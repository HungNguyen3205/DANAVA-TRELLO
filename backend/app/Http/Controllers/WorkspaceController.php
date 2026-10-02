<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use Illuminate\Http\Request;

class WorkspaceController extends Controller
{
    public function index(Request $request)
    {
        // Get all workspaces the user is a member of
        $workspaces = $request->user()->workspaces()->with('boards')->get();
        return response()->json($workspaces);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $workspace = Workspace::create([
            'name' => $request->name,
            'owner_id' => $request->user()->id,
        ]);

        // Attach the user as admin
        $workspace->members()->attach($request->user()->id, ['role' => 'admin']);

        return response()->json($workspace->load('boards'), 201);
    }

    public function show(Request $request, Workspace $workspace)
    {
        // Check if user is member
        if (!$workspace->members()->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($workspace->load(['boards', 'members']));
    }
}
