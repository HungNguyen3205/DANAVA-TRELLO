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

        $query = Task::with(['parent', 'column.board', 'sprint', 'assignees'])
            ->where(function ($q) use ($user) {
                $q->where('tasks.assignee_id', $user->id)
                  ->orWhereHas('assignees', function ($sub) use ($user) {
                      $sub->where('users.id', $user->id);
                  });
            })
            ->inUserBoards($user->id);

        // Filters
        $taskType = $request->query('task_type'); // 'root', 'subtask', 'all'
        if ($taskType === 'root') {
            $query->whereNull('tasks.parent_task_id');
        } elseif ($taskType === 'subtask') {
            $query->whereNotNull('tasks.parent_task_id');
        }

        $assignmentType = $request->query('assignment_type'); // 'solo', 'shared', 'all'
        if ($assignmentType === 'solo') {
            $query->has('assignees', '=', 1);
        } elseif ($assignmentType === 'shared') {
            $query->has('assignees', '>', 1);
        }

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
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%chưa bắt đầu%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%chưa làm%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%backlog%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%chuẩn bị%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%mới%')
                        ->orWhere(function($other) {
                            $other->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'not like', '%đang thực hiện%')
                                  ->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'not like', '%đang làm%')
                                  ->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'not like', '%in progress%')
                                  ->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'not like', '%doing%')
                                  ->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'not like', '%đang xử lý%');
                        });
                });
            });
        } elseif ($statusType === 'in_progress') {
            $query->pending()->whereHas('column', function ($q) {
                $q->where(function($sub) {
                    $sub->where(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%đang thực hiện%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%đang làm%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%in progress%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%doing%')
                        ->orWhere(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), 'like', '%đang xử lý%');
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
        $tasks->getCollection()->transform(function ($task) use ($user) {
            $board = $task->column ? $task->column->board : null;
            $workspace = $board ? $board->workspace : null;
            $isSubtask = !empty($task->parent_task_id);

            $assignees = $task->assignees->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'avatar' => $u->avatar,
                    'contribution_percent' => $u->pivot->contribution_percent ?? null,
                ];
            });

            $myAssigneePivot = $task->assignees->firstWhere('id', $user->id);
            $myContributionPercent = $myAssigneePivot?->pivot->contribution_percent ?? null;
            
            return [
                'id' => $task->id,
                'parent_task_id' => $task->parent_task_id,
                'is_subtask' => $isSubtask,
                'type' => $isSubtask ? 'Task con' : 'Task chính',
                'parent_task' => $task->parent ? [
                    'id' => $task->parent->id,
                    'title' => $task->parent->title,
                ] : null,
                'title' => $task->title,
                'priority' => $task->priority,
                'due_date' => $task->due_date ? Carbon::parse($task->due_date)->toIso8601String() : null,
                'completed_at' => $task->completed_at ? Carbon::parse($task->completed_at)->toIso8601String() : null,
                'status' => $task->column ? $task->column->title : null,
                'workspace' => $workspace ? ['id' => $workspace->id, 'name' => $workspace->name] : null,
                'board' => $board ? ['id' => $board->id, 'public_id' => $board->public_id, 'name' => $board->name, 'color' => $board->color] : null,
                'sprint' => $task->sprint ? ['id' => $task->sprint->id, 'name' => $task->sprint->name] : null,
                'assignees' => $assignees,
                'co_assignees_count' => max(0, $assignees->count() - 1),
                'my_contribution_percent' => $myContributionPercent,
            ];
        });

        return response()->json($tasks);

        return response()->json($tasks);
    }
}
