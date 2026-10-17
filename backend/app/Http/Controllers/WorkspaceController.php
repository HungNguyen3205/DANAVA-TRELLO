<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Models\Board;
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
        $user = $request->user();
        // Get all workspaces the user is a member of (excluding other users' personal workspaces)
        $workspaces = $user->workspaces()
            ->where(function ($q) use ($user) {
                $q->where('workspaces.owner_id', $user->id)
                  ->orWhere('workspaces.name', 'not like', 'Không gian của %');
            })
            ->with('boards')
            ->get();
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
                
            $totalTasks = (clone $taskQuery)->count();
            
            $completedTitles = ['done', 'hoàn thành', 'completed'];
            $completedTasks = (clone $taskQuery)
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(kanban_columns.title)'), $completedTitles)
                ->count();
            
            $overdueTasks = (clone $taskQuery)
                ->whereNotNull('tasks.due_date')
                ->where('tasks.due_date', '<', \Carbon\Carbon::today())
                ->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(kanban_columns.title)'), $completedTitles)
                ->count();

            return [
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'overdue_tasks' => $overdueTasks,
                'completion_rate' => $totalTasks > 0 ? (int) round(($completedTasks / $totalTasks) * 100) : 0
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
                    'users.avatar as user_avatar',
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

    public function globalDashboard(Request $request)
    {
        $range = max(7, min((int) $request->query('days', 14), 90));
        $today = Carbon::today();
        $rangeStart = $today->copy()->subDays($range - 1);

        $user = $request->user();
        $userId = $user->id;
        $isSystemAdmin = in_array($user->system_role ?? '', ['system_admin', 'admin'], true);

        // Scope: 'personal' (default, focuses strictly on the logged in user) or 'team' (company-wide)
        $scope = $request->query('scope', 'personal');
        if (!in_array($scope, ['personal', 'team'], true)) {
            $scope = 'personal';
        }

        // Get all boards accessible to user
        $boardsQuery = Board::query();
        if (!$isSystemAdmin) {
            $boardsQuery->whereHas('members', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            });
        }
        $boards = $boardsQuery->get();
        $boardIds = $boards->pluck('id')->toArray();

        $cacheKey = "global_dashboard_{$userId}_{$range}_{$scope}_" . ($isSystemAdmin ? 'admin' : 'member');

        $dashboardData = \Illuminate\Support\Facades\Cache::remember($cacheKey, 60, function() use ($boards, $boardIds, $userId, $range, $rangeStart, $today, $scope) {
            if (empty($boardIds)) {
                return [
                    'range_days' => $range,
                    'summary' => [
                        'total_boards' => 0,
                        'total_members' => 0,
                        'total_tasks' => 0,
                        'completed_tasks' => 0,
                        'active_tasks' => 0,
                        'overdue_tasks' => 0,
                        'due_soon_tasks' => 0,
                        'completion_rate' => 0,
                    ],
                    'activity_trend' => [],
                    'status_distribution' => [],
                    'priority_distribution' => [],
                    'board_progress' => [],
                    'workload' => [],
                    'upcoming_deadlines' => [],
                    'recent_activity' => [],
                    'sprint_summary' => ['pending' => 0, 'active' => 0, 'completed' => 0],
                ];
            }

            $tasksQuery = DB::table('tasks')
                ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
                ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
                ->leftJoin('users as assignees', 'tasks.assignee_id', '=', 'assignees.id')
                ->whereIn('boards.id', $boardIds)
                ->whereNull('tasks.deleted_at');

            if ($scope === 'personal') {
                $tasksQuery->where('tasks.assignee_id', $userId);
            }

            $tasks = $tasksQuery->select([
                'tasks.id',
                'tasks.title',
                'tasks.priority',
                'tasks.due_date',
                'tasks.created_at',
                'tasks.updated_at',
                'tasks.completed_at',
                'tasks.assignee_id',
                'assignees.name as assignee_name',
                'assignees.avatar as assignee_avatar',
                'boards.id as board_id',
                'boards.public_id as board_public_id',
                'boards.name as board_name',
                'boards.color as board_color',
                'kanban_columns.title as column_name',
                'kanban_columns.color as column_color',
            ])->get();

            $isCompleted = static function ($task): bool {
                $column = mb_strtolower(trim((string) $task->column_name));
                return !empty($task->completed_at)
                    || in_array($column, ['done', 'hoàn thành', 'completed', 'đã xong'], true);
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

            // Status distribution
            $statusPalette = ['#7C5CFC', '#38BDF8', '#F59E0B', '#10B981', '#EC4899', '#6366F1'];
            $statusDistribution = $tasks
                ->groupBy('column_name')
                ->map(function ($items, $name) use ($statusPalette) {
                    static $index = 0;
                    $color = $items->first()->column_color ?: $statusPalette[$index % count($statusPalette)];
                    $index++;
                    return ['name' => $name, 'value' => $items->count(), 'color' => $color];
                })
                ->values();

            // Priority distribution
            $priorityPalette = [
                'Khẩn cấp' => '#EF4444',
                'Cao' => '#F97316',
                'Bình thường' => '#3B82F6',
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

            // Activity trend (created vs completed)
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

            // Board progress
            $boardProgress = $boards->map(function ($board) use ($tasks, $isCompleted) {
                $boardTasks = $tasks->where('board_id', $board->id);
                $total = $boardTasks->count();
                $completed = $boardTasks->filter($isCompleted)->count();

                return [
                    'id' => $board->id,
                    'public_id' => $board->public_id,
                    'name' => $board->name,
                    'total' => $total,
                    'completed' => $completed,
                    'progress' => $total ? round(($completed / $total) * 100) : 0,
                    'color' => $board->color,
                ];
            })->filter(fn ($b) => $scope === 'team' || $b['total'] > 0)->sortByDesc('total')->values();

            // Workload: in personal mode, group by board name; in team mode, group by assignee
            if ($scope === 'personal') {
                $workload = $tasks
                    ->reject($isCompleted)
                    ->groupBy(fn ($task) => $task->board_name ?: 'Khác')
                    ->map(fn ($items, $name) => [
                        'name' => $name,
                        'tasks' => $items->count(),
                        'overdue' => $items->filter(fn ($task) => $task->due_date && Carbon::parse($task->due_date)->lt($today))->count(),
                    ])
                    ->sortByDesc('tasks')
                    ->take(8)
                    ->values();
            } else {
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
            }

            // Upcoming deadlines
            $upcomingDeadlines = $tasks
                ->filter(function ($task) use ($today, $isCompleted) {
                    return $task->due_date
                        && !$isCompleted($task)
                        && Carbon::parse($task->due_date)->gte($today);
                })
                ->sortBy('due_date')
                ->take(8)
                ->map(fn ($task) => [
                    'id' => $task->id,
                    'title' => $task->title,
                    'board_id' => $task->board_id,
                    'board' => $task->board_name,
                    'board_public_id' => $task->board_public_id,
                    'assignee' => $task->assignee_name ?: 'Chưa phân công',
                    'assignee_avatar' => $task->assignee_avatar,
                    'priority' => $task->priority,
                    'due_date' => $task->due_date,
                    'days_left' => $today->diffInDays(Carbon::parse($task->due_date), false),
                ])
                ->values();

            // Total unique members
            $totalMembers = DB::table('board_members')
                ->whereIn('board_id', $boardIds)
                ->distinct('user_id')
                ->count('user_id');

            // Recent activity
            $activities = collect();
            $logsQuery = DB::table('activity_logs')
                ->join('tasks', 'activity_logs.task_id', '=', 'tasks.id')
                ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
                ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
                ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
                ->whereIn('boards.id', $boardIds);

            if ($scope === 'personal') {
                $logsQuery->where(function($q) use ($userId) {
                    $q->where('activity_logs.user_id', $userId)
                      ->orWhere('tasks.assignee_id', $userId);
                });
            }

            $logs = $logsQuery
                ->orderByDesc('activity_logs.created_at')
                ->limit(8)
                ->get([
                    'activity_logs.id',
                    'activity_logs.action',
                    'activity_logs.created_at',
                    'tasks.id as task_id',
                    'tasks.title as task_title',
                    'boards.id as board_id',
                    'boards.public_id as board_public_id',
                    'boards.name as board_name',
                    'users.name as user_name',
                    'users.avatar as user_avatar',
                ]);

            foreach ($logs as $log) {
                $activities->push($log);
            }

            // Fallback to comments if few logs
            if ($activities->count() < 6) {
                $commentsQuery = DB::table('task_comments')
                    ->join('tasks', 'task_comments.task_id', '=', 'tasks.id')
                    ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
                    ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
                    ->leftJoin('users', 'task_comments.user_id', '=', 'users.id')
                    ->whereIn('boards.id', $boardIds);

                if ($scope === 'personal') {
                    $commentsQuery->where(function($q) use ($userId) {
                        $q->where('task_comments.user_id', $userId)
                          ->orWhere('tasks.assignee_id', $userId);
                    });
                }

                $comments = $commentsQuery
                    ->orderByDesc('task_comments.created_at')
                    ->limit(6)
                    ->get([
                        'task_comments.id',
                        DB::raw('"commented" as action'),
                        'task_comments.created_at',
                        'tasks.id as task_id',
                        'tasks.title as task_title',
                        'boards.id as board_id',
                        'boards.public_id as board_public_id',
                        'boards.name as board_name',
                        'users.name as user_name',
                        'users.avatar as user_avatar',
                    ]);
                foreach ($comments as $c) {
                    $activities->push($c);
                }
            }

            // Fallback to latest tasks if still few
            if ($activities->count() < 6) {
                $recentTasks = $tasks->sortByDesc('updated_at')->take(6);
                foreach ($recentTasks as $rt) {
                    $activities->push((object)[
                        'id' => 'task-' . $rt->id,
                        'action' => $isCompleted($rt) ? 'completed' : 'updated',
                        'created_at' => $rt->updated_at ?: $rt->created_at,
                        'task_id' => $rt->id,
                        'task_title' => $rt->title,
                        'board_id' => $rt->board_id,
                        'board_public_id' => $rt->board_public_id,
                        'board_name' => $rt->board_name,
                        'user_name' => $rt->assignee_name ?: 'Hệ thống',
                        'user_avatar' => $rt->assignee_avatar,
                    ]);
                }
            }

            return [
                'range_days' => $range,
                'summary' => [
                    'total_boards' => $boards->count(),
                    'total_members' => $totalMembers,
                    'total_tasks' => $totalTasks,
                    'completed_tasks' => $completedTasks,
                    'active_tasks' => $totalTasks - $completedTasks,
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
                'recent_activity' => $activities->values(),
                'sprint_summary' => ['pending' => 0, 'active' => 0, 'completed' => 0],
            ];
        });

        return response()->json(array_merge($dashboardData, [
            'scope' => $scope,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'is_system_admin' => $isSystemAdmin,
        ]));
    }
}
