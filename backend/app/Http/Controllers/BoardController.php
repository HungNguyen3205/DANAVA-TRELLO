<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Workspace;
use Illuminate\Http\Request;

class BoardController extends Controller
{
    // Lấy toàn bộ danh sách bảng của người dùng đang đăng nhập (chỉ hiển thị bảng mà người đó tạo hoặc được thêm vào)
    public function myBoards(Request $request)
    {
        $userId = $request->user()->id;

        $boards = Board::whereHas('members', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })->with('workspace')->orderBy('updated_at', 'desc')->get();

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

        $boards = $boards->map(function ($board) use ($memberships, $membersCount) {
            $member = $memberships->get($board->id);
            $board->is_starred = $member ? (bool)$member->is_starred : false;
            $board->my_role = $member ? $member->role : 'member';
            $board->members_count = $membersCount[$board->id] ?? 1;
            return $board;
        });

        return response()->json($boards);
    }

    // Tạo bảng trực tiếp mà không cần cấu hình hay quản lý Không gian làm việc
    public function storeDirect(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
        ]);

        $userId = $request->user()->id;

        // Tìm hoặc tạo không gian nền cá nhân
        $workspace = Workspace::firstOrCreate(
            ['owner_id' => $userId],
            ['name' => 'Không gian của ' . $request->user()->name]
        );

        \Illuminate\Support\Facades\DB::table('workspace_members')->updateOrInsert(
            ['workspace_id' => $workspace->id, 'user_id' => $userId],
            ['role' => 'admin', 'updated_at' => now()]
        );

        $board = $workspace->boards()->create([
            'name' => $request->name,
            'color' => $request->color ?? 'bg-gradient-to-br from-blue-500 to-cyan-400',
        ]);

        // Người tạo là Quản trị viên (Chủ bảng)
        \Illuminate\Support\Facades\DB::table('board_members')->insert([
            'board_id' => $board->id,
            'user_id' => $userId,
            'role' => 'admin',
            'is_starred' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Tự động tạo sẵn 4 cột mặc định có màu theo quy chuẩn làm việc
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chưa bắt đầu', 'color' => 'violet', 'order' => 1000]);
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Đang thực hiện', 'color' => 'blue', 'order' => 2000]);
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chờ duyệt', 'color' => 'orange', 'order' => 3000]);
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Hoàn thành', 'color' => 'green', 'order' => 4000]);

        return response()->json($board, 201);
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

    // Tạo bảng mới
    public function store(Request $request, Workspace $workspace)
    {
        $userId = $request->user()->id;

        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
        ]);

        $board = $workspace->boards()->create([
            'name' => $request->name,
            'color' => $request->color ?? 'bg-gradient-to-br from-blue-500 to-cyan-400',
        ]);

        // Người tạo bảng tự động trở thành Quản trị viên (Chủ sở hữu) của bảng đó
        \Illuminate\Support\Facades\DB::table('board_members')->insert([
            'board_id' => $board->id,
            'user_id' => $userId,
            'role' => 'admin',
            'is_starred' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Tạo sẵn 4 cột mặc định có màu theo quy chuẩn làm việc
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chưa bắt đầu', 'color' => 'violet', 'order' => 1000]);
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Đang thực hiện', 'color' => 'blue', 'order' => 2000]);
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chờ duyệt', 'color' => 'orange', 'order' => 3000]);
        \App\Models\KanbanColumn::create(['board_id' => $board->id, 'title' => 'Hoàn thành', 'color' => 'green', 'order' => 4000]);

        return response()->json($board, 201);
    }

    // Xem chi tiết một bảng
    public function show(Request $request, Board $board)
    {
        $userId = $request->user()->id;

        // Phải là thành viên của bảng
        $inBoard = \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->exists();

        if (!$inBoard) {
            return response()->json(['message' => 'Bạn không phải là thành viên của bảng này'], 403);
        }

        return response()->json($board->load(['sprints', 'labels', 'columns.tasks', 'members', 'workspace.members']));
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
        $userId = $request->user()->id;

        // Chỉ Quản trị viên (Chủ sở hữu) của bảng mới có quyền chỉnh sửa
        $isBoardAdmin = \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->where('role', 'admin')
            ->exists();

        if (!$isBoardAdmin) {
            return response()->json(['message' => 'Chỉ Quản trị viên của bảng mới có quyền chỉnh sửa bảng.'], 403);
        }

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
        $userId = $request->user()->id;

        // Chỉ Quản trị viên (Chủ sở hữu) của bảng mới có quyền xóa
        $isBoardAdmin = \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->where('role', 'admin')
            ->exists();

        if (!$isBoardAdmin) {
            return response()->json(['message' => 'Chỉ Quản trị viên của bảng mới có quyền xóa bảng.'], 403);
        }

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
}
