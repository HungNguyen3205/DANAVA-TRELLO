<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class TaskPolicy
{
    public function resolveBoardId(Task $task): ?int
    {
        if ($task->relationLoaded('column') && $task->column) {
            return $task->column->board_id;
        }

        $column = DB::table('kanban_columns')->where('id', $task->column_id)->first();
        return $column ? (int) $column->board_id : null;
    }

    public function view(User $user, Task $task): bool
    {
        $boardId = $this->resolveBoardId($task);
        return $user->isBoardMember($boardId);
    }

    public function createSubtask(User $user, Task $task): bool
    {
        $boardId = $this->resolveBoardId($task);
        if (!$user->isBoardMember($boardId)) {
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
        return $user->isBoardMember($boardId);
    }

    public function delete(User $user, Task $task): bool
    {
        $boardId = $this->resolveBoardId($task);
        return $user->isBoardMember($boardId);
    }

    public function assignMember(User $user, Task $task, int $targetUserId): bool
    {
        $boardId = $this->resolveBoardId($task);
        if (!$user->isBoardMember($boardId)) {
            return false;
        }

        // Target user must also be a member of the same board
        $targetUser = User::find($targetUserId);
        return $targetUser && $targetUser->isBoardMember($boardId);
    }
}
