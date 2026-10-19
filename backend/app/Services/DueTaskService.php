<?php

namespace App\Services;

use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;

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
            ->where(function ($q) use ($user) {
                $q->where('assignee_id', $user->id)
                  ->orWhereHas('assignees', fn($sq) => $sq->where('users.id', $user->id));
            })
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

            // 1. Check Overdue (due date has passed)
            if ($now->isAfter($dueDate) && !$now->isSameDay($dueDate)) {
                $msg = "Công việc \"{$task->title}\" đã quá hạn (" . $dueDate->format('d/m/Y') . ")";
                NotificationService::send($user, 'overdue', $msg, $task, null, $board, extraData: [
                    'due_date' => $task->due_date,
                ]);
            }
            // 2. Check Approaching Due (due today or within 24 hours)
            elseif ($now->isSameDay($dueDate) || ($now->diffInHours($dueDate, false) > 0 && $now->diffInHours($dueDate, false) <= 24)) {
                $msg = "Công việc \"{$task->title}\" sắp đến hạn (" . $dueDate->format('d/m/Y') . ")";
                NotificationService::send($user, 'due_soon', $msg, $task, null, $board, extraData: [
                    'due_date' => $task->due_date,
                ]);
            }
        }
    }
}
