<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\BoardReview;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class BoardReviewController extends Controller
{
    private function resolveBoard(Request $request): Board
    {
        $board = $request->route('board');
        if ($board instanceof Board) {
            return $board;
        }

        if (is_numeric($board)) {
            return Board::findOrFail((int) $board);
        }

        if (is_string($board)) {
            $found = Board::where('public_id', $board)->first();
            if ($found) {
                return $found;
            }
            if (is_numeric($board)) {
                return Board::findOrFail((int) $board);
            }
        }

        abort(404, 'Không tìm thấy bảng công việc.');
    }

    /**
     * Compute automated stats for the board:
     * - Total tasks
     * - Completed tasks
     * - Incomplete tasks
     * - Overdue tasks
     * - Task count & metrics per member
     */
    public function getBoardStats(Board $board, ?BoardReview $review = null): array
    {
        $now = Carbon::now('Asia/Ho_Chi_Minh');

        $columnQuery = KanbanColumn::where('board_id', $board->id);
        if (\Illuminate\Support\Facades\Schema::hasColumn('kanban_columns', 'deleted_at')) {
            $columnQuery->whereNull('deleted_at');
        }
        if (\Illuminate\Support\Facades\Schema::hasColumn('kanban_columns', 'archived_at')) {
            $columnQuery->whereNull('archived_at');
        }
        $boardColumnIds = $columnQuery->pluck('id')->toArray();

        $taskQuery = Task::whereIn('column_id', $boardColumnIds)->whereNull('deleted_at');
        if (\Illuminate\Support\Facades\Schema::hasColumn('tasks', 'archived_at')) {
            $taskQuery->whereNull('archived_at');
        }
        $tasks = $taskQuery->with(['column', 'assignees'])->get();

        $doneColumnNames = ['done', 'hoàn thành', 'completed'];

        $totalTasks = $tasks->count();
        $completedTasks = 0;
        $incompleteTasks = 0;
        $overdueTasks = 0;

        foreach ($tasks as $task) {
            $colTitle = mb_strtolower(trim($task->column?->title ?? ''));
            $isDone = !empty($task->completed_at) || in_array($colTitle, $doneColumnNames, true);

            if ($isDone) {
                $completedTasks++;
            } else {
                $incompleteTasks++;
                if (!empty($task->due_date)) {
                    $due = Carbon::parse($task->due_date, 'Asia/Ho_Chi_Minh')->endOfDay();
                    if ($now->isAfter($due)) {
                        $overdueTasks++;
                    }
                }
            }
        }

        $completionRate = $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0;

        // Member Breakdown
        $boardMembers = DB::table('board_members')
            ->join('users', 'users.id', '=', 'board_members.user_id')
            ->where('board_members.board_id', $board->id)
            ->select([
                'users.id',
                'users.name',
                'users.username',
                'users.email',
                'users.avatar',
                'board_members.role',
            ])
            ->get();

        $savedMemberReviews = [];
        if ($review && !empty($review->member_reviews)) {
            foreach ($review->member_reviews as $mr) {
                if (isset($mr['user_id'])) {
                    $savedMemberReviews[(int)$mr['user_id']] = $mr;
                }
            }
        }

        $memberStats = [];
        foreach ($boardMembers as $member) {
            $mId = (int)$member->id;

            $assignedTasks = $tasks->filter(function ($t) use ($mId) {
                if ((int)$t->assignee_id === $mId) {
                    return true;
                }
                return $t->assignees->contains('id', $mId);
            });

            $mTotal = $assignedTasks->count();
            $mCompleted = 0;
            $mOverdue = 0;

            foreach ($assignedTasks as $t) {
                $colTitle = mb_strtolower(trim($t->column?->title ?? ''));
                $isDone = !empty($t->completed_at) || in_array($colTitle, $doneColumnNames, true);
                if ($isDone) {
                    $mCompleted++;
                } else {
                    if (!empty($t->due_date)) {
                        $due = Carbon::parse($t->due_date, 'Asia/Ho_Chi_Minh')->endOfDay();
                        if ($now->isAfter($due)) {
                            $mOverdue++;
                        }
                    }
                }
            }

            $mIncomplete = $mTotal - $mCompleted;
            $mRate = $mTotal > 0 ? round(($mCompleted / $mTotal) * 100, 1) : 0;

            $memberStats[] = [
                'user_id' => $mId,
                'name' => $member->name,
                'username' => $member->username,
                'email' => $member->email,
                'avatar' => $member->avatar,
                'role' => $member->role,
                'total_tasks' => $mTotal,
                'completed_tasks' => $mCompleted,
                'incomplete_tasks' => $mIncomplete,
                'overdue_tasks' => $mOverdue,
                'completion_rate' => $mRate,
                'saved_review' => $savedMemberReviews[$mId] ?? null,
            ];
        }

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'incomplete_tasks' => $incompleteTasks,
            'overdue_tasks' => $overdueTasks,
            'completion_rate' => $completionRate,
            'members_stats' => $memberStats,
        ];
    }

    /**
     * GET /api/boards/{board}/review
     * Retrieve the board review and automated stats.
     */
    public function show(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        $user = $request->user();

        // 1. Outsider cannot access
        if (!$user->isBoardMember($board->id)) {
            return response()->json(['message' => 'Bạn không phải là thành viên của bảng này.'], 403);
        }

        $isAdmin = $user->isBoardAdmin($board->id);
        $review = BoardReview::where('board_id', $board->id)->first();

        // 2. Member can only view if review exists and is published or locked
        if (!$isAdmin) {
            if (!$review) {
                return response()->json(['message' => 'Bản tổng kết chưa được tạo hoặc chưa được công bố.'], 403);
            }
            if ($review->status === 'draft') {
                return response()->json(['message' => 'Bản tổng kết đang là bản nháp và chưa được công bố.'], 403);
            }
        }

        $stats = $this->getBoardStats($board, $review);

        return response()->json([
            'board' => [
                'id' => $board->id,
                'name' => $board->name,
                'public_id' => $board->public_id,
                'owner_id' => $board->owner_id,
                'is_admin' => $isAdmin,
            ],
            'review' => $review ? $review->load(['creator', 'publisher', 'locker']) : null,
            'stats' => $stats,
        ]);
    }

    /**
     * POST /api/boards/{board}/review
     * Create or update the project review.
     */
    public function storeOrUpdate(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        $user = $request->user();

        // Only Board Owner/Admin can create or update
        if (!$user->isBoardAdmin($board->id)) {
            return response()->json(['message' => 'Chỉ Quản trị viên hoặc Chủ sở hữu bảng mới có quyền tạo hoặc sửa bản tổng kết.'], 403);
        }

        $review = BoardReview::where('board_id', $board->id)->first();

        // Locked review cannot be modified
        if ($review && $review->status === 'locked' && $request->input('status') !== 'unlocked') {
            return response()->json([
                'message' => 'Bản tổng kết đã bị khóa. Vui lòng mở khóa trước khi chỉnh sửa.',
                'error_code' => 'REVIEW_LOCKED'
            ], 422);
        }

        $validated = $request->validate([
            'goals' => 'nullable|string',
            'summary' => 'nullable|string',
            'achievements' => 'nullable|string',
            'unfinished_work' => 'nullable|string',
            'issues' => 'nullable|string',
            'lessons_learned' => 'nullable|string',
            'revenue' => 'nullable|numeric|min:0',
            'cost' => 'nullable|numeric|min:0',
            'profit' => 'nullable|numeric',
            'overall_rating' => 'nullable|integer|min:1|max:5',
            'member_reviews' => 'nullable|array',
            'attachments' => 'nullable|array',
            'status' => 'sometimes|in:draft,published,locked',
        ]);

        // Auto-calculate profit if revenue and cost are provided
        if (isset($validated['revenue']) && isset($validated['cost']) && !isset($validated['profit'])) {
            $validated['profit'] = (float)$validated['revenue'] - (float)$validated['cost'];
        }

        $isPublishing = false;
        if (isset($validated['status']) && $validated['status'] === 'published') {
            if (!$review || $review->status !== 'published') {
                $isPublishing = true;
                $validated['published_by'] = $user->id;
                $validated['published_at'] = now();
            }
        }

        if (isset($validated['status']) && $validated['status'] === 'locked') {
            if (!$review || $review->status !== 'locked') {
                $validated['locked_by'] = $user->id;
                $validated['locked_at'] = now();
            }
        }

        if ($review) {
            $review->update($validated);
            $action = $isPublishing ? 'publish_project_review' : 'update_project_review';
        } else {
            $validated['board_id'] = $board->id;
            $validated['created_by'] = $user->id;
            if (!isset($validated['status'])) {
                $validated['status'] = 'draft';
            }
            $review = BoardReview::create($validated);
            $action = $isPublishing ? 'publish_project_review' : 'create_project_review';
        }

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'action' => $action,
            'old_value' => null,
            'new_value' => json_encode([
                'review_id' => $review->id,
                'status' => $review->status,
                'timestamp' => now()->toIso8601String(),
            ]),
        ]);

        if ($isPublishing) {
            $this->notifyMembersReviewPublished($board, $user, $review);
        }

        $stats = $this->getBoardStats($board, $review);

        return response()->json([
            'message' => 'Lưu bản tổng kết dự án thành công',
            'review' => $review->fresh(['creator', 'publisher', 'locker']),
            'stats' => $stats,
        ]);
    }

    /**
     * POST /api/boards/{board}/review/publish
     * Publish the project review and notify all board members.
     */
    public function publish(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            return response()->json(['message' => 'Chỉ Quản trị viên mới có quyền công bố bản tổng kết.'], 403);
        }

        $review = BoardReview::where('board_id', $board->id)->first();
        if (!$review) {
            return response()->json(['message' => 'Vui lòng tạo bản tổng kết trước khi công bố.'], 404);
        }

        if ($review->status === 'locked') {
            return response()->json([
                'message' => 'Bản tổng kết đang bị khóa. Vui lòng mở khóa trước.',
                'error_code' => 'REVIEW_LOCKED'
            ], 422);
        }

        $review->update([
            'status' => 'published',
            'published_by' => $user->id,
            'published_at' => now(),
        ]);

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'action' => 'publish_project_review',
            'new_value' => json_encode([
                'review_id' => $review->id,
                'published_at' => now()->toIso8601String(),
            ]),
        ]);

        $this->notifyMembersReviewPublished($board, $user, $review);

        $stats = $this->getBoardStats($board, $review);

        return response()->json([
            'message' => 'Đã công bố bản tổng kết dự án thành công',
            'review' => $review->fresh(['creator', 'publisher', 'locker']),
            'stats' => $stats,
        ]);
    }

    /**
     * POST /api/boards/{board}/review/lock
     * Lock the project review.
     */
    public function lock(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            return response()->json(['message' => 'Chỉ Quản trị viên mới có quyền khóa bản tổng kết.'], 403);
        }

        $review = BoardReview::where('board_id', $board->id)->first();
        if (!$review) {
            return response()->json(['message' => 'Không tìm thấy bản tổng kết để khóa.'], 404);
        }

        $review->update([
            'status' => 'locked',
            'locked_by' => $user->id,
            'locked_at' => now(),
        ]);

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'action' => 'lock_project_review',
            'new_value' => json_encode([
                'review_id' => $review->id,
                'locked_at' => now()->toIso8601String(),
            ]),
        ]);

        return response()->json([
            'message' => 'Đã khóa bản tổng kết dự án thành công',
            'review' => $review->fresh(['creator', 'publisher', 'locker']),
        ]);
    }

    /**
     * POST /api/boards/{board}/review/unlock
     * Unlock the project review.
     */
    public function unlock(Request $request): JsonResponse
    {
        $board = $this->resolveBoard($request);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            return response()->json(['message' => 'Chỉ Quản trị viên mới có quyền mở khóa bản tổng kết.'], 403);
        }

        $review = BoardReview::where('board_id', $board->id)->first();
        if (!$review) {
            return response()->json(['message' => 'Không tìm thấy bản tổng kết để mở khóa.'], 404);
        }

        // Restore to published status if it was published, otherwise draft
        $newStatus = $review->published_at ? 'published' : 'draft';

        $review->update([
            'status' => $newStatus,
            'locked_by' => null,
            'locked_at' => null,
        ]);

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'action' => 'unlock_project_review',
            'new_value' => json_encode([
                'review_id' => $review->id,
                'status' => $newStatus,
                'unlocked_at' => now()->toIso8601String(),
            ]),
        ]);

        return response()->json([
            'message' => 'Đã mở khóa bản tổng kết dự án thành công',
            'review' => $review->fresh(['creator', 'publisher', 'locker']),
        ]);
    }

    /**
     * Send notification to all active board members when review is published
     */
    private function notifyMembersReviewPublished(Board $board, User $actor, BoardReview $review): void
    {
        $memberUserIds = DB::table('board_members')
            ->where('board_id', $board->id)
            ->where('user_id', '!=', $actor->id)
            ->pluck('user_id');

        $recipients = User::whereIn('id', $memberUserIds)
            ->where('account_status', 'active')
            ->get();

        $actionUrl = "/{$board->public_id}/review";
        $message = "{$actor->name} đã công bố bản tổng kết dự án cho bảng \"{$board->name}\"";

        foreach ($recipients as $recipient) {
            NotificationService::send(
                recipient: $recipient,
                type: 'evaluation_published',
                message: $message,
                board: $board,
                actor: $actor,
                actionUrl: $actionUrl,
                extraData: [
                    'review_id' => $review->id,
                    'board_id' => $board->id,
                ]
            );
        }
    }
}
