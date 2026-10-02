<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Workspace;
use App\Models\Board;
use App\Models\Task;

class SearchController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');
        $type = $request->query('type', 'all'); // 'all', 'tasks', 'boards', 'workspaces'
        $user = $request->user();

        if (empty($q)) {
            return response()->json([
                'workspaces' => [],
                'boards' => [],
                'tasks' => []
            ]);
        }

        $results = [];

        // Search Workspaces
        if (in_array($type, ['all', 'workspaces'])) {
            $workspaces = Workspace::whereHas('members', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })->where(function ($query) use ($q) {
                $query->where('name', 'LIKE', "%{$q}%")
                      ->orWhere('description', 'LIKE', "%{$q}%");
            })->take(10)->get();

            $results['workspaces'] = $workspaces;
        }

        // Search Boards
        if (in_array($type, ['all', 'boards'])) {
            $boards = Board::whereHas('workspace.members', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })->where('title', 'LIKE', "%{$q}%")->take(10)->get()->map(function ($board) {
                $board->workspace_id = $board->workspace->id;
                return $board;
            });

            $results['boards'] = $boards;
        }

        // Search Tasks
        if (in_array($type, ['all', 'tasks'])) {
            $tasksQuery = Task::with(['column.board.workspace', 'assignee'])
                ->whereHas('column.board.workspace.members', function ($query) use ($user) {
                    $query->where('user_id', $user->id);
                })
                ->where(function ($query) use ($q) {
                    $query->where('title', 'LIKE', "%{$q}%")
                          ->orWhere('description', 'LIKE', "%{$q}%");
                });

            // Filters
            if ($request->has('board_id')) {
                $tasksQuery->whereHas('column', function ($query) use ($request) {
                    $query->where('board_id', $request->query('board_id'));
                });
            }

            if ($request->has('assignee_id')) {
                $tasksQuery->where('assignee_id', $request->query('assignee_id'));
            }

            if ($request->has('status')) {
                $status = $request->query('status');
                if ($status === 'completed') {
                    $tasksQuery->completed();
                } elseif ($status === 'pending') {
                    $tasksQuery->pending();
                }
            }

            $tasks = $tasksQuery->orderBy('updated_at', 'desc')->take(20)->get()->map(function ($task) {
                $board = $task->column ? $task->column->board : null;
                $workspace = $board ? $board->workspace : null;
                
                return [
                    'id' => $task->id,
                    'title' => $task->title,
                    'description' => substr(strip_tags($task->description), 0, 100),
                    'priority' => $task->priority,
                    'due_date' => $task->due_date,
                    'completed_at' => $task->completed_at,
                    'status' => $task->column ? $task->column->title : null,
                    'workspace' => $workspace ? ['id' => $workspace->id, 'name' => $workspace->name] : null,
                    'board' => $board ? ['id' => $board->id, 'title' => $board->title] : null,
                    'assignee' => $task->assignee ? ['id' => $task->assignee->id, 'name' => $task->assignee->name, 'avatar' => $task->assignee->avatar] : null,
                ];
            });

            $results['tasks'] = $tasks;
        }

        return response()->json($results);
    }
}
