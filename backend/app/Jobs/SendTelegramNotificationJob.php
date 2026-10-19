<?php

namespace App\Jobs;

use App\Models\NotificationIntegration;
use App\Models\TelegramDelivery;
use App\Services\TelegramService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendTelegramNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [10, 60, 300];

    public function __construct(
        public int $integrationId,
        public string $chatId,
        public string $message,
        public array $options = [],
        public string $eventType = 'general',
        public ?string $notifiableType = null,
        public ?int $notifiableId = null,
        public ?string $idempotencyKey = null
    ) {}

    public function handle(TelegramService $telegramService): void
    {
        // 1. Idempotency Check: Prevent duplicate messages for identical event
        if ($this->idempotencyKey) {
            $alreadySent = TelegramDelivery::where('idempotency_key', $this->idempotencyKey)
                ->where('status', 'sent')
                ->exists();

            if ($alreadySent) {
                Log::info("Telegram delivery skipped (already sent): {$this->idempotencyKey}");
                return;
            }
        }

        // 2. Verify Integration is still enabled
        $integration = NotificationIntegration::find($this->integrationId);
        if (!$integration || !$integration->is_enabled || $integration->status !== 'connected') {
            Log::info("Telegram delivery skipped (integration disabled or disconnected): {$this->integrationId}");
            return;
        }

        // 3. Track or create delivery record
        $delivery = null;
        if ($this->idempotencyKey) {
            $delivery = TelegramDelivery::firstOrCreate(
                ['idempotency_key' => $this->idempotencyKey],
                [
                    'integration_id' => $this->integrationId,
                    'event_type' => $this->eventType,
                    'notifiable_type' => $this->notifiableType,
                    'notifiable_id' => $this->notifiableId,
                    'chat_id' => $this->chatId,
                    'status' => 'pending',
                    'attempts' => 1,
                ]
            );
        }

        // 4. Send Message via Telegram API
        $res = $telegramService->sendMessage($this->chatId, $this->message, $this->options);

        if ($res['success']) {
            if ($delivery) {
                $delivery->update([
                    'status' => 'sent',
                    'telegram_message_id' => $res['message_id'] ?? null,
                    'response_code' => 200,
                    'sent_at' => Carbon::now(),
                ]);
            }

            $integration->update([
                'last_sent_at' => Carbon::now(),
                'last_error_message' => null,
            ]);
            return;
        }

        // 5. Handle Error Cases & Retry Policy
        $statusCode = $res['status_code'] ?? 500;
        $errorMsg = $res['error'] ?? 'Lỗi gửi tin Telegram không xác định';

        if ($delivery) {
            $delivery->update([
                'status' => 'failed',
                'response_code' => $statusCode,
                'error_message' => $errorMsg,
                'attempts' => $this->attempts(),
            ]);
        }

        // Non-retryable errors:
        // 400: Invalid chat ID / chat not found
        // 403: Bot blocked by user or kicked from group
        if ($statusCode === 400 || $statusCode === 403) {
            $integration->update([
                'status' => 'error',
                'last_error_at' => Carbon::now(),
                'last_error_message' => $errorMsg,
            ]);
            Log::warning("Telegram non-retryable error [{$statusCode}] for integration {$this->integrationId}: {$errorMsg}");
            return; // Do not retry
        }

        // 429: Rate limited - retry after specific seconds
        if ($statusCode === 429) {
            $retryAfter = max(5, $res['retry_after'] ?? 10);
            Log::warning("Telegram rate limit 429. Releasing job after {$retryAfter} seconds.");
            $this->release($retryAfter);
            return;
        }

        // Other network/server errors: let Laravel queue retry with backoff
        if ($this->attempts() < $this->tries) {
            throw new \Exception("Telegram sendMessage failed [{$statusCode}]: {$errorMsg}");
        } else {
            $integration->update([
                'last_error_at' => Carbon::now(),
                'last_error_message' => $errorMsg,
            ]);
        }
    }
}
