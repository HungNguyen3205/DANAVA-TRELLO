<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\Task;
use App\Models\User;

class TaskMemberAssignedNotification extends Notification
{
    use Queueable;

    public Task $task;
    public User $actor;
    public int $boardId;
    public string $boardName;
    public ?string $publicId;

    public function __construct(Task $task, User $actor, int $boardId, string $boardName, ?string $publicId = null)
    {
        $this->task = $task;
        $this->actor = $actor;
        $this->boardId = $boardId;
        $this->boardName = $boardName;
        $this->publicId = $publicId;
    }

    public function via(object $notifiable): array
    {
        if ($notifiable instanceof User) {
            $prefs = $notifiable->notification_preferences ?? [];
            if (is_array($prefs) && isset($prefs['assigned']) && $prefs['assigned'] === false) {
                return [];
            }
            if ($notifiable->account_status && $notifiable->account_status !== 'active') {
                return [];
            }
        }
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        // Target root task ID if this is a subtask so modal opens properly
        $openTaskId = $this->task->parent_task_id ?: $this->task->id;
        $isSubtask = !empty($this->task->parent_task_id);

        $actionUrl = $this->publicId 
            ? "/{$this->publicId}/kanban?task={$openTaskId}"
            : "/b/{$this->boardId}?task={$openTaskId}";

        $message = $isSubtask
            ? "{$this->actor->name} đã giao công việc con \"{$this->task->title}\" cho bạn"
            : "{$this->actor->name} đã giao công việc \"{$this->task->title}\" cho bạn";

        return [
            'type' => 'assigned',
            'task_id' => $openTaskId,
            'subtask_id' => $isSubtask ? $this->task->id : null,
            'task_title' => $this->task->title,
            'board_id' => $this->boardId,
            'board_name' => $this->boardName,
            'actor_id' => $this->actor->id,
            'actor_name' => $this->actor->name,
            'message' => $message,
            'action_url' => $actionUrl,
            'assigned_at' => now()->toIso8601String(),
        ];
    }
}
