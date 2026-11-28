<?php

namespace App\Services\Assistant;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Models\UserAlias;
use App\Notifications\BoardMemberAddedNotification;
use App\Notifications\TaskMemberAssignedNotification;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Creates the tasks a user confirmed in the assistant preview.
 * Each item is validated and created independently; one failure does not block the others.
 */
class TaskApplyService
{
    private const DONE_COLUMN_NAMES = ['done', 'hoàn thành', 'completed'];

    /**
     * @param array<int, array> $items validated items from the request
     * @return array<int, array{index: int, ok: bool, message?: string, task?: array}>
     */
    public function apply(User $actor, array $items): array
    {
        $results = [];
        foreach ($items as $index => $item) {
            try {
                $results[] = ['index' => $index, 'ok' => true, ...$this->applyOne($actor, $item)];
            } catch (ApplyException $e) {
                $results[] = ['index' => $index, 'ok' => false, 'message' => $e->getMessage()];
            }
        }

        return $results;
    }

    private function applyOne(User $actor, array $item): array
    {
        $board = Board::find($item['board_id']);
        if (!$board || !Gate::forUser($actor)->allows('view', $board)) {
            throw new ApplyException('Bạn không có quyền tạo công việc trong bảng đã chọn.');
        }

        $column = $this->targetColumn($board, (bool) ($item['done'] ?? false));
        if (!$column) {
            throw new ApplyException("Bảng \"{$board->name}\" chưa có cột nào.");
        }
        if ($column->wip_limit && $column->wip_enforcement === 'strict' && $column->wip_count >= $column->wip_limit) {
            throw new ApplyException("Cột \"{$column->title}\" đã đạt giới hạn WIP ({$column->wip_limit}).");
        }

        [$assigneeIds, $skipped] = $this->resolveAssignees($actor, $board, $item['assignee_ids'] ?? [], (bool) ($item['add_to_board'] ?? false));

        $task = DB::transaction(function () use ($actor, $item, $column, $assigneeIds) {
            $done = (bool) ($item['done'] ?? false);
            $task = $column->tasks()->create([
                'title' => $item['title'],
                'description' => $item['description'] ?? null,
                'priority' => $item['priority'] ?? 'Bình thường',
                'due_date' => $item['due_date'] ?? null,
                'created_by' => $actor->id,
                'order' => ($column->tasks()->max('order') ?? 0) + 1000,
                'completed_at' => $done ? now() : null,
                'completed_by' => $done ? $actor->id : null,
            ]);
            if ($assigneeIds) {
                $task->syncAssigneesWithAutoSplit($assigneeIds, $actor->id);
            }
            $this->addSubtasks($actor, $task, $item['subtasks'] ?? []);

            return $task;
        });

        $this->notifyAssignees($task, $actor, $board, $assigneeIds);
        $this->rememberAliases($actor, $item, $assigneeIds);

        return [
            'task' => [
                'id' => $task->id,
                'title' => $task->title,
                'board_id' => $board->id,
                'board_name' => $board->name,
                'board_code' => $board->public_id,
                'column' => $column->title,
                'assignee_ids' => $assigneeIds,
                'subtask_count' => $task->subtasks()->count(),
            ],
            'skipped_assignees' => $skipped,
        ];
    }

    /**
     * Add checklist items as subtasks of $parent (in its first "Việc cần làm" group),
     * the same way SubtaskController::store lays them out.
     *
     * @param array<int, string|array{title?: string, done?: bool}> $items
     * @return int number of subtasks created
     */
    public function addSubtasks(User $actor, Task $parent, array $items, array $assigneeIds = []): int
    {
        $items = array_values(array_filter(array_map(function ($item) {
            $title = trim(is_array($item) ? (string) ($item['title'] ?? '') : (string) $item);
            return $title === '' ? null : ['title' => mb_substr($title, 0, 255), 'done' => is_array($item) && !empty($item['done'])];
        }, $items)));
        if (!$items || $parent->parent_task_id !== null) {
            return 0;
        }

        $assigneeIds = array_values(array_unique(array_map('intval', $assigneeIds)));

        return DB::transaction(function () use ($actor, $parent, $items, $assigneeIds) {
            $group = $parent->taskGroups()->orderBy('position')->first()
                ?? $parent->taskGroups()->create(['title' => 'Việc cần làm', 'position' => 0, 'created_by' => $actor->id]);
            $sort = (int) ($parent->subtasks()->max('sort_order') ?? 0);

            foreach ($items as $item) {
                $subtask = Task::create([
                    'parent_task_id' => $parent->id,
                    'task_group_id' => $group->id,
                    'column_id' => $parent->column_id,
                    'sprint_id' => $parent->sprint_id,
                    'assignee_id' => $assigneeIds[0] ?? null,
                    'created_by' => $actor->id,
                    'title' => $item['title'],
                    'priority' => 'Bình thường',
                    'complexity' => 'M',
                    'order' => $parent->order ?? 0,
                    'sort_order' => ++$sort,
                    'completed_at' => $item['done'] ? now() : null,
                    'completed_by' => $item['done'] ? $actor->id : null,
                ]);
                if ($assigneeIds) {
                    $subtask->syncAssigneesWithAutoSplit($assigneeIds, $actor->id);
                }
            }

            return count($items);
        });
    }

    private function targetColumn(Board $board, bool $done): ?KanbanColumn
    {
        $columns = $board->columns()->whereNull('archived_at')->orderBy('order')->get();
        if ($done) {
            return $columns->first(fn ($c) => in_array(mb_strtolower(trim($c->title)), self::DONE_COLUMN_NAMES, true))
                ?? $columns->last();
        }

        return $columns->first();
    }

    /**
     * Only board members can be assigned; a board admin may opt in to adding missing people.
     *
     * @return array{0: int[], 1: array<int, array{id: int, name: string}>}
     */
    private function resolveAssignees(User $actor, Board $board, array $ids, bool $addToBoard): array
    {
        $users = User::whereIn('id', array_map('intval', $ids))->where('account_status', 'active')->get();
        $memberIds = DB::table('board_members')->where('board_id', $board->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
        $memberIds[] = (int) $board->owner_id;
        $canAdd = $addToBoard && $actor->isBoardAdmin($board->id);

        $assignees = [];
        $skipped = [];
        foreach ($users as $user) {
            if (in_array((int) $user->id, $memberIds, true)) {
                $assignees[] = (int) $user->id;
            } elseif ($canAdd) {
                DB::table('board_members')->insertOrIgnore([
                    'board_id' => $board->id, 'user_id' => $user->id, 'role' => 'member',
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $user->notify(new BoardMemberAddedNotification($board, $actor));
                $assignees[] = (int) $user->id;
            } else {
                $skipped[] = ['id' => (int) $user->id, 'name' => $user->name];
            }
        }

        return [$assignees, $skipped];
    }

    private function notifyAssignees(Task $task, User $actor, Board $board, array $assigneeIds): void
    {
        foreach (User::whereIn('id', $assigneeIds)->where('id', '!=', $actor->id)->get() as $user) {
            $user->notify(new TaskMemberAssignedNotification($task, $actor, $board->id, $board->name ?? 'Bảng công việc', $board->public_id));
            try {
                NotificationService::notifyAssigned($task, $user, $actor);
            } catch (Throwable $e) {
                Log::error('Telegram dispatch error: ' . $e->getMessage());
            }
        }
    }

    /** Learn "nickname -> person" from mentions the user resolved in the preview. */
    private function rememberAliases(User $actor, array $item, array $assigneeIds): void
    {
        foreach ($item['aliases'] ?? [] as $alias) {
            $userId = (int) ($alias['user_id'] ?? 0);
            $text = (string) ($alias['alias'] ?? '');
            if ($userId && $text !== '' && in_array($userId, $assigneeIds, true)) {
                UserAlias::remember($text, $userId, $actor->id);
            }
        }
    }
}
