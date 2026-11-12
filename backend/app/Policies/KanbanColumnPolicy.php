<?php

namespace App\Policies;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\User;

class KanbanColumnPolicy
{
    /**
     * Check if user is a member or admin of the column's board.
     * System admin does NOT automatically have access unless they are a board member.
     */
    public function view(User $user, KanbanColumn $column): bool
    {
        return $user->isBoardMember($column->board_id);
    }

    /**
     * Every member of the board can add columns (like Trello).
     */
    public function create(User $user, Board $board): bool
    {
        return $this->columns($user, $board->id);
    }

    /**
     * Every member of the board can rename or recolour columns. WIP limits are checked in the controller (board managers only).
     */
    public function update(User $user, KanbanColumn $column): bool
    {
        return $this->columns($user, $column->board_id);
    }

    /**
     * Board Owner/Admin can archive a column.
     * Regular members cannot archive columns.
     */
    public function archive(User $user, KanbanColumn $column): bool
    {
        return $user->isBoardAdmin($column->board_id);
    }

    /**
     * Board Owner/Admin can restore an archived column.
     * Regular members cannot restore columns.
     */
    public function restore(User $user, KanbanColumn $column): bool
    {
        return $user->isBoardAdmin($column->board_id);
    }

    /**
     * Board Owner/Admin can delete a column.
     * Regular members cannot delete columns.
     */
    public function delete(User $user, KanbanColumn $column): bool
    {
        return $user->isBoardAdmin($column->board_id);
    }

    private function columns(User $user, int|string|null $boardId): bool
    {
        $board = $boardId ? Board::find($boardId) : null;

        return $board !== null && app(\App\Services\BoardAccessService::class)->canManageColumns($user, $board);
    }
}
