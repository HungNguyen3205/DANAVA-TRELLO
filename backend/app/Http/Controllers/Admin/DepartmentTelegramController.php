<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\NotificationIntegration;
use App\Services\TelegramService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

class DepartmentTelegramController extends Controller
{
    public function __construct(
        protected TelegramService $telegramService
    ) {}

    /**
     * Get Department Telegram integration status & settings.
     */
    public function show(Department $department): JsonResponse
    {
        $integration = $department->telegramIntegration;

        $defaultEventSettings = [
            'employee_added' => true,
            'employee_transferred' => true,
            'task_assigned' => true,
            'task_completed' => true,
            'task_overdue' => true,
            'daily_summary' => false,
            'weekly_performance_summary' => true,
        ];

        return response()->json([
            'enabled' => $integration?->is_enabled ?? false,
            'chat_id' => $integration?->chat_id, // System admin is authorized to see/edit
            'chat_id_masked' => $integration?->masked_chat_id,
            'chat_title' => $integration?->chat_title,
            'status' => $integration?->status ?? 'disconnected',
            'verified_at' => $integration?->verified_at?->toIso8601String(),
            'last_tested_at' => $integration?->last_tested_at?->toIso8601String(),
            'last_sent_at' => $integration?->last_sent_at?->toIso8601String(),
            'last_error_at' => $integration?->last_error_at?->toIso8601String(),
            'last_error_message' => $integration?->last_error_message,
            'event_settings' => $integration?->event_settings ?? $defaultEventSettings,
            'bot_configured' => $this->telegramService->isConfigured(),
            'bot_username' => $this->telegramService->getBotUsername(),
        ]);
    }

    /**
     * Update Department Telegram integration.
     */
    public function update(Request $request, Department $department): JsonResponse
    {
        $validated = $request->validate([
            'chat_id' => 'nullable|string|max:100',
            'enabled' => 'required|boolean',
            'event_settings' => 'nullable|array',
        ]);

        $chatId = isset($validated['chat_id']) ? trim($validated['chat_id']) : null;
        if ($chatId !== null && $chatId !== '') {
            // Validate chat ID structure
            if (!preg_match('/^-?[0-9]+$/', $chatId)) {
                return response()->json([
                    'message' => 'Chat ID Telegram phải là chuỗi số, thường bắt đầu bằng -100 đối với Supergroup.',
                    'errors' => ['chat_id' => ['Chat ID Telegram phải là chuỗi số hợp lệ (ví dụ: -1004340949074).']],
                ], 422);
            }
        }

        $user = $request->user();
        $integration = $department->telegramIntegration;
        $oldChatId = $integration?->chat_id;

        DB::transaction(function () use ($department, $integration, $chatId, $validated, $user) {
            $data = [
                'provider' => 'telegram',
                'chat_id' => $chatId,
                'is_enabled' => (bool) $validated['enabled'],
                'event_settings' => $validated['event_settings'] ?? null,
                'updated_by' => $user->id,
            ];

            if (!$integration) {
                $data['created_by'] = $user->id;
                $data['status'] = empty($chatId) ? 'disconnected' : 'pending';
                $department->telegramIntegration()->create($data);
            } else {
                if ($chatId !== $integration->chat_id) {
                    $data['status'] = empty($chatId) ? 'disconnected' : 'pending';
                    $data['verified_at'] = null;
                    $data['chat_title'] = null;
                }
                $integration->update($data);
            }

            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $user->id,
                'action' => 'telegram_updated',
                'old_value' => $integration ? NotificationIntegration::maskChatId($integration->chat_id) : null,
                'new_value' => NotificationIntegration::maskChatId($chatId),
            ]);
        });

        return response()->json([
            'message' => 'Cập nhật cấu hình Telegram phòng ban thành công.',
        ]);
    }

    /**
     * Verify Telegram Chat ID with official API.
     */
    public function verify(Request $request, Department $department): JsonResponse
    {
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

        $user = $request->user();
        $integration = $department->telegramIntegration()->firstOrCreate(
            ['provider' => 'telegram'],
            ['created_by' => $user->id]
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
            'department_id' => $department->id,
            'user_id' => $user->id,
            'action' => 'telegram_verified',
            'new_value' => "Nhóm: {$chatInfo['title']} (" . NotificationIntegration::maskChatId($chatInfo['chat_id']) . ")",
        ]);

        return response()->json([
            'message' => "Xác thực thành công nhóm \"{$chatInfo['title']}\"",
            'chat_id' => $chatInfo['chat_id'],
            'chat_title' => $chatInfo['title'],
            'type' => $chatInfo['type'],
            'status' => 'connected',
        ]);
    }

    /**
     * Send test message to Department Telegram group.
     */
    public function test(Request $request, Department $department): JsonResponse
    {
        $user = $request->user();

        // Rate limit: 3 tests per minute per user
        $rateLimitKey = 'telegram_test_dept_' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 3)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'message' => "Bạn đã gửi thử quá nhiều lần. Vui lòng đợi {$seconds} giây trước khi thử lại.",
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 60);

        $integration = $department->telegramIntegration;
        if (!$integration || empty($integration->chat_id)) {
            return response()->json([
                'message' => 'Phòng ban chưa được gắn Chat ID Telegram.',
            ], 422);
        }

        if (!$this->telegramService->isConfigured()) {
            return response()->json([
                'message' => 'Telegram Bot Token chưa được cấu hình trong hệ thống.',
            ], 422);
        }

        $res = $this->telegramService->sendTestMessage($integration, $user);

        if (!$res['success']) {
            return response()->json([
                'message' => 'Gửi tin thử thất bại: ' . ($res['error'] ?? 'Lỗi không xác định'),
            ], 422);
        }

        ActivityLog::create([
            'department_id' => $department->id,
            'user_id' => $user->id,
            'action' => 'telegram_tested',
            'new_value' => 'Gửi tin thử nghiệm thành công',
        ]);

        return response()->json([
            'message' => 'Tin nhắn thử nghiệm đã được gửi thành công vào nhóm Telegram.',
            'last_tested_at' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * Disconnect Telegram from Department.
     */
    public function destroy(Request $request, Department $department): JsonResponse
    {
        $integration = $department->telegramIntegration;
        if ($integration) {
            $oldChatId = $integration->chat_id;
            $integration->update([
                'chat_id' => null,
                'chat_title' => null,
                'status' => 'disconnected',
                'is_enabled' => false,
                'verified_at' => null,
                'updated_by' => $request->user()->id,
            ]);

            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $request->user()->id,
                'action' => 'telegram_disconnected',
                'old_value' => NotificationIntegration::maskChatId($oldChatId),
            ]);
        }

        return response()->json([
            'message' => 'Đã ngắt kết nối Telegram khỏi phòng ban.',
        ]);
    }
}
