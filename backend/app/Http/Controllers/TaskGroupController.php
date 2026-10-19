<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class TaskGroupController extends Controller
{
    /**
     * GET /api/tasks/{task}/groups
     * List all task groups with their subtasks.
     */
    public function index(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        $groups = $task->taskGroups()
            ->with([
                'subtasks' => function ($q) {
                    $q->with(['assignees', 'creator', 'labels'])
                        ->orderBy('sort_order', 'asc')
                        ->orderBy('id', 'asc');
                },
                'creator',
            ])
            ->get();

        return response()->json($groups);
    }

    /**
     * POST /api/tasks/{task}/groups
     * Create a new task group under a parent task.
     */
    public function store(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('createSubtask', $task);

        if ($task->parent_task_id !== null) {
            return response()->json([
                'message' => 'Không thể tạo nhóm cho công việc con. Chỉ có thể tạo nhóm trên công việc chính.',
            ], 422);
        }

        $request->validate([
            'title' => 'required|string|max:255',
        ], [
            'title.required' => 'Vui lòng nhập tên nhóm việc cần làm.',
            'title.max' => 'Tên nhóm không được vượt quá 255 ký tự.',
        ]);

        $maxPosition = (int) $task->taskGroups()->max('position');

        $group = $task->taskGroups()->create([
            'title' => trim($request->input('title')),
            'position' => $maxPosition + 1,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json($group->load([
            'subtasks' => function ($q) {
                $q->with(['assignees', 'creator', 'labels']);
            },
            'creator',
        ]), 201);
    }

    /**
     * PUT/PATCH /api/tasks/{task}/groups/{group}
     * Update a task group's title or position.
     */
    public function update(Request $request, Task $task, TaskGroup $group): JsonResponse
    {
        Gate::authorize('update', $task);

        if ((int) $group->task_id !== (int) $task->id) {
            return response()->json([
                'message' => 'Nhóm việc cần làm không thuộc công việc này.',
            ], 404);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'position' => 'sometimes|integer|min:0',
        ]);

        $group->update($request->only(['title', 'position']));

        return response()->json($group->load([
            'subtasks' => function ($q) {
                $q->with(['assignees', 'creator', 'labels'])
                    ->orderBy('sort_order', 'asc')
                    ->orderBy('id', 'asc');
            },
            'creator',
        ]));
    }

    /**
     * DELETE /api/tasks/{task}/groups/{group}
     * Delete a task group. Handles empty groups, move subtasks, or soft-delete with subtasks.
     */
    public function destroy(Request $request, Task $task, TaskGroup $group): JsonResponse
    {
        Gate::authorize('update', $task);

        if ((int) $group->task_id !== (int) $task->id) {
            return response()->json([
                'message' => 'Nhóm việc cần làm không thuộc công việc này.',
            ], 404);
        }

        $subtasksCount = $group->subtasks()->count();
        $action = $request->input('action');

        // 1. If group has no subtasks, delete immediately
        if ($subtasksCount === 0) {
            $group->delete();
            return response()->json([
                'message' => 'Đã xóa nhóm việc cần làm.',
                'action' => 'deleted',
            ]);
        }

        // 2. If group has subtasks, require explicit action
        if ($action === 'move') {
            $targetGroupId = $request->input('target_group_id');
            if (!$targetGroupId) {
                return response()->json([
                    'message' => 'Vui lòng chọn nhóm đích để chuyển công việc con sang.',
                ], 422);
            }

            $targetGroup = TaskGroup::where('task_id', $task->id)
                ->where('id', $targetGroupId)
                ->first();

            if (!$targetGroup || (int) $targetGroup->id === (int) $group->id) {
                return response()->json([
                    'message' => 'Nhóm đích không hợp lệ hoặc không thuộc công việc này.',
                ], 422);
            }

            DB::transaction(function () use ($group, $targetGroup) {
                $group->subtasks()->update([
                    'task_group_id' => $targetGroup->id,
                ]);
                $group->delete();
            });

            return response()->json([
                'message' => 'Đã chuyển toàn bộ công việc con sang nhóm khác và xóa nhóm thành công.',
                'action' => 'moved',
                'target_group_id' => $targetGroup->id,
            ]);
        }

        if ($action === 'trash') {
            DB::transaction(function () use ($group, $request) {
                $userId = $request->user()?->id;
                $group->subtasks()->each(function ($subtask) use ($userId) {
                    $subtask->update(['deleted_by' => $userId]);
                    $subtask->delete();
                });
                $group->delete();
            });

            return response()->json([
                'message' => 'Đã đưa nhóm và toàn bộ công việc con vào thùng rác.',
                'action' => 'trashed',
            ]);
        }

        // Neither move nor trash chosen, return warning
        return response()->json([
            'message' => "Nhóm đang có {$subtasksCount} công việc con. Vui lòng chọn phương án chuyển sang nhóm khác hoặc đưa vào thùng rác.",
            'has_subtasks' => true,
            'subtasks_count' => $subtasksCount,
        ], 422);
    }

    /**
     * PATCH /api/tasks/{task}/groups/reorder
     * Reorder task groups within a parent task.
     */
    public function reorder(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate([
            'group_ids' => 'required|array',
            'group_ids.*' => 'integer',
        ]);

        $groupIds = $request->input('group_ids', []);

        DB::transaction(function () use ($task, $groupIds) {
            foreach ($groupIds as $pos => $gid) {
                TaskGroup::where('task_id', $task->id)
                    ->where('id', $gid)
                    ->update(['position' => $pos]);
            }
        });

        return response()->json(['message' => 'Đã cập nhật thứ tự các nhóm thành công.']);
    }
}
