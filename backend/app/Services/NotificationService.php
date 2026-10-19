<?php

namespace App\Services;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Notifications\TaskLifecycleNotification;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Send a notification to a recipient while strictly honoring:
     * 1. No self-notification (actor cannot receive own notification)
     * 2. No duplicate notification for the same event
     * 3. Respect user notification preferences
     * 4. Includes action_url pointing to canonical public board & task
     */
    public static function send(
        User $recipient,
        string $type,
        string $message,
        ?Task $task = null,
        ?User $actor = null,
        ?Board $board = null,
        ?string $actionUrl = null,
        array $extraData = []
    ): bool {
        // 1. Never send to the actor who performed the action
        if ($actor && (int)$recipient->id === (int)$actor->id) {
            return false;
        }

        // Only active users receive notifications
        if ($recipient->account_status && $recipient->account_status !== 'active') {
            return false;
        }

        // 2. Check user notification preferences
        $prefs = $recipient->notification_preferences ?? [];
        if (is_array($prefs)) {
            // Direct type check
            if (isset($prefs[$type]) && $prefs[$type] === false) {
                return false;
            }
            // Category mapped checks
            $categoryMap = [
                'assigned' => 'assigned',
                'unassigned' => 'assigned',
                'comment_added' => 'comments',
                'mention' => 'comments',
                'due_date_changed' => 'deadlines',
                'due_soon' => 'deadlines',
                'due_today' => 'deadlines',
                'overdue' => 'deadlines',
                'column_moved' => 'status_changes',
                'task_completed' => 'status_changes',
                'task_reopened' => 'status_changes',
                'quality_review' => 'reviews',
                'evaluation_published' => 'reviews',
                'review_published' => 'reviews',
                'board_invited' => 'board_invited',
            ];
            $category = $categoryMap[$type] ?? null;
            if ($category && isset($prefs[$category]) && $prefs[$category] === false) {
                return false;
            }
        }

        // Resolve board info
        if (!$board && $task) {
            $board = self::resolveBoardForTask($task);
        }

        $openTaskId = $task ? ($task->parent_task_id ?: $task->id) : null;
        $boardPublicId = $board?->public_id;
        $boardId = $board?->id;
        $boardName = $board?->name ?? 'Bảng công việc';

        // Build canonical action_url
        if (!$actionUrl) {
            if ($task && ($boardPublicId || $boardId)) {
                $code = $boardPublicId ?: "b/{$boardId}";
                $actionUrl = "/{$code}/kanban?task={$openTaskId}";
            } elseif ($boardPublicId || $boardId) {
                $code = $boardPublicId ?: "b/{$boardId}";
                $actionUrl = "/{$code}/kanban";
            }
        }

        // 3. Avoid duplicate notifications
        if (in_array($type, ['due_soon', 'due_today', 'overdue'])) {
            // Due date reminders are sent only once per task & type
            $exists = DB::table('notifications')
                ->where('notifiable_id', $recipient->id)
                ->where('notifiable_type', get_class($recipient))
                ->where('data', 'LIKE', '%"task_id":' . $openTaskId . '%')
                ->where('data', 'LIKE', '%"type":"' . $type . '"%')
                ->exists();

            if ($exists) {
                return false;
            }
        } else {
            // Prevent duplicate event within 2 minutes for other actions
            $query = DB::table('notifications')
                ->where('notifiable_id', $recipient->id)
                ->where('notifiable_type', get_class($recipient))
                ->where('created_at', '>=', now()->subMinutes(2))
                ->where('data', 'LIKE', '%"type":"' . $type . '"%');

            if ($openTaskId) {
                $query->where('data', 'LIKE', '%"task_id":' . $openTaskId . '%');
            }

            if ($query->exists()) {
                return false;
            }
        }

        // Send database notification
        $recipient->notify(new TaskLifecycleNotification(
            type: $type,
            message: $message,
            task: $task,
            actor: $actor,
            boardId: $boardId,
            boardTitle: $boardName,
            boardPublicId: $boardPublicId,
            actionUrl: $actionUrl,
            extraData: $extraData
        ));

        return true;
    }

    /**
     * Resolve Board model for a Task.
     */
    public static function resolveBoardForTask(?Task $task): ?Board
    {
        if (!$task) return null;
        if ($task->column && $task->column->board) {
            return $task->column->board;
        }
        if ($task->column_id) {
            $boardId = DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');
            if ($boardId) {
                return Board::find($boardId);
            }
        }
        return null;
    }

    /**
     * Dispatch Telegram notification for Board and inherited Department integrations.
     */
    public static function dispatchTelegramForBoard(
        Board $board,
        string $eventType,
        callable $formatCallback,
        string $idempotencyPrefix,
        ?string $notifiableType = null,
        ?int $notifiableId = null
    ): void {
        try {
            $telegramService = app(TelegramService::class);
            $destinations = $telegramService->resolveBoardDestinations($board, $eventType);
            if (empty($destinations)) {
                return;
            }

            $formatted = $formatCallback($telegramService);
            foreach ($destinations as $dest) {
                \App\Jobs\SendTelegramNotificationJob::dispatch(
                    integrationId: $dest->id,
                    chatId: $dest->chat_id,
                    message: $formatted['text'],
                    options: ['buttons' => $formatted['buttons'] ?? []],
                    eventType: $eventType,
                    notifiableType: $notifiableType,
                    notifiableId: $notifiableId,
                    idempotencyKey: "{$idempotencyPrefix}_{$dest->chat_id}"
                );
            }
        } catch (\Throwable $e) {
            Log::error("Telegram dispatch error for {$eventType}: " . $e->getMessage());
        }
    }

    /**
     * Get all related users for a task (assignees + creator)
     */
    public static function getTaskStakeholders(Task $task, ?User $actor = null): array
    {
        $userIds = [];

        // Assignees
        $assigneeIds = $task->assignees()->pluck('users.id')->toArray();
        if ($task->assignee_id) {
            $assigneeIds[] = (int)$task->assignee_id;
        }

        // Creator
        if ($task->created_by) {
            $assigneeIds[] = (int)$task->created_by;
        }

        // If subtask, also include parent task assignees & creator
        if ($task->parent_task_id) {
            $parent = Task::find($task->parent_task_id);
            if ($parent) {
                if ($parent->assignee_id) $assigneeIds[] = (int)$parent->assignee_id;
                if ($parent->created_by) $assigneeIds[] = (int)$parent->created_by;
                $assigneeIds = array_merge($assigneeIds, $parent->assignees()->pluck('users.id')->toArray());
            }
        }

        $uniqueIds = array_unique($assigneeIds);
        if ($actor) {
            $uniqueIds = array_filter($uniqueIds, fn($id) => (int)$id !== (int)$actor->id);
        }

        return User::whereIn('id', $uniqueIds)->get()->all();
    }

    /**
     * Parse @mentions from text and find board members
     */
    public static function parseMentions(string $text, int $boardId): array
    {
        preg_match_all('/@([a-zA-Z0-9_\.\-]+)/u', $text, $matches);
        if (empty($matches[1])) {
            return [];
        }

        $usernames = array_unique($matches[1]);

        return User::whereIn('username', $usernames)
            ->where('account_status', 'active')
            ->whereExists(function ($q) use ($boardId) {
                $q->select(DB::raw(1))
                    ->from('board_members')
                    ->whereColumn('board_members.user_id', 'users.id')
                    ->where('board_members.board_id', $boardId);
            })
            ->get()
            ->all();
    }

    /**
     * 2. Được giao task/task con
     */
    public static function notifyAssigned(Task $task, User $recipient, User $actor): void
    {
        $isSubtask = !empty($task->parent_task_id);
        $message = $isSubtask
            ? "{$actor->name} đã giao công việc con \"{$task->title}\" cho bạn"
            : "{$actor->name} đã giao công việc \"{$task->title}\" cho bạn";

        self::send($recipient, 'assigned', $message, $task, $actor, extraData: [
            'subtask_id' => $isSubtask ? $task->id : null,
        ]);

        // Dispatch Telegram
        if ($board = self::resolveBoardForTask($task)) {
            self::dispatchTelegramForBoard(
                $board,
                'task_assigned',
                fn($svc) => $svc->formatTaskAssigned($task, $recipient, $actor, $board),
                "task_assigned_{$task->id}_{$recipient->id}",
                Task::class,
                $task->id
            );
        }
    }

    /**
     * 3. Bị gỡ khỏi task
     */
    public static function notifyUnassigned(Task $task, User $unassignedUser, User $actor): void
    {
        $message = "{$actor->name} đã gỡ bạn khỏi công việc \"{$task->title}\"";
        self::send($unassignedUser, 'unassigned', $message, $task, $actor);
    }

    /**
     * 4. Deadline thay đổi
     */
    public static function notifyDueDateChanged(Task $task, User $actor, ?string $oldDueDate, ?string $newDueDate): void
    {
        $formattedDate = $newDueDate ? Carbon::parse($newDueDate)->format('d/m/Y') : 'không có thời hạn';
        $message = "{$actor->name} đã thay đổi hạn chót công việc \"{$task->title}\" sang {$formattedDate}";

        $stakeholders = self::getTaskStakeholders($task, $actor);
        foreach ($stakeholders as $user) {
            self::send($user, 'due_date_changed', $message, $task, $actor);
        }
    }

    /**
     * 7. Task chuyển cột
     */
    public static function notifyColumnMoved(Task $task, User $actor, KanbanColumn $destinationColumn): void
    {
        $message = "{$actor->name} đã chuyển công việc \"{$task->title}\" sang cột \"{$destinationColumn->title}\"";

        $stakeholders = self::getTaskStakeholders($task, $actor);
        foreach ($stakeholders as $user) {
            self::send($user, 'column_moved', $message, $task, $actor, extraData: [
                'target_column_id' => $destinationColumn->id,
                'target_column_title' => $destinationColumn->title,
            ]);
        }

        // Dispatch Telegram
        if ($board = self::resolveBoardForTask($task)) {
            self::dispatchTelegramForBoard(
                $board,
                'task_moved',
                fn($svc) => $svc->formatColumnMoved($task, $actor, $destinationColumn, null, $board),
                "column_moved_{$task->id}_{$destinationColumn->id}_" . time(),
                Task::class,
                $task->id
            );
        }
    }

    /**
     * 8. Task hoàn thành
     */
    public static function notifyTaskCompleted(Task $task, User $actor): void
    {
        $message = "{$actor->name} đã hoàn thành công việc \"{$task->title}\"";

        $stakeholders = self::getTaskStakeholders($task, $actor);
        foreach ($stakeholders as $user) {
            self::send($user, 'task_completed', $message, $task, $actor);
        }

        // Dispatch Telegram
        if ($board = self::resolveBoardForTask($task)) {
            self::dispatchTelegramForBoard(
                $board,
                'task_completed',
                fn($svc) => $svc->formatTaskCompleted($task, $actor, $board),
                "task_completed_{$task->id}_" . Carbon::now()->toDateString(),
                Task::class,
                $task->id
            );
        }
    }

    /**
     * 9. Task được mở lại
     */
    public static function notifyTaskReopened(Task $task, User $actor): void
    {
        $message = "{$actor->name} đã mở lại công việc \"{$task->title}\"";

        $stakeholders = self::getTaskStakeholders($task, $actor);
        foreach ($stakeholders as $user) {
            self::send($user, 'task_reopened', $message, $task, $actor);
        }
    }

    /**
     * 10 & 11. Có bình luận mới & Người được nhắc @username
     */
    public static function notifyCommentAdded(Task $task, TaskComment $comment, User $actor): void
    {
        $boardId = $task->column?->board_id ?: DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');

        // Check mentions
        $mentionedUsers = $boardId ? self::parseMentions($comment->content, $boardId) : [];
        $mentionedUserIds = [];

        foreach ($mentionedUsers as $mentioned) {
            if ((int)$mentioned->id !== (int)$actor->id) {
                $mentionedUserIds[] = (int)$mentioned->id;
                $mentionMsg = "{$actor->name} đã nhắc đến bạn trong bình luận công việc \"{$task->title}\"";
                self::send($mentioned, 'mention', $mentionMsg, $task, $actor);
            }
        }

        // Notify other stakeholders (excluding actor and already mentioned users)
        $commentMsg = "{$actor->name} đã bình luận trên công việc \"{$task->title}\"";
        $stakeholders = self::getTaskStakeholders($task, $actor);

        foreach ($stakeholders as $user) {
            if (!in_array((int)$user->id, $mentionedUserIds, true)) {
                self::send($user, 'comment_added', $commentMsg, $task, $actor);
            }
        }
    }

    /**
     * 12. Có đánh giá chất lượng
     */
    public static function notifyQualityReview(Task $task, User $actor, string $ratingSummary = ''): void
    {
        $msg = $ratingSummary 
            ? "{$actor->name} đã đánh giá chất lượng cho công việc \"{$task->title}\": {$ratingSummary}"
            : "{$actor->name} đã đánh giá chất lượng cho công việc \"{$task->title}\"";

        $stakeholders = self::getTaskStakeholders($task, $actor);
        foreach ($stakeholders as $user) {
            self::send($user, 'quality_review', $msg, $task, $actor);
        }
    }

    /**
     * 13. Kỳ đánh giá được công bố
     */
    public static function notifyEvaluationPublished(Board $board, User $actor, string $periodTitle): void
    {
        $message = "Kỳ đánh giá hiệu suất \"{$periodTitle}\" đã được công bố";
        $actionUrl = "/{$board->public_id}/dashboard";

        $members = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', '!=', $actor->id)
            ->pluck('user_id');

        $users = User::whereIn('id', $members)->where('account_status', 'active')->get();
        foreach ($users as $user) {
            self::send($user, 'evaluation_published', $message, null, $actor, $board, $actionUrl, [
                'period_title' => $periodTitle,
            ]);
        }
    }
}
