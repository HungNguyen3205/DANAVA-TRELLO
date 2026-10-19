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
     * Board Owner/Admin can create columns on their board.
     * Regular members cannot create columns.
     */
    public function create(User $user, Board $board): bool
    {
        return $user->isBoardAdmin($board->id);
    }

    /**
     * Board Owner/Admin can update column titles or colors.
     * Regular members cannot update columns.
     */
    public function update(User $user, KanbanColumn $column): bool
    {
        return $user->isBoardAdmin($column->board_id);
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
}
