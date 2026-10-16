<?php

namespace App\Services;

use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DueTaskService
{
    /**
     * Check and send due date notifications for a specific user in real-time.
     */
    public static function checkDueTasksForUser(User $user): void
    {
        date_default_timezone_set('Asia/Ho_Chi_Minh');
        $now = Carbon::now('Asia/Ho_Chi_Minh');

        $tasks = Task::with('column.board')
            ->where('assignee_id', $user->id)
            ->whereNotNull('due_date')
            ->get();

        foreach ($tasks as $task) {
            if (!$task->column || !$task->column->board) {
                continue;
            }

            // Skip if task is in a completed/done column
            $colTitle = mb_strtolower($task->column->title);
            if (str_contains($colTitle, 'hoàn thành') || str_contains($colTitle, 'done') || str_contains($colTitle, 'completed')) {
                continue;
            }

            if ($task->completed_at) {
                continue;
            }

            $dueDate = Carbon::parse($task->due_date, 'Asia/Ho_Chi_Minh');
            $board = $task->column->board;
            $boardTitle = $board->name ?? $board->title ?? 'Bảng công việc';

            // 1. Check Overdue (due date is in past days)
            if ($now->isAfter($dueDate) && !$now->isSameDay($dueDate)) {
                self::notifyIfNotExists($user, $task, $board->id, $boardTitle, 'overdue', \App\Notifications\TaskOverdueNotification::class);
            }
            // 2. Check Due Today (due date is today)
            elseif ($now->isSameDay($dueDate)) {
                self::notifyIfNotExists($user, $task, $board->id, $boardTitle, 'due_today', \App\Notifications\TaskDueTodayNotification::class);
            }
            // 3. Check Approaching Due (within 24 hours)
            elseif ($now->copy()->addDay()->isSameDay($dueDate) || ($now->diffInHours($dueDate, false) > 0 && $now->diffInHours($dueDate, false) <= 24)) {
                self::notifyIfNotExists($user, $task, $board->id, $boardTitle, 'approaching_due', \App\Notifications\TaskApproachingDueNotification::class);
            }
        }
    }

    private static function notifyIfNotExists(User $user, Task $task, $boardId, string $boardTitle, string $type, string $notificationClass): void
    {
        // Check preferences
        $prefs = $user->notification_preferences ?? [];
        if (isset($prefs[$type]) && $prefs[$type] === false) {
            return;
        }

        // Avoid duplicate notification for the exact same task & type
        $exists = DB::table('notifications')
            ->where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->where('data', 'LIKE', '%"task_id":'.$task->id.'%')
            ->where('data', 'LIKE', '%"type":"'.$type.'"%')
            ->exists();

        if (!$exists) {
            $user->notify(new $notificationClass($task, $boardId, $boardTitle));
        }
    }
}
