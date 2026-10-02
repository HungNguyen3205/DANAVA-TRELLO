<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkspaceController extends Controller
{
    private function ensureMember(Request $request, Workspace $workspace): void
    {
        abort_unless(
            $workspace->members()->where('user_id', $request->user()->id)->exists(),
            403,
            'Forbidden'
        );
    }

    public function index(Request $request)
    {
        // Get all workspaces the user is a member of
        $workspaces = $request->user()->workspaces()->with('boards')->get();
        return response()->json($workspaces);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $workspace = Workspace::create([
            'name' => $request->name,
            'owner_id' => $request->user()->id,
        ]);

        // Attach the user as admin
        $workspace->members()->attach($request->user()->id, ['role' => 'admin']);

        return response()->json($workspace->load('boards'), 201);
    }

    public function show(Request $request, Workspace $workspace)
    {
        $this->ensureMember($request, $workspace);
        $userId = $request->user()->id;
        
        $workspaceMember = \Illuminate\Support\Facades\DB::table('workspace_members')
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $userId)
            ->first();
            
        $role = $workspaceMember ? $workspaceMember->role : 'member';

        $workspace->load(['boards' => function ($query) use ($userId, $role) {
            if ($role !== 'admin') {
                $query->whereHas('members', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                });
            }
        }, 'members']);
        
        $boardIds = $workspace->boards->pluck('id')->toArray();
        $memberships = \Illuminate\Support\Facades\DB::table('board_members')
            ->whereIn('board_id', $boardIds)
            ->where('user_id', $userId)
            ->get()
            ->keyBy('board_id');

        $workspace->boards->transform(function ($board) use ($memberships) {
            $member = $memberships->get($board->id);
            $board->is_starred = $member ? (bool)$member->is_starred : false;
            return $board;
        });
        
        // Calculate basic statistics
        $boards = $workspace->boards;
        $totalBoards = $boards->count();
        $totalMembers = $workspace->members->count();
        
        $cacheKey = "workspace_stats_{$workspace->id}_{$userId}_{$role}";
        $stats = \Illuminate\Support\Facades\Cache::remember($cacheKey, 60, function() use ($workspace, $userId, $role) {
            $taskQuery = \Illuminate\Support\Facades\DB::table('tasks')
                ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
                ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
                ->where('boards.workspace_id', $workspace->id)
                ->whereNull('tasks.deleted_at');
                
            if ($role !== 'admin') {
                $taskQuery->join('board_members', function($join) use ($userId) {
                    $join->on('boards.id', '=', 'board_members.board_id')
                         ->where('board_members.user_id', '=', $userId);
                });
            }
                
            $tasks = $taskQuery->select('tasks.id', 'tasks.due_date', 'kanban_columns.title as column_name')
                ->get();
                
            $totalTasks = $tasks->count();
            $completedTasks = $tasks->filter(function($task) {
                return strtolower($task->column_name) === 'hoàn thành' || strtolower($task->column_name) === 'done';
            })->count();
            
            $overdueTasks = $tasks->filter(function($task) {
                return $task->due_date && \Carbon\Carbon::parse($task->due_date)->isPast() && strtolower($task->column_name) !== 'hoàn thành' && strtolower($task->column_name) !== 'done';
            })->count();

            return [
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'overdue_tasks' => $overdueTasks,
                'completion_rate' => $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100) : 0
            ];
        });

        $workspaceData = $workspace->toArray();
        $workspaceData['stats'] = array_merge([
            'total_boards' => $totalBoards,
            'total_members' => $totalMembers,
        ], $stats);

        return response()->json($workspaceData);
    }

    public function members(Request $request, Workspace $workspace)
    {
        $this->ensureMember($request, $workspace);
        
        // Return all system users for now so they can be invited
        // In a real app, this might just be workspace members, but to allow inviting:
        $users = \App\Models\User::all();
        return response()->json($users);
    }

    public function dashboard(Request $request, Workspace $workspace)
    {
        $this->ensureMember($request, $workspace);

        $range = max(7, min((int) $request->query('days', 14), 90));
        $today = Carbon::today();
        $rangeStart = $today->copy()->subDays($range - 1);

        $userId = $request->user()->id;
        $workspaceMember = \Illuminate\Support\Facades\DB::table('workspace_members')
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $userId)
            ->first();
            
        $role = $workspaceMember ? $workspaceMember->role : 'member';

        $cacheKey = "workspace_dashboard_{$workspace->id}_{$userId}_{$range}_" . ($role === 'admin' ? 'admin' : 'member');
        
        $dashboardData = \Illuminate\Support\Facades\Cache::remember($cacheKey, 300, function() use ($workspace, $userId, $role, $range, $rangeStart, $today) {
            $query = DB::table('tasks')
                ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
                ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
                ->leftJoin('users as assignees', 'tasks.assignee_id', '=', 'assignees.id')
                ->where('boards.workspace_id', $workspace->id)
                ->whereNull('tasks.deleted_at');
                
            if ($role !== 'admin') {
                $query->join('board_members', function($join) use ($userId) {
                    $join->on('boards.id', '=', 'board_members.board_id')
                         ->where('board_members.user_id', '=', $userId);
                });
            }

            $tasks = $query->select([
                    'tasks.id',
                    'tasks.title',
                    'tasks.priority',
                    'tasks.due_date',
                    'tasks.created_at',
                    'tasks.completed_at',
                    'tasks.assignee_id',
                    'assignees.name as assignee_name',
                    'boards.id as board_id',
                    'boards.name as board_name',
                    'kanban_columns.title as column_name',
                    'kanban_columns.color as column_color',
                ])
                ->get();

            $isCompleted = static function ($task): bool {
                $column = mb_strtolower(trim((string) $task->column_name));
                return !empty($task->completed_at)
                    || in_array($column, ['done', 'hoàn thành', 'completed'], true);
            };

            $totalTasks = $tasks->count();
            $completedTasks = $tasks->filter($isCompleted)->count();
            $overdueTasks = $tasks->filter(function ($task) use ($today, $isCompleted) {
                return $task->due_date
                    && Carbon::parse($task->due_date)->lt($today)
                    && !$isCompleted($task);
            })->count();
            $dueSoonTasks = $tasks->filter(function ($task) use ($today, $isCompleted) {
                if (!$task->due_date || $isCompleted($task)) {
                    return false;
                }

                $due = Carbon::parse($task->due_date);
                return $due->gte($today) && $due->lte($today->copy()->addDays(7));
            })->count();

            $statusPalette = ['#7C5CFC', '#4F7DF3', '#F2B83F', '#37BC8F', '#F97316', '#EC4899'];
            $statusDistribution = $tasks
                ->groupBy('column_name')
                ->map(function ($items, $name) use ($statusPalette) {
                    static $index = 0;
                    $color = $items->first()->column_color ?: $statusPalette[$index % count($statusPalette)];
                    $index++;

                    return ['name' => $name, 'value' => $items->count(), 'color' => $color];
                })
                ->values();

            $priorityPalette = [
                'Khẩn cấp' => '#EF4444',
                'Cao' => '#F97316',
                'Bình thường' => '#4F7DF3',
                'Thấp' => '#94A3B8',
            ];
            $priorityDistribution = $tasks
                ->groupBy(fn ($task) => $task->priority ?: 'Bình thường')
                ->map(fn ($items, $name) => [
                    'name' => $name,
                    'value' => $items->count(),
                    'color' => $priorityPalette[$name] ?? '#8B5CF6',
                ])
                ->values();

            $activityTrend = collect(range(0, $range - 1))->map(function ($offset) use ($rangeStart, $tasks) {
                $date = $rangeStart->copy()->addDays($offset);
                $dateKey = $date->toDateString();

                return [
                    'date' => $dateKey,
                    'label' => $date->format('d/m'),
                    'created' => $tasks->filter(fn ($task) => Carbon::parse($task->created_at)->toDateString() === $dateKey)->count(),
                    'completed' => $tasks->filter(fn ($task) => $task->completed_at && Carbon::parse($task->completed_at)->toDateString() === $dateKey)->count(),
                ];
            });

            $boardProgress = $workspace->boards()->get()->map(function ($board) use ($tasks, $isCompleted) {
                $boardTasks = $tasks->where('board_id', $board->id);
                $completed = $boardTasks->filter($isCompleted)->count();
                $total = $boardTasks->count();

                return [
                    'id' => $board->id,
                    'name' => $board->name,
                    'total' => $total,
                    'completed' => $completed,
                    'progress' => $total ? round(($completed / $total) * 100) : 0,
                    'color' => $board->color,
                ];
            })->sortByDesc('total')->values();

            $workload = $tasks
                ->reject($isCompleted)
                ->groupBy(fn ($task) => $task->assignee_name ?: 'Chưa phân công')
                ->map(fn ($items, $name) => [
                    'name' => $name,
                    'tasks' => $items->count(),
                    'overdue' => $items->filter(fn ($task) => $task->due_date && Carbon::parse($task->due_date)->lt($today))->count(),
                ])
                ->sortByDesc('tasks')
                ->take(8)
                ->values();

            $upcomingDeadlines = $tasks
                ->filter(function ($task) use ($today, $isCompleted) {
                    return $task->due_date
                        && !$isCompleted($task)
                        && Carbon::parse($task->due_date)->gte($today);
                })
                ->sortBy('due_date')
                ->take(6)
                ->map(fn ($task) => [
                    'id' => $task->id,
                    'title' => $task->title,
                    'board' => $task->board_name,
                    'assignee' => $task->assignee_name ?: 'Chưa phân công',
                    'priority' => $task->priority,
                    'due_date' => $task->due_date,
                    'days_left' => $today->diffInDays(Carbon::parse($task->due_date), false),
                ])
                ->values();

            $recentActivity = DB::table('activity_logs')
                ->join('tasks', 'activity_logs.task_id', '=', 'tasks.id')
                ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
                ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
                ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
                ->where('boards.workspace_id', $workspace->id)
                ->orderByDesc('activity_logs.created_at')
                ->limit(8)
                ->get([
                    'activity_logs.id',
                    'activity_logs.action',
                    'activity_logs.created_at',
                    'tasks.title as task_title',
                    'boards.name as board_name',
                    'users.name as user_name',
                ]);

            $sprintSummary = DB::table('board_sprints')
                ->join('boards', 'board_sprints.board_id', '=', 'boards.id')
                ->where('boards.workspace_id', $workspace->id)
                ->select('board_sprints.status')
                ->get()
                ->countBy('status');

            return [
                'workspace' => [
                    'id' => $workspace->id,
                    'name' => $workspace->name,
                ],
                'range_days' => $range,
                'summary' => [
                    'total_boards' => $workspace->boards()->count(),
                    'total_members' => $workspace->members()->count(),
                    'total_tasks' => $totalTasks,
                    'completed_tasks' => $completedTasks,
                    'active_tasks' => max(0, $totalTasks - $completedTasks),
                    'overdue_tasks' => $overdueTasks,
                    'due_soon_tasks' => $dueSoonTasks,
                    'completion_rate' => $totalTasks ? round(($completedTasks / $totalTasks) * 100) : 0,
                ],
                'activity_trend' => $activityTrend,
                'status_distribution' => $statusDistribution,
                'priority_distribution' => $priorityDistribution,
                'board_progress' => $boardProgress,
                'workload' => $workload,
                'upcoming_deadlines' => $upcomingDeadlines,
                'recent_activity' => $recentActivity,
                'sprint_summary' => [
                    'pending' => $sprintSummary->get('pending', 0),
                    'active' => $sprintSummary->get('active', 0),
                    'completed' => $sprintSummary->get('completed', 0),
                ],
            ];
        });

        return response()->json($dashboardData);
    }
}
