<?php

namespace App\Services;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class BoardAccessService
{
    /**
     * Check if user is the direct owner of the board or has owner role.
     * System Admin does NOT automatically bypass.
     */
    public function isOwner(User $user, Board $board): bool
    {
        if ((int)$board->owner_id === (int)$user->id) {
            return true;
        }

        return DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $user->id)
            ->where('role', 'owner')
            ->exists();
    }

    /**
     * Check if user is a member or owner of the board.
     * System Admin does NOT automatically bypass.
     */
    public function isMember(User $user, Board $board): bool
    {
        if ($this->isOwner($user, $board)) {
            return true;
        }

        return DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Check if user is a board administrator or owner.
     * System Admin does NOT automatically bypass.
     */
    public function isAdmin(User $user, Board $board): bool
    {
        if ($this->isOwner($user, $board)) {
            return true;
        }

        return DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $user->id)
            ->whereIn('role', ['admin', 'owner'])
            ->exists();
    }

    /**
     * Permission to view board details, columns, tasks, labels, etc.
     */
    public function canView(User $user, Board $board): bool
    {
        return $this->isMember($user, $board);
    }

    /**
     * Permission to manage board settings, columns, sprints, members.
     */
    public function canManage(User $user, Board $board): bool
    {
        return $this->isAdmin($user, $board);
    }

    /**
     * Permission to delete the board. Only Owner has this right.
     */
    public function canDelete(User $user, Board $board): bool
    {
        return $this->isOwner($user, $board);
    }

    /**
     * Resolve Board model from a Task instance.
     */
    public function resolveBoardFromTask(Task $task): ?Board
    {
        if ($task->relationLoaded('column') && $task->column) {
            return $task->column->board;
        }

        $column = KanbanColumn::with('board')->find($task->column_id);
        return $column?->board;
    }

    /**
     * Strict check: ensure all provided models belong to the specified board.
     *
     * @throws AuthorizationException
     */
    public function assertSameBoard(Board $board, ...$models): void
    {
        foreach ($models as $model) {
            if (!$model) continue;

            $modelBoardId = null;
            if ($model instanceof KanbanColumn) {
                $modelBoardId = $model->board_id;
            } elseif ($model instanceof Task) {
                $modelBoardId = $model->column?->board_id ?: DB::table('kanban_columns')->where('id', $model->column_id)->value('board_id');
            } elseif (isset($model->board_id)) {
                $modelBoardId = $model->board_id;
            }

            if ($modelBoardId && (int)$modelBoardId !== (int)$board->id) {
                throw new AuthorizationException('Đối tượng không thuộc cùng bảng công việc.');
            }
        }
    }

    /**
     * Strict check: ensure user is an active member or owner of the board.
     *
     * @throws AuthorizationException
     */
    public function assertBoardMember(User $user, Board $board): void
    {
        if (!$this->canView($user, $board)) {
            throw new AuthorizationException('Bạn không phải là thành viên của bảng này.');
        }
    }

    /**
     * Strict check: ensure user is a board admin or owner.
     *
     * @throws AuthorizationException
     */
    public function assertBoardAdmin(User $user, Board $board): void
    {
        if (!$this->canManage($user, $board)) {
            throw new AuthorizationException('Chỉ Quản trị viên hoặc Chủ sở hữu của bảng mới có quyền thực hiện hành động này.');
        }
    }

    /**
     * Strict check: ensure user is the direct board owner.
     *
     * @throws AuthorizationException
     */
    public function assertBoardOwner(User $user, Board $board): void
    {
        if (!$this->canDelete($user, $board)) {
            throw new AuthorizationException('Chỉ Chủ sở hữu của bảng mới có quyền xóa bảng.');
        }
    }
}
