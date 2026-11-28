<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Task;
use App\Services\Assistant\SubtaskSuggestionService;
use App\Services\Assistant\TaskApplyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * "Phân tích AI" in the task detail: propose subtasks from the description, then create
 * the ones the user kept after reviewing them.
 */
class SubtaskSuggestionController extends Controller
{
    /** POST /api/tasks/{task}/subtasks/ai-suggest: proposal only, nothing is created. */
    public function suggest(Request $request, Task $task, SubtaskSuggestionService $service): JsonResponse
    {
        Gate::authorize('createSubtask', $task);

        if (trim((string) $task->description) === '') {
            return response()->json(['message' => 'Công việc chưa có mô tả. Hãy viết mô tả (hoặc dán danh sách việc) rồi bấm Phân tích AI.'], 422);
        }

        return response()->json($service->suggest($request->user(), $task));
    }

    /** POST /api/tasks/{task}/subtasks/bulk: create the reviewed subtasks in one go. */
    public function store(Request $request, Task $task, TaskApplyService $applier): JsonResponse
    {
        Gate::authorize('createSubtask', $task);

        $data = $request->validate([
            'subtasks' => 'required|array|min:1|max:' . SubtaskSuggestionService::MAX,
            'subtasks.*.title' => 'required|string|max:255',
            'subtasks.*.done' => 'boolean',
            'copy_parent_assignees' => 'boolean',
        ]);

        $assignees = !empty($data['copy_parent_assignees'])
            ? $task->assignees()->pluck('users.id')->map(fn ($id) => (int) $id)->all()
            : [];
        $count = $applier->addSubtasks($request->user(), $task, $data['subtasks'], $assignees);

        $boardId = $task->column?->board_id;
        if ($boardId && $count) {
            ActivityLog::create([
                'board_id' => $boardId,
                'task_id' => $task->id,
                'user_id' => $request->user()->id,
                'action' => "tạo {$count} việc con bằng Phân tích AI",
                'new_value' => mb_substr(implode('; ', array_column($data['subtasks'], 'title')), 0, 1000),
            ]);
        }

        return response()->json(['created' => $count, 'message' => "Đã tạo {$count} việc con."], 201);
    }
}
