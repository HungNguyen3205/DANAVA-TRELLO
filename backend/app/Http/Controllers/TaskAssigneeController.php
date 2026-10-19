<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\Task;
use App\Models\User;
use App\Notifications\BoardMemberAddedNotification;
use App\Notifications\TaskMemberAssignedNotification;
use App\Services\NotificationService;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;

class TaskAssigneeController extends Controller
{
    /**
     * Resolve board for a given task.
     */
    private function resolveBoard(Task $task): ?Board
    {
        if ($task->column && $task->column->board) {
            return $task->column->board;
        }

        $boardId = DB::table('kanban_columns')
            ->where('id', $task->column_id)
            ->value('board_id');

        return $boardId ? Board::find($boardId) : null;
    }

    /**
     * Get valid board member IDs for a given board.
     */
    private function getValidBoardMemberIds(int $boardId): array
    {
        $memberIds = DB::table('board_members')
            ->where('board_id', $boardId)
            ->pluck('user_id')
            ->map(fn($id) => (int)$id)
            ->toArray();

        $ownerId = DB::table('boards')->where('id', $boardId)->value('owner_id');
        if ($ownerId && !in_array((int)$ownerId, $memberIds, true)) {
            $memberIds[] = (int)$ownerId;
        }

        return array_values(array_unique($memberIds));
    }

    /**
     * PUT /api/tasks/{task}/assignees
     * Update multiple assignees for a parent task or subtask.
     */
    public function update(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate([
            'assignee_ids' => 'present|array',
            'assignee_ids.*' => 'integer|exists:users,id',
            'contribution_percents' => 'sometimes|nullable|array',
            'contribution_percents.*' => 'numeric|min:0|max:100',
            'apply_to_subtasks' => 'sometimes|boolean',
            'subtask_ids' => 'sometimes|nullable|array',
            'subtask_ids.*' => 'integer|exists:tasks,id',
        ]);

        $board = $this->resolveBoard($task);
        if (!$board) {
            return response()->json(['message' => 'Không tìm thấy bảng cho công việc này.'], 404);
        }

        $validMemberIds = $this->getValidBoardMemberIds($board->id);
        $newAssigneeIds = array_values(array_unique(array_map('intval', $request->input('assignee_ids', []))));

        // Validate all assignees belong to board and are active
        $invalidUsers = array_diff($newAssigneeIds, $validMemberIds);
        if (!empty($invalidUsers)) {
            return response()->json([
                'message' => 'Thành viên này chưa thuộc Board.',
                'errors' => ['assignee_ids' => ['Một hoặc nhiều người dùng chưa thuộc bảng này.']],
            ], 422);
        }

        // Check for locked/inactive accounts
        if (!empty($newAssigneeIds)) {
            $inactiveCount = User::whereIn('id', $newAssigneeIds)
                ->where('account_status', '!=', 'active')
                ->count();
            if ($inactiveCount > 0) {
                return response()->json([
                    'message' => 'Không thể giao việc cho tài khoản đã bị khóa hoặc ngừng hoạt động.',
                    'errors' => ['assignee_ids' => ['Tài khoản người dùng đã bị khóa hoặc không hoạt động.']],
                ], 422);
            }
        }

        $currentAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
        $addedAssignees = array_diff($newAssigneeIds, $currentAssigneeIds);
        $removedAssignees = array_diff($currentAssigneeIds, $newAssigneeIds);
        $contributionPercents = $request->input('contribution_percents', []);

        // Validate contribution_percents if explicitly passed and non-empty
        if (!empty($contributionPercents) && !empty($newAssigneeIds)) {
            $sum = 0.0;
            foreach ($newAssigneeIds as $uid) {
                if (isset($contributionPercents[$uid])) {
                    $sum += (float) $contributionPercents[$uid];
                }
            }
            if (abs($sum - 100.0) >= 0.1) {
                return response()->json([
                    'message' => 'Tổng tỷ lệ đóng góp phải bằng 100%.',
                    'errors' => ['contribution_percents' => ['Tổng tỷ lệ đóng góp phải bằng 100%.']],
                ], 422);
            }
        }

        DB::transaction(function () use (
            $task, $newAssigneeIds, $contributionPercents,
            $request, $board, $addedAssignees, $removedAssignees
        ) {
            $task->syncAssigneesWithAutoSplit($newAssigneeIds, $request->user()->id, $contributionPercents);

            // Apply to subtasks if requested
            if ($request->boolean('apply_to_subtasks') && !empty($addedAssignees)) {
                $subtaskIds = $request->input('subtask_ids', []);
                $subtasksQuery = $task->subtasks();
                if (!empty($subtaskIds)) {
                    $subtasksQuery->whereIn('id', $subtaskIds);
                }
                $subtasks = $subtasksQuery->get();

                foreach ($subtasks as $subtask) {
                    $subCurrent = $subtask->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
                    $merged = array_values(array_unique(array_merge($subCurrent, $addedAssignees)));
                    $subtask->syncAssigneesWithAutoSplit($merged, $request->user()->id);

                    // Notify subtask assignees
                    $subAdded = array_diff($merged, $subCurrent);
                    foreach ($subAdded as $uid) {
                        if ($uid !== $request->user()->id) {
                            $user = User::find($uid);
                            if ($user) {
                                $user->notify(new TaskMemberAssignedNotification(
                                    $subtask,
                                    $request->user(),
                                    $board->id,
                                    $board->name ?? 'Bảng công việc',
                                    $board->public_id ?? null
                                ));
                            }
                        }
                    }
                }
            }

            // Log activity
            if (!empty($addedAssignees) || !empty($removedAssignees)) {
                $addedNames = !empty($addedAssignees) ? User::whereIn('id', $addedAssignees)->pluck('name')->implode(', ') : null;
                $removedNames = !empty($removedAssignees) ? User::whereIn('id', $removedAssignees)->pluck('name')->implode(', ') : null;

                $actionText = [];
                if ($addedNames) {
                    $actionText[] = "thêm {$addedNames}";
                }
                if ($removedNames) {
                    $actionText[] = "gỡ {$removedNames}";
                }

                $isSubtask = !empty($task->parent_task_id);
                $taskTypeLabel = $isSubtask ? "Task con '{$task->title}'" : "Task '{$task->title}'";

                ActivityLog::create([
                    'board_id' => $board->id,
                    'task_id' => $task->id,
                    'user_id' => $request->user()->id,
                    'action' => implode(' và ', $actionText) . " vào {$taskTypeLabel}",
                    'new_value' => json_encode(['assignee_ids' => $newAssigneeIds]),
                ]);
            }
        });

        // Notifications for newly added assignees
        if (!empty($addedAssignees)) {
            foreach ($addedAssignees as $uid) {
                if ($uid !== $request->user()->id) {
                    $user = User::find($uid);
                    if ($user) {
                        $user->notify(new TaskMemberAssignedNotification(
                            $task,
                            $request->user(),
                            $board->id,
                            $board->name ?? 'Bảng công việc',
                            $board->public_id ?? null
                        ));

                        // Telegram notification
                        try {
                            NotificationService::notifyAssigned($task, $user, $request->user());
                        } catch (\Throwable $e) {
                            Log::error('Telegram dispatch error for task assignment: ' . $e->getMessage());
                        }
                    }
                }
            }
        }

        // Notify removed assignees
        if (!empty($removedAssignees)) {
            foreach ($removedAssignees as $uid) {
                if ($uid !== $request->user()->id) {
                    $unassignedUser = User::find($uid);
                    if ($unassignedUser) {
                        NotificationService::notifyUnassigned($task, $unassignedUser, $request->user());
                    }
                }
            }
        }

        return response()->json([
            'message' => 'Cập nhật thành viên công việc thành công.',
            'task' => $task->fresh()->load(['assignees', 'subtasks.assignees', 'creator']),
        ]);
    }

    /**
     * POST /api/tasks/{task}/assignees/{user}
     * Add single assignee to task with optional auto-add to board for Board Admin.
     */
    public function addAssignee(Request $request, Task $task, User $user): JsonResponse
    {
        Gate::authorize('update', $task);

        $board = $this->resolveBoard($task);
        if (!$board) {
            return response()->json(['message' => 'Không tìm thấy bảng cho công việc này.'], 404);
        }

        if ($user->account_status !== 'active') {
            return response()->json(['message' => 'Tài khoản người dùng đã bị khóa hoặc không hoạt động.'], 422);
        }

        $validMemberIds = $this->getValidBoardMemberIds($board->id);
        $isMember = in_array((int)$user->id, $validMemberIds, true);

        // If not member, check if caller is Board Admin and requested add_to_board
        if (!$isMember) {
            $isBoardAdmin = $request->user()->isBoardAdmin($board->id);
            if ($isBoardAdmin && $request->boolean('add_to_board')) {
                DB::table('board_members')->insertOrIgnore([
                    'board_id' => $board->id,
                    'user_id' => $user->id,
                    'role' => 'member',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $user->notify(new BoardMemberAddedNotification($board, $request->user()));
            } else {
                return response()->json([
                    'message' => 'Thành viên này chưa thuộc Board.',
                    'can_add_to_board' => $isBoardAdmin,
                ], 422);
            }
        }

        $currentAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
        if (in_array((int)$user->id, $currentAssigneeIds, true)) {
            return response()->json([
                'message' => 'Thành viên đã được giao công việc này từ trước.',
                'task' => $task->load('assignees'),
            ]);
        }

        $newAssigneeIds = array_values(array_unique(array_merge($currentAssigneeIds, [(int)$user->id])));
        $task->syncAssigneesWithAutoSplit($newAssigneeIds, $request->user()->id);

        // Log and notify
        if ($user->id !== $request->user()->id) {
            $user->notify(new TaskMemberAssignedNotification(
                $task,
                $request->user(),
                $board->id,
                $board->name ?? 'Bảng công việc',
                $board->public_id ?? null
            ));
            try {
                NotificationService::notifyAssigned($task, $user, $request->user());
            } catch (\Throwable $e) {
                Log::error('Telegram dispatch error: ' . $e->getMessage());
            }
        }

        $isSubtask = !empty($task->parent_task_id);
        $taskTypeLabel = $isSubtask ? "Task con '{$task->title}'" : "Task '{$task->title}'";

        ActivityLog::create([
            'board_id' => $board->id,
            'task_id' => $task->id,
            'user_id' => $request->user()->id,
            'action' => "thêm {$user->name} vào {$taskTypeLabel}",
            'new_value' => $user->name,
        ]);

        return response()->json([
            'message' => "Đã giao công việc cho {$user->name}.",
            'task' => $task->fresh()->load(['assignees', 'subtasks.assignees']),
        ]);
    }

    /**
     * DELETE /api/tasks/{task}/assignees/{user}
     * Remove single assignee from task, with warning if still assigned to subtasks.
     */
    public function removeAssignee(Request $request, Task $task, User $user): JsonResponse
    {
        Gate::authorize('update', $task);

        $board = $this->resolveBoard($task);
        $currentAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();

        if (!in_array((int)$user->id, $currentAssigneeIds, true)) {
            return response()->json(['message' => 'Thành viên không phụ trách công việc này.'], 404);
        }

        // Check if member is still in subtasks of parent task
        $subtasksWithUser = $task->subtasks()
            ->whereHas('assignees', fn($q) => $q->where('users.id', $user->id))
            ->select(['id', 'title', 'completed_at'])
            ->get();

        $force = $request->boolean('force');
        $removeFromSubtasks = $request->boolean('remove_from_subtasks');
        $onlyParent = $request->boolean('only_parent');

        if ($subtasksWithUser->isNotEmpty() && !$force && !$removeFromSubtasks && !$onlyParent) {
            return response()->json([
                'warning' => 'USER_STILL_IN_SUBTASKS',
                'message' => "Thành viên {$user->name} vẫn đang phụ trách {$subtasksWithUser->count()} Task con.",
                'subtasks' => $subtasksWithUser,
            ], 200);
        }

        DB::transaction(function () use ($task, $user, $currentAssigneeIds, $removeFromSubtasks, $request, $board) {
            $newAssigneeIds = array_values(array_diff($currentAssigneeIds, [(int)$user->id]));
            $task->syncAssigneesWithAutoSplit($newAssigneeIds, $request->user()->id);

            // Remove from selected or all subtasks if requested
            if ($removeFromSubtasks) {
                $selectedSubtaskIds = $request->input('subtask_ids', []);
                $subtasksQuery = $task->subtasks()->whereHas('assignees', fn($q) => $q->where('users.id', $user->id));
                if (!empty($selectedSubtaskIds)) {
                    $subtasksQuery->whereIn('id', $selectedSubtaskIds);
                }
                $affectedSubtasks = $subtasksQuery->get();

                foreach ($affectedSubtasks as $sub) {
                    $subAssignees = $sub->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
                    $subNew = array_values(array_diff($subAssignees, [(int)$user->id]));
                    $sub->syncAssigneesWithAutoSplit($subNew, $request->user()->id);
                }
            }

            if ($board) {
                $isSubtask = !empty($task->parent_task_id);
                $taskTypeLabel = $isSubtask ? "Task con '{$task->title}'" : "Task '{$task->title}'";

                ActivityLog::create([
                    'board_id' => $board->id,
                    'task_id' => $task->id,
                    'user_id' => $request->user()->id,
                    'action' => "gỡ {$user->name} khỏi {$taskTypeLabel}",
                    'old_value' => $user->name,
                ]);
            }
        });

        // Notify user
        if ($user->id !== $request->user()->id) {
            NotificationService::notifyUnassigned($task, $user, $request->user());
        }

        return response()->json([
            'message' => "Đã gỡ {$user->name} khỏi công việc.",
            'task' => $task->fresh()->load(['assignees', 'subtasks.assignees']),
        ]);
    }

    /**
     * POST /api/tasks/{task}/copy-assignees-to-subtasks
     * Copy parent task assignees down to subtasks.
     */
    public function copyAssigneesToSubtasks(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate([
            'mode' => 'required|in:all,selected',
            'subtask_ids' => 'required_if:mode,selected|array',
            'subtask_ids.*' => 'integer|exists:tasks,id',
            'merge_strategy' => 'sometimes|in:merge,replace',
        ]);

        $board = $this->resolveBoard($task);
        if (!$board) {
            return response()->json(['message' => 'Không tìm thấy bảng.'], 404);
        }

        $parentAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
        if (empty($parentAssigneeIds)) {
            return response()->json(['message' => 'Task cha chưa có thành viên nào để sao chép.'], 422);
        }

        $mode = $request->input('mode', 'all');
        $strategy = $request->input('merge_strategy', 'merge');
        $subtaskIds = $request->input('subtask_ids', []);

        $subtasksQuery = $task->subtasks();
        if ($mode === 'selected' && !empty($subtaskIds)) {
            $subtasksQuery->whereIn('id', $subtaskIds);
        }
        $subtasks = $subtasksQuery->get();

        if ($subtasks->isEmpty()) {
            return response()->json(['message' => 'Không tìm thấy Task con phù hợp.'], 422);
        }

        DB::transaction(function () use ($subtasks, $parentAssigneeIds, $strategy, $request, $board, $task) {
            foreach ($subtasks as $subtask) {
                $currentSubAssigneeIds = $subtask->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();

                $targetAssigneeIds = $strategy === 'replace'
                    ? $parentAssigneeIds
                    : array_values(array_unique(array_merge($currentSubAssigneeIds, $parentAssigneeIds)));

                $subtask->syncAssigneesWithAutoSplit($targetAssigneeIds, $request->user()->id);

                // Notify newly assigned members
                $newMembers = array_diff($targetAssigneeIds, $currentSubAssigneeIds);
                foreach ($newMembers as $uid) {
                    if ($uid !== $request->user()->id) {
                        $user = User::find($uid);
                        if ($user) {
                            $user->notify(new TaskMemberAssignedNotification(
                                $subtask,
                                $request->user(),
                                $board->id,
                                $board->name ?? 'Bảng công việc',
                                $board->public_id ?? null
                            ));
                        }
                    }
                }
            }

            ActivityLog::create([
                'board_id' => $board->id,
                'task_id' => $task->id,
                'user_id' => $request->user()->id,
                'action' => "sao chép thành viên Task cha sang " . $subtasks->count() . " Task con",
                'new_value' => json_encode(['parent_assignees' => $parentAssigneeIds, 'strategy' => $strategy]),
            ]);
        });

        return response()->json([
            'message' => 'Đã sao chép thành viên Task cha sang các Task con thành công.',
            'task' => $task->fresh()->load(['assignees', 'subtasks.assignees']),
        ]);
    }

    /**
     * PUT /api/tasks/{task}/contribution-percents
     * Adjust contribution percents for task assignees.
     */
    public function updateContributionPercents(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $rawInput = $request->input('contribution_percents') ?? $request->input('percents');
        if (!is_array($rawInput) || empty($rawInput)) {
            return response()->json([
                'message' => 'The contribution percents field is required.',
                'errors' => ['contribution_percents' => ['The contribution percents field is required.']],
            ], 422);
        }

        $inputPercents = [];
        foreach ($rawInput as $key => $val) {
            if (is_array($val) && isset($val['user_id'])) {
                $inputPercents[(int)$val['user_id']] = (float)($val['contribution_percent'] ?? 0);
            } else {
                $inputPercents[(int)$key] = (float)$val;
            }
        }

        $board = $this->resolveBoard($task);
        $currentAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();

        // Sum check
        $sum = 0.0;
        foreach ($currentAssigneeIds as $uid) {
            if (!isset($inputPercents[$uid])) {
                return response()->json([
                    'message' => 'Thiếu tỷ lệ đóng góp cho một hoặc nhiều thành viên.',
                    'errors' => ['contribution_percents' => ['Tất cả thành viên phải có tỷ lệ đóng góp.']],
                ], 422);
            }
            $sum += (float) $inputPercents[$uid];
        }

        if (abs($sum - 100.0) >= 0.1) {
            return response()->json([
                'message' => 'Tổng tỷ lệ đóng góp phải bằng 100%.',
                'errors' => ['contribution_percents' => ["Tổng tỷ lệ hiện tại là {$sum}%, phải bằng 100%."]],
            ], 422);
        }

        DB::transaction(function () use ($task, $currentAssigneeIds, $inputPercents, $request, $board) {
            foreach ($currentAssigneeIds as $uid) {
                DB::table('task_assignees')
                    ->where('task_id', $task->id)
                    ->where('user_id', $uid)
                    ->update([
                        'contribution_percent' => (float) $inputPercents[$uid],
                        'updated_at' => now(),
                    ]);
            }

            if ($board) {
                ActivityLog::create([
                    'board_id' => $board->id,
                    'task_id' => $task->id,
                    'user_id' => $request->user()->id,
                    'action' => "cập nhật tỷ lệ đóng góp công việc '{$task->title}'",
                    'new_value' => json_encode($inputPercents),
                ]);
            }
        });

        return response()->json([
            'message' => 'Cập nhật tỷ lệ đóng góp thành công.',
            'task' => $task->fresh()->load('assignees'),
        ]);
    }
}
