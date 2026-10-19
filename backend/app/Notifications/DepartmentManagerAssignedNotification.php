<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\Department;
use App\Models\User;

class DepartmentManagerAssignedNotification extends Notification
{
    use Queueable;

    public $department;
    public $actor;

    public function __construct(Department $department, ?User $actor = null)
    {
        $this->department = $department;
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
        return [
            'type' => 'department_manager_assigned',
            'department_id' => $this->department->id,
            'department_name' => $this->department->name,
            'actor_id' => $this->actor?->id,
            'actor_name' => $this->actor?->name ?? 'System Admin',
            'message' => "Bạn đã được chỉ định làm Trưởng phòng {$this->department->name}.",
            'action_url' => '/profile',
        ];
    }
}
