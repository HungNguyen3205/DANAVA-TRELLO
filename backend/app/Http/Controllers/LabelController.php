<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Label;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LabelController extends Controller
{
    private function canEditBoard($user, $boardId)
    {
        $board = Board::find($boardId);
        if (!$board) return false;

        // Check workspace admin
        $wsMember = DB::table('workspace_members')
            ->where('workspace_id', $board->workspace_id)
            ->where('user_id', $user->id)
            ->first();
            
        if ($wsMember && $wsMember->role === 'admin') {
            return true;
        }

        // Check board role
        $boardMember = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $user->id)
            ->first();

        if ($boardMember && in_array($boardMember->role, ['admin', 'editor'])) {
            return true;
        }

        return false;
    }

    public function index(Board $board)
    {
        return response()->json($board->labels);
    }

    public function store(Request $request, Board $board)
    {
        if (!$this->canEditBoard($request->user(), $board->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('labels')->where(function ($query) use ($board) {
                    return $query->where('board_id', $board->id);
                })
            ],
            'color' => 'required|string'
        ], [
            'name.unique' => 'Tên nhãn đã tồn tại trong bảng này.',
            'name.required' => 'Tên nhãn không được để trống.'
        ]);

        $label = $board->labels()->create($request->only(['name', 'color']));
        return response()->json($label, 201);
    }

    public function update(Request $request, Label $label)
    {
        if (!$this->canEditBoard($request->user(), $label->board_id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'name' => [
                'sometimes',
                'string',
                Rule::unique('labels')->where(function ($query) use ($label) {
                    return $query->where('board_id', $label->board_id);
                })->ignore($label->id)
            ],
            'color' => 'sometimes|string'
        ], [
            'name.unique' => 'Tên nhãn đã tồn tại trong bảng này.'
        ]);

        $label->update($request->only(['name', 'color']));
        return response()->json($label);
    }

    public function destroy(Request $request, Label $label)
    {
        if (!$this->canEditBoard($request->user(), $label->board_id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // DB Cascade should handle pivot table `task_label` removal.
        $label->delete();
        return response()->json(['message' => 'Label deleted']);
    }

    public function syncTaskLabels(Request $request, Task $task)
    {
        // Load task column -> board to check permission
        $task->load('column.board');
        if (!$task->column || !$task->column->board) {
            return response()->json(['message' => 'Task not in a board'], 404);
        }

        if (!$this->canEditBoard($request->user(), $task->column->board->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'label_ids' => 'required|array',
            'label_ids.*' => 'exists:labels,id'
        ]);

        $task->labels()->sync($request->label_ids);
        return response()->json($task->load('labels'));
    }
}

