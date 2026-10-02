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

        $workspace->load(['boards', 'members']);
        
        // Calculate basic statistics
        $boards = $workspace->boards;
        $totalBoards = $boards->count();
        $totalMembers = $workspace->members->count();
        
        // We can fetch tasks by joining boards -> columns -> tasks
        $tasks = \DB::table('tasks')
            ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
            ->join('boards', 'kanban_columns.board_id', '=', 'boards.id')
            ->where('boards.workspace_id', $workspace->id)
            ->select('tasks.id', 'tasks.due_date', 'kanban_columns.title as column_name')
            ->get();
            
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->filter(function($task) {
            return strtolower($task->column_name) === 'hoàn thành' || strtolower($task->column_name) === 'done';
        })->count();
        
        $overdueTasks = $tasks->filter(function($task) {
            return $task->due_date && \Carbon\Carbon::parse($task->due_date)->isPast() && strtolower($task->column_name) !== 'hoàn thành' && strtolower($task->column_name) !== 'done';
        })->count();

        $workspaceData = $workspace->toArray();
        $workspaceData['stats'] = [
            'total_boards' => $totalBoards,
            'total_members' => $totalMembers,
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'overdue_tasks' => $overdueTasks,
            'completion_rate' => $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100) : 0
        ];

        return response()->json($workspaceData);
    }
}
