<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\Task;
use App\Models\User;

class TaskAssignedNotification extends Notification
{
    use Queueable;

    public $task;
    public $actor;
    public $boardId;
    public $boardTitle;

    public function __construct(Task $task, User $actor, $boardId, $boardTitle)
    {
        $this->task = $task;
        $this->actor = $actor;
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
            'type' => 'assigned',
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'board_id' => $this->boardId,
            'board_title' => $this->boardTitle,
            'actor_id' => $this->actor->id,
            'actor_name' => $this->actor->name,
            'message' => 'Bạn đã được thêm vào nhiệm vụ ' . $this->task->title,
        ];
    }
}
