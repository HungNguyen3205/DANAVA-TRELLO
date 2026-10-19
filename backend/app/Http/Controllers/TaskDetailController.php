<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Http\Request;

class TaskDetailController extends Controller
{
    private function ensureAccess(Request $request, Task $task): void
    {
        $boardId = $task->column?->board_id ?: \Illuminate\Support\Facades\DB::table('kanban_columns')
            ->where('id', $task->column_id)
            ->value('board_id');

        abort_unless(
            $boardId && \Illuminate\Support\Facades\DB::table('board_members')
                ->where('board_id', $boardId)
                ->where('user_id', $request->user()->id)
                ->exists(),
            403,
            'Bạn không có quyền truy cập công việc này.'
        );
    }

    public function show(Request $request, Task $task)
    {
        $this->ensureAccess($request, $task);
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

    // Cập nhật chi tiết thẻ (Mô tả, Tiêu đề, Thành viên, ...)
    public function update(Request $request, Task $task)
    {
        $this->ensureAccess($request, $task);

        $request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
            'column_id' => 'sometimes|exists:kanban_columns,id',
            'priority' => 'sometimes|in:Khẩn cấp,Cao,Bình thường,Thấp',
            'assignee_id' => 'nullable|exists:users,id',
            'assignee_ids' => 'sometimes|nullable|array',
            'assignee_ids.*' => 'integer|exists:users,id',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'completed_at' => 'nullable',
        ]);

        $board = $task->column?->board ?: \App\Models\Board::find(
            \Illuminate\Support\Facades\DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id')
        );

        $validBoardMemberIds = \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $board?->id)
            ->pluck('user_id')
            ->toArray();

        $updateData = $request->only([
            'title', 'description', 'column_id', 'priority', 'start_date', 'due_date', 'completed_at'
        ]);

        // Handle assignees
        $newAssigneeIds = null;
        $addedAssignees = [];

        if ($request->has('assignee_ids')) {
            $newAssigneeIds = array_map('intval', (array) $request->input('assignee_ids', []));
            $invalidUsers = array_diff($newAssigneeIds, $validBoardMemberIds);
            if (!empty($invalidUsers)) {
                return response()->json([
                    'message' => 'Chỉ có thể giao việc cho thành viên thuộc bảng.',
                    'errors' => ['assignee_ids' => ['Một hoặc nhiều người dùng không thuộc bảng.']]
                ], 422);
            }

            $currentAssigneeIds = $task->assignees()->pluck('users.id')->toArray();
            $addedAssignees = array_diff($newAssigneeIds, $currentAssigneeIds);

            $updateData['assignee_id'] = $newAssigneeIds[0] ?? null;
        } elseif ($request->has('assignee_id')) {
            $assigneeId = $request->input('assignee_id');
            if ($assigneeId && !in_array((int)$assigneeId, $validBoardMemberIds, true)) {
                return response()->json(['message' => 'Thành viên được giao không thuộc bảng.'], 422);
            }
            $newAssigneeIds = $assigneeId ? [(int)$assigneeId] : [];
            $currentAssigneeIds = $task->assignees()->pluck('users.id')->toArray();
            $addedAssignees = array_diff($newAssigneeIds, $currentAssigneeIds);
            $updateData['assignee_id'] = $assigneeId;
        }

        $task->update($updateData);

        if ($newAssigneeIds !== null) {
            $syncData = [];
            foreach ($newAssigneeIds as $uid) {
                $syncData[$uid] = ['assigned_by' => $request->user()->id];
            }
            $task->assignees()->sync($syncData);
        }

        // Send notifications without duplication
        if (!empty($addedAssignees) && $board) {
            foreach ($addedAssignees as $uid) {
                if ($uid !== $request->user()->id) {
                    $newAssignee = \App\Models\User::find($uid);
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

    // Thêm comment
    public function addComment(Request $request, Task $task)
    {
        $this->ensureAccess($request, $task);

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
        
        return response()->json($comment->load('user'), 201);
    }

    // Cập nhật comment
    public function updateComment(Request $request, TaskComment $comment)
    {
        $this->ensureAccess($request, $comment->task);

        abort_unless(
            $comment->user_id === $request->user()->id,
            403,
            'Bạn chỉ có thể chỉnh sửa bình luận của chính mình.'
        );

        $request->validate(['content' => 'required|string']);
        $comment->update(['content' => $request->content]);

        return response()->json($comment->load('user'));
    }

    // Xóa comment
    public function deleteComment(Request $request, TaskComment $comment)
    {
        $this->ensureAccess($request, $comment->task);

        abort_unless(
            $comment->user_id === $request->user()->id,
            403,
            'Bạn chỉ có thể xóa bình luận của chính mình.'
        );

        $comment->delete();

        return response()->json(['message' => 'Comment deleted successfully']);
    }

    // Xoá (Lưu trữ) thẻ
    public function destroy(Request $request, Task $task)
    {
        $this->ensureAccess($request, $task);

        $task->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
