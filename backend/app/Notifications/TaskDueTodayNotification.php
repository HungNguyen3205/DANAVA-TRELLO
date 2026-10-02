<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\Task;

class TaskDueTodayNotification extends Notification
{
    use Queueable;

    public $task;
    public $boardId;
    public $boardTitle;

    public function __construct(Task $task, $boardId, $boardTitle)
    {
        $this->task = $task;
        $this->boardId = $boardId;
        $this->boardTitle = $boardTitle;
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'due_today',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->boardId,
            'board_title' => $this->boardTitle,
            'due_date' => $this->task->due_date,
            'message' => 'Nhiệm vụ đến hạn hôm nay: ' . $this->task->title,
        ];
    }
}
