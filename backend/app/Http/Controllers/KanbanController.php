<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use Illuminate\Http\Request;

class KanbanController extends Controller
{
    // Lấy tất cả Cột và Thẻ của một Bảng
    public function index(Request $request, Board $board)
    {
        $workspace = $board->workspace;
        $userId = $request->user()->id;

        $workspaceMember = $workspace->members()->where('user_id', $userId)->first();
        if (!$workspaceMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($workspaceMember->pivot->role !== 'admin') {
            $inBoard = \Illuminate\Support\Facades\DB::table('board_members')
                ->where('board_id', $board->id)
                ->where('user_id', $userId)
                ->exists();
            if (!$inBoard) {
                return response()->json(['message' => 'Forbidden - You are not a member of this board'], 403);
            }
        }

        $columns = $board->columns()->with(['tasks' => function ($query) {
            $query->with(['checklists.items', 'labels', 'attachments', 'comments.user'])->orderBy('order');
        }])->orderBy('order')->get();

        return response()->json($columns);
    }

    // Tạo cột mới
    public function storeColumn(Request $request, Board $board)
    {
        $request->validate(['title' => 'required|string']);
        
        $maxOrder = $board->columns()->max('order') ?? 0;
        $column = $board->columns()->create([
            'title' => $request->title,
            'order' => $maxOrder + 1000,
        ]);

        return response()->json($column, 201);
    }

    // Tạo thẻ mới
    public function storeTask(Request $request, KanbanColumn $column)
    {
        $request->validate(['title' => 'required|string']);
        
        $maxOrder = $column->tasks()->max('order') ?? 0;
        $task = $column->tasks()->create([
            'title' => $request->title,
            'order' => $maxOrder + 1000,
            'priority' => $request->priority ?? 'Bình thường',
        ]);

        return response()->json($task, 201);
    }

    // Kéo thả Cột (Đổi vị trí)
    public function reorderColumns(Request $request, Board $board)
    {
        $request->validate([
            'columns' => 'required|array',
            'columns.*.id' => 'required|exists:kanban_columns,id',
            'columns.*.order' => 'required|numeric',
        ]);

        foreach ($request->columns as $col) {
            KanbanColumn::where('id', $col['id'])->where('board_id', $board->id)->update(['order' => $col['order']]);
        }

        return response()->json(['message' => 'Cập nhật vị trí cột thành công']);
    }

    // Kéo thả Thẻ (Đổi cột, Đổi vị trí)
    public function reorderTasks(Request $request, Board $board)
    {
        $request->validate([
            'tasks' => 'required|array',
            'tasks.*.id' => 'required|exists:tasks,id',
            'tasks.*.column_id' => 'required|exists:kanban_columns,id',
            'tasks.*.order' => 'required|numeric',
        ]);

        // Có thể tối ưu bằng DB::transaction
        foreach ($request->tasks as $taskData) {
            Task::where('id', $taskData['id'])->update([
                'column_id' => $taskData['column_id'],
                'order' => $taskData['order'],
            ]);
        }

        return response()->json(['message' => 'Cập nhật vị trí thẻ thành công']);
    }

    public function updateColumn(Request $request, KanbanColumn $column)
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'color' => 'sometimes|nullable|string|max:7',
        ]);

        $column->update($validated);

        return response()->json($column);
    }

    // Trello-style move task: Fractional Indexing / Single Task update
    public function moveTask(Request $request, Task $task)
    {
        $request->validate([
            'column_id' => 'required|exists:kanban_columns,id',
            'prev_id' => 'nullable|exists:tasks,id',
            'next_id' => 'nullable|exists:tasks,id',
        ]);

        // Security: Check if user is in board
        $board = KanbanColumn::find($request->column_id)->board;
        $workspace = $board->workspace;
        $userId = $request->user()->id;
        $workspaceMember = $workspace->members()->where('user_id', $userId)->first();
        if (!$workspaceMember || ($workspaceMember->pivot->role !== 'admin' && !\Illuminate\Support\Facades\DB::table('board_members')->where('board_id', $board->id)->where('user_id', $userId)->exists())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $prevOrder = 0;
        $nextOrder = 0;
        
        if ($request->prev_id) {
            $prevOrder = Task::find($request->prev_id)->order;
        }
        
        if ($request->next_id) {
            $nextOrder = Task::find($request->next_id)->order;
        }

        $newOrder = 0;
        if ($request->prev_id && $request->next_id) {
            $newOrder = ($prevOrder + $nextOrder) / 2.0;
        } elseif ($request->prev_id) {
            $newOrder = $prevOrder + 1000.0;
        } elseif ($request->next_id) {
            $newOrder = $nextOrder / 2.0;
        } else {
            $newOrder = 1000.0;
        }

        $task->update([
            'column_id' => $request->column_id,
            'order' => $newOrder
        ]);

        return response()->json(['message' => 'Cập nhật vị trí thẻ thành công', 'task' => $task]);
    }
}
