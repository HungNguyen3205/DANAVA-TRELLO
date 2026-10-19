<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Label;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class LabelController extends Controller
{
    public function index(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('view', $board);

        return response()->json($board->labels);
    }

    public function store(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('view', $board);

        $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('labels')->where(function ($query) use ($board) {
                    return $query->where('board_id', $board->id);
                })
            ],
            'color' => 'required|string|max:50'
        ], [
            'name.unique' => 'Tên nhãn đã tồn tại trong bảng này.',
            'name.required' => 'Tên nhãn không được để trống.'
        ]);

        $label = $board->labels()->create($request->only(['name', 'color']));
        return response()->json($label, 201);
    }

    public function update(Request $request, Label $label): JsonResponse
    {
        $label->loadMissing('board');
        Gate::authorize('view', $label->board);

        $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('labels')->where(function ($query) use ($label) {
                    return $query->where('board_id', $label->board_id);
                })->ignore($label->id)
            ],
            'color' => 'sometimes|string|max:50'
        ], [
            'name.unique' => 'Tên nhãn đã tồn tại trong bảng này.'
        ]);

        $label->update($request->only(['name', 'color']));
        return response()->json($label);
    }

    public function destroy(Request $request, Label $label): JsonResponse
    {
        $label->loadMissing('board');
        Gate::authorize('view', $label->board);

        $label->delete();
        return response()->json(['message' => 'Đã xóa nhãn thành công']);
    }

    public function syncTaskLabels(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate([
            'label_ids' => 'required|array',
            'label_ids.*' => 'integer|exists:labels,id'
        ]);

        $taskBoardId = $task->column?->board_id ?: DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');
        $validBoardLabelIds = Label::where('board_id', $taskBoardId)->pluck('id')->toArray();

        $invalidLabels = array_diff($request->label_ids, $validBoardLabelIds);
        if (!empty($invalidLabels)) {
            return response()->json([
                'message' => 'Một hoặc nhiều nhãn không thuộc bảng này.',
                'errors' => ['label_ids' => ['Một hoặc nhiều nhãn không thuộc bảng này.']]
            ], 422);
        }

        $task->labels()->sync($request->label_ids);
        return response()->json($task->load('labels'));
    }
}
