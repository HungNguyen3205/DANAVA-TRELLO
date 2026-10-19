<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class TaskPolicy
{
    private function resolveBoardId(Task $task): ?int
    {
        if ($task->relationLoaded('column') && $task->column) {
            return $task->column->board_id;
        }

        $column = DB::table('kanban_columns')->where('id', $task->column_id)->first();
        return $column ? $column->board_id : null;
    }

    private function isBoardMember(int $userId, ?int $boardId): bool
    {
        if (!$boardId) {
            return false;
        }

        return DB::table('board_members')
            ->where('board_id', $boardId)
            ->where('user_id', $userId)
            ->exists();
    }

    public function view(User $user, Task $task): bool
    {
        $boardId = $this->resolveBoardId($task);
        return $this->isBoardMember($user->id, $boardId);
    }

    public function createSubtask(User $user, Task $task): bool
    {
        // Must belong to the board
        $boardId = $this->resolveBoardId($task);
        if (!$this->isBoardMember($user->id, $boardId)) {
            return false;
        }

        // Rule: Max 1 level of hierarchy (Parent -> Subtask). Cannot create subtask for a subtask.
        if ($task->parent_task_id !== null) {
            return false;
        }

        return true;
    }

    public function update(User $user, Task $task): bool
    {
        $boardId = $this->resolveBoardId($task);
        return $this->isBoardMember($user->id, $boardId);
    }

    public function delete(User $user, Task $task): bool
    {
        $boardId = $this->resolveBoardId($task);
        return $this->isBoardMember($user->id, $boardId);
    }

    public function assignMember(User $user, Task $task, int $targetUserId): bool
    {
        $boardId = $this->resolveBoardId($task);
        if (!$this->isBoardMember($user->id, $boardId)) {
            return false;
        }

        // Target user must also be a member of the same board
        return $this->isBoardMember($targetUserId, $boardId);
    }
}
