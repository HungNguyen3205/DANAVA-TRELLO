<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\Workspace;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PersonalDashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $tz = 'Asia/Ho_Chi_Minh';
        $todayStart = Carbon::now($tz)->startOfDay()->utc();
        $todayEnd = Carbon::now($tz)->endOfDay()->utc();
        $upcomingEnd = Carbon::now($tz)->addDays(7)->endOfDay()->utc();

        $baseTaskQuery = Task::where('assignee_id', $user->id)
                             ->with(['column.board.workspace', 'assignee'])
                             ->inUserWorkspaces($user->id);

        $cacheKey = "personal_dashboard_{$user->id}";
        $tasks = \Illuminate\Support\Facades\Cache::remember($cacheKey, 60, function() use ($user, $baseTaskQuery) {
            return $baseTaskQuery->get();
        });

        $dueToday = 0;
        $overdue = 0;
        $inProgress = 0;

        $focusTasks = [];
        $attentionItems = [];
        $todaySchedule = [];

        foreach ($tasks as $task) {
            $isCompleted = false;
            $colName = mb_strtolower(trim($task->column->title ?? ''));
            if ($task->completed_at || in_array($colName, ['done', 'hoàn thành', 'completed'])) {
                $isCompleted = true;
            }

            $hasDue = $task->due_date ? true : false;
            $due = $hasDue ? Carbon::parse($task->due_date) : null;
            
            $status = 'todo';
            if ($isCompleted) {
                $status = 'completed';
            } elseif (in_array($colName, ['in progress', 'đang thực hiện', 'đang làm', 'doing'])) {
                $status = 'in_progress';
                $inProgress++;
            }

            if (!$isCompleted && $hasDue) {
                if ($due->isBetween($todayStart, $todayEnd)) {
                    $dueToday++;
                    $attentionItems[] = [
                        'id' => $task->id,
                        'type' => 'due_today',
                        'message' => 'Đến hạn hôm nay',
                        'task_title' => $task->title,
                        'board_id' => $task->column?->board?->id ?? null,
                        'workspace_id' => $task->column?->board?->workspace?->id ?? null,
                        'created_at' => $task->created_at,
                    ];
                } elseif ($due->isBefore($todayStart)) {
                    $overdue++;
                    $attentionItems[] = [
                        'id' => $task->id,
                        'type' => 'overdue',
                        'message' => 'Đã quá hạn',
                        'task_title' => $task->title,
                        'board_id' => $task->column?->board?->id ?? null,
                        'workspace_id' => $task->column?->board?->workspace?->id ?? null,
                        'created_at' => $task->created_at,
                    ];
                } elseif ($due->isBetween($todayEnd, $upcomingEnd)) {
                    $attentionItems[] = [
                        'id' => $task->id,
                        'type' => 'due_soon',
                        'message' => 'Sắp đến hạn',
                        'task_title' => $task->title,
                        'board_id' => $task->column?->board?->id ?? null,
                        'workspace_id' => $task->column?->board?->workspace?->id ?? null,
                        'created_at' => $task->created_at,
                    ];
                }
            }

            if (mb_strtolower(trim($task->priority ?? '')) === 'khẩn cấp' && !$isCompleted) {
                $attentionItems[] = [
                    'id' => $task->id,
                    'type' => 'urgent',
                    'message' => 'Khẩn cấp',
                    'task_title' => $task->title,
                    'board_id' => $task->column?->board?->id ?? null,
                    'workspace_id' => $task->column?->board?->workspace?->id ?? null,
                    'created_at' => $task->created_at,
                ];
            }

            $formattedTask = [
                'id' => $task->id,
                'title' => $task->title,
                'workspace_name' => $task->column?->board?->workspace?->name ?? '',
                'board_name' => $task->column?->board?->name ?? '',
                'board_id' => $task->column?->board?->id ?? null,
                'workspace_id' => $task->column?->board?->workspace?->id ?? null,
                'status' => $status,
                'priority' => $task->priority,
                'due_date' => $task->due_date,
                'start_date' => $task->start_date,
                'assignee' => [
                    'name' => $task->assignee?->name ?? '',
                ]
            ];

            $focusTasks[] = $formattedTask;

            if ($hasDue && $due->isBetween($todayStart, $todayEnd)) {
                $todaySchedule[] = $formattedTask;
            }
        }

        // Sort attention items by type priority (overdue > urgent > due_today > due_soon)
        usort($attentionItems, function($a, $b) {
            $order = ['overdue' => 1, 'urgent' => 2, 'due_today' => 3, 'due_soon' => 4];
            return ($order[$a['type']] ?? 9) <=> ($order[$b['type']] ?? 9);
        });

        // Limit attention items
        $attentionItems = array_slice($attentionItems, 0, 5);

        // Sort today schedule by due_date time
        usort($todaySchedule, function($a, $b) {
            return strtotime($a['due_date']) <=> strtotime($b['due_date']);
        });

        // Recent Workspaces
        $recentWorkspaces = clone $user->workspaces()
            ->withCount(['boards', 'members'])
            ->limit(5)
            ->get();
            
        $recentBoards = clone \DB::table('boards')
            ->join('workspace_members', 'boards.workspace_id', '=', 'workspace_members.workspace_id')
            ->where('workspace_members.user_id', $user->id)
            ->select('boards.id', 'boards.name', 'boards.color', 'boards.workspace_id')
            ->limit(4)
            ->get();

        $starredBoards = clone \DB::table('boards')
            ->join('board_members', 'boards.id', '=', 'board_members.board_id')
            ->where('board_members.user_id', $user->id)
            ->where('board_members.is_starred', true)
            ->select('boards.id', 'boards.name', 'boards.color', 'boards.workspace_id')
            ->get();

        $recentActivities = ActivityLog::where('user_id', $user->id)
            ->with(['task.column.board.workspace'])
            ->orderBy('created_at', 'desc')
            ->limit(8)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'created_at' => $log->created_at,
                    'task_title' => $log->task?->title ?? null,
                    'board_id' => $log->task?->column?->board?->id ?? null,
                    'board_name' => $log->task?->column?->board?->name ?? null,
                    'workspace_name' => $log->task?->column?->board?->workspace?->name ?? null,
                ];
            });

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'system_role' => $user->system_role,
            ],
            'summary' => [
                'due_today' => $dueToday,
                'overdue' => $overdue,
                'in_progress' => $inProgress,
            ],
            'focus_tasks' => $focusTasks,
            'attention_items' => $attentionItems,
            'today_schedule' => $todaySchedule,
            'recent_workspaces' => $recentWorkspaces,
            'recent_boards' => $recentBoards,
            'starred_boards' => $starredBoards,
            'recent_activities' => $recentActivities,
        ]);
    }
}
