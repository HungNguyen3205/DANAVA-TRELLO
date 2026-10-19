<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\User;

class DepartmentTransferNotification extends Notification
{
    use Queueable;

    public $oldDeptName;
    public $newDeptName;
    public $actor;

    public function __construct(?string $oldDeptName, ?string $newDeptName, ?User $actor = null)
    {
        $this->oldDeptName = $oldDeptName;
        $this->newDeptName = $newDeptName;
        $this->actor = $actor;
    }

    public function via(object $notifiable): array
    {
        if ($notifiable instanceof User) {
            if ($notifiable->account_status && $notifiable->account_status !== 'active') {
                return [];
            }
        }
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        if ($this->oldDeptName && $this->newDeptName) {
            $message = "Bạn đã được chuyển từ phòng ban {$this->oldDeptName} sang {$this->newDeptName}.";
        } elseif ($this->newDeptName) {
            $message = "Bạn đã được thêm vào phòng ban {$this->newDeptName}.";
        } else {
            $message = "Bạn đã được gỡ khỏi phòng ban {$this->oldDeptName}.";
        }

        return [
            'type' => 'department_transferred',
            'actor_id' => $this->actor?->id,
            'actor_name' => $this->actor?->name ?? 'System Admin',
            'old_department' => $this->oldDeptName,
            'new_department' => $this->newDeptName,
            'message' => $message,
            'action_url' => '/profile',
        ];
    }
}
