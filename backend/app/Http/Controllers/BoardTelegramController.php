<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\NotificationIntegration;
use App\Services\TelegramService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

class BoardTelegramController extends Controller
{
    public function __construct(
        protected TelegramService $telegramService
    ) {}

    /**
     * Resolve board by id or public_id.
     */
    protected function resolveBoard(string $boardParam): Board
    {
        $board = is_numeric($boardParam)
            ? Board::find($boardParam)
            : Board::where('public_id', $boardParam)->first();

        if (!$board) {
            abort(404, 'Không tìm thấy bảng công việc.');
        }

        return $board;
    }

    /**
     * Get Board Telegram settings and inherited department status.
     */
    public function show(Request $request, string $boardParam): JsonResponse
    {
        $board = $this->resolveBoard($boardParam);
        $user = $request->user();

        // Security: User must be a board member or admin
        $isMember = $user->isBoardMember($board->id);
        $isAdmin = $user->isBoardAdmin($board->id);

        if (!$isMember && !$isAdmin) {
            return response()->json([
                'message' => 'Bạn không có quyền xem thông tin tích hợp của Bảng này.',
            ], 403);
        }

        $integration = $board->telegramIntegration;
        $dept = $board->department;
        $deptIntegration = $dept?->telegramIntegration;

        $defaultEventSettings = [
            'member_added' => true,
            'member_removed' => false,
            'task_created' => true,
            'task_assigned' => true,
            'task_updated' => false,
            'task_moved' => true,
            'task_completed' => true,
            'task_reopened' => true,
            'task_due_soon' => true,
            'task_overdue' => true,
            'comment_created' => true,
            'subtask_created' => false,
            'subtask_completed' => true,
            'daily_summary' => false,
        ];

        $inheritedInfo = null;
        if ($dept) {
            $inheritedInfo = [
                'department_id' => $dept->id,
                'department_name' => $dept->name,
                'department_code' => $dept->code,
                'has_integration' => (bool) $deptIntegration,
                'enabled' => $deptIntegration?->is_enabled ?? false,
                'status' => $deptIntegration?->status ?? 'disconnected',
                'chat_title' => $deptIntegration?->chat_title,
                'chat_id_masked' => $deptIntegration?->masked_chat_id,
            ];
        }

        // Default delivery mode: inherit if has dept, else disabled
        $deliveryMode = $integration?->delivery_mode ?? ($dept ? 'inherit_department' : 'disabled');

        return response()->json([
            'enabled' => $integration?->is_enabled ?? false,
            'delivery_mode' => $deliveryMode,
            'allow_department_notification' => (bool) $board->allow_department_notification,
            'chat_id' => $isAdmin ? $integration?->chat_id : null, // Only admin can see full ID
            'chat_id_masked' => $integration?->masked_chat_id,
            'chat_title' => $integration?->chat_title,
            'status' => $integration?->status ?? 'disconnected',
            'verified_at' => $integration?->verified_at?->toIso8601String(),
            'last_tested_at' => $integration?->last_tested_at?->toIso8601String(),
            'last_sent_at' => $integration?->last_sent_at?->toIso8601String(),
            'last_error_at' => $integration?->last_error_at?->toIso8601String(),
            'last_error_message' => $integration?->last_error_message,
            'event_settings' => $integration?->event_settings ?? $defaultEventSettings,
            'can_manage' => $isAdmin,
            'has_department' => (bool) $dept,
            'inherited_department' => $inheritedInfo,
            'bot_configured' => $this->telegramService->isConfigured(),
            'bot_username' => $this->telegramService->getBotUsername(),
        ]);
    }

    /**
     * Update Board Telegram integration settings.
     */
    public function update(Request $request, string $boardParam): JsonResponse
    {
        $board = $this->resolveBoard($boardParam);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            return response()->json([
                'message' => 'Chỉ Quản trị viên của Board mới có quyền cấu hình Telegram.',
            ], 403);
        }

        $validated = $request->validate([
            'delivery_mode' => 'required|string|in:inherit_department,board_only,department_only,both,disabled',
            'enabled' => 'required|boolean',
            'chat_id' => 'nullable|string|max:100',
            'allow_department_notification' => 'nullable|boolean',
            'event_settings' => 'nullable|array',
        ]);

        $deliveryMode = $validated['delivery_mode'];
        $chatId = isset($validated['chat_id']) ? trim($validated['chat_id']) : null;

        // Validation for board_only mode: must have valid chat_id
        if ($deliveryMode === 'board_only') {
            if (empty($chatId)) {
                return response()->json([
                    'message' => 'Chế độ "Chỉ gửi nhóm Board" yêu cầu phải nhập Chat ID nhóm Telegram của Board.',
                    'errors' => ['chat_id' => ['Vui lòng nhập Chat ID nhóm Telegram của Board.']],
                ], 422);
            }
        }

        // Validation for inherit_department: board must be assigned to department
        if ($deliveryMode === 'inherit_department' && !$board->department_id) {
            return response()->json([
                'message' => 'Board này chưa được gắn phòng ban nên không thể kế thừa nhóm Telegram.',
                'errors' => ['delivery_mode' => ['Board chưa được liên kết với phòng ban nào.']],
            ], 422);
        }

        if ($chatId !== null && $chatId !== '') {
            if (!preg_match('/^-?[0-9]+$/', $chatId)) {
                return response()->json([
                    'message' => 'Chat ID Telegram phải là chuỗi số (ví dụ: -1004340949074).',
                    'errors' => ['chat_id' => ['Chat ID Telegram phải là chuỗi số hợp lệ.']],
                ], 422);
            }
        }

        $integration = $board->telegramIntegration;

        DB::transaction(function () use ($board, $integration, $chatId, $validated, $user, $deliveryMode) {
            // Update board security option
            if (isset($validated['allow_department_notification'])) {
                $board->update(['allow_department_notification' => (bool) $validated['allow_department_notification']]);
            }

            $data = [
                'provider' => 'telegram',
                'chat_id' => $chatId,
                'is_enabled' => (bool) $validated['enabled'],
                'delivery_mode' => $deliveryMode,
                'event_settings' => $validated['event_settings'] ?? null,
                'updated_by' => $user->id,
            ];

            if (!$integration) {
                $data['created_by'] = $user->id;
                $data['status'] = empty($chatId) ? 'disconnected' : 'pending';
                $board->telegramIntegration()->create($data);
            } else {
                if ($chatId !== $integration->chat_id) {
                    $data['status'] = empty($chatId) ? 'disconnected' : 'pending';
                    $data['verified_at'] = null;
                    $data['chat_title'] = null;
                }
                $integration->update($data);
            }

            ActivityLog::create([
                'board_id' => $board->id,
                'user_id' => $user->id,
                'action' => 'board_telegram_updated',
                'old_value' => $integration ? NotificationIntegration::maskChatId($integration->chat_id) : null,
                'new_value' => NotificationIntegration::maskChatId($chatId),
            ]);
        });

        return response()->json([
            'message' => 'Cập nhật cấu hình Telegram cho Board thành công.',
        ]);
    }

    /**
     * Verify Board Chat ID.
     */
    public function verify(Request $request, string $boardParam): JsonResponse
    {
        $board = $this->resolveBoard($boardParam);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            return response()->json([
                'message' => 'Chỉ Quản trị viên của Board mới có quyền xác thực Telegram.',
            ], 403);
        }

        $validated = $request->validate([
            'chat_id' => 'required|string|max:100',
        ]);

        $chatId = trim($validated['chat_id']);
        if (!preg_match('/^-?[0-9]+$/', $chatId)) {
            return response()->json([
                'message' => 'Chat ID Telegram phải là chuỗi số (ví dụ: -1004340949074).',
            ], 422);
        }

        $chatInfo = $this->telegramService->getChatInfo($chatId);
        if (!$chatInfo['ok']) {
            return response()->json([
                'message' => $chatInfo['error'] ?? 'Không thể xác thực Chat ID với Telegram.',
            ], 422);
        }

        $integration = $board->telegramIntegration()->firstOrCreate(
            ['provider' => 'telegram'],
            ['created_by' => $user->id, 'delivery_mode' => 'board_only']
        );

        $integration->update([
            'chat_id' => $chatInfo['chat_id'],
            'chat_title' => $chatInfo['title'],
            'status' => 'connected',
            'verified_at' => Carbon::now(),
            'last_error_message' => null,
            'updated_by' => $user->id,
        ]);

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'action' => 'board_telegram_verified',
            'new_value' => "Nhóm: {$chatInfo['title']} (" . NotificationIntegration::maskChatId($chatInfo['chat_id']) . ")",
        ]);

        return response()->json([
            'message' => "Xác thực thành công nhóm \"{$chatInfo['title']}\"",
            'chat_id' => $chatInfo['chat_id'],
            'chat_title' => $chatInfo['title'],
            'status' => 'connected',
        ]);
    }

    /**
     * Send test message to Board Telegram group.
     */
    public function test(Request $request, string $boardParam): JsonResponse
    {
        $board = $this->resolveBoard($boardParam);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            return response()->json([
                'message' => 'Chỉ Quản trị viên của Board mới có quyền gửi tin thử.',
            ], 403);
        }

        // Rate limit: 3 tests per minute per user
        $rateLimitKey = 'telegram_test_board_' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 3)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'message' => "Bạn đã gửi thử quá nhiều lần. Vui lòng đợi {$seconds} giây trước khi thử lại.",
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 60);

        $integration = $board->telegramIntegration;
        if (!$integration || empty($integration->chat_id)) {
            return response()->json([
                'message' => 'Board chưa được gắn Chat ID Telegram riêng.',
            ], 422);
        }

        if (!$this->telegramService->isConfigured()) {
            return response()->json([
                'message' => 'Telegram Bot Token chưa được cấu hình trên hệ thống.',
            ], 422);
        }

        $res = $this->telegramService->sendTestMessage($integration, $user);

        if (!$res['success']) {
            return response()->json([
                'message' => 'Gửi tin thử thất bại: ' . ($res['error'] ?? 'Lỗi không xác định'),
            ], 422);
        }

        ActivityLog::create([
            'board_id' => $board->id,
            'user_id' => $user->id,
            'action' => 'board_telegram_tested',
            'new_value' => 'Gửi tin thử nghiệm thành công',
        ]);

        return response()->json([
            'message' => 'Tin nhắn thử nghiệm đã được gửi thành công vào nhóm Telegram của Board.',
            'last_tested_at' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * Disconnect Telegram from Board.
     */
    public function destroy(Request $request, string $boardParam): JsonResponse
    {
        $board = $this->resolveBoard($boardParam);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            return response()->json([
                'message' => 'Chỉ Quản trị viên của Board mới có quyền ngắt kết nối.',
            ], 403);
        }

        $integration = $board->telegramIntegration;
        if ($integration) {
            $oldChatId = $integration->chat_id;
            $integration->update([
                'chat_id' => null,
                'chat_title' => null,
                'status' => 'disconnected',
                'is_enabled' => false,
                'verified_at' => null,
                'updated_by' => $user->id,
            ]);

            ActivityLog::create([
                'board_id' => $board->id,
                'user_id' => $user->id,
                'action' => 'board_telegram_disconnected',
                'old_value' => NotificationIntegration::maskChatId($oldChatId),
            ]);
        }

        return response()->json([
            'message' => 'Đã ngắt kết nối Telegram khỏi Board.',
        ]);
    }
}
