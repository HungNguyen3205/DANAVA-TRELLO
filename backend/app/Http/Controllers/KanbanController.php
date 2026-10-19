<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class KanbanController extends Controller
{
    /**
     * GET /api/boards/{board}/kanban
     * Retrieve all active (non-archived, non-deleted) columns and active root tasks of a board.
     */
    public function index(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('view', $board);

        $columns = $board->columns()
            ->whereNull('archived_at')
            ->with(['tasks' => function ($query) {
                $query->whereNull('tasks.parent_task_id')
                      ->whereNull('tasks.archived_at')
                      ->with(['labels', 'assignees'])
                      ->withCount([
                          'attachments', 
                          'comments',
                          'subtasks as total_subtasks_count',
                          'subtasks as done_subtasks_count' => function ($q) {
                              $q->whereNotNull('completed_at');
                          },
                          'checklistItems as total_checklists_items',
                          'checklistItems as done_checklists_items' => function ($q) {
                              $q->where('is_completed', true);
                          }
                      ])
                      ->orderBy('order');
            }])->orderBy('order')->get();

        return response()->json($columns);
    }

    /**
     * GET /api/boards/{board}/columns/archived
     * Retrieve all archived columns of a board.
     */
    public function archivedColumns(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('view', $board);

        $columns = KanbanColumn::where('board_id', $board->id)
            ->whereNotNull('archived_at')
            ->with('archivedBy:id,name,username')
            ->withCount(['tasks' => function ($q) {
                $q->whereNull('deleted_at');
            }])
            ->orderBy('archived_at', 'desc')
            ->get();

        return response()->json($columns);
    }

    /**
     * POST /api/boards/{board}/columns
     * Create a new column on the board.
     */
    public function storeColumn(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('create', [KanbanColumn::class, $board]);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
            'wip_limit' => 'nullable|integer|min:0',
            'wip_enforcement' => 'nullable|string|in:warning,strict',
        ]);

        $maxOrder = KanbanColumn::where('board_id', $board->id)
            ->whereNull('archived_at')
            ->max('order') ?? 0;

        $wipLimit = (!empty($validated['wip_limit']) && (int)$validated['wip_limit'] > 0)
            ? (int)$validated['wip_limit']
            : null;

        $column = $board->columns()->create([
            'title' => $validated['title'],
            'color' => $validated['color'] ?? 'violet',
            'wip_limit' => $wipLimit,
            'wip_enforcement' => $validated['wip_enforcement'] ?? 'warning',
            'order' => $maxOrder + 1000,
        ]);

        return response()->json($column, 201);
    }

    /**
     * PUT / PATCH /api/columns/{column}
     * Update column title, color, and WIP Limit configuration.
     * Restricted: Only Board Owner / Admin can update columns.
     */
    public function updateColumn(Request $request, KanbanColumn $column): JsonResponse
    {
        Gate::authorize('update', $column);

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'color' => 'sometimes|nullable|string|max:50',
            'wip_limit' => 'sometimes|nullable|integer|min:0',
            'wip_enforcement' => 'sometimes|nullable|string|in:warning,strict',
        ]);

        if (array_key_exists('wip_limit', $validated)) {
            $validated['wip_limit'] = (!empty($validated['wip_limit']) && (int)$validated['wip_limit'] > 0)
                ? (int)$validated['wip_limit']
                : null;
        }

        $column->update($validated);

        return response()->json($column);
    }

    /**
     * POST /api/columns/{column}/archive
     * Archive an active column and its tasks.
     */
    public function archiveColumn(Request $request, KanbanColumn $column): JsonResponse
    {
        Gate::authorize('archive', $column);

        // Cannot archive the last active column on the board
        $activeColumnsCount = KanbanColumn::where('board_id', $column->board_id)
            ->whereNull('archived_at')
            ->count();

        if ($activeColumnsCount <= 1) {
            return response()->json([
                'message' => 'Không thể lưu trữ cột cuối cùng đang hoạt động của bảng.',
                'error_code' => 'CANNOT_ARCHIVE_LAST_COLUMN'
            ], 422);
        }

        $userId = $request->user()->id;
        $now = now();
        $tasksCount = $column->tasks()->count();

        DB::transaction(function () use ($column, $userId, $now, $tasksCount) {
            $column->update([
                'archived_at' => $now,
                'archived_by' => $userId,
            ]);

            $column->tasks()->update([
                'archived_at' => $now,
                'archived_by' => $userId,
            ]);

            $this->resequenceColumns($column->board_id);

            ActivityLog::create([
                'board_id' => $column->board_id,
                'user_id' => $userId,
                'action' => 'archive_column',
                'old_value' => $column->title,
                'new_value' => json_encode([
                    'column_id' => $column->id,
                    'column_title' => $column->title,
                    'tasks_count' => $tasksCount,
                    'action' => 'archive_column',
                    'timestamp' => $now->toIso8601String(),
                ])
            ]);
        });

        return response()->json([
            'message' => 'Đã lưu trữ cột thành công',
            'column' => $column->fresh()
        ]);
    }

    /**
     * POST /api/columns/{column}/restore
     * Restore an archived column and its tasks back to the board.
     */
    public function restoreColumn(Request $request, KanbanColumn $column): JsonResponse
    {
        Gate::authorize('restore', $column);

        if (!$column->archived_at) {
            return response()->json(['message' => 'Cột này hiện không ở trạng thái lưu trữ.'], 400);
        }

        $userId = $request->user()->id;
        $now = now();
        $tasksCount = $column->tasks()->count();

        DB::transaction(function () use ($column, $userId, $now, $tasksCount) {
            $maxOrder = KanbanColumn::where('board_id', $column->board_id)
                ->whereNull('archived_at')
                ->max('order') ?? 0;

            $column->update([
                'archived_at' => null,
                'archived_by' => null,
                'order' => $maxOrder + 1000,
            ]);

            $column->tasks()->update([
                'archived_at' => null,
                'archived_by' => null,
            ]);

            $this->resequenceColumns($column->board_id);

            ActivityLog::create([
                'board_id' => $column->board_id,
                'user_id' => $userId,
                'action' => 'restore_column',
                'old_value' => $column->title,
                'new_value' => json_encode([
                    'column_id' => $column->id,
                    'column_title' => $column->title,
                    'tasks_count' => $tasksCount,
                    'action' => 'restore_column',
                    'timestamp' => $now->toIso8601String(),
                ])
            ]);
        });

        return response()->json([
            'message' => 'Đã khôi phục cột thành công',
            'column' => $column->fresh()
        ]);
    }

    /**
     * DELETE /api/columns/{column}
     * Delete a column with strict lifecycle handling.
     * - Only Board Admin / Owner can delete columns.
     * - Cannot delete the last active column.
     * - Empty column: soft delete + Activity Log.
     * - Column with tasks: require action (move_tasks, archive_all, delete_all).
     */
    public function destroyColumn(Request $request, KanbanColumn $column): JsonResponse
    {
        Gate::authorize('delete', $column);

        // 1. Cannot delete last active column
        $activeColumnsCount = KanbanColumn::where('board_id', $column->board_id)
            ->whereNull('archived_at')
            ->count();

        if ($activeColumnsCount <= 1) {
            return response()->json([
                'message' => 'Không thể xóa cột cuối cùng đang hoạt động của bảng.',
                'error_code' => 'CANNOT_DELETE_LAST_COLUMN'
            ], 422);
        }

        $tasksCount = $column->tasks()->count();
        $userId = $request->user()->id;
        $now = now();

        // 2. Column is empty: Soft delete directly
        if ($tasksCount === 0) {
            DB::transaction(function () use ($column, $userId, $now) {
                $column->update(['deleted_by' => $userId]);
                $column->delete();

                $this->resequenceColumns($column->board_id);

                ActivityLog::create([
                    'board_id' => $column->board_id,
                    'user_id' => $userId,
                    'action' => 'delete_empty_column',
                    'old_value' => $column->title,
                    'new_value' => json_encode([
                        'column_id' => $column->id,
                        'column_title' => $column->title,
                        'tasks_count' => 0,
                        'target_column_id' => null,
                        'action' => 'delete_empty_column',
                        'timestamp' => $now->toIso8601String(),
                    ])
                ]);
            });

            return response()->json([
                'message' => 'Đã xóa cột rỗng thành công',
                'action' => 'delete_empty_column'
            ]);
        }

        // 3. Column has tasks: Action is required
        if (!$request->filled('action')) {
            return response()->json([
                'message' => "Cột '{$column->title}' đang có {$tasksCount} công việc. Vui lòng chọn hành động xử lý công việc trước khi xóa.",
                'error_code' => 'COLUMN_HAS_TASKS',
                'tasks_count' => $tasksCount,
            ], 422);
        }

        $action = $request->input('action');

        // ACTION: move_tasks
        if ($action === 'move_tasks') {
            $targetColumnId = $request->input('target_column_id');

            if (!$targetColumnId) {
                return response()->json([
                    'message' => 'Vui lòng chọn cột đích để chuyển công việc sang.',
                    'errors' => ['target_column_id' => ['Cột đích là bắt buộc khi chọn chuyển công việc.']]
                ], 422);
            }

            if ((int)$targetColumnId === (int)$column->id) {
                return response()->json([
                    'message' => 'Không thể chọn chính cột đang xóa làm cột đích.',
                    'errors' => ['target_column_id' => ['Không thể chọn chính cột đang xóa làm cột đích.']]
                ], 422);
            }

            $targetColumn = KanbanColumn::where('id', $targetColumnId)
                ->where('board_id', $column->board_id)
                ->whereNull('archived_at')
                ->first();

            if (!$targetColumn) {
                return response()->json([
                    'message' => 'Cột đích không tồn tại hoặc không thuộc cùng bảng công việc.',
                    'errors' => ['target_column_id' => ['Cột đích không hợp lệ.']]
                ], 422);
            }

            DB::transaction(function () use ($column, $targetColumn, $userId, $now, $tasksCount) {
                $maxOrder = $targetColumn->tasks()->max('order') ?? 0;
                $tasks = $column->tasks()->orderBy('order')->get();

                foreach ($tasks as $idx => $task) {
                    $task->update([
                        'column_id' => $targetColumn->id,
                        'order' => $maxOrder + (($idx + 1) * 1000)
                    ]);
                }

                $column->update(['deleted_by' => $userId]);
                $column->delete();

                $this->resequenceColumns($column->board_id);

                ActivityLog::create([
                    'board_id' => $column->board_id,
                    'user_id' => $userId,
                    'action' => 'delete_column_move_tasks',
                    'old_value' => $column->title,
                    'new_value' => json_encode([
                        'column_id' => $column->id,
                        'column_title' => $column->title,
                        'tasks_count' => $tasksCount,
                        'target_column_id' => $targetColumn->id,
                        'target_column_title' => $targetColumn->title,
                        'action' => 'move_tasks',
                        'timestamp' => $now->toIso8601String(),
                    ])
                ]);
            });

            return response()->json([
                'message' => "Đã chuyển {$tasksCount} công việc sang cột '{$targetColumn->title}' và xóa cột thành công",
                'action' => 'move_tasks',
                'target_column_id' => $targetColumn->id
            ]);
        }

        // ACTION: archive_all
        if ($action === 'archive_all') {
            DB::transaction(function () use ($column, $userId, $now, $tasksCount) {
                $column->update([
                    'archived_at' => $now,
                    'archived_by' => $userId,
                ]);

                $column->tasks()->update([
                    'archived_at' => $now,
                    'archived_by' => $userId,
                ]);

                $this->resequenceColumns($column->board_id);

                ActivityLog::create([
                    'board_id' => $column->board_id,
                    'user_id' => $userId,
                    'action' => 'archive_column_and_tasks',
                    'old_value' => $column->title,
                    'new_value' => json_encode([
                        'column_id' => $column->id,
                        'column_title' => $column->title,
                        'tasks_count' => $tasksCount,
                        'target_column_id' => null,
                        'action' => 'archive_all',
                        'timestamp' => $now->toIso8601String(),
                    ])
                ]);
            });

            return response()->json([
                'message' => 'Đã lưu trữ cột cùng toàn bộ công việc thành công',
                'action' => 'archive_all'
            ]);
        }

        // ACTION: delete_all (Only Board Owner allowed)
        if ($action === 'delete_all') {
            $board = Board::find($column->board_id);
            $isOwner = ($board && (int)$board->owner_id === (int)$userId);
            if (!$isOwner) {
                $isOwnerMember = DB::table('board_members')
                    ->where('board_id', $column->board_id)
                    ->where('user_id', $userId)
                    ->where('role', 'owner')
                    ->exists();

                // If board has no owner_id set, the board admin acts as owner
                if (!$isOwnerMember && (!$board?->owner_id && $request->user()->isBoardAdmin($column->board_id))) {
                    $isOwnerMember = true;
                }

                if (!$isOwnerMember) {
                    return response()->json([
                        'message' => 'Chỉ Chủ sở hữu (Board Owner) mới có quyền xóa toàn bộ cột kèm tất cả công việc.',
                        'error_code' => 'ONLY_OWNER_CAN_DELETE_ALL'
                    ], 403);
                }
            }

            DB::transaction(function () use ($column, $userId, $now, $tasksCount) {
                // Soft delete all tasks
                foreach ($column->tasks()->get() as $task) {
                    $task->update(['deleted_by' => $userId]);
                    $task->delete();
                }

                // Soft delete column
                $column->update(['deleted_by' => $userId]);
                $column->delete();

                $this->resequenceColumns($column->board_id);

                ActivityLog::create([
                    'board_id' => $column->board_id,
                    'user_id' => $userId,
                    'action' => 'delete_column_and_tasks',
                    'old_value' => $column->title,
                    'new_value' => json_encode([
                        'column_id' => $column->id,
                        'column_title' => $column->title,
                        'tasks_count' => $tasksCount,
                        'target_column_id' => null,
                        'action' => 'delete_all',
                        'timestamp' => $now->toIso8601String(),
                    ])
                ]);
            });

            return response()->json([
                'message' => 'Đã xóa cột và toàn bộ công việc thành công',
                'action' => 'delete_all'
            ]);
        }

        return response()->json([
            'message' => 'Hành động không hợp lệ.',
            'errors' => ['action' => ['Hành động phải là move_tasks, archive_all hoặc delete_all.']]
        ], 422);
    }

    /**
     * POST /api/columns/{column}/tasks
     * Create a new task in a specific column.
     */
    public function storeTask(Request $request, KanbanColumn $column): JsonResponse
    {
        $column->loadMissing('board');
        Gate::authorize('view', $column->board);

        // WIP Limit Check (Strict mode)
        // Subtasks do not count, but storeTask creates a root task.
        if ($column->wip_limit && $column->wip_limit > 0 && $column->wip_enforcement === 'strict') {
            if ($column->wip_count >= $column->wip_limit) {
                return response()->json([
                    'message' => "Cột '{$column->title}' đã đạt giới hạn WIP tối đa ({$column->wip_limit} công việc). Chế độ Nghiêm ngặt (Strict) không cho phép tạo thêm công việc.",
                    'error_code' => 'WIP_LIMIT_EXCEEDED',
                    'errors' => ['wip_limit' => ["Cột đã đạt giới hạn WIP tối đa ({$column->wip_limit} công việc)."]],
                    'wip_limit' => $column->wip_limit,
                    'wip_count' => $column->wip_count,
                    'enforcement' => 'strict',
                ], 422);
            }
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'priority' => 'nullable|string',
            'description' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        $maxOrder = $column->tasks()->max('order') ?? 0;
        $task = $column->tasks()->create([
            'title' => $validated['title'],
            'priority' => $validated['priority'] ?? 'Bình thường',
            'description' => $validated['description'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'created_by' => $request->user()->id,
            'order' => $maxOrder + 1000,
        ]);

        return response()->json($task, 201);
    }

    /**
     * PUT /api/boards/{board}/columns/reorder
     * Reorder columns within a board. Strict verification that all columns belong to this board.
     */
    public function reorderColumns(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('view', $board);

        $request->validate([
            'columns' => 'required|array',
            'columns.*.id' => 'required|integer',
            'columns.*.order' => 'required|numeric',
        ]);

        $inputColumnIds = collect($request->columns)->pluck('id')->unique()->toArray();
        $boardColumnIds = $board->columns()->whereNull('archived_at')->pluck('id')->toArray();

        $diff = array_diff($inputColumnIds, $boardColumnIds);
        if (!empty($diff)) {
            return response()->json([
                'message' => 'Một hoặc nhiều cột không thuộc bảng này.',
                'errors' => ['columns' => ['Một hoặc nhiều cột không thuộc bảng này.']]
            ], 422);
        }

        DB::transaction(function () use ($request, $board) {
            foreach ($request->columns as $col) {
                KanbanColumn::where('id', $col['id'])
                    ->where('board_id', $board->id)
                    ->update(['order' => $col['order']]);
            }
        });

        return response()->json(['message' => 'Cập nhật vị trí cột thành công']);
    }

    /**
     * PUT /api/boards/{board}/tasks/reorder
     * Reorder tasks across columns in a board. Strict verification that all tasks and columns belong to this board.
     */
    public function reorderTasks(Request $request, Board $board): JsonResponse
    {
        Gate::authorize('view', $board);

        $request->validate([
            'tasks' => 'required|array',
            'tasks.*.id' => 'required|integer',
            'tasks.*.column_id' => 'required|integer',
            'tasks.*.order' => 'required|numeric',
        ]);

        $taskIds = collect($request->tasks)->pluck('id')->unique()->toArray();
        $destColumnIds = collect($request->tasks)->pluck('column_id')->unique()->toArray();
        $boardColumnIds = $board->columns()->whereNull('archived_at')->pluck('id')->toArray();

        // 1. All destination columns must belong to this board
        if (!empty(array_diff($destColumnIds, $boardColumnIds))) {
            return response()->json([
                'message' => 'Cột đích không thuộc bảng này.',
                'errors' => ['column_id' => ['Một hoặc nhiều cột đích không thuộc bảng này.']]
            ], 422);
        }

        // 2. All tasks must belong to this board
        $validTaskCount = Task::whereIn('tasks.id', $taskIds)
            ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
            ->where('kanban_columns.board_id', $board->id)
            ->count();

        if (count($taskIds) !== $validTaskCount) {
            return response()->json([
                'message' => 'Một hoặc nhiều công việc không thuộc bảng này.',
                'errors' => ['tasks' => ['Một hoặc nhiều công việc không thuộc bảng này.']]
            ], 422);
        }

        // WIP Limit Check (Strict mode) for reorderTasks
        $strictColumns = KanbanColumn::whereIn('id', $destColumnIds)
            ->whereNotNull('wip_limit')
            ->where('wip_limit', '>', 0)
            ->where('wip_enforcement', 'strict')
            ->get();

        foreach ($strictColumns as $strictCol) {
            $tasksInRequestForCol = collect($request->tasks)->where('column_id', $strictCol->id)->pluck('id')->toArray();
            $rootTasksInRequestForColCount = Task::whereIn('id', $tasksInRequestForCol)->whereNull('parent_task_id')->count();
            
            $existingRootTasksCount = Task::where('column_id', $strictCol->id)
                ->whereNotIn('id', $taskIds)
                ->whereNull('parent_task_id')
                ->whereNull('archived_at')
                ->count();

            if (($rootTasksInRequestForColCount + $existingRootTasksCount) > $strictCol->wip_limit) {
                return response()->json([
                    'message' => "Cột '{$strictCol->title}' đã đạt giới hạn WIP tối đa ({$strictCol->wip_limit} công việc). Chế độ Nghiêm ngặt (Strict) không cho phép vượt quá giới hạn.",
                    'error_code' => 'WIP_LIMIT_EXCEEDED',
                    'errors' => ['column_id' => ["Cột '{$strictCol->title}' đã đạt giới hạn WIP tối đa ({$strictCol->wip_limit} công việc)."]],
                    'wip_limit' => $strictCol->wip_limit,
                    'enforcement' => 'strict',
                ], 422);
            }
        }

        DB::transaction(function () use ($request) {
            foreach ($request->tasks as $taskData) {
                Task::where('id', $taskData['id'])->update([
                    'column_id' => $taskData['column_id'],
                    'order' => $taskData['order'],
                ]);
            }
        });

        return response()->json(['message' => 'Cập nhật vị trí thẻ thành công']);
    }

    /**
     * PUT /api/tasks/{task}/move
     * Single task fractional move. Strict check: source task and destination column must belong to the SAME board.
     * prev_id and next_id must strictly belong to the destination column.
     */
    public function moveTask(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate([
            'column_id' => 'required|integer|exists:kanban_columns,id',
            'prev_id' => 'nullable|integer|exists:tasks,id',
            'next_id' => 'nullable|integer|exists:tasks,id',
        ]);

        $taskBoardId = $task->column?->board_id ?: DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');
        $destinationColumn = KanbanColumn::findOrFail($request->column_id);

        // Security: Task and destination column must belong to the exact same board
        if ((int)$taskBoardId !== (int)$destinationColumn->board_id) {
            return response()->json([
                'message' => 'Không thể di chuyển công việc sang bảng khác.',
                'errors' => ['column_id' => ['Cột đích không thuộc cùng bảng với công việc.']]
            ], 422);
        }

        // WIP Limit Check (Strict mode)
        // Subtasks (parent_task_id != null) do NOT count towards WIP.
        // Moving within the same column does not change column WIP count.
        $isChangingColumn = ((int)$task->column_id !== (int)$destinationColumn->id);
        $isRootTask = is_null($task->parent_task_id);

        if ($isChangingColumn && $isRootTask) {
            if ($destinationColumn->wip_limit && $destinationColumn->wip_limit > 0 && $destinationColumn->wip_enforcement === 'strict') {
                if ($destinationColumn->wip_count >= $destinationColumn->wip_limit) {
                    return response()->json([
                        'message' => "Cột '{$destinationColumn->title}' đã đạt giới hạn WIP tối đa ({$destinationColumn->wip_limit} công việc). Chế độ Nghiêm ngặt (Strict) không cho phép chuyển thêm công việc vào cột này.",
                        'error_code' => 'WIP_LIMIT_EXCEEDED',
                        'errors' => ['column_id' => ["Cột đã đạt giới hạn WIP tối đa ({$destinationColumn->wip_limit} công việc)."]],
                        'wip_limit' => $destinationColumn->wip_limit,
                        'wip_count' => $destinationColumn->wip_count,
                        'enforcement' => 'strict',
                    ], 422);
                }
            }
        }

        $prevOrder = 0.0;
        if ($request->prev_id) {
            $prevTask = Task::find($request->prev_id);
            if (!$prevTask || (int)$prevTask->column_id !== (int)$destinationColumn->id) {
                return response()->json([
                    'message' => 'Công việc liền trước (prev_id) không thuộc cột đích.',
                    'errors' => ['prev_id' => ['Công việc liền trước không thuộc cột đích.']]
                ], 422);
            }
            $prevOrder = (float) $prevTask->order;
        }

        $nextOrder = 0.0;
        if ($request->next_id) {
            $nextTask = Task::find($request->next_id);
            if (!$nextTask || (int)$nextTask->column_id !== (int)$destinationColumn->id) {
                return response()->json([
                    'message' => 'Công việc liền sau (next_id) không thuộc cột đích.',
                    'errors' => ['next_id' => ['Công việc liền sau không thuộc cột đích.']]
                ], 422);
            }
            $nextOrder = (float) $nextTask->order;
        }

        $newOrder = 0.0;
        if ($request->prev_id && $request->next_id) {
            $newOrder = ($prevOrder + $nextOrder) / 2.0;
        } elseif ($request->prev_id) {
            $newOrder = $prevOrder + 1000.0;
        } elseif ($request->next_id) {
            $newOrder = $nextOrder / 2.0;
        } else {
            $newOrder = 1000.0;
        }

        $oldColumnId = (int)$task->column_id;
        $wasCompleted = !empty($task->completed_at);

        $doneColumnNames = ['done', 'hoàn thành', 'completed'];
        $isDestDone = in_array(mb_strtolower(trim($destinationColumn->title ?? '')), $doneColumnNames, true);

        $updateData = [
            'column_id' => $destinationColumn->id,
            'order' => $newOrder,
        ];

        if ($isDestDone && !$wasCompleted) {
            $updateData['completed_at'] = now();
            $updateData['completed_by'] = $request->user()->id;
        } elseif (!$isDestDone && $wasCompleted) {
            $updateData['completed_at'] = null;
            $updateData['completed_by'] = null;
        }

        DB::transaction(function () use ($task, $updateData) {
            $task->update($updateData);
        });

        // Trigger notifications
        if ($oldColumnId !== (int)$destinationColumn->id) {
            NotificationService::notifyColumnMoved($task, $request->user(), $destinationColumn);
        }

        if ($isDestDone && !$wasCompleted) {
            NotificationService::notifyTaskCompleted($task, $request->user());
        } elseif (!$isDestDone && $wasCompleted) {
            NotificationService::notifyTaskReopened($task, $request->user());
        }

        return response()->json([
            'message' => 'Cập nhật vị trí thẻ thành công',
            'task' => $task->fresh(['column', 'assignees', 'labels']),
        ]);
    }

    /**
     * Helper to re-sequence active columns to clean order multiples of 1000.
     */
    protected function resequenceColumns(int|string $boardId): void
    {
        $activeColumns = KanbanColumn::where('board_id', $boardId)
            ->whereNull('archived_at')
            ->orderBy('order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        foreach ($activeColumns as $index => $col) {
            $expectedOrder = ($index + 1) * 1000;
            if ($col->order != $expectedOrder) {
                $col->update(['order' => $expectedOrder]);
            }
        }
    }
}
