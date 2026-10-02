<?php

namespace App\Http\Controllers;

use App\Models\Task;
use Illuminate\Http\Request;
use Carbon\Carbon;

class MyTaskController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $tz = 'Asia/Ho_Chi_Minh';
        $todayStart = Carbon::now($tz)->startOfDay()->utc();
        $todayEnd = Carbon::now($tz)->endOfDay()->utc();
        $upcomingEnd = Carbon::now($tz)->addDays(7)->endOfDay()->utc();

        $query = Task::with(['column.board.workspace', 'sprint'])
            ->where('assignee_id', $user->id)
            ->inUserWorkspaces($user->id);

        // Filters
        $due = $request->query('due');
        if ($due === 'today') {
            $query->pending()->whereNotNull('due_date')->whereBetween('due_date', [$todayStart, $todayEnd]);
        } elseif ($due === 'upcoming') {
            $query->pending()->whereNotNull('due_date')->where('due_date', '>', $todayEnd)->where('due_date', '<=', $upcomingEnd);
        } elseif ($due === 'overdue') {
            $query->pending()->whereNotNull('due_date')->where('due_date', '<', $todayStart);
        } elseif ($due === 'completed') {
            $query->completed();
        }

        $statusType = $request->query('status_type');
        if ($statusType === 'todo') {
            $query->pending()->whereHas('column', function ($q) {
                $q->where(function($sub) {
                    $sub->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%cần làm%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%to do%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%mới%');
                });
            });
        } elseif ($statusType === 'in_progress') {
            $query->pending()->whereHas('column', function ($q) {
                $q->where(function($sub) {
                    $sub->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%đang thực hiện%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%in progress%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%doing%');
                });
            });
        } elseif ($statusType === 'pending_all') {
            $query->pending();
        }

        if ($request->has('workspace_id')) {
            $query->whereHas('column.board', function ($q) use ($request) {
                $q->where('workspace_id', $request->query('workspace_id'));
            });
        }

        if ($request->has('board_id')) {
            $query->whereHas('column', function ($q) use ($request) {
                $q->where('board_id', $request->query('board_id'));
            });
        }

        if ($request->has('priority')) {
            $query->where('priority', $request->query('priority'));
        }

        if ($request->has('search')) {
            $search = $request->query('search');
            $query->where('title', 'like', "%{$search}%");
        }

        // Sorting
        $allowedSorts = ['due_date', 'priority', 'updated_at', 'created_at'];
        $sort = $request->query('sort', 'updated_at');
        $direction = $request->query('direction', 'desc');
        
        if (in_array($sort, $allowedSorts)) {
            $query->orderBy($sort, $direction === 'asc' ? 'asc' : 'desc');
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 15)));
        $tasks = $query->paginate($perPage);

        // Transform response
        $tasks->getCollection()->transform(function ($task) {
            $board = $task->column ? $task->column->board : null;
            $workspace = $board ? $board->workspace : null;
            
            return [
                'id' => $task->id,
                'title' => $task->title,
                'priority' => $task->priority,
                'due_date' => $task->due_date ? Carbon::parse($task->due_date)->toIso8601String() : null,
                'completed_at' => $task->completed_at ? Carbon::parse($task->completed_at)->toIso8601String() : null,
                'status' => $task->column ? $task->column->title : null,
                'workspace' => $workspace ? ['id' => $workspace->id, 'name' => $workspace->name] : null,
                'board' => $board ? ['id' => $board->id, 'name' => $board->name, 'color' => $board->color] : null,
                'sprint' => $task->sprint ? ['id' => $task->sprint->id, 'name' => $task->sprint->name] : null,
            ];
        });

        return response()->json($tasks);
    }
}
