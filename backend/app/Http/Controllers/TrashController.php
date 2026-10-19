<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TrashController extends Controller
{
    /**
     * GET /api/trash
     * List trashed items with support for Board/Column/Task/Attachment filtering.
     * Restricted: Only Board Owner and Board Admins can access board trash.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $boardParam = $request->query('board_id');
        $typeFilter = $request->query('type', 'all');
        $search = trim($request->query('search', ''));

        $board = null;
        $adminBoardIds = [];
        $activeColumns = [];

        if ($boardParam) {
            $board = Board::withTrashed()
                ->where('id', $boardParam)
                ->orWhere('public_id', $boardParam)
                ->first();

            if (!$board) {
                return response()->json(['message' => 'Bảng không tồn tại.'], 404);
            }

            // Authorization: Only Board Owner or Board Admin can view trash
            $isOwnerOrAdmin = ((int)$board->owner_id === (int)$user->id) || $user->isBoardAdmin($board->id);
            if (!$isOwnerOrAdmin) {
                abort(403, 'Chỉ Chủ sở hữu hoặc Quản trị viên của Bảng mới có quyền xem thùng rác.');
            }

            $adminBoardIds = [$board->id];
            $activeColumns = KanbanColumn::where('board_id', $board->id)
                ->whereNull('archived_at')
                ->orderBy('order')
                ->get(['id', 'title']);
        } else {
            // No board specified: fetch all boards where user is Owner or Admin
            $ownedBoardIds = Board::withTrashed()
                ->where('owner_id', $user->id)
                ->pluck('id');

            $adminMemberBoardIds = DB::table('board_members')
                ->where('user_id', $user->id)
                ->whereIn('role', ['admin', 'owner'])
                ->pluck('board_id');

            $adminBoardIds = $ownedBoardIds->merge($adminMemberBoardIds)->unique()->toArray();
        }

        $items = [];

        // 1. BOARDS TRASH
        if ($typeFilter === 'all' || $typeFilter === 'board') {
            $boardQuery = Board::onlyTrashed()
                ->with('deletedBy:id,name,username,avatar');

            if ($board) {
                if ($board->trashed()) {
                    $boardQuery->where('id', $board->id);
                } else {
                    $boardQuery->whereRaw('1 = 0'); // Current board is active
                }
            } else {
                $boardQuery->whereIn('id', $adminBoardIds);
            }

            foreach ($boardQuery->get() as $b) {
                $items[] = [
                    'id' => $b->id,
                    'type' => 'board',
                    'title' => $b->name,
                    'deleted_at' => $b->deleted_at?->toIso8601String(),
                    'deleted_by' => $b->deletedBy,
                    'board_id' => $b->id,
                    'board_name' => $b->name,
                    'board_code' => $b->public_id,
                    'is_column_deleted' => false,
                    'column_id' => null,
                    'column_title' => null,
                    'parent_id' => null,
                    'parent_title' => null,
                    'is_subtask' => false,
                    'extra' => [
                        'color' => $b->color,
                        'description' => $b->description,
                    ],
                ];
            }
        }

        // 2. COLUMNS TRASH
        if ($typeFilter === 'all' || $typeFilter === 'column') {
            $colQuery = KanbanColumn::onlyTrashed()
                ->whereIn('board_id', $adminBoardIds)
                ->with(['deletedBy:id,name,username,avatar', 'board:id,name,public_id']);

            foreach ($colQuery->get() as $col) {
                $items[] = [
                    'id' => $col->id,
                    'type' => 'column',
                    'title' => $col->title,
                    'deleted_at' => $col->deleted_at?->toIso8601String(),
                    'deleted_by' => $col->deletedBy,
                    'board_id' => $col->board_id,
                    'board_name' => $col->board?->name,
                    'board_code' => $col->board?->public_id,
                    'is_column_deleted' => false,
                    'column_id' => $col->id,
                    'column_title' => $col->title,
                    'parent_id' => null,
                    'parent_title' => null,
                    'is_subtask' => false,
                    'extra' => [
                        'color' => $col->color,
                        'order' => $col->order,
                    ],
                ];
            }
        }

        // 3. TASKS & SUBTASKS TRASH
        if ($typeFilter === 'all' || $typeFilter === 'task' || $typeFilter === 'subtask') {
            $taskQuery = Task::onlyTrashed()
                ->whereHas('column', function ($q) use ($adminBoardIds) {
                    $q->withTrashed()->whereIn('board_id', $adminBoardIds);
                })
                ->with([
                    'deletedBy:id,name,username,avatar',
                    'column' => fn($q) => $q->withTrashed(),
                    'column.board' => fn($q) => $q->withTrashed(),
                    'parent' => fn($q) => $q->withTrashed(),
                ]);

            if ($typeFilter === 'subtask') {
                $taskQuery->whereNotNull('parent_task_id');
            }

            foreach ($taskQuery->get() as $t) {
                $col = $t->column;
                $isColDeleted = $col ? $col->trashed() : true;
                $isSubtask = !empty($t->parent_task_id);

                $items[] = [
                    'id' => $t->id,
                    'type' => 'task',
                    'title' => $t->title,
                    'deleted_at' => $t->deleted_at?->toIso8601String(),
                    'deleted_by' => $t->deletedBy,
                    'board_id' => $col?->board?->id,
                    'board_name' => $col?->board?->name,
                    'board_code' => $col?->board?->public_id,
                    'is_column_deleted' => $isColDeleted,
                    'column_id' => $t->column_id,
                    'column_title' => $col?->title ?? 'Không xác định',
                    'parent_id' => $t->parent_task_id,
                    'parent_title' => $t->parent?->title,
                    'is_subtask' => $isSubtask,
                    'extra' => [
                        'priority' => $t->priority,
                        'complexity' => $t->complexity,
                        'estimated_points' => $t->estimated_points,
                        'external_key' => $t->external_key,
                    ],
                ];
            }
        }

        // 4. ATTACHMENTS TRASH
        if ($typeFilter === 'all' || $typeFilter === 'attachment') {
            $attQuery = TaskAttachment::onlyTrashed()
                ->whereHas('task', function ($t) use ($adminBoardIds) {
                    $t->withTrashed()->whereHas('column', function ($c) use ($adminBoardIds) {
                        $c->withTrashed()->whereIn('board_id', $adminBoardIds);
                    });
                })
                ->with([
                    'deletedBy:id,name,username,avatar',
                    'task' => fn($q) => $q->withTrashed()->with(['column' => fn($c) => $c->withTrashed()->with('board')]),
                ]);

            foreach ($attQuery->get() as $att) {
                $task = $att->task;
                $col = $task?->column;
                $b = $col?->board;

                $items[] = [
                    'id' => $att->id,
                    'type' => 'attachment',
                    'title' => $att->file_name,
                    'deleted_at' => $att->deleted_at?->toIso8601String(),
                    'deleted_by' => $att->deletedBy,
                    'board_id' => $b?->id,
                    'board_name' => $b?->name,
                    'board_code' => $b?->public_id,
                    'is_column_deleted' => false,
                    'column_id' => $col?->id,
                    'column_title' => $col?->title,
                    'parent_id' => $task?->id,
                    'parent_title' => $task?->title,
                    'is_subtask' => false,
                    'extra' => [
                        'file_size' => $att->size,
                        'mime_type' => $att->mime_type,
                    ],
                ];
            }
        }

        // Sort items by deleted_at descending
        usort($items, fn($a, $b) => strcmp($b['deleted_at'] ?? '', $a['deleted_at'] ?? ''));

        // Calculate counts
        $counts = [
            'all' => count($items),
            'board' => count(array_filter($items, fn($i) => $i['type'] === 'board')),
            'column' => count(array_filter($items, fn($i) => $i['type'] === 'column')),
            'task' => count(array_filter($items, fn($i) => $i['type'] === 'task')),
            'attachment' => count(array_filter($items, fn($i) => $i['type'] === 'attachment')),
        ];

        // Search filtering if requested
        if ($search !== '') {
            $searchLower = mb_strtolower($search);
            $items = array_values(array_filter($items, function ($item) use ($searchLower) {
                return str_contains(mb_strtolower($item['title'] ?? ''), $searchLower)
                    || str_contains(mb_strtolower($item['board_name'] ?? ''), $searchLower)
                    || str_contains(mb_strtolower($item['deleted_by']['name'] ?? ''), $searchLower);
            }));
        }

        return response()->json([
            'data' => $items,
            'counts' => $counts,
            'available_columns' => $activeColumns,
        ]);
    }

    /**
     * POST /api/trash/{type}/{id}/restore
     * Restore a soft-deleted item.
     */
    public function restore(Request $request, string $type, int $id): JsonResponse
    {
        $user = $request->user();

        return match ($type) {
            'board' => $this->restoreBoard($user, $id),
            'column' => $this->restoreColumn($user, $id),
            'task' => $this->restoreTask($request, $user, $id),
            'attachment' => $this->restoreAttachment($user, $id),
            default => response()->json(['message' => "Loại đối tượng '{$type}' không hợp lệ."], 400),
        };
    }

    /**
     * DELETE /api/trash/{type}/{id}/force
     * Permanently force delete an item.
     * Requires 2-step confirmation with exact object name and records ActivityLog.
     * Regular members are strictly blocked (403).
     */
    public function forceDelete(Request $request, string $type, int $id): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'confirm_name' => ['required', 'string'],
        ], [
            'confirm_name.required' => 'Vui lòng nhập tên đối tượng để xác nhận xóa vĩnh viễn.',
        ]);

        $confirmName = trim($request->input('confirm_name'));

        return match ($type) {
            'board' => $this->forceDeleteBoard($user, $id, $confirmName),
            'column' => $this->forceDeleteColumn($user, $id, $confirmName),
            'task' => $this->forceDeleteTask($user, $id, $confirmName),
            'attachment' => $this->forceDeleteAttachment($user, $id, $confirmName),
            default => response()->json(['message' => "Loại đối tượng '{$type}' không hợp lệ."], 400),
        };
    }

    // -------------------------------------------------------------
    // RESTORE LOGIC
    // -------------------------------------------------------------

    private function restoreBoard($user, int $id): JsonResponse
    {
        $board = Board::onlyTrashed()->findOrFail($id);

        if ((int)$board->owner_id !== (int)$user->id) {
            abort(403, 'Chỉ Chủ sở hữu bảng mới có quyền khôi phục bảng này.');
        }

        $board->update(['deleted_by' => null]);
        $board->restore();

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'action' => 'restored_board',
            'old_value' => null,
            'new_value' => "Đã khôi phục bảng '{$board->name}' từ thùng rác.",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Đã khôi phục bảng '{$board->name}' thành công.",
        ]);
    }

    private function restoreColumn($user, int $id): JsonResponse
    {
        $column = KanbanColumn::onlyTrashed()->findOrFail($id);

        if (!$user->isBoardAdmin($column->board_id)) {
            abort(403, 'Chỉ Quản trị viên hoặc Chủ sở hữu Bảng mới có quyền khôi phục cột.');
        }

        // Keep a reasonable order: place column at the end of active columns
        $maxOrder = KanbanColumn::where('board_id', $column->board_id)
            ->whereNull('archived_at')
            ->max('order') ?? 0;

        $column->update([
            'order' => $maxOrder + 1000,
            'deleted_by' => null,
        ]);
        $column->restore();

        ActivityLog::create([
            'board_id' => $column->board_id,
            'user_id' => $user->id,
            'action' => 'restored_column',
            'old_value' => null,
            'new_value' => "Đã khôi phục cột '{$column->title}' từ thùng rác.",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Đã khôi phục cột '{$column->title}' thành công.",
        ]);
    }

    private function restoreTask(Request $request, $user, int $id): JsonResponse
    {
        $task = Task::onlyTrashed()
            ->with(['column' => fn($c) => $c->withTrashed()])
            ->findOrFail($id);

        $boardId = $task->column?->board_id
            ?: DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');

        if (!$user->isBoardAdmin($boardId)) {
            abort(403, 'Chỉ Quản trị viên hoặc Chủ sở hữu Bảng mới có quyền khôi phục công việc.');
        }

        // Check if old column still exists and is active (not soft deleted)
        $oldColumn = KanbanColumn::where('id', $task->column_id)
            ->whereNull('deleted_at')
            ->first();

        if (!$oldColumn) {
            // Old column was deleted -> require target_column_id
            $targetColId = $request->input('target_column_id');

            if (!$targetColId) {
                $availableColumns = KanbanColumn::where('board_id', $boardId)
                    ->whereNull('archived_at')
                    ->orderBy('order')
                    ->get(['id', 'title']);

                return response()->json([
                    'message' => 'Cột ban đầu của công việc này đã bị xóa. Vui lòng chọn cột đích để khôi phục.',
                    'require_target_column' => true,
                    'available_columns' => $availableColumns,
                ], 422);
            }

            $targetColumn = KanbanColumn::where('id', $targetColId)
                ->where('board_id', $boardId)
                ->whereNull('deleted_at')
                ->first();

            if (!$targetColumn) {
                return response()->json([
                    'message' => 'Cột đích đã chọn không hợp lệ hoặc không thuộc bảng này.',
                ], 422);
            }

            $task->column_id = $targetColumn->id;
        }

        $task->update(['deleted_by' => null]);
        $task->restore();

        ActivityLog::create([
            'board_id' => $boardId,
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'restored_task',
            'old_value' => null,
            'new_value' => "Đã khôi phục công việc '{$task->title}' từ thùng rác.",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Đã khôi phục công việc '{$task->title}' thành công.",
        ]);
    }

    private function restoreAttachment($user, int $id): JsonResponse
    {
        $att = TaskAttachment::onlyTrashed()
            ->with(['task' => fn($t) => $t->withTrashed()->with(['column' => fn($c) => $c->withTrashed()])])
            ->findOrFail($id);

        $boardId = $att->task?->column?->board_id;

        $isAuthor = ((int)$att->user_id === (int)$user->id);
        $isBoardAdmin = $boardId && $user->isBoardAdmin($boardId);

        if (!$isAuthor && !$isBoardAdmin) {
            abort(403, 'Bạn không có quyền khôi phục tệp đính kèm này.');
        }

        $att->update(['deleted_by' => null]);
        $att->restore();

        ActivityLog::create([
            'board_id' => $boardId,
            'task_id' => $att->task_id,
            'user_id' => $user->id,
            'action' => 'restored_attachment',
            'old_value' => null,
            'new_value' => "Đã khôi phục tệp đính kèm '{$att->file_name}' từ thùng rác.",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Đã khôi phục tệp đính kèm '{$att->file_name}' thành công.",
        ]);
    }

    // -------------------------------------------------------------
    // FORCE DELETE LOGIC (2-Step confirmation with Name validation)
    // -------------------------------------------------------------

    private function forceDeleteBoard($user, int $id, string $confirmName): JsonResponse
    {
        $board = Board::onlyTrashed()->findOrFail($id);

        // Only Board Owner can permanently force delete a board
        if ((int)$board->owner_id !== (int)$user->id) {
            abort(403, 'Chỉ Chủ sở hữu bảng mới có quyền xóa vĩnh viễn bảng này.');
        }

        if (mb_strtolower($confirmName) !== mb_strtolower(trim($board->name))) {
            return response()->json([
                'message' => "Tên xác nhận '{$confirmName}' không khớp với tên bảng '{$board->name}'.",
                'errors' => ['confirm_name' => ['Tên xác nhận không chính xác.']],
            ], 422);
        }

        $boardName = $board->name;

        DB::transaction(function () use ($board, $user, $boardName) {
            ActivityLog::create([
                'board_id' => $board->id,
                'user_id' => $user->id,
                'action' => 'force_deleted_board',
                'old_value' => $boardName,
                'new_value' => "Đã xóa vĩnh viễn bảng '{$boardName}' khỏi hệ thống.",
            ]);

            $board->forceDelete();
        });

        return response()->json([
            'success' => true,
            'message' => "Đã xóa vĩnh viễn bảng '{$boardName}' thành công.",
        ]);
    }

    private function forceDeleteColumn($user, int $id, string $confirmName): JsonResponse
    {
        $column = KanbanColumn::onlyTrashed()->findOrFail($id);

        if (!$user->isBoardAdmin($column->board_id)) {
            abort(403, 'Chỉ Quản trị viên hoặc Chủ sở hữu Bảng mới có quyền xóa vĩnh viễn cột.');
        }

        if (mb_strtolower($confirmName) !== mb_strtolower(trim($column->title))) {
            return response()->json([
                'message' => "Tên xác nhận '{$confirmName}' không khớp với tên cột '{$column->title}'.",
                'errors' => ['confirm_name' => ['Tên xác nhận không chính xác.']],
            ], 422);
        }

        $colTitle = $column->title;
        $boardId = $column->board_id;

        DB::transaction(function () use ($column, $user, $colTitle, $boardId) {
            ActivityLog::create([
                'board_id' => $boardId,
                'user_id' => $user->id,
                'action' => 'force_deleted_column',
                'old_value' => $colTitle,
                'new_value' => "Đã xóa vĩnh viễn cột '{$colTitle}' khỏi hệ thống.",
            ]);

            $column->forceDelete();
        });

        return response()->json([
            'success' => true,
            'message' => "Đã xóa vĩnh viễn cột '{$colTitle}' thành công.",
        ]);
    }

    private function forceDeleteTask($user, int $id, string $confirmName): JsonResponse
    {
        $task = Task::onlyTrashed()
            ->with(['column' => fn($c) => $c->withTrashed()])
            ->findOrFail($id);

        $boardId = $task->column?->board_id
            ?: DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');

        if (!$user->isBoardAdmin($boardId)) {
            abort(403, 'Chỉ Quản trị viên hoặc Chủ sở hữu Bảng mới có quyền xóa vĩnh viễn công việc.');
        }

        if (mb_strtolower($confirmName) !== mb_strtolower(trim($task->title))) {
            return response()->json([
                'message' => "Tên xác nhận '{$confirmName}' không khớp với tiêu đề công việc '{$task->title}'.",
                'errors' => ['confirm_name' => ['Tên xác nhận không chính xác.']],
            ], 422);
        }

        $taskTitle = $task->title;

        DB::transaction(function () use ($task, $user, $taskTitle, $boardId) {
            ActivityLog::create([
                'board_id' => $boardId,
                'task_id' => null,
                'user_id' => $user->id,
                'action' => 'force_deleted_task',
                'old_value' => $taskTitle,
                'new_value' => "Đã xóa vĩnh viễn công việc '{$taskTitle}' khỏi hệ thống.",
            ]);

            $task->forceDelete();
        });

        return response()->json([
            'success' => true,
            'message' => "Đã xóa vĩnh viễn công việc '{$taskTitle}' thành công.",
        ]);
    }

    private function forceDeleteAttachment($user, int $id, string $confirmName): JsonResponse
    {
        $att = TaskAttachment::onlyTrashed()
            ->with(['task' => fn($t) => $t->withTrashed()->with(['column' => fn($c) => $c->withTrashed()])])
            ->findOrFail($id);

        $boardId = $att->task?->column?->board_id;

        if (!$user->isBoardAdmin($boardId)) {
            abort(403, 'Chỉ Quản trị viên hoặc Chủ sở hữu Bảng mới có quyền xóa vĩnh viễn tệp đính kèm.');
        }

        if (mb_strtolower($confirmName) !== mb_strtolower(trim($att->file_name))) {
            return response()->json([
                'message' => "Tên xác nhận '{$confirmName}' không khớp với tên tệp '{$att->file_name}'.",
                'errors' => ['confirm_name' => ['Tên xác nhận không chính xác.']],
            ], 422);
        }

        $fileName = $att->file_name;

        DB::transaction(function () use ($att, $user, $fileName, $boardId) {
            if ($att->file_path && Storage::disk('public')->exists($att->file_path)) {
                Storage::disk('public')->delete($att->file_path);
            }

            ActivityLog::create([
                'board_id' => $boardId,
                'task_id' => $att->task_id,
                'user_id' => $user->id,
                'action' => 'force_deleted_attachment',
                'old_value' => $fileName,
                'new_value' => "Đã xóa vĩnh viễn tệp đính kèm '{$fileName}' khỏi hệ thống.",
            ]);

            $att->forceDelete();
        });

        return response()->json([
            'success' => true,
            'message' => "Đã xóa vĩnh viễn tệp đính kèm '{$fileName}' thành công.",
        ]);
    }
}
