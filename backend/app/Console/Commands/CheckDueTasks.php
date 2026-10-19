<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Task;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;

class CheckDueTasks extends Command
{
    protected $signature = 'notifications:check-due-tasks';
    protected $description = 'Check due dates of tasks and send notifications';

    public function handle()
    {
        date_default_timezone_set('Asia/Ho_Chi_Minh');
        $now = Carbon::now('Asia/Ho_Chi_Minh');

        $tasks = Task::with(['column.board', 'assignees', 'assignee'])
            ->whereNotNull('due_date')
            ->whereNull('completed_at')
            ->get();

        $count = 0;

        foreach ($tasks as $task) {
            if (!$task->column || !$task->column->board) {
                continue;
            }

            // Skip if task is in a completed/done column
            $colTitle = mb_strtolower($task->column->title);
            if (str_contains($colTitle, 'hoàn thành') || str_contains($colTitle, 'done') || str_contains($colTitle, 'completed')) {
                continue;
            }

            $dueDate = Carbon::parse($task->due_date, 'Asia/Ho_Chi_Minh');
            $board = $task->column->board;

            // Collect all assigned users
            $assignees = $task->assignees->all();
            if ($task->assignee && !in_array($task->assignee->id, array_map(fn($u) => $u->id, $assignees))) {
                $assignees[] = $task->assignee;
            }

            foreach ($assignees as $user) {
                // Check Overdue
                if ($now->isAfter($dueDate) && !$now->isSameDay($dueDate)) {
                    $msg = "Công việc \"{$task->title}\" đã quá hạn (" . $dueDate->format('d/m/Y') . ")";
                    if (NotificationService::send($user, 'overdue', $msg, $task, null, $board, extraData: ['due_date' => $task->due_date])) {
                        $count++;
                    }
                } 
                // Check Approaching Due (due today or within 24 hours)
                elseif ($now->isSameDay($dueDate) || ($now->diffInHours($dueDate, false) > 0 && $now->diffInHours($dueDate, false) <= 24)) {
                    $msg = "Công việc \"{$task->title}\" sắp đến hạn (" . $dueDate->format('d/m/Y') . ")";
                    if (NotificationService::send($user, 'due_soon', $msg, $task, null, $board, extraData: ['due_date' => $task->due_date])) {
                        $count++;
                    }
                }
            }
        }
        
        $this->info("Checked due tasks successfully. Sent {$count} notification(s).");
    }
}
