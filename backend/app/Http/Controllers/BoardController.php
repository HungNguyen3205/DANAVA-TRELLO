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

        // Includes boards of projects this user owns or manages (full rights there).
        $managedProjectIds = Board::managedProjectIds($request->user())->pluck('id')->all();
        $boards = Board::accessibleBy($request->user())
            ->with(['owner', 'manager:id,name,avatar', 'project:id,name,status'])->orderBy('updated_at', 'desc')->get();

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

        $boards = $boards->map(function ($board) use ($userId, $memberships, $membersCount, $managedProjectIds) {
            $member = $memberships->get($board->id);
            $board->is_starred = $member ? (bool)$member->is_starred : false;
            $viaProject = in_array($board->project_id, $managedProjectIds, false);
            $board->my_role = ($board->owner_id === $userId || $viaProject || ($member && in_array($member->role, ['owner', 'admin']))) ? 'admin' : 'member';
            $board->via_project = $viaProject && !$member && $board->owner_id !== $userId;
            $board->members_count = $membersCount[$board->id] ?? 1;
            return $board;
        });

        return response()->json($boards);
    }

    // Tạo bảng trực tiếp hoàn toàn Board-first, không tạo Không gian làm việc nền
    public function storeDirect(Request $request)
    {
        $request->validate(array_merge([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'project_id' => 'nullable|integer|exists:projects,id',
        ], $this->projectRules()));

        $userId = $request->user()->id;
        $projectId = $request->input('project_id');
        if ($projectId) {
            abort_unless(\App\Models\Project::find($projectId)?->canView($request->user()), 403, 'Bạn không có quyền tạo bảng trong dự án này.');
        }
        $type = $request->input('type', Board::TYPE_TASK);
        $projectFields = $type === Board::TYPE_PROJECT
            ? $this->resolveProjectFields($request, null)
            : [];

        if ($type === Board::TYPE_PROJECT) {
            // The creator is the only member at creation time, so they manage the project by default.
            $projectFields['manager_id'] = $userId;
            $projectFields['project_status'] = $projectFields['project_status'] ?? 'planning';
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $userId, $type, $projectFields, $projectId) {
            $board = Board::create(array_merge([
                'owner_id' => $userId,
                'workspace_id' => null,
                'project_id' => $projectId,
                'name' => $request->name,
                'type' => $type,
                'description' => $request->description,
                'color' => $request->color ?? 'bg-gradient-to-br from-blue-500 to-cyan-400',
            ], $projectFields));

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
            'manager:id,name,avatar',
            'project:id,name,status',
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
        $access = app(\App\Services\BoardAccessService::class);
        $viaProject = $access->isProjectManager($request->user(), $board);
        $boardData->my_role = ($board->owner_id === $userId || $viaProject || ($member && in_array($member->role, ['owner', 'admin']))) ? 'admin' : 'member';
        // Project owners/managers have full rights (including delete) on the project's boards.
        $boardData->is_owner = ($board->owner_id === $userId || $viaProject || ($member && $member->role === 'owner'));
        $boardData->via_project = $viaProject && !$member && $board->owner_id !== $userId;

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

        $request->validate(array_merge([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:50',
        ], $this->projectRules()));

        $data = $request->only(['name', 'description', 'color']);
        if ($request->exists('project_id')) {
            $request->validate(['project_id' => 'nullable|integer|exists:projects,id']);
            $target = $request->input('project_id') ? \App\Models\Project::find($request->input('project_id')) : null;
            abort_if($target && !$target->canView($request->user()), 403, 'Bạn không có quyền với dự án này.');
            $data['project_id'] = $target?->id;
        }
        $type = $request->input('type', $board->type);

        if ($request->has('type')) {
            $data['type'] = $type;
        }

        // Project fields are kept when a project is turned back into a simple board,
        // so switching back later restores them.
        if ($type === Board::TYPE_PROJECT) {
            $data = array_merge($data, $this->resolveProjectFields($request, $board));

            if ($board->type !== Board::TYPE_PROJECT) {
                $data['project_status'] = $data['project_status'] ?? $board->project_status ?? 'planning';
                $data['manager_id'] = $data['manager_id'] ?? $board->manager_id ?? $board->owner_id;
            }
        }

        $board->update($data);

        return response()->json($board->fresh(['manager:id,name,avatar']));
    }

    private function projectRules(): array
    {
        return [
            'type' => 'sometimes|in:' . implode(',', Board::TYPES),
            'project_status' => 'nullable|in:' . implode(',', Board::PROJECT_STATUSES),
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'manager_id' => 'nullable|integer|exists:users,id',
            'budget' => 'nullable|numeric|min:0|max:9999999999999',
        ];
    }

    /**
     * Collect project fields from the request, validating cross-field rules
     * against the board's current values for fields that were not sent.
     */
    private function resolveProjectFields(Request $request, ?Board $board): array
    {
        $fields = $request->only(['project_status', 'start_date', 'end_date', 'manager_id', 'budget']);

        $start = array_key_exists('start_date', $fields) ? $fields['start_date'] : $board?->start_date?->toDateString();
        $end = array_key_exists('end_date', $fields) ? $fields['end_date'] : $board?->end_date?->toDateString();

        if ($start && $end && strtotime($end) < strtotime($start)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'end_date' => ['Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'],
            ]);
        }

        if (!empty($fields['manager_id']) && $board) {
            $managerId = (int) $fields['manager_id'];
            $isMember = $managerId === (int) $board->owner_id || \Illuminate\Support\Facades\DB::table('board_members')
                ->where('board_id', $board->id)
                ->where('user_id', $managerId)
                ->exists();

            if (!$isMember) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'manager_id' => ['Người quản lý dự án phải là thành viên của bảng.'],
                ]);
            }
        }

        return $fields;
    }

    /**
     * POST /api/boards/{board}/background — upload a custom background image (board admins).
     * SVG is not accepted (it can carry scripts).
     */
    public function uploadBackground(Request $request, Board $board)
    {
        Gate::authorize('update', $board);

        $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp|mimetypes:image/jpeg,image/png,image/webp|max:5120',
        ], [
            'image.mimes' => 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
            'image.mimetypes' => 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
            'image.max' => 'Ảnh tối đa 5MB.',
        ]);

        $old = $board->background_image;
        $path = $request->file('image')->store('board-backgrounds', 'public');
        $board->update(['background_image' => '/storage/' . $path]);
        $this->deleteBackgroundFile($old);

        return response()->json($board->fresh());
    }

    /** DELETE /api/boards/{board}/background */
    public function removeBackground(Board $board)
    {
        Gate::authorize('update', $board);

        $old = $board->background_image;
        $board->update(['background_image' => null]);
        $this->deleteBackgroundFile($old);

        return response()->json($board->fresh());
    }

    private function deleteBackgroundFile(?string $publicPath): void
    {
        if ($publicPath && str_starts_with($publicPath, '/storage/board-backgrounds/')) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete(substr($publicPath, strlen('/storage/')));
        }
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

