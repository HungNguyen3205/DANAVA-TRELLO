<?php

namespace App\Services;

use App\Models\Board;
use App\Models\Department;
use App\Models\KanbanColumn;
use App\Models\NotificationIntegration;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    protected ?string $botToken;
    protected ?string $botUsername;
    protected string $apiUrl;
    protected int $timeout;
    protected bool $enabled;

    public function __construct()
    {
        $this->botToken = config('telegram.bot_token');
        $this->botUsername = config('telegram.bot_username', 'trolyNotificationAI_bot');
        $this->apiUrl = rtrim(config('telegram.api_url', 'https://api.telegram.org'), '/');
        $this->timeout = (int) config('telegram.timeout', 10);
        $this->enabled = (bool) config('telegram.enabled', true);
    }

    /**
     * Check if Telegram notifications are enabled and bot token is configured.
     */
    public function isConfigured(): bool
    {
        return $this->enabled && !empty($this->botToken);
    }

    public function getBotUsername(): string
    {
        return $this->botUsername ?: 'trolyNotificationAI_bot';
    }

    /**
     * Get basic info about the Bot (getMe).
     */
    public function getBotInfo(): array
    {
        if (!$this->isConfigured()) {
            return ['ok' => false, 'error' => 'Bot Token chưa được cấu hình trên hệ thống.'];
        }

        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->apiUrl}/bot{$this->botToken}/getMe");

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'ok' => true,
                    'result' => $data['result'] ?? [],
                ];
            }

            return [
                'ok' => false,
                'error' => $response->json('description') ?? 'Lỗi khi kết nối Telegram API',
                'status_code' => $response->status(),
            ];
        } catch (\Throwable $e) {
            Log::error('Telegram getBotInfo exception: ' . $e->getMessage());
            return ['ok' => false, 'error' => 'Không thể kết nối đến máy chủ Telegram.'];
        }
    }

    /**
     * Validate and fetch group chat information (getChat).
     */
    public function getChatInfo(string $chatId): array
    {
        if (!$this->isConfigured()) {
            return ['ok' => false, 'error' => 'Bot Token chưa được cấu hình.'];
        }

        $cleanChatId = trim($chatId);
        if (empty($cleanChatId)) {
            return ['ok' => false, 'error' => 'Chat ID không được để trống.'];
        }

        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->apiUrl}/bot{$this->botToken}/getChat", [
                    'chat_id' => $cleanChatId,
                ]);

            if ($response->successful()) {
                $result = $response->json('result') ?? [];
                $title = $result['title'] ?? ($result['first_name'] ?? 'Nhóm Telegram');
                return [
                    'ok' => true,
                    'chat_id' => (string) $result['id'],
                    'title' => $title,
                    'type' => $result['type'] ?? 'group',
                ];
            }

            $description = $response->json('description') ?? 'Không thể tìm thấy nhóm chat.';
            $status = $response->status();

            if ($status === 400) {
                $errorMsg = 'Chat ID không tồn tại hoặc Bot chưa được thêm vào Nhóm chat.';
            } elseif ($status === 403) {
                $errorMsg = 'Bot đã bị chặn hoặc không có quyền xem thông tin trong Nhóm này.';
            } else {
                $errorMsg = $description;
            }

            return [
                'ok' => false,
                'error' => $errorMsg,
                'status_code' => $status,
            ];
        } catch (\Throwable $e) {
            Log::error('Telegram getChatInfo exception: ' . $e->getMessage());
            return ['ok' => false, 'error' => 'Lỗi kết nối mạng khi xác thực Chat ID.'];
        }
    }

    /**
     * Send a message to Telegram group with HTML formatting and optional buttons.
     */
    public function sendMessage(string $chatId, string $message, array $options = []): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'Telegram Bot chưa được kích hoạt hoặc thiếu Token.',
                'status_code' => 500,
            ];
        }

        $cleanChatId = trim($chatId);
        if (empty($cleanChatId)) {
            return [
                'success' => false,
                'error' => 'Chat ID không hợp lệ.',
                'status_code' => 422,
            ];
        }

        $payload = [
            'chat_id' => $cleanChatId,
            'text' => $message,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => $options['disable_web_page_preview'] ?? false,
        ];

        if (!empty($options['buttons']) && is_array($options['buttons'])) {
            $payload['reply_markup'] = json_encode([
                'inline_keyboard' => $options['buttons'],
            ]);
        }

        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->apiUrl}/bot{$this->botToken}/sendMessage", $payload);

            if ($response->successful()) {
                $result = $response->json('result');
                return [
                    'success' => true,
                    'message_id' => (string) ($result['message_id'] ?? ''),
                    'status_code' => $response->status(),
                ];
            }

            $statusCode = $response->status();
            $data = $response->json() ?? [];
            $description = $data['description'] ?? 'Telegram API gửi tin thất bại.';
            $retryAfter = (int) ($data['parameters']['retry_after'] ?? 0);

            // Never log bot token!
            Log::warning("Telegram sendMessage error [{$statusCode}]: {$description} (chat_id: {$cleanChatId})");

            return [
                'success' => false,
                'error' => $description,
                'status_code' => $statusCode,
                'retry_after' => $retryAfter,
            ];
        } catch (\Throwable $e) {
            Log::error('Telegram sendMessage exception: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Lỗi kết nối đến máy chủ Telegram: ' . $e->getMessage(),
                'status_code' => 500,
            ];
        }
    }

    /**
     * Send test message for a Department or Board integration.
     */
    public function sendTestMessage(NotificationIntegration $integration, User $actor): array
    {
        $nowStr = Carbon::now()->format('d/m/Y H:i');
        $actorName = $this->escapeHtml($actor->name);

        if ($integration->integratable instanceof Department) {
            $dept = $integration->integratable;
            $deptName = $this->escapeHtml($dept->name);

            $text = "✅ <b>KẾT NỐI THÀNH CÔNG</b>\n\n"
                  . "🏢 <b>Phòng ban:</b> {$deptName}\n"
                  . "💼 <b>Hệ thống:</b> DANAVA WORK\n"
                  . "⚡ <b>Trạng thái:</b> Bot đã sẵn sàng nhận thông báo.\n\n"
                  . "👤 <b>Được kiểm tra bởi:</b> {$actorName}\n"
                  . "🕒 <b>Thời gian:</b> {$nowStr}";

            $options = [];
        } elseif ($integration->integratable instanceof Board) {
            $board = $integration->integratable;
            $boardName = $this->escapeHtml($board->name);
            $deptName = $board->department ? $this->escapeHtml($board->department->name) : 'Chưa gắn phòng ban';
            $boardUrl = $this->buildBoardUrl($board);

            $text = "✅ <b>KẾT NỐI BOARD THÀNH CÔNG</b>\n\n"
                  . "📋 <b>Board:</b> {$boardName}\n"
                  . "🏢 <b>Phòng ban:</b> {$deptName}\n"
                  . "💼 <b>Hệ thống:</b> DANAVA WORK\n"
                  . "⚡ <b>Trạng thái:</b> Nhóm Telegram đã được kết nối.\n\n"
                  . "👤 <b>Được kiểm tra bởi:</b> {$actorName}\n"
                  . "🕒 <b>Thời gian:</b> {$nowStr}";

            $options = [
                'buttons' => [
                    [
                        ['text' => '👉 Mở Board', 'url' => $boardUrl],
                    ],
                ],
            ];
        } else {
            $text = "✅ <b>KẾT NỐI DANAVA WORK THÀNH CÔNG</b>\nThời gian: {$nowStr}";
            $options = [];
        }

        $res = $this->sendMessage($integration->chat_id, $text, $options);

        // Update integration status & logs
        if ($res['success']) {
            $integration->update([
                'status' => 'connected',
                'last_tested_at' => Carbon::now(),
                'last_error_message' => null,
            ]);
        } else {
            $integration->update([
                'last_error_at' => Carbon::now(),
                'last_error_message' => $res['error'] ?? 'Gửi tin thử thất bại',
            ]);
        }

        return $res;
    }

    /**
     * Resolve destination Telegram integrations for a Board event.
     * Honors delivery_mode, allow_department_notification, and deduplicates chat IDs.
     *
     * @return array<string, NotificationIntegration> [chat_id => NotificationIntegration]
     */
    public function resolveBoardDestinations(Board $board, string $eventType): array
    {
        $boardIntegration = $board->telegramIntegration;
        $dept = $board->department;
        $deptIntegration = $dept?->telegramIntegration;

        $mode = $boardIntegration?->delivery_mode;
        if (!$mode) {
            // Default delivery mode
            $mode = $board->department_id ? 'inherit_department' : 'disabled';
        }

        if ($mode === 'disabled') {
            return [];
        }

        $destinations = [];

        // Check Board integration
        $canSendBoard = in_array($mode, ['board_only', 'both'], true)
            && $boardIntegration
            && $boardIntegration->is_enabled
            && $boardIntegration->status === 'connected'
            && !empty($boardIntegration->chat_id)
            && $boardIntegration->isEventEnabled($eventType, true);

        if ($canSendBoard) {
            $destinations[$boardIntegration->chat_id] = $boardIntegration;
        }

        // Check Department integration
        $canSendDepartment = in_array($mode, ['inherit_department', 'department_only', 'both'], true)
            && $board->allow_department_notification
            && $deptIntegration
            && $deptIntegration->is_enabled
            && $deptIntegration->status === 'connected'
            && !empty($deptIntegration->chat_id)
            && $deptIntegration->isEventEnabled($eventType, true);

        if ($canSendDepartment) {
            // Deduplication: if same chat_id, only add once
            if (!isset($destinations[$deptIntegration->chat_id])) {
                $destinations[$deptIntegration->chat_id] = $deptIntegration;
            }
        }

        return $destinations;
    }

    /**
     * Resolve destination Telegram integration for Department-specific events (e.g. employee transferred).
     *
     * @return array<string, NotificationIntegration>
     */
    public function resolveDepartmentDestinations(Department $department, string $eventType): array
    {
        $integration = $department->telegramIntegration;
        if (!$integration || !$integration->is_enabled || $integration->status !== 'connected' || empty($integration->chat_id)) {
            return [];
        }

        if (!$integration->isEventEnabled($eventType, true)) {
            return [];
        }

        return [$integration->chat_id => $integration];
    }

    /**
     * Format Task Assigned Message
     */
    public function formatTaskAssigned(Task $task, User $recipient, User $actor, Board $board): array
    {
        $boardName = $this->escapeHtml($board->name);
        $taskTitle = $this->escapeHtml($task->title);
        $actorName = $this->escapeHtml($actor->name);
        $assigneeName = $this->escapeHtml($recipient->name);
        $priority = $this->formatPriority($task->priority ?? 'medium');
        $status = $this->escapeHtml($task->column?->title ?? 'Cần thực hiện');
        $dueDate = $task->due_date ? Carbon::parse($task->due_date)->format('d/m/Y H:i') : 'Không có';
        $taskUrl = $this->buildTaskUrl($task, $board);

        $isSubtask = !empty($task->parent_task_id);
        $header = $isSubtask ? "📌 <b>CÔNG VIỆC CON MỚI ĐƯỢC GIAO</b>" : "📌 <b>CÔNG VIỆC MỚI ĐƯỢC GIAO</b>";

        $text = "{$header}\n\n"
              . "📋 <b>Board:</b> {$boardName}\n"
              . "🎯 <b>Công việc:</b> {$taskTitle}\n"
              . "👤 <b>Người giao:</b> {$actorName}\n"
              . "👉 <b>Người thực hiện:</b> {$assigneeName}\n"
              . "⚡ <b>Ưu tiên:</b> {$priority}\n"
              . "⏰ <b>Hạn chót:</b> {$dueDate}\n"
              . "📊 <b>Trạng thái:</b> {$status}";

        return [
            'text' => $text,
            'buttons' => [
                [
                    ['text' => '🔍 Xem công việc', 'url' => $taskUrl],
                ],
            ],
        ];
    }

    /**
     * Format Task Completed Message
     */
    public function formatTaskCompleted(Task $task, User $actor, Board $board): array
    {
        $boardName = $this->escapeHtml($board->name);
        $taskTitle = $this->escapeHtml($task->title);
        $actorName = $this->escapeHtml($actor->name);
        $completedAt = Carbon::now()->format('d/m/Y H:i');
        $taskUrl = $this->buildTaskUrl($task, $board);

        $isOnTime = 'Có';
        if ($task->due_date) {
            $isOnTime = Carbon::now()->lte(Carbon::parse($task->due_date)) ? 'Đúng hạn ✅' : 'Trễ hạn ⚠️';
        }

        $text = "✅ <b>CÔNG VIỆC ĐÃ HOÀN THÀNH</b>\n\n"
              . "📋 <b>Board:</b> {$boardName}\n"
              . "🎯 <b>Công việc:</b> {$taskTitle}\n"
              . "👤 <b>Người thực hiện:</b> {$actorName}\n"
              . "🕒 <b>Hoàn thành lúc:</b> {$completedAt}\n"
              . "⏱ <b>Đúng hạn:</b> {$isOnTime}";

        return [
            'text' => $text,
            'buttons' => [
                [
                    ['text' => '🔍 Xem công việc', 'url' => $taskUrl],
                ],
            ],
        ];
    }

    /**
     * Format Column Moved Message
     */
    public function formatColumnMoved(Task $task, User $actor, KanbanColumn $destColumn, ?KanbanColumn $srcColumn, Board $board): array
    {
        $boardName = $this->escapeHtml($board->name);
        $taskTitle = $this->escapeHtml($task->title);
        $actorName = $this->escapeHtml($actor->name);
        $srcName = $srcColumn ? $this->escapeHtml($srcColumn->title) : 'Đang xử lý';
        $destName = $this->escapeHtml($destColumn->title);
        $taskUrl = $this->buildTaskUrl($task, $board);

        $text = "🔄 <b>CẬP NHẬT TIẾN ĐỘ CÔNG VIỆC</b>\n\n"
              . "📋 <b>Board:</b> {$boardName}\n"
              . "🎯 <b>Công việc:</b> {$taskTitle}\n"
              . "📤 <b>Từ cột:</b> {$srcName}\n"
              . "📥 <b>Sang cột:</b> {$destName}\n"
              . "👤 <b>Cập nhật bởi:</b> {$actorName}";

        return [
            'text' => $text,
            'buttons' => [
                [
                    ['text' => '🔍 Xem công việc', 'url' => $taskUrl],
                ],
            ],
        ];
    }

    /**
     * Format Member Added Message
     */
    public function formatMemberAdded(User $newMember, User $actor, Board $board, string $role = 'member'): array
    {
        $boardName = $this->escapeHtml($board->name);
        $memberName = $this->escapeHtml($newMember->name);
        $actorName = $this->escapeHtml($actor->name);
        $roleTitle = ucfirst($role);
        $boardUrl = $this->buildBoardUrl($board);

        $text = "👤 <b>THÀNH VIÊN MỚI THAM GIA BOARD</b>\n\n"
              . "<b>{$memberName}</b> đã được thêm vào Board <b>{$boardName}</b>.\n"
              . "🔑 <b>Vai trò:</b> {$roleTitle}\n"
              . "👥 <b>Người thêm:</b> {$actorName}";

        return [
            'text' => $text,
            'buttons' => [
                [
                    ['text' => '👉 Mở Board', 'url' => $boardUrl],
                ],
            ],
        ];
    }

    /**
     * Format Task Overdue Message
     */
    public function formatTaskOverdue(Task $task, Board $board, int $hoursOverdue = 0): array
    {
        $boardName = $this->escapeHtml($board->name);
        $taskTitle = $this->escapeHtml($task->title);
        $assigneeName = $task->assignee ? $this->escapeHtml($task->assignee->name) : 'Chưa phân công';
        $dueDate = $task->due_date ? Carbon::parse($task->due_date)->format('d/m/Y H:i') : 'Đã qua';
        $taskUrl = $this->buildTaskUrl($task, $board);

        $overdueText = $hoursOverdue > 0 ? "Quá hạn {$hoursOverdue} giờ" : "Đã quá thời hạn dự kiến";

        $text = "⚠️ <b>CẢNH BÁO: CÔNG VIỆC QUÁ HẠN</b>\n\n"
              . "📋 <b>Board:</b> {$boardName}\n"
              . "🎯 <b>Công việc:</b> {$taskTitle}\n"
              . "👤 <b>Phụ trách:</b> {$assigneeName}\n"
              . "⏰ <b>Hạn chót:</b> {$dueDate}\n"
              . "🚨 <b>Tình trạng:</b> {$overdueText}";

        return [
            'text' => $text,
            'buttons' => [
                [
                    ['text' => '🔍 Xử lý ngay', 'url' => $taskUrl],
                ],
            ],
        ];
    }

    /**
     * Format Employee Transferred Message (for Department telegram)
     */
    public function formatEmployeeTransferred(User $employee, User $actor, ?Department $oldDept, ?Department $newDept): array
    {
        $empName = $this->escapeHtml($employee->name);
        $actorName = $this->escapeHtml($actor->name);
        $oldTitle = $oldDept ? $this->escapeHtml($oldDept->name) : 'Chưa phân phòng';
        $newTitle = $newDept ? $this->escapeHtml($newDept->name) : 'Chưa phân phòng';

        $text = "🏢 <b>ĐIỀU CHUYỂN NHÂN SỰ PHÒNG BAN</b>\n\n"
              . "Nhân viên <b>{$empName}</b> vừa được điều chuyển:\n"
              . "📤 <b>Từ:</b> {$oldTitle}\n"
              . "📥 <b>Sang:</b> {$newTitle}\n"
              . "👤 <b>Thực hiện bởi:</b> {$actorName}\n"
              . "🕒 <b>Thời gian:</b> " . Carbon::now()->format('d/m/Y H:i');

        return [
            'text' => $text,
            'buttons' => [],
        ];
    }

    /**
     * Escape special HTML characters for Telegram parse_mode = HTML.
     */
    public function escapeHtml(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * Build canonical frontend URL for Board.
     */
    public function buildBoardUrl(Board $board): string
    {
        $baseUrl = rtrim(config('app.url', 'http://localhost'), '/');
        return "{$baseUrl}/{$board->public_id}/kanban";
    }

    /**
     * Build canonical frontend URL for Task.
     */
    public function buildTaskUrl(Task $task, Board $board): string
    {
        $baseUrl = rtrim(config('app.url', 'http://localhost'), '/');
        $openId = $task->parent_task_id ?: $task->id;
        return "{$baseUrl}/{$board->public_id}/kanban?task={$openId}";
    }

    protected function formatPriority(string $priority): string
    {
        return match (strtolower($priority)) {
            'urgent' => 'Khẩn cấp 🔴',
            'high' => 'Cao 🟠',
            'low' => 'Thấp 🟢',
            default => 'Bình thường 🟡',
        };
    }
}
