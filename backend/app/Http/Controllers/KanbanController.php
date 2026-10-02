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
        if (!$workspace->members()->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $columns = $board->columns()->with(['tasks' => function ($query) {
            $query->orderBy('order');
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
}
