<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class CheckDueTasks extends Command
{
    protected $signature = 'notifications:check-due-tasks';
    protected $description = 'Check due dates of tasks and send notifications';

    public function handle()
    {
        // Set timezone
        date_default_timezone_set('Asia/Ho_Chi_Minh');
        $now = Carbon::now('Asia/Ho_Chi_Minh');

        $tasks = Task::with('column.board', 'assignee')
            ->whereNotNull('assignee_id')
            ->whereNotNull('due_date')
            ->get();

        foreach ($tasks as $task) {
            // Ignore if task is in a "done" column
            $colTitle = mb_strtolower($task->column->title);
            if (str_contains($colTitle, 'hoàn thành') || str_contains($colTitle, 'done')) {
                continue;
            }

            $dueDate = Carbon::parse($task->due_date, 'Asia/Ho_Chi_Minh');
            $user = $task->assignee;
            if (!$user || !$task->column->board) continue;

            $board = $task->column->board;

            // Check Overdue
            if ($now->isAfter($dueDate) && !$now->isSameDay($dueDate)) {
                $this->notifyIfNotExists($user, $task, $board, 'overdue', \App\Notifications\TaskOverdueNotification::class);
            } 
            // Check Due Today
            elseif ($now->isSameDay($dueDate)) {
                $this->notifyIfNotExists($user, $task, $board, 'due_today', \App\Notifications\TaskDueTodayNotification::class);
            } 
            // Check Approaching Due (24 hours before)
            elseif ($now->copy()->addDay()->isSameDay($dueDate) || ($now->diffInHours($dueDate, false) > 0 && $now->diffInHours($dueDate, false) <= 24)) {
                $this->notifyIfNotExists($user, $task, $board, 'approaching_due', \App\Notifications\TaskApproachingDueNotification::class);
            }
        }
        
        $this->info('Checked due tasks successfully.');
    }

    private function notifyIfNotExists($user, $task, $board, $type, $notificationClass)
    {
        // Check preferences
        $prefs = $user->notification_preferences ?? [];
        if (isset($prefs[$type]) && $prefs[$type] === false) {
            return;
        }

        // Check if user already has this exact notification for this task
        $exists = DB::table('notifications')
            ->where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->where('data', 'LIKE', '%"task_id":'.$task->id.'%')
            ->where('data', 'LIKE', '%"type":"'.$type.'"%')
            ->exists();

        if (!$exists) {
            $user->notify(new $notificationClass($task, $board->id, $board->title));
        }
    }
}
