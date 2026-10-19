<?php

namespace App\Http\Controllers;

use App\Models\Board;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class BoardDashboardController extends Controller
{
    /**
     * GET /api/boards/{board}/dashboard/member-workload
     * High performance aggregate workload dashboard per board member.
     */
    public function memberWorkload(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('viewDashboard', $board);

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $sprintId = $request->query('sprint_id');
        $memberFilter = $request->query('member_id');
        $statusFilter = $request->query('status'); // 'completed', 'incomplete', 'overdue'
        $priorityFilter = $request->query('priority');
        $includeParentTasks = filter_var($request->query('include_parent_tasks', false), FILTER_VALIDATE_BOOLEAN);

        $now = Carbon::now();

        // 1. Identify tasks with subtasks to prevent double counting
        $parentTaskIdsWithChildren = DB::table('tasks')
            ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
            ->where('kanban_columns.board_id', $board->id)
            ->whereNotNull('tasks.parent_task_id')
            ->whereNull('tasks.deleted_at')
            ->distinct()
            ->pluck('tasks.parent_task_id')
            ->toArray();

        // 2. Base task query on this board
        $baseQuery = DB::table('tasks')
            ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
            ->where('kanban_columns.board_id', $board->id)
            ->whereNull('tasks.deleted_at');

        // Apply double-counting rule:
        // Exclude parent tasks that have subtasks unless specifically requested
        if (!$includeParentTasks && !empty($parentTaskIdsWithChildren)) {
            $baseQuery->whereNotIn('tasks.id', $parentTaskIdsWithChildren);
        }

        // Filters
        if ($sprintId) {
            $baseQuery->where('tasks.sprint_id', $sprintId);
        }

        if ($priorityFilter) {
            $baseQuery->where('tasks.priority', $priorityFilter);
        }

        if ($startDate) {
            $baseQuery->whereDate('tasks.created_at', '>=', $startDate);
        }

        if ($endDate) {
            $baseQuery->whereDate('tasks.created_at', '<=', $endDate);
        }

        // Get actionable tasks on board
        $actionableTasks = (clone $baseQuery)
            ->select([
                'tasks.id',
                'tasks.parent_task_id',
                'tasks.title',
                'tasks.priority',
                'tasks.due_date',
                'tasks.start_date',
                'tasks.completed_at',
                'tasks.created_at',
                'kanban_columns.title as column_title',
            ])
            ->get();

        $doneColumnNames = ['done', 'hoàn thành', 'completed'];

        $isTaskDone = static function ($task) use ($doneColumnNames): bool {
            if (!empty($task->completed_at)) {
                return true;
            }
            return in_array(mb_strtolower(trim((string) $task->column_title)), $doneColumnNames, true);
        };

        $isTaskOverdue = static function ($task, $now) use ($isTaskDone): bool {
            if ($isTaskDone($task) || empty($task->due_date)) {
                return false;
            }
            return Carbon::parse($task->due_date)->lt($now->startOfDay());
        };

        // 3. Board Overview Summary (Distinct task counts)
        $totalBoardTasks = $actionableTasks->count();
        $completedBoardTasks = 0;
        $overdueBoardTasks = 0;

        foreach ($actionableTasks as $t) {
            if ($isTaskDone($t)) {
                $completedBoardTasks++;
            } elseif ($isTaskOverdue($t, $now)) {
                $overdueBoardTasks++;
            }
        }

        $incompleteBoardTasks = max(0, $totalBoardTasks - $completedBoardTasks);
        $completionRate = $totalBoardTasks > 0 ? round(($completedBoardTasks / $totalBoardTasks) * 100, 2) : 0;

        // 4. Retrieve Board Members
        $boardMembers = DB::table('board_members')
            ->join('users', 'board_members.user_id', '=', 'users.id')
            ->where('board_members.board_id', $board->id)
            ->select([
                'users.id',
                'users.name',
                'users.email',
                'users.avatar',
                'board_members.role',
            ])
            ->get();

        // 5. Query assignments for these actionable tasks
        $actionableTaskIds = $actionableTasks->pluck('id')->toArray();

        $assignments = DB::table('task_assignees')
            ->whereIn('task_id', $actionableTaskIds)
            ->get()
            ->groupBy('user_id');

        // Also check legacy assignee_id if not synced
        $legacyAssignments = $actionableTasks
            ->whereNotNull('assignee_id')
            ->groupBy('assignee_id');

        $actionableTasksMap = $actionableTasks->keyBy('id');

        // 6. Build Members Statistics
        $membersStats = [];
        $unassignedTasksCount = 0;

        foreach ($boardMembers as $member) {
            $userTaskIds = collect();

            if (isset($assignments[$member->id])) {
                $userTaskIds = $userTaskIds->merge($assignments[$member->id]->pluck('task_id'));
            }

            if (isset($legacyAssignments[$member->id])) {
                $userTaskIds = $userTaskIds->merge($legacyAssignments[$member->id]->pluck('id'));
            }

            $userTaskIds = $userTaskIds->unique()->values();

            $assignedCount = $userTaskIds->count();
            $completedCount = 0;
            $overdueCount = 0;
            $memberTasks = [];

            foreach ($userTaskIds as $tid) {
                if (isset($actionableTasksMap[$tid])) {
                    $t = $actionableTasksMap[$tid];
                    $isDone = $isTaskDone($t);
                    $isOverdue = $isTaskOverdue($t, $now);

                    if ($isDone) {
                        $completedCount++;
                    } elseif ($isOverdue) {
                        $overdueCount++;
                    }

                    $memberTasks[] = [
                        'id' => $t->id,
                        'parent_task_id' => $t->parent_task_id,
                        'title' => $t->title,
                        'priority' => $t->priority,
                        'due_date' => $t->due_date,
                        'is_completed' => $isDone,
                        'is_overdue' => $isOverdue,
                    ];
                }
            }

            $incompleteCount = max(0, $assignedCount - $completedCount);
            $memberRate = $assignedCount > 0 ? round(($completedCount / $assignedCount) * 100, 2) : 0;

            $membersStats[] = [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'avatar' => $member->avatar,
                'role' => $member->role,
                'assigned' => $assignedCount,
                'incomplete' => $incompleteCount,
                'completed' => $completedCount,
                'overdue' => $overdueCount,
                'completion_rate' => $memberRate,
                'tasks' => $memberTasks,
            ];
        }

        // Sort members by total assigned descending
        usort($membersStats, function ($a, $b) {
            return $b['assigned'] <=> $a['assigned'];
        });

        // Filter response by member if requested
        if ($memberFilter) {
            $membersStats = array_values(array_filter($membersStats, function ($m) use ($memberFilter) {
                return (string) $m['id'] === (string) $memberFilter;
            }));
        }

        // Filter response by status if requested
        if ($statusFilter) {
            foreach ($membersStats as &$m) {
                if ($statusFilter === 'completed') {
                    $m['tasks'] = array_values(array_filter($m['tasks'], fn($t) => $t['is_completed']));
                } elseif ($statusFilter === 'overdue') {
                    $m['tasks'] = array_values(array_filter($m['tasks'], fn($t) => $t['is_overdue']));
                } elseif ($statusFilter === 'incomplete') {
                    $m['tasks'] = array_values(array_filter($m['tasks'], fn($t) => !$t['is_completed']));
                }
            }
            unset($m);
        }

        return response()->json([
            'summary' => [
                'total_tasks' => $totalBoardTasks,
                'completed_tasks' => $completedBoardTasks,
                'incomplete_tasks' => $incompleteBoardTasks,
                'overdue_tasks' => $overdueBoardTasks,
                'completion_rate' => $completionRate,
            ],
            'members' => $membersStats,
        ]);
    }
}
