<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Label;
use App\Models\Task;
use Illuminate\Http\Request;

class LabelController extends Controller
{
    public function index(Board $board)
    {
        return response()->json($board->labels);
    }

    public function store(Request $request, Board $board)
    {
        $request->validate([
            'name' => 'required|string',
            'color' => 'required|string'
        ]);

        $label = $board->labels()->create($request->only(['name', 'color']));
        return response()->json($label, 201);
    }

    public function update(Request $request, Label $label)
    {
        $request->validate([
            'name' => 'sometimes|string',
            'color' => 'sometimes|string'
        ]);

        $label->update($request->only(['name', 'color']));
        return response()->json($label);
    }

    public function destroy(Label $label)
    {
        $label->delete();
        return response()->json(['message' => 'Label deleted']);
    }

    public function syncTaskLabels(Request $request, Task $task)
    {
        $request->validate([
            'label_ids' => 'required|array',
            'label_ids.*' => 'exists:labels,id'
        ]);

        $task->labels()->sync($request->label_ids);
        return response()->json($task->load('labels'));
    }
}
