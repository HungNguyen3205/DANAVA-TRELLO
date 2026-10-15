    <?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Workspace;
use Illuminate\Http\Request;

class BoardController extends Controller
{
    // Lấy danh sách bảng trong một Không gian làm việc
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

        $query = $workspace->boards();
        
        // If not admin, only show boards they are a member of
        if ($workspaceMember->role !== 'admin') {
            $query->whereHas('members', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            });
        }
        
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
            return $board;
        });

        return response()->json($boards);
    }

    // Tạo bảng mới
    public function store(Request $request, Workspace $workspace)
    {
        $userId = $request->user()->id;
        $isSystemAdmin = $request->user()->system_role === 'system_admin';
        $isOwner = $workspace->owner_id == $userId;
        $workspaceMember = $workspace->members()->where('user_id', $userId)->first();
        $isWorkspaceAdmin = $workspaceMember && $workspaceMember->pivot->role === 'admin';

        if (!$isSystemAdmin && !$isOwner && !$isWorkspaceAdmin) {
            return response()->json(['message' => 'Forbidden - Chỉ Quản trị viên Không gian làm việc mới có quyền tạo bảng'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
        ]);

        $board = $workspace->boards()->create([
            'name' => $request->name,
            'color' => $request->color ?? 'bg-gradient-to-br from-blue-500 to-cyan-400',
        ]);

        // Người tạo bảng tự động trở thành Quản trị viên (Admin) của bảng đó
        \Illuminate\Support\Facades\DB::table('board_members')->insert([
            'board_id' => $board->id,
            'user_id' => $request->user()->id,
            'role' => 'admin',
            'is_starred' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json($board, 201);
    }

    // Xem chi tiết một bảng
    public function show(Request $request, Board $board)
    {
        $workspace = $board->workspace;
        $userId = $request->user()->id;
        
        // Kiểm tra quyền
        $workspaceMember = $workspace->members()->where('user_id', $userId)->first();
        if (!$workspaceMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Must be workspace admin OR explicitly in the board
        if ($workspaceMember->pivot->role !== 'admin') {
            $inBoard = \Illuminate\Support\Facades\DB::table('board_members')
                ->where('board_id', $board->id)
                ->where('user_id', $userId)
                ->exists();
            if (!$inBoard) {
                return response()->json(['message' => 'Forbidden - You are not a member of this board'], 403);
            }
        }

        return response()->json($board->load(['sprints', 'labels', 'columns.tasks', 'workspace.members']));
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
        $workspace = $board->workspace;
        
        // Kiểm tra quyền admin
        $member = $workspace->members()->where('user_id', $request->user()->id)->first();
        if (!$member || $member->pivot->role !== 'admin') {
            return response()->json(['message' => 'Forbidden - Only Admins can update boards'], 403);
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
        $workspace = $board->workspace;
        
        // Kiểm tra quyền admin
        $member = $workspace->members()->where('user_id', $request->user()->id)->first();
        if (!$member || $member->pivot->role !== 'admin') {
            return response()->json(['message' => 'Forbidden - Only Admins can delete boards'], 403);
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
            // If they aren't directly in board_members, but they are in the workspace, 
            // add them to board_members with default role
            $workspaceMember = \Illuminate\Support\Facades\DB::table('workspace_members')
                ->where('workspace_id', $board->workspace_id)
                ->where('user_id', $userId)
                ->first();
                
            if (!$workspaceMember) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            
            \Illuminate\Support\Facades\DB::table('board_members')->insert([
                'board_id' => $board->id,
                'user_id' => $userId,
                'role' => $workspaceMember->role,
                'is_starred' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            
            return response()->json(['is_starred' => true]);
        }

        // Toggle the star status
        $newStatus = !$member->is_starred;
        
        \Illuminate\Support\Facades\DB::table('board_members')
            ->where('id', $member->id)
            ->update(['is_starred' => $newStatus, 'updated_at' => now()]);
            
        return response()->json(['is_starred' => $newStatus]);
    }
}
