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

        $cacheKey = "personal_dashboard_optimized_{$user->id}";
        $data = \Illuminate\Support\Facades\Cache::remember($cacheKey, 60, function() use ($user, $baseTaskQuery, $todayStart, $todayEnd, $upcomingEnd) {
            
            $dueToday = (clone $baseTaskQuery)->pending()->whereBetween('due_date', [$todayStart, $todayEnd])->count();
            $overdue = (clone $baseTaskQuery)->pending()->where('due_date', '<', $todayStart)->count();
            
            $inProgressColNames = ['in progress', 'đang thực hiện', 'đang làm', 'doing'];
            $inProgress = (clone $baseTaskQuery)->whereHas('column', function($q) use ($inProgressColNames) {
                $q->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), $inProgressColNames);
            })->count();

            $attentionItems = [];
            
            $overdueTasks = (clone $baseTaskQuery)->pending()->where('due_date', '<', $todayStart)->limit(5)->get();
            foreach ($overdueTasks as $t) {
                $attentionItems[] = [
                    'id' => $t->id, 'type' => 'overdue', 'message' => 'Đã quá hạn',
                    'task_title' => $t->title, 'board_id' => $t->column?->board?->id ?? null,
                    'workspace_id' => $t->column?->board?->workspace?->id ?? null, 'created_at' => $t->created_at,
                ];
            }

            $urgentTasks = (clone $baseTaskQuery)->pending()->where(\Illuminate\Support\Facades\DB::raw('LOWER(priority)'), 'khẩn cấp')->limit(5)->get();
            foreach ($urgentTasks as $t) {
                $attentionItems[] = [
                    'id' => $t->id, 'type' => 'urgent', 'message' => 'Khẩn cấp',
                    'task_title' => $t->title, 'board_id' => $t->column?->board?->id ?? null,
                    'workspace_id' => $t->column?->board?->workspace?->id ?? null, 'created_at' => $t->created_at,
                ];
            }
            
            $dueTodayTasksList = (clone $baseTaskQuery)->pending()->whereBetween('due_date', [$todayStart, $todayEnd])->limit(5)->get();
            foreach ($dueTodayTasksList as $t) {
                $attentionItems[] = [
                    'id' => $t->id, 'type' => 'due_today', 'message' => 'Đến hạn hôm nay',
                    'task_title' => $t->title, 'board_id' => $t->column?->board?->id ?? null,
                    'workspace_id' => $t->column?->board?->workspace?->id ?? null, 'created_at' => $t->created_at,
                ];
            }

            $dueSoonTasks = (clone $baseTaskQuery)->pending()->whereBetween('due_date', [$todayEnd, $upcomingEnd])->limit(5)->get();
            foreach ($dueSoonTasks as $t) {
                $attentionItems[] = [
                    'id' => $t->id, 'type' => 'due_soon', 'message' => 'Sắp đến hạn',
                    'task_title' => $t->title, 'board_id' => $t->column?->board?->id ?? null,
                    'workspace_id' => $t->column?->board?->workspace?->id ?? null, 'created_at' => $t->created_at,
                ];
            }

            // Deduplicate attention items
            $uniqueAttentions = [];
            $seenAttentions = [];
            foreach ($attentionItems as $item) {
                if (!isset($seenAttentions[$item['id']])) {
                    $seenAttentions[$item['id']] = true;
                    $uniqueAttentions[] = $item;
                }
            }

            usort($uniqueAttentions, function($a, $b) {
                $order = ['overdue' => 1, 'urgent' => 2, 'due_today' => 3, 'due_soon' => 4];
                return ($order[$a['type']] ?? 9) <=> ($order[$b['type']] ?? 9);
            });
            $attentionItems = array_slice($uniqueAttentions, 0, 5);

            $formatTask = function($task, $status) {
                return [
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
                        'id' => $task->assignee?->id,
                        'name' => $task->assignee?->name ?? '',
                        'avatar' => $task->assignee?->avatar ?? null
                    ]
                ];
            };

            $todaySchedule = [];
            $todayScheduleTasks = (clone $baseTaskQuery)->pending()->whereBetween('due_date', [$todayStart, $todayEnd])->orderBy('due_date', 'asc')->limit(10)->get();
            foreach ($todayScheduleTasks as $t) {
                $todaySchedule[] = $formatTask($t, 'todo');
            }

            $focusTasks = [];
            $completedTasks = (clone $baseTaskQuery)->completed()->orderBy('updated_at', 'desc')->limit(7)->get();
            foreach ($completedTasks as $t) $focusTasks[] = $formatTask($t, 'completed');

            $inProgressTasksList = (clone $baseTaskQuery)->pending()->whereHas('column', function($q) use ($inProgressColNames) {
                $q->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), $inProgressColNames);
            })->orderBy('updated_at', 'desc')->limit(7)->get();
            foreach ($inProgressTasksList as $t) $focusTasks[] = $formatTask($t, 'in_progress');

            $todoTasksList = (clone $baseTaskQuery)->pending()->whereHas('column', function($q) use ($inProgressColNames) {
                $q->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), array_merge($inProgressColNames, ['done', 'hoàn thành', 'completed']));
            })->orderBy('updated_at', 'desc')->limit(7)->get();
            foreach ($todoTasksList as $t) $focusTasks[] = $formatTask($t, 'todo');

            return [
                'dueToday' => $dueToday,
                'overdue' => $overdue,
                'inProgress' => $inProgress,
                'attentionItems' => $attentionItems,
                'todaySchedule' => $todaySchedule,
                'focusTasks' => $focusTasks
            ];
        });

        $dueToday = $data['dueToday'];
        $overdue = $data['overdue'];
        $inProgress = $data['inProgress'];
        $attentionItems = $data['attentionItems'];
        $todaySchedule = $data['todaySchedule'];
        $focusTasks = $data['focusTasks'];

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
