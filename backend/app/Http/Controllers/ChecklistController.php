<?php

namespace App\Http\Controllers;

use App\Models\Checklist;
use App\Models\ChecklistItem;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ChecklistController extends Controller
{
    public function storeChecklist(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate(['title' => 'required|string|max:255']);
        $checklist = $task->checklists()->create(['title' => $request->title]);
        return response()->json($checklist->load('items'), 201);
    }

    public function destroyChecklist(Request $request, Checklist $checklist): JsonResponse
    {
        Gate::authorize('update', $checklist->task);

        $checklist->delete();
        return response()->json(['message' => 'Checklist deleted']);
    }

    public function storeItem(Request $request, Checklist $checklist): JsonResponse
    {
        Gate::authorize('update', $checklist->task);

        $request->validate(['content' => 'required|string|max:255']);
        $item = $checklist->items()->create([
            'content' => $request->content,
            'is_completed' => false
        ]);
        return response()->json($item, 201);
    }

    public function updateItem(Request $request, ChecklistItem $item): JsonResponse
    {
        Gate::authorize('update', $item->checklist->task);

        $request->validate([
            'content' => 'sometimes|string|max:255',
            'is_completed' => 'sometimes|boolean'
        ]);

        $item->update($request->only(['content', 'is_completed']));
        return response()->json($item);
    }

    public function destroyItem(Request $request, ChecklistItem $item): JsonResponse
    {
        Gate::authorize('update', $item->checklist->task);

        $item->delete();
        return response()->json(['message' => 'Item deleted']);
    }
}
