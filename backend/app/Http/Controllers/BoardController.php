<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Workspace;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class BoardController extends Controller
{
    // Lấy toàn bộ danh sách bảng của người dùng đang đăng nhập (chỉ hiển thị bảng mà người đó tạo hoặc được thêm vào)
    public function myBoards(Request $request)
    {
        $userId = $request->user()->id;

        $boards = Board::where(function ($q) use ($userId) {
            $q->where('owner_id', $userId)
              ->orWhereHas('members', function ($sub) use ($userId) {
                  $sub->where('users.id', $userId);
              });
        })->with('owner')->orderBy('updated_at', 'desc')->get();

        $boardIds = $boards->pluck('id')->toArray();

        $memberships = \Illuminate\Support\Facades\DB::table('board_members')
            ->whereIn('board_id', $boardIds)
            ->where('user_id', $userId)
            ->get()
            ->keyBy('board_id');

        $membersCount = \Illuminate\Support\Facades\DB::table('board_members')
            ->whereIn('board_id', $boardIds)
            ->select('board_id', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
            ->groupBy('board_id')
            ->pluck('count', 'board_id');

        $boards = $boards->map(function ($board) use ($userId, $memberships, $membersCount) {
            $member = $memberships->get($board->id);
            $board->is_starred = $member ? (bool)$member->is_starred : false;
            $board->my_role = ($board->owner_id === $userId || ($member && in_array($member->role, ['owner', 'admin']))) ? 'admin' : 'member';
            $board->members_count = $membersCount[$board->id] ?? 1;
            return $board;
        });

        return response()->json($boards);
    }

    // Tạo bảng trực tiếp hoàn toàn Board-first, không tạo Không gian làm việc nền
    public function storeDirect(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
            'description' => 'nullable|string',
        ]);

        $userId = $request->user()->id;

        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $userId) {
            $board = Board::create([
                'owner_id' => $userId,
                'workspace_id' => null,
                'name' => $request->name,
                'description' => $request->description,
                'color' => $request->color ?? 'bg-gradient-to-br from-blue-500 to-cyan-400',
            ]);

            // Người tạo là Quản trị viên (Chủ sở hữu) của bảng
            \Illuminate\Support\Facades\DB::table('board_members')->updateOrInsert(
                ['board_id' => $board->id, 'user_id' => $userId],
                ['role' => 'admin', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()]
            );

            // Tự động tạo sẵn 4 cột mặc định có màu theo quy chuẩn làm việc
            \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chưa bắt đầu', 'color' => 'violet', 'order' => 1000]);
            \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Đang thực hiện', 'color' => 'blue', 'order' => 2000]);
            \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chờ duyệt', 'color' => 'orange', 'order' => 3000]);
            \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Hoàn thành', 'color' => 'green', 'order' => 4000]);

            return response()->json($board, 201);
        });
    }

    // Lấy danh sách bảng trong một Không gian (Chỉ bảng mà tài khoản có tham gia)
    public function index(Request $request, Workspace $workspace)
    {
        $userId = $request->user()->id;
        
        $workspaceMember = \Illuminate\Support\Facades\DB::table('workspace_members')
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $userId)
            ->first();

        if (!$workspaceMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Bất kể vai trò gì, chỉ hiển thị bảng mà người đó là thành viên (được tạo hoặc được thêm vào)
        $query = $workspace->boards()->whereHas('members', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        });
        
        $boards = $query->get();
        $boardIds = $boards->pluck('id')->toArray();
        
        $memberships = \Illuminate\Support\Facades\DB::table('board_members')
            ->whereIn('board_id', $boardIds)
            ->where('user_id', $userId)
            ->get()
            ->keyBy('board_id');

        $boards = $boards->map(function ($board) use ($memberships) {
            $member = $memberships->get($board->id);
            $board->is_starred = $member ? (bool)$member->is_starred : false;
            $board->my_role = $member ? $member->role : 'member';
            return $board;
        });

        return response()->json($boards);
    }

    // Tạo bảng qua Không gian làm việc cũ (Ngừng hỗ trợ - trả về 410 Gone)
    public function store(Request $request, Workspace $workspace)
    {
        return response()->json([
            'message' => 'Tạo bảng qua Không gian làm việc đã ngừng hỗ trợ. Vui lòng sử dụng POST /api/boards.'
        ], 410);
    }

    // Xem chi tiết một bảng
    public function show(Request $request, Board $board)
    {
        abort_if(!Gate::check('view', $board), 403, 'Bạn không phải là thành viên của bảng này');

        $userId = $request->user()->id;

        $relations = [
            'owner', 
            'sprints', 
            'labels', 
            'columns' => function ($q) {
                $q->whereNull('archived_at')->orderBy('order');
            }, 
            'columns.tasks' => function ($q) {
                $q->whereNull('archived_at')->orderBy('order');
            }, 
            'members'
        ];
        if ($board->workspace_id) {
            $relations[] = 'workspace';
        }

        $boardData = $board->load($relations);
        $member = \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->first();

        $boardData->is_starred = $member ? (bool)$member->is_starred : false;
        $boardData->my_role = ($board->owner_id === $userId || ($member && in_array($member->role, ['owner', 'admin']))) ? 'admin' : 'member';
        $boardData->is_owner = ($board->owner_id === $userId || ($member && $member->role === 'owner'));

        return response()->json($boardData);
    }

    // Resolve an opaque public board code without exposing sequential database IDs in URLs.
    public function showByPublicId(Request $request, string $publicId)
    {
        $board = Board::where('public_id', $publicId)->firstOrFail();

        return $this->show($request, $board);
    }

    // Cập nhật bảng
    public function update(Request $request, Board $board)
    {
        Gate::authorize('update', $board);

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:50',
        ]);

        $board->update($request->only(['name', 'description', 'color']));

        return response()->json($board);
    }

    // Xóa bảng
    public function destroy(Request $request, Board $board)
    {
        Gate::authorize('delete', $board);

        $userId = $request->user()->id;
        $board->update(['deleted_by' => $userId]);
        $board->delete();
        return response()->json(['message' => 'Board deleted successfully']);
    }

    public function toggleStar(Request $request, Board $board)
    {
        $userId = $request->user()->id;
        
        // Find member record for this board
        $member = \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->first();
            
        if (!$member) {
            return response()->json(['message' => 'Bạn không phải là thành viên của bảng này'], 403);
        }

        // Toggle the star status
        $newStatus = !$member->is_starred;
        
        \Illuminate\Support\Facades\DB::table('board_members')
            ->where('id', $member->id)
            ->update(['is_starred' => $newStatus, 'updated_at' => now()]);
            
        return response()->json(['is_starred' => $newStatus]);
    }

    /**
     * POST /api/boards/{board}/evaluation/publish
     * Publish performance evaluation period for the board.
     */
    public function publishEvaluation(Request $request, Board $board)
    {
        Gate::authorize('update', $board);

        $request->validate([
            'period_title' => 'required|string|max:255',
        ]);

        $periodTitle = $request->input('period_title');
        NotificationService::notifyEvaluationPublished($board, $request->user(), $periodTitle);

        return response()->json([
            'message' => 'Đã công bố kỳ đánh giá thành công',
            'period_title' => $periodTitle,
        ]);
    }

    /**
     * POST /api/boards/{board}/transfer-ownership
     * Transfer board ownership to an active member with password confirmation.
     */
    public function transferOwnership(Request $request, Board $board)
    {
        $user = $request->user();

        // Only current board owner can transfer ownership
        if ((int)$board->owner_id !== (int)$user->id) {
            abort(403, 'Chỉ Chủ sở hữu hiện tại mới có quyền chuyển giao quyền sở hữu bảng.');
        }

        $request->validate([
            'new_owner_id' => 'required|integer|exists:users,id',
            'password' => 'required|string',
        ]);

        if (!\Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'password' => ['Mật khẩu xác nhận không chính xác.'],
            ]);
        }

        $newOwnerId = (int)$request->new_owner_id;

        if ($newOwnerId === (int)$user->id) {
            return response()->json([
                'message' => 'Bạn đã là Chủ sở hữu của bảng này.',
            ], 422);
        }

        // Target user must be an active member of this board
        $isMember = \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $newOwnerId)
            ->exists();

        if (!$isMember) {
            return response()->json([
                'message' => 'Người nhận chuyển giao phải là thành viên hiện tại của bảng.',
            ], 422);
        }

        $newOwner = \App\Models\User::findOrFail($newOwnerId);
        if ($newOwner->account_status !== 'active') {
            return response()->json([
                'message' => 'Tài khoản người nhận đang bị khóa hoặc không hoạt động.',
            ], 422);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($board, $user, $newOwnerId) {
            // Update board owner
            $board->update(['owner_id' => $newOwnerId]);

            // Ensure new owner has admin role in board_members
            \Illuminate\Support\Facades\DB::table('board_members')->updateOrInsert(
                ['board_id' => $board->id, 'user_id' => $newOwnerId],
                ['role' => 'admin', 'updated_at' => now()]
            );

            // Previous owner remains an admin in board_members
            \Illuminate\Support\Facades\DB::table('board_members')->updateOrInsert(
                ['board_id' => $board->id, 'user_id' => $user->id],
                ['role' => 'admin', 'updated_at' => now()]
            );

            \App\Models\ActivityLog::create([
                'board_id' => $board->id,
                'user_id' => $user->id,
                'action' => 'transfer_board_ownership',
                'old_value' => (string)$user->id,
                'new_value' => (string)$newOwnerId,
            ]);
        });

        \Illuminate\Support\Facades\Cache::forget("personal_dashboard_optimized_{$user->id}");
        \Illuminate\Support\Facades\Cache::forget("personal_dashboard_optimized_{$newOwnerId}");

        return response()->json([
            'message' => 'Chuyển giao quyền sở hữu bảng thành công.',
            'owner_id' => $newOwnerId,
        ]);
    }
}

