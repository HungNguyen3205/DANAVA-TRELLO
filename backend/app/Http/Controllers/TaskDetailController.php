<?php

namespace App\Http\Controllers;

use App\Models\Task;
use Illuminate\Http\Request;

class TaskDetailController extends Controller
{
    private function ensureAccess(Request $request, Task $task): void
    {
        abort_unless(
            $task->column && 
            $task->column->board && 
            $task->column->board->workspace && 
            $task->column->board->workspace->members()->where('user_id', $request->user()->id)->exists(),
            403,
            'Bạn không có quyền truy cập công việc này.'
        );
    }

    public function show(Request $request, Task $task)
    {
        $this->ensureAccess($request, $task);
        return response()->json($task->load(['checklists.items', 'labels', 'attachments', 'comments.user']));
    }

    // Cập nhật chi tiết thẻ (Mô tả, Tiêu đề)
    public function update(Request $request, Task $task)
    {
        $this->ensureAccess($request, $task);

        $request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
            'column_id' => 'sometimes|exists:kanban_columns,id',
            'priority' => 'sometimes|in:Khẩn cấp,Cao,Bình thường,Thấp',
            'assignee_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
        ]);

        $oldAssignee = $task->assignee_id;

        $task->update($request->only([
            'title', 'description', 'column_id', 'priority', 'assignee_id', 'due_date'
        ]));

        if ($request->has('assignee_id') && $request->assignee_id != $oldAssignee && $request->assignee_id != null) {
            $newAssignee = \App\Models\User::find($request->assignee_id);
            if ($newAssignee && $newAssignee->id !== $request->user()->id) {
                // Check preferences
                $prefs = $newAssignee->notification_preferences ?? [];
                if (!isset($prefs['assigned']) || $prefs['assigned'] !== false) {
                    // Get board via column
                    $task->load('column.board');
                    $board = $task->column->board;
                    if ($board) {
                        $newAssignee->notify(new \App\Notifications\TaskAssignedNotification(
                            $task,
                            $request->user(),
                            $board->id,
                            $board->title
                        ));
                    }
                }
            }
        }

        return response()->json($task);
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
        
        return response()->json($comment->load('user'), 201);
    }

    // Xoá (Lưu trữ) thẻ
    public function destroy(Request $request, Task $task)
    {
        $this->ensureAccess($request, $task);

        $task->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
