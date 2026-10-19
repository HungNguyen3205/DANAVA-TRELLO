<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSubtaskRequest;
use App\Http\Requests\UpdateSubtaskRequest;
use App\Http\Requests\ReorderSubtasksRequest;
use App\Models\ActivityLog;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskMemberAssignedNotification;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class SubtaskController extends Controller
{
    private function resolveBoard($task)
    {
        return $task->column?->board ?: DB::table('kanban_columns')
            ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
            ->where('kanban_columns.id', $task->column_id)
            ->select('boards.*')
            ->first();
    }

    private function getValidBoardMemberIds(int $boardId): array
    {
        return DB::table('board_members')
            ->where('board_id', $boardId)
            ->pluck('user_id')
            ->toArray();
    }

    /**
     * GET /api/tasks/{task}/subtasks
     * List all subtasks for a parent task.
     */
    public function index(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        $subtasks = $task->subtasks()
            ->with(['assignees', 'creator', 'labels'])
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        return response()->json($subtasks);
    }

    /**
     * POST /api/tasks/{task}/subtasks
     * Create a new subtask under a parent task.
     */
    public function store(StoreSubtaskRequest $request, ...$args): JsonResponse
    {
        $rawTask = $args[0] ?? null;
        $task = ($rawTask instanceof Task) ? $rawTask : Task::findOrFail($rawTask);
        Gate::authorize('createSubtask', $task);

        $currentUser = $request->user();
        $board = $this->resolveBoard($task);

        if (!$board) {
            return response()->json(['message' => 'Không tìm thấy bảng cho công việc này.'], 404);
        }

        $validMemberIds = $this->getValidBoardMemberIds($board->id);

        // Validate assignees belong to board or copy from parent
        $assigneeIds = $request->input('assignee_ids', []);
        if ($request->boolean('copy_parent_assignees') && empty($assigneeIds)) {
            $assigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
        }

        if (!empty($assigneeIds)) {
            $invalidUsers = array_diff($assigneeIds, $validMemberIds);
            if (!empty($invalidUsers)) {
                return response()->json([
                    'message' => 'Chỉ có thể giao việc cho thành viên thuộc bảng này.',
                    'errors' => ['assignee_ids' => ['Một hoặc nhiều người dùng không thuộc bảng.']]
                ], 422);
            }
        }

        $maxSortOrder = $task->subtasks()->max('sort_order') ?? 0;
        $sortOrder = $request->input('sort_order', $maxSortOrder + 1);

        $subtask = DB::transaction(function () use ($request, $task, $currentUser, $sortOrder, $assigneeIds, $board) {
            $created = Task::create([
                'parent_task_id' => $task->id,
                'column_id' => $task->column_id,
                'sprint_id' => $task->sprint_id,
                'assignee_id' => $assigneeIds[0] ?? null,
                'created_by' => $currentUser->id,
                'title' => trim($request->input('title')),
                'description' => $request->input('description'),
                'priority' => $request->input('priority', 'Bình thường'),
                'complexity' => strtoupper(trim((string)$request->input('complexity', 'M'))) ?: 'M',
                'order' => $task->order ?? 0,
                'sort_order' => $sortOrder,
                'start_date' => $request->input('start_date'),
                'due_date' => $request->input('due_date'),
                'completed_at' => null,
            ]);

            // Sync assignees with auto-split contribution
            $created->syncAssigneesWithAutoSplit($assigneeIds, $currentUser->id);

            // Log activity
            ActivityLog::create([
                'board_id' => $board->id,
                'task_id' => $created->id,
                'user_id' => $currentUser->id,
                'action' => 'tạo công việc con: "' . $created->title . '"',
                'new_value' => $created->title,
            ]);

            return $created;
        });

        // Send notifications to assignees (excluding actor)
        if (!empty($assigneeIds)) {
            foreach ($assigneeIds as $uid) {
                if ($uid !== $currentUser->id) {
                    $user = User::find($uid);
                    if ($user) {
                        $user->notify(new TaskMemberAssignedNotification(
                            $subtask,
                            $currentUser,
                            $board->id,
                            $board->name ?? 'Bảng công việc',
                            $board->public_id ?? null
                        ));
                    }
                }
            }
        }

        return response()->json($subtask->load(['assignees', 'creator']), 201);
    }

    /**
     * GET /api/tasks/subtasks/{subtask}
     * Get single subtask details.
     */
    public function show(Request $request, ...$args): JsonResponse
    {
        $rawSubtask = end($args);
        $subtask = ($rawSubtask instanceof Task) ? $rawSubtask : Task::findOrFail($rawSubtask);
        if (count($args) > 1) {
            $rawParent = $args[0];
            $parentTask = ($rawParent instanceof Task) ? $rawParent : Task::find($rawParent);
            if ($parentTask && (int)$subtask->parent_task_id !== (int)$parentTask->id) {
                return response()->json(['message' => 'Công việc con không thuộc công việc cha này.'], 404);
            }
        }

        Gate::authorize('view', $subtask);

        return response()->json($subtask->load([
            'parent.assignees',
            'assignees',
            'creator',
            'labels',
            'activityLogs.user'
        ]));
    }

    /**
     * PATCH /api/tasks/subtasks/{subtask}
     * Full edit of a subtask.
     */
    public function update(UpdateSubtaskRequest $request, ...$args): JsonResponse
    {
        $rawSubtask = end($args);
        $subtask = ($rawSubtask instanceof Task) ? $rawSubtask : Task::findOrFail($rawSubtask);
        if (count($args) > 1) {
            $rawParent = $args[0];
            $parentTask = ($rawParent instanceof Task) ? $rawParent : Task::find($rawParent);
            if ($parentTask && (int)$subtask->parent_task_id !== (int)$parentTask->id) {
                return response()->json(['message' => 'Công việc con không thuộc công việc cha này.'], 404);
            }
        }

        Gate::authorize('update', $subtask);

        $currentUser = $request->user();
        $board = $this->resolveBoard($subtask);

        if (!$board) {
            return response()->json(['message' => 'Không tìm thấy bảng cho công việc này.'], 404);
        }

        $validMemberIds = $this->getValidBoardMemberIds($board->id);

        $updates = [];
        $logs = [];

        // Title
        if ($request->has('title') && $request->input('title') !== $subtask->title) {
            $newTitle = trim($request->input('title'));
            $logs[] = [
                'action' => 'đổi tên công việc con',
                'old_value' => $subtask->title,
                'new_value' => $newTitle,
            ];
            $updates['title'] = $newTitle;
        }

        // Description
        if ($request->has('description') && $request->input('description') !== $subtask->description) {
            $newDesc = $request->input('description');
            $logs[] = [
                'action' => 'cập nhật mô tả',
                'old_value' => \Illuminate\Support\Str::limit($subtask->description, 50),
                'new_value' => \Illuminate\Support\Str::limit($newDesc, 50),
            ];
            $updates['description'] = $newDesc;
        }

        // Priority
        if ($request->has('priority') && $request->input('priority') !== $subtask->priority) {
            $newPriority = $request->input('priority') ?: 'Bình thường';
            $logs[] = [
                'action' => 'đổi mức độ ưu tiên',
                'old_value' => $subtask->priority,
                'new_value' => $newPriority,
            ];
            $updates['priority'] = $newPriority;
        }

        // Complexity
        if ($request->has('complexity') && $request->input('complexity') !== $subtask->complexity) {
            $newComplexity = strtoupper(trim((string)$request->input('complexity'))) ?: 'M';
            $logs[] = [
                'action' => 'đổi độ phức tạp',
                'old_value' => $subtask->complexity ?: 'M',
                'new_value' => $newComplexity,
            ];
            $updates['complexity'] = $newComplexity;
        }

        // Due date
        if ($request->has('due_date') && $request->input('due_date') !== $subtask->due_date) {
            $newDueDate = $request->input('due_date');
            $logs[] = [
                'action' => 'đổi ngày đến hạn',
                'old_value' => $subtask->due_date,
                'new_value' => $newDueDate,
            ];
            $updates['due_date'] = $newDueDate;
        }

        // Start date
        if ($request->has('start_date') && $request->input('start_date') !== $subtask->start_date) {
            $updates['start_date'] = $request->input('start_date');
        }

        // Completion status
        if ($request->has('is_completed')) {
            $isCompleted = filter_var($request->input('is_completed'), FILTER_VALIDATE_BOOLEAN);
            $wasCompleted = !empty($subtask->completed_at);

            if ($isCompleted !== $wasCompleted) {
                $updates['completed_at'] = $isCompleted ? now() : null;
                $updates['completed_by'] = $isCompleted ? $currentUser->id : null;
                $logs[] = [
                    'action' => $isCompleted ? 'hoàn thành công việc con' : 'đánh dấu chưa hoàn thành',
                    'old_value' => $wasCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành',
                    'new_value' => $isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành',
                ];
            }
        } elseif ($request->has('completed_at')) {
            $updates['completed_at'] = $request->input('completed_at');
        }

        if ($request->has('sort_order')) {
            $updates['sort_order'] = $request->input('sort_order');
        }

        // Assignees change detection
        $newAssigneeIds = null;
        $addedAssignees = [];
        if ($request->has('assignee_ids')) {
            $newAssigneeIds = array_map('intval', (array) $request->input('assignee_ids', []));
            $invalidUsers = array_diff($newAssigneeIds, $validMemberIds);
            if (!empty($invalidUsers)) {
                return response()->json([
                    'message' => 'Chỉ có thể giao việc cho thành viên thuộc bảng.',
                    'errors' => ['assignee_ids' => ['Một hoặc nhiều người dùng không thuộc bảng.']]
                ], 422);
            }

            $currentAssigneeIds = $subtask->assignees()->pluck('users.id')->toArray();
            $added = array_diff($newAssigneeIds, $currentAssigneeIds);
            $removed = array_diff($currentAssigneeIds, $newAssigneeIds);

            if (!empty($added)) {
                $addedUsers = User::whereIn('id', $added)->pluck('name')->implode(', ');
                $logs[] = [
                    'action' => 'gắn thành viên',
                    'new_value' => $addedUsers,
                ];
                $addedAssignees = $added;
            }

            if (!empty($removed)) {
                $removedUsers = User::whereIn('id', $removed)->pluck('name')->implode(', ');
                $logs[] = [
                    'action' => 'gỡ thành viên',
                    'old_value' => $removedUsers,
                ];
            }

            $updates['assignee_id'] = $newAssigneeIds[0] ?? null;
        }

        DB::transaction(function () use ($subtask, $updates, $newAssigneeIds, $currentUser, $logs, $board) {
            if (!empty($updates)) {
                $subtask->update($updates);
            }

            if ($newAssigneeIds !== null) {
                $subtask->syncAssigneesWithAutoSplit($newAssigneeIds, $currentUser->id);
            }

            foreach ($logs as $log) {
                ActivityLog::create([
                    'board_id' => $board->id,
                    'task_id' => $subtask->id,
                    'user_id' => $currentUser->id,
                    'action' => $log['action'],
                    'old_value' => $log['old_value'] ?? null,
                    'new_value' => $log['new_value'] ?? null,
                ]);
            }
        });

        // Send notification to newly added assignees
        if (!empty($addedAssignees)) {
            foreach ($addedAssignees as $uid) {
                if ($uid !== $currentUser->id) {
                    $user = User::find($uid);
                    if ($user) {
                        $user->notify(new TaskMemberAssignedNotification(
                            $subtask,
                            $currentUser,
                            $board->id,
                            $board->name ?? 'Bảng công việc',
                            $board->public_id ?? null
                        ));
                    }
                }
            }
        }

        // Send notification to unassigned members
        if (!empty($removed)) {
            foreach ($removed as $uid) {
                if ($uid !== $currentUser->id) {
                    $user = User::find($uid);
                    if ($user) {
                        NotificationService::notifyUnassigned($subtask, $user, $currentUser);
                    }
                }
            }
        }

        // Send notification for due date change
        if ($request->has('due_date')) {
            $oldDueDate = $subtask->getOriginal('due_date') ? Carbon::parse($subtask->getOriginal('due_date'))->toDateString() : null;
            $newDueDate = $subtask->due_date ? Carbon::parse($subtask->due_date)->toDateString() : null;
            if ($oldDueDate !== $newDueDate) {
                NotificationService::notifyDueDateChanged($subtask, $currentUser, $oldDueDate, $newDueDate);
            }
        }

        // Send notification for completion transition
        if (isset($isCompleted) && isset($wasCompleted) && $isCompleted !== $wasCompleted) {
            if ($isCompleted) {
                NotificationService::notifyTaskCompleted($subtask, $currentUser);
            } else {
                NotificationService::notifyTaskReopened($subtask, $currentUser);
            }
        }

        return response()->json($subtask->fresh(['assignees', 'creator', 'activityLogs.user']));
    }

    /**
     * DELETE /api/tasks/subtasks/{subtask}
     * Delete a subtask.
     */
    public function destroy(Request $request, ...$args): JsonResponse
    {
        $rawSubtask = end($args);
        $subtask = ($rawSubtask instanceof Task) ? $rawSubtask : Task::findOrFail($rawSubtask);
        if (count($args) > 1) {
            $rawParent = $args[0];
            $parentTask = ($rawParent instanceof Task) ? $rawParent : Task::find($rawParent);
            if ($parentTask && (int)$subtask->parent_task_id !== (int)$parentTask->id) {
                return response()->json(['message' => 'Công việc con không thuộc công việc cha này.'], 404);
            }
        }

        Gate::authorize('delete', $subtask);

        $currentUser = $request->user();
        $board = $this->resolveBoard($subtask);

        if ($board) {
            ActivityLog::create([
                'board_id' => $board->id,
                'task_id' => $subtask->parent_task_id ?: $subtask->id,
                'user_id' => $currentUser->id,
                'action' => 'xóa công việc con: "' . $subtask->title . '"',
                'old_value' => $subtask->title,
            ]);
        }

        $subtask->update(['deleted_by' => $currentUser->id]);
        $subtask->delete();

        return response()->json(['message' => 'Đã xóa công việc con thành công.']);
    }

    /**
     * PATCH /api/tasks/{task}/subtasks/reorder
     * Reorder subtasks and persist sort_order.
     */
    public function reorder(ReorderSubtasksRequest $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $subtaskIds = $request->input('subtask_ids', []);

        DB::transaction(function () use ($subtaskIds, $task) {
            foreach ($subtaskIds as $order => $subtaskId) {
                Task::where('id', $subtaskId)
                    ->where('parent_task_id', $task->id)
                    ->update(['sort_order' => $order + 1]);
            }
        });

        $board = $this->resolveBoard($task);
        if ($board) {
            ActivityLog::create([
                'board_id' => $board->id,
                'task_id' => $task->id,
                'user_id' => $request->user()->id,
                'action' => 'sắp xếp lại danh sách công việc con',
            ]);
        }

        return response()->json(['message' => 'Cập nhật thứ tự công việc con thành công.']);
    }
}
