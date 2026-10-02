<?php

namespace App\Http\Controllers;

use App\Models\Task;
use Illuminate\Http\Request;

class TaskDetailController extends Controller
{
    // Cập nhật chi tiết thẻ (Mô tả, Tiêu đề)
    public function update(Request $request, Task $task)
    {
        $request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
        ]);

        $task->update($request->only(['title', 'description']));
        return response()->json($task);
    }

    // Thêm comment
    public function addComment(Request $request, Task $task)
    {
        $request->validate(['content' => 'required|string']);
        
        $comment = $task->comments()->create([
            'user_id' => $request->user()->id,
            'content' => $request->content
        ]);
        
        return response()->json($comment->load('user'), 201);
    // Xoá (Lưu trữ) thẻ
    public function destroy(Task $task)
    {
        $task->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
