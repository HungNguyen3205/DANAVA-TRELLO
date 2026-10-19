<?php

namespace App\Policies;

use App\Models\Board;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class BoardPolicy
{
    /**
     * Check if user is a member of the board.
     * System Admin does NOT automatically have access unless they are a board member.
     */
    public function view(User $user, Board $board): bool
    {
        return DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $user->id)
            ->exists();
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
        return DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $user->id)
            ->where('role', 'admin')
            ->exists();
    }

    /**
     * Only Board Admin can delete the board.
     */
    public function delete(User $user, Board $board): bool
    {
        return $this->update($user, $board);
    }

    /**
     * Manage members on board.
     */
    public function manageMembers(User $user, Board $board): bool
    {
        return $this->update($user, $board);
    }
}
