<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\BoardSprint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SprintController extends Controller
{
    public function store(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('update', $board);

        $request->validate([
            'name' => 'required|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $sprint = $board->sprints()->create([
            'name' => $request->name,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'status' => 'pending'
        ]);

        return response()->json($sprint, 201);
    }

    public function update(Request $request, BoardSprint $sprint): JsonResponse
    {
        $sprint->loadMissing('board');
        Gate::authorize('update', $sprint->board);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'status' => 'sometimes|in:pending,active,completed'
        ]);

        $sprint->update($request->only(['name', 'start_date', 'end_date', 'status']));

        return response()->json($sprint);
    }

    public function destroy(Request $request, BoardSprint $sprint): JsonResponse
    {
        $sprint->loadMissing('board');
        Gate::authorize('update', $sprint->board);

        $sprint->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
