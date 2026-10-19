<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class BoardMemberController extends Controller
{
    /**
     * Helper to resolve Board instance regardless of whether route has {workspace} prefix or not.
     */
    private function resolveBoard(Request $request): Board
    {
        $board = $request->route('board');
        if ($board instanceof Board) {
            return $board;
        }

        if (is_numeric($board) || is_string($board)) {
            return Board::findOrFail($board);
        }

        abort(404, 'Không tìm thấy bảng công việc.');
    }

    /**
     * GET /api/boards/{board}/members
     * GET /api/workspaces/{workspace}/boards/{board}/members
     * List all members of a board. Only board members can view.
     */
    public function index(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        Gate::authorize('view', $board);

        $members = DB::table('board_members')
            ->join('users', 'users.id', '=', 'board_members.user_id')
            ->where('board_members.board_id', $board->id)
            ->select([
                'users.id',
                'users.name',
                'users.username',
                'users.email',
                'users.avatar',
                'board_members.role',
                'board_members.created_at as joined_at',
            ])
            ->get();

        return response()->json($members);
    }

    /**
     * POST /api/boards/{board}/members
     * POST /api/workspaces/{workspace}/boards/{board}/members
     * Add a member to the board. Only Board Admin can add.
     */
    public function store(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        Gate::authorize('manageMembers', $board);

        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role' => 'required|in:admin,member',
        ]);

        $targetUser = User::findOrFail($request->user_id);
        if ($targetUser->account_status !== 'active') {
            return response()->json(['message' => 'Tài khoản này đang bị khóa hoặc không hoạt động.'], 422);
        }

        DB::table('board_members')->updateOrInsert(
            [
                'board_id' => $board->id,
                'user_id' => $targetUser->id,
            ],
            [
                'role' => $request->role,
                'updated_at' => now(),
            ]
        );

        // Notify member if not adding self
        if ($targetUser->id !== $request->user()->id) {
            $targetUser->notify(new \App\Notifications\BoardMemberAddedNotification($board, $request->user()));
        }

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $request->user()->id,
            'action' => 'add_board_member',
            'old_value' => null,
            'new_value' => json_encode([
                'member_id' => $targetUser->id,
                'member_name' => $targetUser->name,
                'member_username' => $targetUser->username,
                'role' => $request->role,
                'timestamp' => now()->toIso8601String(),
            ]),
        ]);

        // Telegram notification for member added
        try {
            $telegramService = app(\App\Services\TelegramService::class);
            $destinations = $telegramService->resolveBoardDestinations($board, 'member_added');
            if (!empty($destinations)) {
                $formatted = $telegramService->formatMemberAdded($targetUser, $request->user(), $board, $request->role);
                foreach ($destinations as $dest) {
                    \App\Jobs\SendTelegramNotificationJob::dispatch(
                        integrationId: $dest->id,
                        chatId: $dest->chat_id,
                        message: $formatted['text'],
                        options: ['buttons' => $formatted['buttons']],
                        eventType: 'member_added',
                        notifiableType: Board::class,
                        notifiableId: $board->id,
                        idempotencyKey: "member_added_{$board->id}_{$targetUser->id}_{$dest->chat_id}"
                    );
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Telegram dispatch error for member_added: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Đã thêm thành viên vào bảng thành công'], 201);
    }

    /**
     * PATCH /api/boards/{board}/members/{userId}
     * PATCH /api/workspaces/{workspace}/boards/{board}/members/{userId}
     * Change member's role. Only Board Admin can update.
     */
    public function update(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        Gate::authorize('manageMembers', $board);

        $userId = (int) $request->route('userId');

        $request->validate([
            'role' => 'required|in:admin,member',
        ]);

        $memberRow = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->first();

        if (!$memberRow) {
            return response()->json(['message' => 'Thành viên không thuộc bảng này.'], 404);
        }

        // Prevent demoting the last admin
        $adminCount = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('role', 'admin')
            ->count();

        if ($memberRow->role === 'admin' && $request->role !== 'admin' && $adminCount <= 1) {
            return response()->json([
                'message' => 'Không thể hạ quyền Quản trị viên duy nhất của bảng.',
                'errors' => ['role' => ['Không thể hạ quyền Quản trị viên duy nhất của bảng.']]
            ], 422);
        }

        DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->update([
                'role' => $request->role,
                'updated_at' => now(),
            ]);

        return response()->json(['message' => 'Đã cập nhật vai trò']);
    }

    /**
     * DELETE /api/boards/{board}/members/{userId}
     * DELETE /api/workspaces/{workspace}/boards/{board}/members/{userId}
     * Remove a member or leave the board.
     * Admin can remove others. Member can only remove self.
     * The last admin cannot be removed or leave.
     */
    public function destroy(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        $userId = (int) $request->route('userId');
        $currentUserId = (int) $request->user()->id;

        $memberRow = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->first();

        if (!$memberRow) {
            return response()->json(['message' => 'Thành viên không thuộc bảng này.'], 404);
        }

        $isSelf = ($currentUserId === $userId);
        $isBoardAdmin = $request->user()->isBoardAdmin($board->id);

        if (!$isBoardAdmin && !$isSelf) {
            return response()->json(['message' => 'Chỉ Quản trị viên của bảng mới có quyền xóa thành viên khác.'], 403);
        }

        // Prevent removing the last admin
        $adminCount = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('role', 'admin')
            ->count();

        if ($memberRow->role === 'admin' && $adminCount <= 1) {
            return response()->json([
                'message' => 'Không thể gỡ Quản trị viên duy nhất của bảng.',
                'errors' => ['user_id' => ['Không thể gỡ Quản trị viên duy nhất của bảng.']]
            ], 422);
        }

        DB::transaction(function () use ($board, $userId) {
            DB::table('board_members')
                ->where('board_id', $board->id)
                ->where('user_id', $userId)
                ->delete();

            // Find all tasks on this board where user is assigned
            $affectedTaskIds = DB::table('tasks')
                ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
                ->join('task_assignees', 'tasks.id', '=', 'task_assignees.task_id')
                ->where('kanban_columns.board_id', $board->id)
                ->where('task_assignees.user_id', $userId)
                ->pluck('tasks.id')
                ->toArray();

            if (!empty($affectedTaskIds)) {
                DB::table('task_assignees')
                    ->whereIn('task_id', $affectedTaskIds)
                    ->where('user_id', $userId)
                    ->delete();

                // Rebalance remaining assignees for affected tasks
                $tasks = Task::whereIn('id', $affectedTaskIds)->get();
                foreach ($tasks as $t) {
                    $remainingUserIds = $t->assignees()->pluck('users.id')->map(fn($id) => (int)$id)->toArray();
                    $t->syncAssigneesWithAutoSplit($remainingUserIds);
                }
            }
        });

        return response()->json(['message' => 'Đã gỡ thành viên khỏi bảng']);
    }
}
