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
        // Kiểm tra quyền: User có trong workspace này không
        if (!$workspace->members()->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($workspace->boards);
    }

    // Tạo bảng mới
    public function store(Request $request, Workspace $workspace)
    {
        // Kiểm tra quyền
        if (!$workspace->members()->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
        ]);

        $board = $workspace->boards()->create([
            'name' => $request->name,
            'color' => $request->color ?? 'bg-gradient-to-br from-blue-500 to-cyan-400',
        ]);

        return response()->json($board, 201);
    }

    // Xem chi tiết một bảng
    public function show(Request $request, Board $board)
    {
        $workspace = $board->workspace;
        
        // Kiểm tra quyền
        if (!$workspace->members()->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($board->load(['sprints', 'columns.tasks']));
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
}
