<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\PerformancePeriod;
use App\Models\PerformancePolicy;
use App\Models\PerformancePolicyAcknowledgement;
use App\Models\PerformanceScore;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\PerformanceCalculationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PerformanceController extends Controller
{
    protected PerformanceCalculationService $calcService;

    public function __construct(PerformanceCalculationService $calcService)
    {
        $this->calcService = $calcService;
    }

    /**
     * Resolve board by id or public_id.
     */
    protected function resolveBoard(string|int $boardId): Board
    {
        if (is_numeric($boardId)) {
            return Board::findOrFail((int) $boardId);
        }
        return Board::where('public_id', $boardId)->firstOrFail();
    }

    /**
     * Ensure the user has access to this board.
     */
    protected function authorizeBoardAccess(Board $board, User $user): void
    {
        if (!$board->hasMember($user->id)) {
            abort(403, 'Bạn không thuộc bảng này.');
        }
    }

    /**
     * Ensure the user is Board Owner or Admin.
     */
    protected function authorizeBoardManagement(Board $board, User $user): void
    {
        if (!$board->canManage($user)) {
            abort(403, 'Chỉ Quản trị viên hoặc Chủ sở hữu Bảng mới có quyền thực hiện thao tác này.');
        }
    }

    // ==========================================
    // 1. POLICY & ACKNOWLEDGEMENT
    // ==========================================

    /**
     * GET /api/boards/{board}/performance/policy
     * Get active policy and member acknowledgment status.
     */
    public function getPolicy(Request $request, string|int $board): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardAccess($boardModel, $user);

        // Fetch or create default policy for this board if none exists
        $policy = PerformancePolicy::where('board_id', $boardModel->id)
            ->where('is_active', true)
            ->latest()
            ->first();

        if (!$policy) {
            $defaultContent = "# NỘI QUY ĐÁNH GIÁ HIỆU SUẤT CÔNG VIỆC\n\n"
                . "## 1. Nguyên Tắc Cốt Lõi\n"
                . "- Đánh giá dựa trên kết quả đầu ra thực tế của công việc và nhiệm vụ trên hệ thống.\n"
                . "- **Tuyệt đối không áp dụng chấm công, check-in, check-out, tính ngày công hay phạt đi muộn.**\n\n"
                . "## 2. Thang Điểm Chuẩn (100 Điểm)\n"
                . "- **Khối lượng hoàn thành (40 điểm):** Tính theo tỷ lệ điểm độ phức tạp hoàn thành trên tổng điểm kế hoạch.\n"
                . "- **Đúng hạn (25 điểm):** Đạt tối đa khi tất cả công việc hoàn thành trước hoặc đúng ngày hạn chót.\n"
                . "- **Chất lượng (25 điểm):** Đánh giá khách quan 1–5 sao từ Quản trị viên theo trọng số công việc.\n"
                . "- **Cập nhật tiến độ (10 điểm):** Đảm bảo ghi nhận trao đổi, bình luận hoặc cập nhật tiến độ công việc định kỳ.\n\n"
                . "## 3. Độ Phức Tạp Công Việc (Không Nhân Điểm Ưu Tiên)\n"
                . "- **XS:** 1 điểm (Rất nhỏ, tác vụ đơn giản)\n"
                . "- **S:** 2 điểm (Nhỏ, xử lý nhanh)\n"
                . "- **M:** 3 điểm (Trung bình, tiêu chuẩn mặc định)\n"
                . "- **L:** 5 điểm (Lớn, yêu cầu phối hợp)\n"
                . "- **XL:** 8 điểm (Rất lớn, độ khó cao)\n\n"
                . "## 4. Phân Chia Đóng Góp Khi Nhiều Người Cùng Làm\n"
                . "- Tỷ lệ đóng góp (contribution_percent) được thiết lập cụ thể hoặc chia đều tự động.\n"
                . "- Tổng tỷ lệ phải đạt 100% để đảm bảo tính công bằng, không cộng dồn trùng lặp.\n\n"
                . "## 5. Quy Tắc Task Cha / Task Con\n"
                . "- Task cha có task con: Chỉ tính điểm các task con trực tiếp thực thi.\n"
                . "- Task cha không có task con: Tính điểm task cha.\n\n"
                . "## 6. Xử Lý Khi Thiếu Dữ Liệu\n"
                . "- Không tự ý gán điểm 0. Điểm cuối cùng chuẩn hóa theo tổng trọng số các tiêu chí có phát sinh dữ liệu.\n"
                . "- Nếu dữ liệu phát sinh dưới 50% tổng trọng số: Chỉ ghi nhận điểm tạm tính, không xếp loại chính thức.\n\n"
                . "## 7. Khung Xếp Loại\n"
                . "- **90 – 100 điểm:** Xuất sắc\n"
                . "- **80 – 89.99 điểm:** Tốt\n"
                . "- **65 – 79.99 điểm:** Đạt\n"
                . "- **50 – 64.99 điểm:** Cần cải thiện\n"
                . "- **Dưới 50 điểm:** Chưa đạt";

            $policy = PerformancePolicy::create([
                'board_id' => $boardModel->id,
                'version' => 'v1.0',
                'title' => 'Nội quy đánh giá hiệu suất công việc ' . ($boardModel->name ?? 'Bảng'),
                'content' => $defaultContent,
                'created_by' => $user->id,
                'is_active' => true,
            ]);
        }

        $userAck = PerformancePolicyAcknowledgement::where('policy_id', $policy->id)
            ->where('board_id', $boardModel->id)
            ->where('user_id', $user->id)
            ->first();

        // Get total acknowledgements count for board members
        $allAcksCount = PerformancePolicyAcknowledgement::where('policy_id', $policy->id)
            ->where('board_id', $boardModel->id)
            ->count();

        $totalMembersCount = DB::table('board_members')
            ->where('board_id', $boardModel->id)
            ->count();

        return response()->json([
            'policy' => $policy,
            'is_acknowledged' => (bool) $userAck,
            'acknowledged_at' => $userAck?->acknowledged_at?->toIso8601String(),
            'total_acknowledged' => $allAcksCount,
            'total_members' => $totalMembersCount,
            'can_manage' => $boardModel->canManage($user),
        ]);
    }

    /**
     * POST /api/boards/{board}/performance/policy/acknowledge
     * Member acknowledges reading the performance policy.
     */
    public function acknowledgePolicy(Request $request, string|int $board): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardAccess($boardModel, $user);

        $policy = PerformancePolicy::where('board_id', $boardModel->id)
            ->where('is_active', true)
            ->latest()
            ->firstOrFail();

        $ack = PerformancePolicyAcknowledgement::updateOrCreate(
            [
                'policy_id' => $policy->id,
                'board_id' => $boardModel->id,
                'user_id' => $user->id,
            ],
            [
                'acknowledged_at' => now(),
                'ip_address' => $request->ip(),
            ]
        );

        ActivityLog::create([
            'board_id' => $boardModel->id,
            'user_id' => $user->id,
            'action' => 'xác nhận nội quy hiệu suất',
            'old_value' => null,
            'new_value' => "Phiên bản {$policy->version}",
        ]);

        return response()->json([
            'message' => 'Đã xác nhận đọc và đồng thuận nội quy hiệu suất thành công.',
            'policy_version' => $policy->version,
            'acknowledged_at' => $ack->acknowledged_at->toIso8601String(),
        ]);
    }

    /**
     * POST /api/boards/{board}/performance/policy
     * Owner/Admin creates or updates a policy version.
     */
    public function updatePolicy(Request $request, string|int $board): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardManagement($boardModel, $user);

        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'version' => 'required|string|max:20',
        ]);

        // Deactivate previous active policies
        PerformancePolicy::where('board_id', $boardModel->id)->update(['is_active' => false]);

        $policy = PerformancePolicy::create([
            'board_id' => $boardModel->id,
            'version' => trim($request->input('version')),
            'title' => trim($request->input('title')),
            'content' => $request->input('content'),
            'created_by' => $user->id,
            'is_active' => true,
        ]);

        ActivityLog::create([
            'board_id' => $boardModel->id,
            'user_id' => $user->id,
            'action' => 'cập nhật nội quy hiệu suất',
            'old_value' => null,
            'new_value' => "Phiên bản {$policy->version}",
        ]);

        return response()->json([
            'message' => 'Đã cập nhật phiên bản nội quy đánh giá hiệu suất thành công.',
            'policy' => $policy,
        ]);
    }

    // ==========================================
    // 2. PERIODS & SCORING
    // ==========================================

    /**
     * GET /api/boards/{board}/performance/periods
     * List all evaluation periods for this board.
     */
    public function listPeriods(Request $request, string|int $board): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardAccess($boardModel, $user);

        $query = PerformancePeriod::where('board_id', $boardModel->id)
            ->with(['creator:id,name,avatar', 'publisher:id,name', 'locker:id,name'])
            ->withCount('scores')
            ->orderBy('start_date', 'desc');

        // Regular members only see published and locked periods
        $canManage = $boardModel->canManage($user);
        if (!$canManage) {
            $query->whereIn('status', ['published', 'locked']);
        }

        $periods = $query->get();

        return response()->json([
            'periods' => $periods,
            'can_manage' => $canManage,
        ]);
    }

    /**
     * POST /api/boards/{board}/performance/periods
     * Create a new evaluation period.
     */
    public function storePeriod(Request $request, string|int $board): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardManagement($boardModel, $user);

        $request->validate([
            'title' => 'required|string|max:255',
            'period_type' => 'required|string|in:weekly,monthly,quarterly,custom',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $period = PerformancePeriod::create([
            'board_id' => $boardModel->id,
            'title' => trim($request->input('title')),
            'period_type' => $request->input('period_type'),
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        // Calculate initial scores snapshot
        $scores = $this->calcService->calculatePeriodScores($boardModel, $period, true);

        ActivityLog::create([
            'board_id' => $boardModel->id,
            'user_id' => $user->id,
            'action' => 'tạo kỳ đánh giá hiệu suất',
            'old_value' => null,
            'new_value' => "{$period->title} ({$period->start_date} - {$period->end_date})",
        ]);

        return response()->json([
            'message' => 'Đã tạo kỳ đánh giá hiệu suất thành công.',
            'period' => $period->load(['creator:id,name']),
            'scores' => $scores,
        ], 201);
    }

    /**
     * GET /api/boards/{board}/performance/periods/{period}
     * Get period details, member scores, and aggregate analytics.
     */
    public function showPeriod(Request $request, string|int $board, PerformancePeriod $period): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardAccess($boardModel, $user);

        if ($period->board_id !== $boardModel->id) {
            abort(404, 'Kỳ đánh giá không thuộc bảng này.');
        }

        $canManage = $boardModel->canManage($user);

        // Regular member cannot view draft periods
        if ($period->isDraft() && !$canManage) {
            return response()->json([
                'message' => 'Kỳ đánh giá đang ở trạng thái nháp và chưa được công bố.',
                'status' => 'draft',
            ], 403);
        }

        // If draft, recalculate on the fly and optionally update snapshot
        // If published or locked, retrieve persisted snapshot scores
        if ($period->isDraft()) {
            $scores = $this->calcService->calculatePeriodScores($boardModel, $period, true);
        } else {
            $dbScores = PerformanceScore::where('period_id', $period->id)
                ->with(['user:id,name,username,email,avatar,account_status,department_id', 'user.department:id,name,color'])
                ->get();

            if ($dbScores->isEmpty()) {
                $scores = $this->calcService->calculatePeriodScores($boardModel, $period, true);
            } else {
                $scores = $dbScores->map(function ($s) {
                    return [
                        'user_id' => $s->user_id,
                        'user_name' => $s->user?->name ?? 'Thành viên',
                        'user_username' => $s->user?->username ?? '',
                        'user_email' => $s->user?->email ?? '',
                        'user_avatar' => $s->user?->avatar,
                        'account_status' => $s->user?->account_status ?? 'active',
                        'department_id' => $s->user?->department_id,
                        'department_name' => $s->user?->department?->name,
                        'department_color' => $s->user?->department?->color,
                        'workload_score' => (float) $s->workload_score,
                        'on_time_score' => (float) $s->on_time_score,
                        'quality_score' => (float) $s->quality_score,
                        'progress_score' => (float) $s->progress_score,
                        'total_points_earned' => (float) $s->total_points_earned,
                        'available_weight' => (float) $s->available_weight,
                        'final_score' => (float) $s->final_score,
                        'is_provisional' => (bool) $s->is_provisional,
                        'rank' => $s->rank,
                        'metrics_breakdown' => $s->metrics_breakdown,
                        'task_details' => $s->task_details,
                    ];
                })->sortByDesc('final_score')->values()->toArray();
            }
        }

        // Aggregate statistics
        $count = count($scores);
        $totalFinalScore = 0.0;
        $rankDistribution = [
            'Xuất sắc' => 0,
            'Tốt' => 0,
            'Đạt' => 0,
            'Cần cải thiện' => 0,
            'Chưa đạt' => 0,
            'Tạm tính' => 0,
        ];

        foreach ($scores as $s) {
            $totalFinalScore += $s['final_score'];
            $rankKey = $s['is_provisional'] ? 'Tạm tính' : ($s['rank'] ?? 'Chưa đạt');
            if (isset($rankDistribution[$rankKey])) {
                $rankDistribution[$rankKey]++;
            } else {
                $rankDistribution['Tạm tính']++;
            }
        }

        $boardAverage = $count > 0 ? round($totalFinalScore / $count, 2) : 0;

        return response()->json([
            'period' => $period->load(['creator:id,name', 'publisher:id,name', 'locker:id,name']),
            'scores' => $scores,
            'analytics' => [
                'total_members' => $count,
                'board_average' => $boardAverage,
                'rank_distribution' => $rankDistribution,
                'top_performers' => array_slice(array_filter($scores, fn($x) => !$x['is_provisional']), 0, 3),
            ],
            'can_manage' => $canManage,
        ]);
    }

    /**
     * POST /api/boards/{board}/performance/periods/{period}/calculate
     * Recalculate scores for a period.
     */
    public function recalculatePeriod(Request $request, string|int $board, PerformancePeriod $period): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardManagement($boardModel, $user);

        if ($period->board_id !== $boardModel->id) {
            abort(404, 'Kỳ đánh giá không thuộc bảng này.');
        }

        if ($period->isLocked()) {
            return response()->json([
                'message' => 'Kỳ đánh giá đã bị khóa. Vui lòng mở khóa trước khi tính toán lại.',
                'error_code' => 'PERIOD_LOCKED',
            ], 422);
        }

        $scores = $this->calcService->calculatePeriodScores($boardModel, $period, true);

        ActivityLog::create([
            'board_id' => $boardModel->id,
            'user_id' => $user->id,
            'action' => 'tính lại điểm hiệu suất',
            'old_value' => null,
            'new_value' => $period->title,
        ]);

        return response()->json([
            'message' => 'Đã tính toán lại điểm hiệu suất thành công.',
            'scores' => $scores,
        ]);
    }

    /**
     * POST /api/boards/{board}/performance/periods/{period}/publish
     * Publish evaluation results and notify board members.
     */
    public function publishPeriod(Request $request, string|int $board, PerformancePeriod $period): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardManagement($boardModel, $user);

        if ($period->board_id !== $boardModel->id) {
            abort(404, 'Kỳ đánh giá không thuộc bảng này.');
        }

        if ($period->isLocked()) {
            return response()->json([
                'message' => 'Kỳ đánh giá đang bị khóa.',
                'error_code' => 'PERIOD_LOCKED',
            ], 422);
        }

        // Calculate and save authoritative snapshot
        $scores = $this->calcService->calculatePeriodScores($boardModel, $period, true);

        $period->update([
            'status' => 'published',
            'published_by' => $user->id,
            'published_at' => now(),
        ]);

        ActivityLog::create([
            'board_id' => $boardModel->id,
            'user_id' => $user->id,
            'action' => 'công bố kết quả hiệu suất',
            'old_value' => 'draft',
            'new_value' => 'published',
        ]);

        // Send notifications to all board members
        $boardMemberUserIds = DB::table('board_members')
            ->where('board_id', $boardModel->id)
            ->where('user_id', '!=', $user->id)
            ->pluck('user_id')
            ->toArray();

        $actionUrl = "/{$boardModel->public_id}/performance?period={$period->id}";
        $boardName = $boardModel->name ?? 'Bảng';
        $message = "Kết quả đánh giá hiệu suất [{$period->title}] đã được công bố trên bảng {$boardName}.";

        $members = User::whereIn('id', $boardMemberUserIds)->get();
        foreach ($members as $member) {
            NotificationService::send(
                recipient: $member,
                type: 'evaluation_published',
                message: $message,
                task: null,
                actor: $user,
                board: $boardModel,
                actionUrl: $actionUrl
            );
        }

        return response()->json([
            'message' => 'Đã công bố kết quả hiệu suất thành công và gửi thông báo đến các thành viên.',
            'period' => $period->fresh(['publisher:id,name']),
            'scores' => $scores,
        ]);
    }

    /**
     * POST /api/boards/{board}/performance/periods/{period}/lock
     * Lock evaluation period.
     */
    public function lockPeriod(Request $request, string|int $board, PerformancePeriod $period): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardManagement($boardModel, $user);

        if ($period->board_id !== $boardModel->id) {
            abort(404, 'Kỳ đánh giá không thuộc bảng này.');
        }

        $period->update([
            'status' => 'locked',
            'locked_by' => $user->id,
            'locked_at' => now(),
        ]);

        ActivityLog::create([
            'board_id' => $boardModel->id,
            'user_id' => $user->id,
            'action' => 'khóa kỳ đánh giá hiệu suất',
            'old_value' => null,
            'new_value' => $period->title,
        ]);

        return response()->json([
            'message' => 'Đã khóa kỳ đánh giá thành công. Dữ liệu điểm đã được cố định an toàn.',
            'period' => $period->fresh(['locker:id,name']),
        ]);
    }

    /**
     * POST /api/boards/{board}/performance/periods/{period}/unlock
     * Unlock evaluation period.
     */
    public function unlockPeriod(Request $request, string|int $board, PerformancePeriod $period): JsonResponse
    {
        $boardModel = $this->resolveBoard($board);
        $user = $request->user();
        $this->authorizeBoardManagement($boardModel, $user);

        if ($period->board_id !== $boardModel->id) {
            abort(404, 'Kỳ đánh giá không thuộc bảng này.');
        }

        $period->update([
            'status' => 'published',
            'locked_by' => null,
            'locked_at' => null,
        ]);

        ActivityLog::create([
            'board_id' => $boardModel->id,
            'user_id' => $user->id,
            'action' => 'mở khóa kỳ đánh giá hiệu suất',
            'old_value' => 'locked',
            'new_value' => 'published',
        ]);

        return response()->json([
            'message' => 'Đã mở khóa kỳ đánh giá thành công.',
            'period' => $period->fresh(),
        ]);
    }

    /**
     * GET /api/boards/{board}/performance/periods/{period}/members/{memberUser}/lineage
     * Detailed lineage and explanation for a specific member's scores.
     */
    public function memberLineage(
        Request $request, 
        string|int $board, 
        PerformancePeriod $period, 
        User $memberUser
    ): JsonResponse {
        $boardModel = $this->resolveBoard($board);
        $currentUser = $request->user();
        $this->authorizeBoardAccess($boardModel, $currentUser);

        if ($period->board_id !== $boardModel->id) {
            abort(404, 'Kỳ đánh giá không thuộc bảng này.');
        }

        // A regular member can only see their own lineage unless board is published
        $canManage = $boardModel->canManage($currentUser);
        if ($period->isDraft() && !$canManage) {
            abort(403, 'Kỳ đánh giá đang ở trạng thái nháp.');
        }

        // Fetch member score record
        $score = PerformanceScore::where('period_id', $period->id)
            ->where('user_id', $memberUser->id)
            ->first();

        if (!$score) {
            $scores = $this->calcService->calculatePeriodScores($boardModel, $period, false);
            $found = collect($scores)->firstWhere('user_id', $memberUser->id);
            if (!$found) {
                return response()->json([
                    'message' => 'Không tìm thấy dữ liệu điểm của thành viên này trong kỳ.',
                ], 404);
            }
            return response()->json([
                'member' => $memberUser->only(['id', 'name', 'username', 'email', 'avatar']),
                'score' => $found,
            ]);
        }

        return response()->json([
            'member' => $memberUser->only(['id', 'name', 'username', 'email', 'avatar']),
            'score' => [
                'user_id' => $score->user_id,
                'workload_score' => (float) $score->workload_score,
                'on_time_score' => (float) $score->on_time_score,
                'quality_score' => (float) $score->quality_score,
                'progress_score' => (float) $score->progress_score,
                'total_points_earned' => (float) $score->total_points_earned,
                'available_weight' => (float) $score->available_weight,
                'final_score' => (float) $score->final_score,
                'is_provisional' => (bool) $score->is_provisional,
                'rank' => $score->rank,
                'metrics_breakdown' => $score->metrics_breakdown,
                'task_details' => $score->task_details,
            ],
        ]);
    }
}
