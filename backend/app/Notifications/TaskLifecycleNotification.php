<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\Task;
use App\Models\User;

class TaskLifecycleNotification extends Notification
{
    use Queueable;

    public string $type;
    public string $message;
    public ?Task $task;
    public ?User $actor;
    public ?int $boardId;
    public ?string $boardTitle;
    public ?string $boardPublicId;
    public ?string $actionUrl;
    public array $extraData;

    public function __construct(
        string $type,
        string $message,
        ?Task $task = null,
        ?User $actor = null,
        ?int $boardId = null,
        ?string $boardTitle = null,
        ?string $boardPublicId = null,
        ?string $actionUrl = null,
        array $extraData = []
    ) {
        $this->type = $type;
        $this->message = $message;
        $this->task = $task;
        $this->actor = $actor;
        $this->boardId = $boardId;
        $this->boardTitle = $boardTitle;
        $this->boardPublicId = $boardPublicId;
        $this->actionUrl = $actionUrl;
        $this->extraData = $extraData;
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $openTaskId = $this->task ? ($this->task->parent_task_id ?: $this->task->id) : null;
        $isSubtask = $this->task ? !empty($this->task->parent_task_id) : false;

        $actionUrl = $this->actionUrl;
        if (!$actionUrl && $this->task) {
            $code = $this->boardPublicId ?: ($this->boardId ? "b/{$this->boardId}" : null);
            if ($code) {
                $actionUrl = "/{$code}/kanban?task={$openTaskId}";
            }
        }

        return array_merge([
            'type' => $this->type,
            'task_id' => $openTaskId,
            'subtask_id' => $isSubtask ? $this->task->id : null,
            'task_title' => $this->task ? $this->task->title : null,
            'board_id' => $this->boardId,
            'board_title' => $this->boardTitle,
            'board_public_id' => $this->boardPublicId,
            'actor_id' => $this->actor ? $this->actor->id : null,
            'actor_name' => $this->actor ? $this->actor->name : null,
            'actor_username' => $this->actor ? $this->actor->username : null,
            'message' => $this->message,
            'action_url' => $actionUrl,
            'created_at' => now()->toIso8601String(),
        ], $this->extraData);
    }
}
