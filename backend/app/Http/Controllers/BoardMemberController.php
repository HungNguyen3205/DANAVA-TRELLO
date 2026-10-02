<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Board;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class BoardMemberController extends Controller
{
    public function index(Request $request, $workspaceId, Board $board)
    {
        $members = DB::table('board_members')
            ->join('users', 'users.id', '=', 'board_members.user_id')
            ->where('board_members.board_id', $board->id)
            ->select('users.id', 'users.name', 'users.username', 'users.email', 'users.avatar', 'board_members.role', 'board_members.created_at as joined_at')
            ->get();

        return response()->json($members);
    }

    public function store(Request $request, $workspaceId, Board $board)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'role' => 'required|in:admin,member',
        ]);

        // Check if user is in workspace
        $inWorkspace = DB::table('workspace_members')
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $request->user_id)
            ->exists();

        if (!$inWorkspace) {
            DB::table('workspace_members')->insert([
                'workspace_id' => $workspaceId,
                'user_id' => $request->user_id,
                'role' => 'member',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('board_members')->insertOrIgnore([
            'board_id' => $board->id,
            'user_id' => $request->user_id,
            'role' => $request->role,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Đã thêm thành viên vào bảng']);
    }

    public function update(Request $request, $workspaceId, Board $board, $userId)
    {
        $request->validate([
            'role' => 'required|in:admin,member',
        ]);

        DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->update(['role' => $request->role, 'updated_at' => now()]);

        return response()->json(['message' => 'Đã cập nhật vai trò']);
    }

    public function destroy(Request $request, $workspaceId, Board $board, $userId)
    {
        // Don't remove the last admin
        if ($request->user()->id == $userId || true) {
            $adminCount = DB::table('board_members')->where('board_id', $board->id)->where('role', 'admin')->count();
            $memberRole = DB::table('board_members')->where('board_id', $board->id)->where('user_id', $userId)->value('role');
            
            if ($adminCount <= 1 && $memberRole === 'admin') {
                return response()->json(['message' => 'Không thể gỡ Quản trị viên duy nhất của bảng.'], 400);
            }
        }

        DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->delete();

        return response()->json(['message' => 'Đã gỡ thành viên khỏi bảng']);
    }
}
