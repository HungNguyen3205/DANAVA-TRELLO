<?php

namespace App\Policies;

use App\Models\Board;
use App\Models\User;

class BoardPolicy
{
    /**
     * Check if user is a member of the board.
     * System Admin does NOT automatically have access unless they are a board member.
     */
    public function view(User $user, Board $board): bool
    {
        return $user->isBoardMember($board->id);
    }

    /**
     * Everyone who belongs to the board can view its workload dashboard.
     * System Admin does NOT automatically have access unless they are a board member.
     */
    public function viewDashboard(User $user, Board $board): bool
    {
        return $this->view($user, $board);
    }

    /**
     * Only Board Admin can update board settings.
     */
    public function update(User $user, Board $board): bool
    {
        return $user->isBoardAdmin($board->id);
    }

    /**
     * Only Board Admin can delete the board.
     */
    public function delete(User $user, Board $board): bool
    {
        return $user->isBoardAdmin($board->id);
    }

    /**
     * Manage members on board (add, change role, remove).
     */
    public function manageMembers(User $user, Board $board): bool
    {
        return $user->isBoardAdmin($board->id);
    }
}
