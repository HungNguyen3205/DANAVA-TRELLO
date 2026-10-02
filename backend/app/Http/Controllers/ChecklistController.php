<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\Checklist;
use App\Models\ChecklistItem;
use Illuminate\Http\Request;

class ChecklistController extends Controller
{
    public function storeChecklist(Request $request, Task $task)
    {
        $request->validate(['title' => 'required|string']);
        $checklist = $task->checklists()->create(['title' => $request->title]);
        return response()->json($checklist->load('items'), 201);
    }

    public function destroyChecklist(Checklist $checklist)
    {
        $checklist->delete();
        return response()->json(['message' => 'Checklist deleted']);
    }

    public function storeItem(Request $request, Checklist $checklist)
    {
        $request->validate(['content' => 'required|string']);
        $item = $checklist->items()->create([
            'content' => $request->content,
            'is_completed' => false
        ]);
        return response()->json($item, 201);
    }

    public function updateItem(Request $request, ChecklistItem $item)
    {
        $request->validate([
            'content' => 'sometimes|string',
            'is_completed' => 'sometimes|boolean'
        ]);

        $item->update($request->only(['content', 'is_completed']));
        return response()->json($item);
    }

    public function destroyItem(ChecklistItem $item)
    {
        $item->delete();
        return response()->json(['message' => 'Item deleted']);
    }
}
