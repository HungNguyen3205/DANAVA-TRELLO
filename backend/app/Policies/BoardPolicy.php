<?php

namespace App\Policies;

use App\Models\Board;
use App\Models\User;
use App\Services\BoardAccessService;

class BoardPolicy
{
    protected BoardAccessService $accessService;

    public function __construct(?BoardAccessService $accessService = null)
    {
        $this->accessService = $accessService ?? app(BoardAccessService::class);
    }

    /**
     * Check if user is a member or owner of the board.
     * System Admin does NOT automatically have access unless they are a board member.
     */
    public function view(User $user, Board $board): bool
    {
        return $this->accessService->canView($user, $board);
    }

    /**
     * Everyone who belongs to the board can view its workload dashboard.
     */
    public function viewDashboard(User $user, Board $board): bool
    {
        return $this->accessService->canView($user, $board);
    }

    /**
     * Only Board Admin or Owner can update board settings.
     */
    public function update(User $user, Board $board): bool
    {
        return $this->accessService->canManage($user, $board);
    }

    /**
     * Only Board Owner can delete the board.
     */
    public function delete(User $user, Board $board): bool
    {
        return $this->accessService->canDelete($user, $board);
    }

    /**
     * Manage members on board (add, change role, remove).
     */
    public function manageMembers(User $user, Board $board): bool
    {
        return $this->accessService->canManage($user, $board);
    }

    /**
     * Manage columns on board.
     */
    public function manageColumns(User $user, Board $board): bool
    {
        return $this->accessService->canManage($user, $board);
    }

    /**
     * Manage tasks on board.
     */
    public function manageTasks(User $user, Board $board): bool
    {
        return $this->accessService->canView($user, $board);
    }

    /**
     * Manage sprints on board.
     */
    public function manageSprints(User $user, Board $board): bool
    {
        return $this->accessService->canManage($user, $board);
    }

    /**
     * Manage labels on board.
     */
    public function manageLabels(User $user, Board $board): bool
    {
        return $this->accessService->canView($user, $board);
    }

    /**
     * Manage attachments on board.
     */
    public function manageAttachments(User $user, Board $board): bool
    {
        return $this->accessService->canView($user, $board);
    }
}
