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

        $currentUserId = $request->user()->id;
        $isBoardAdmin = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $currentUserId)
            ->where('role', 'admin')
            ->exists();
        $isSystemAdmin = in_array($request->user()->system_role, ['admin', 'system_admin']);

        // Check if user is Workspace Owner/Admin
        $isWorkspaceAdmin = DB::table('workspace_members')
            ->where('workspace_id', $board->workspace_id)
            ->where('user_id', $currentUserId)
            ->where('role', 'admin')
            ->exists();

        if (!$isBoardAdmin && !$isSystemAdmin && !$isWorkspaceAdmin) {
            return response()->json(['message' => 'Chỉ Quản trị viên của bảng mới có quyền thêm thành viên.'], 403);
        }

        // Check if user is in workspace behind the scenes
        $inWorkspace = DB::table('workspace_members')
            ->where('workspace_id', $board->workspace_id)
            ->where('user_id', $request->user_id)
            ->exists();

        if (!$inWorkspace) {
            DB::table('workspace_members')->insert([
                'workspace_id' => $board->workspace_id,
                'user_id' => $request->user_id,
                'role' => 'member',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('board_members')->updateOrInsert(
            [
                'board_id' => $board->id,
                'user_id' => $request->user_id,
            ],
            [
                'role' => $request->role,
                'updated_at' => now(),
            ]
        );

        // Gửi thông báo đến người vừa được thêm vào bảng
        $addedUser = User::find($request->user_id);
        if ($addedUser && $addedUser->id !== $currentUserId) {
            $addedUser->notify(new \App\Notifications\BoardMemberAddedNotification($board, $request->user()));
        }

        return response()->json(['message' => 'Đã thêm thành viên vào bảng và gửi thông báo thành công']);
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
        $currentUserId = $request->user()->id;
        $isSystemAdmin = in_array($request->user()->system_role, ['admin', 'system_admin']);

        // Check if user is Workspace Owner
        $isWorkspaceOwner = DB::table('workspaces')
            ->where('id', $workspaceId)
            ->where('owner_id', $currentUserId)
            ->exists();

        // Check if user is Workspace Admin
        $isWorkspaceAdmin = DB::table('workspace_members')
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $currentUserId)
            ->where('role', 'admin')
            ->exists();

        // Check if user is Board Admin
        $isBoardAdmin = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $currentUserId)
            ->where('role', 'admin')
            ->exists();

        // A user can remove themselves, OR must be System Admin / Workspace Owner / Workspace Admin / Board Admin
        $canRemove = $isSystemAdmin || $isWorkspaceOwner || $isWorkspaceAdmin || $isBoardAdmin || ($currentUserId == $userId);

        abort_unless($canRemove, 403, 'Bạn không có quyền xóa thành viên này khỏi bảng.');

        // Don't remove the last admin
        $adminCount = DB::table('board_members')->where('board_id', $board->id)->where('role', 'admin')->count();
        $memberRole = DB::table('board_members')->where('board_id', $board->id)->where('user_id', $userId)->value('role');
        
        if ($adminCount <= 1 && $memberRole === 'admin') {
            return response()->json(['message' => 'Không thể gỡ Quản trị viên duy nhất của bảng.'], 400);
        }

        DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', $userId)
            ->delete();

        return response()->json(['message' => 'Đã gỡ thành viên khỏi bảng']);
    }
}
