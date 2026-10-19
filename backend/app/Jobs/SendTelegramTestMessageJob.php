<?php

namespace App\Jobs;

use App\Models\NotificationIntegration;
use App\Models\User;
use App\Services\TelegramService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendTelegramTestMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(
        public int $integrationId,
        public int $actorId
    ) {}

    public function handle(TelegramService $telegramService): void
    {
        $integration = NotificationIntegration::find($this->integrationId);
        $actor = User::find($this->actorId);

        if (!$integration || !$actor) {
            return;
        }

        $telegramService->sendTestMessage($integration, $actor);
    }
}
