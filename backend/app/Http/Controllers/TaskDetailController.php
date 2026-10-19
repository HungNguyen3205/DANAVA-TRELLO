<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class TaskDetailController extends Controller
{
    public function show(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        return response()->json($task->load([
            'subtasks' => function ($q) {
                $q->with(['assignees', 'creator', 'labels'])->orderBy('sort_order', 'asc')->orderBy('id', 'asc');
            },
            'assignees',
            'creator',
            'checklists.items',
            'labels',
            'attachments',
            'comments.user',
            'activityLogs.user'
        ]));
    }

    /**
     * PUT /api/tasks/{task}
     * Update task details (title, description, column_id, priority, assignees, dates).
     */
    public function update(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'column_id' => 'sometimes|integer|exists:kanban_columns,id',
            'priority' => 'sometimes|string',
            'complexity' => 'sometimes|nullable|string|in:XS,S,M,L,XL,xs,s,m,l,xl',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'assignee_ids' => 'sometimes|nullable|array',
            'assignee_ids.*' => 'integer|exists:users,id',
            'contribution_percents' => 'sometimes|nullable|array',
            'contribution_percents.*' => 'numeric|min:0|max:100',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'completed_at' => 'nullable',
        ]);

        $taskBoardId = $task->column?->board_id ?: (int) DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');

        $oldDueDate = $task->due_date ? Carbon::parse($task->due_date)->toDateString() : null;
        $oldColumnId = (int)$task->column_id;
        $wasCompleted = !empty($task->completed_at);
        $removedAssignees = [];
        $newColumn = null;

        // Security: Ensure new column_id belongs to the SAME board
        if ($request->has('column_id')) {
            $newColumn = KanbanColumn::find($request->column_id);
            if (!$newColumn || (int)$newColumn->board_id !== $taskBoardId) {
                return response()->json([
                    'message' => 'Cột đích không thuộc cùng bảng với công việc.',
                    'errors' => ['column_id' => ['Cột đích không thuộc cùng bảng với công việc.']]
                ], 422);
            }

            // WIP Limit Check (Strict mode)
            // Subtasks do not count towards WIP. Moving within same column does not change WIP count.
            if ((int)$newColumn->id !== $oldColumnId && is_null($task->parent_task_id)) {
                if ($newColumn->wip_limit && $newColumn->wip_limit > 0 && $newColumn->wip_enforcement === 'strict') {
                    if ($newColumn->wip_count >= $newColumn->wip_limit) {
                        return response()->json([
                            'message' => "Cột '{$newColumn->title}' đã đạt giới hạn WIP tối đa ({$newColumn->wip_limit} công việc). Chế độ Nghiêm ngặt (Strict) không cho phép chuyển thêm công việc vào cột này.",
                            'error_code' => 'WIP_LIMIT_EXCEEDED',
                            'errors' => ['column_id' => ["Cột đã đạt giới hạn WIP tối đa ({$newColumn->wip_limit} công việc)."]],
                            'wip_limit' => $newColumn->wip_limit,
                            'wip_count' => $newColumn->wip_count,
                            'enforcement' => 'strict',
                        ], 422);
                    }
                }
            }
        }

        $validBoardMemberIds = DB::table('board_members')
            ->where('board_id', $taskBoardId)
            ->pluck('user_id')
            ->map(fn($id) => (int)$id)
            ->toArray();

        $updateData = $request->only([
            'title', 'description', 'column_id', 'priority', 'start_date', 'due_date', 'completed_at'
        ]);

        if ($request->has('complexity')) {
            $updateData['complexity'] = strtoupper(trim((string)$request->input('complexity'))) ?: 'M';
        }

        // Auto-complete or reopen when moved to/from Done column if completed_at not explicitly passed
        if ($newColumn && !$request->has('completed_at')) {
            $doneColumnNames = ['done', 'hoàn thành', 'completed'];
            $isDoneCol = in_array(mb_strtolower(trim($newColumn->title ?? '')), $doneColumnNames, true);
            if ($isDoneCol && !$wasCompleted) {
                $updateData['completed_at'] = now();
                $updateData['completed_by'] = $request->user()->id;
            } elseif (!$isDoneCol && $wasCompleted) {
                $updateData['completed_at'] = null;
                $updateData['completed_by'] = null;
            }
        }

        // Security: Handle and validate assignees against board membership
        $newAssigneeIds = null;
        $addedAssignees = [];
        $contributionPercents = $request->input('contribution_percents', []);

        if ($request->has('assignee_ids')) {
            $newAssigneeIds = array_map('intval', (array) $request->input('assignee_ids', []));
            $invalidUsers = array_diff($newAssigneeIds, $validBoardMemberIds);
            if (!empty($invalidUsers)) {
                return response()->json([
                    'message' => 'Chỉ có thể giao việc cho thành viên thuộc bảng.',
                    'errors' => ['assignee_ids' => ['Một hoặc nhiều người dùng không thuộc bảng này.']]
                ], 422);
            }

            $currentAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
            $addedAssignees = array_diff($newAssigneeIds, $currentAssigneeIds);
            $removedAssignees = array_diff($currentAssigneeIds, $newAssigneeIds);

            $updateData['assignee_id'] = $newAssigneeIds[0] ?? null;
        } elseif ($request->has('assignee_id')) {
            $assigneeId = $request->input('assignee_id') ? (int) $request->input('assignee_id') : null;
            if ($assigneeId && !in_array($assigneeId, $validBoardMemberIds, true)) {
                return response()->json([
                    'message' => 'Thành viên được giao không thuộc bảng này.',
                    'errors' => ['assignee_id' => ['Thành viên được giao không thuộc bảng này.']]
                ], 422);
            }
            $newAssigneeIds = $assigneeId ? [$assigneeId] : [];
            $currentAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
            $addedAssignees = array_diff($newAssigneeIds, $currentAssigneeIds);
            $removedAssignees = array_diff($currentAssigneeIds, $newAssigneeIds);
            $updateData['assignee_id'] = $assigneeId;
        }

        // Validate contribution_percents if explicitly passed for multiple assignees
        if (!empty($contributionPercents) && !empty($newAssigneeIds)) {
            $sum = 0.0;
            foreach ($newAssigneeIds as $uid) {
                if (isset($contributionPercents[$uid])) {
                    $sum += (float) $contributionPercents[$uid];
                }
            }
            if (abs($sum - 100.0) >= 0.1) {
                return response()->json([
                    'message' => 'Tổng tỷ lệ đóng góp của các thành viên phải bằng 100%.',
                    'errors' => ['contribution_percents' => ['Tổng tỷ lệ đóng góp phải bằng 100%.']]
                ], 422);
            }
        }

        DB::transaction(function () use ($task, $updateData, $newAssigneeIds, $contributionPercents, $request) {
            $task->update($updateData);

            if ($newAssigneeIds !== null) {
                $syncData = [];
                foreach ($newAssigneeIds as $uid) {
                    $percent = isset($contributionPercents[$uid]) ? (float)$contributionPercents[$uid] : null;
                    $syncData[$uid] = [
                        'assigned_by' => $request->user()->id,
                        'contribution_percent' => $percent,
                    ];
                }
                $task->assignees()->sync($syncData);
            }
        });

        // 1. Send notifications to newly added assignees
        if (!empty($addedAssignees) && $taskBoardId) {
            $board = Board::find($taskBoardId);
            foreach ($addedAssignees as $uid) {
                if ($uid !== $request->user()->id) {
                    $newAssignee = User::find($uid);
                    if ($newAssignee) {
                        $newAssignee->notify(new \App\Notifications\TaskMemberAssignedNotification(
                            $task,
                            $request->user(),
                            $board->id,
                            $board->name ?? 'Bảng công việc',
                            $board->public_id ?? null
                        ));
                    }
                }
            }
        }

        // 2. Send notification to unassigned members
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

        // 3. Send notification for due date change
        if ($request->has('due_date')) {
            $newDueDate = $task->due_date ? Carbon::parse($task->due_date)->toDateString() : null;
            if ($oldDueDate !== $newDueDate) {
                NotificationService::notifyDueDateChanged($task, $request->user(), $oldDueDate, $newDueDate);
            }
        }

        // 4. Send notification for column move
        if ($newColumn && (int)$oldColumnId !== (int)$newColumn->id) {
            NotificationService::notifyColumnMoved($task, $request->user(), $newColumn);
        }

        // 5. Send notification for task completed / reopened
        $isCompletedNow = !empty($task->completed_at);
        if (!$wasCompleted && $isCompletedNow) {
            NotificationService::notifyTaskCompleted($task, $request->user());
        } elseif ($wasCompleted && !$isCompletedNow) {
            NotificationService::notifyTaskReopened($task, $request->user());
        }

        return response()->json($task->fresh([
            'subtasks.assignees',
            'subtasks.creator',
            'assignees',
            'creator',
            'checklists.items',
            'labels',
            'attachments',
            'comments.user'
        ]));
    }

    /**
     * POST /api/tasks/{task}/comments
     */
    public function addComment(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        $request->validate(['content' => 'required|string']);
        
        $comment = $task->comments()->create([
            'user_id' => $request->user()->id,
            'content' => $request->content
        ]);

        \App\Models\ActivityLog::create([
            'task_id' => $task->id,
            'user_id' => $request->user()->id,
            'action' => 'đã bình luận: "' . \Illuminate\Support\Str::limit($request->content, 35) . '"',
        ]);

        NotificationService::notifyCommentAdded($task, $comment, $request->user());
        
        return response()->json($comment->load('user'), 201);
    }

    /**
     * PUT /api/comments/{comment}
     */
    public function updateComment(Request $request, TaskComment $comment): JsonResponse
    {
        Gate::authorize('view', $comment->task);

        abort_unless(
            (int)$comment->user_id === (int)$request->user()->id,
            403,
            'Bạn chỉ có thể chỉnh sửa bình luận của chính mình.'
        );

        $request->validate(['content' => 'required|string']);
        $comment->update(['content' => $request->content]);

        return response()->json($comment->load('user'));
    }

    /**
     * DELETE /api/comments/{comment}
     */
    public function deleteComment(Request $request, TaskComment $comment): JsonResponse
    {
        Gate::authorize('view', $comment->task);

        $isAuthor = ((int)$comment->user_id === (int)$request->user()->id);
        $taskBoardId = $comment->task->column?->board_id ?: DB::table('kanban_columns')->where('id', $comment->task->column_id)->value('board_id');
        $isBoardAdmin = $request->user()->isBoardAdmin($taskBoardId);

        abort_unless(
            $isAuthor || $isBoardAdmin,
            403,
            'Bạn chỉ có thể xóa bình luận của chính mình.'
        );

        $comment->delete();

        return response()->json(['message' => 'Comment deleted successfully']);
    }

    /**
     * DELETE /api/tasks/{task}
     */
    public function destroy(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('delete', $task);

        $task->update(['deleted_by' => $request->user()->id]);
        $task->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    /**
     * POST /api/tasks/{task}/review
     * Quality review for a task.
     */
    public function reviewQuality(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        $board = $task->column?->board ?: ($task->parent?->column?->board);
        if (!$board || !$board->canManage($request->user())) {
            return response()->json([
                'message' => 'Chỉ Quản trị viên hoặc Chủ sở hữu Bảng mới có quyền đánh giá chất lượng.',
            ], 403);
        }

        $request->validate([
            'rating' => 'nullable|numeric|min:1|max:5',
            'summary' => 'nullable|string|max:500',
        ]);

        $rating = $request->input('rating') ? (int) $request->input('rating') : null;
        $summary = $request->input('summary', '');
        $ratingSummary = $rating ? "{$rating}/5 sao" . ($summary ? " - {$summary}" : "") : $summary;

        // Persist quality rating to database
        $task->update([
            'quality_rating' => $rating,
            'quality_review_note' => $summary,
            'quality_reviewed_by' => $request->user()->id,
            'quality_reviewed_at' => now(),
        ]);

        // Log activity
        \App\Models\ActivityLog::create([
            'board_id' => $board->id,
            'task_id' => $task->id,
            'user_id' => $request->user()->id,
            'action' => 'đánh giá chất lượng',
            'old_value' => null,
            'new_value' => $ratingSummary,
        ]);

        NotificationService::notifyQualityReview($task, $request->user(), $ratingSummary);

        return response()->json([
            'message' => 'Đã lưu và gửi đánh giá chất lượng thành công',
            'task_id' => $task->id,
            'rating' => $rating,
            'summary' => $summary,
            'reviewed_at' => now()->toIso8601String(),
        ]);
    }
}


