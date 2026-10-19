<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\Board;
use App\Models\User;

class BoardMemberAddedNotification extends Notification
{
    use Queueable;

    public $board;
    public $actor;

    public function __construct(Board $board, User $actor)
    {
        $this->board = $board;
        $this->actor = $actor;
    }

    public function via(object $notifiable): array
    {
        if ($notifiable instanceof User) {
            $prefs = $notifiable->notification_preferences ?? [];
            if (is_array($prefs) && isset($prefs['board_invited']) && $prefs['board_invited'] === false) {
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
        return [
            'type' => 'board_invited',
            'board_id' => $this->board->id,
            'board_public_id' => $this->board->public_id,
            'board_title' => $this->board->name,
            'actor_id' => $this->actor->id,
            'actor_name' => $this->actor->name,
            'message' => $this->actor->name . ' đã thêm bạn vào bảng "' . $this->board->name . '"',
            'action_url' => "/{$this->board->public_id}/kanban",
        ];
    }
}
