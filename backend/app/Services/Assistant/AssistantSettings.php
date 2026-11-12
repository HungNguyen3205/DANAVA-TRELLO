<?php

namespace App\Services\Assistant;

use App\Models\AppSetting;
use App\Models\AppSettingChange;

/**
 * Where the Gemini key and model come from: a key saved by an admin in the UI wins,
 * otherwise GEMINI_API_KEY from .env (used only when ASSISTANT_AI_MODE=live).
 */
class AssistantSettings
{
    public const KEY_SETTING = 'assistant.gemini_api_key';
    public const MODEL_SETTING = 'assistant.gemini_model';
    public const ENDPOINT_SETTING = 'assistant.gemini_endpoint';
    /** Set while the saved key is out of daily quota or rejected by Google; cleared on the next success. */
    public const HEALTH_SETTING = 'assistant.gemini_key_health';

    /** Gemini API (AI Studio keys, "AIza...") or Vertex AI express mode (Google Cloud keys, "AQ...."). */
    public const ENDPOINTS = ['gemini', 'vertex'];

    public function apiKey(): ?string
    {
        $saved = AppSetting::getSecret(self::KEY_SETTING);
        if ($saved) {
            return $saved;
        }

        return config('assistant.mode') === 'live' ? (config('assistant.gemini.api_key') ?: null) : null;
    }

    public function keySource(): ?string
    {
        if (AppSetting::getSecret(self::KEY_SETTING)) {
            return 'app';
        }

        return $this->apiKey() ? 'env' : null;
    }

    public function model(): string
    {
        return AppSetting::getValue(self::MODEL_SETTING) ?: config('assistant.gemini.model', 'gemini-2.5-flash');
    }

    /** Which Google endpoint the saved key works with (detected when the key was verified). */
    public function endpoint(): string
    {
        $saved = AppSetting::getValue(self::ENDPOINT_SETTING);
        if (in_array($saved, self::ENDPOINTS, true)) {
            return $saved;
        }

        return self::guessEndpoint((string) $this->apiKey());
    }

    public static function guessEndpoint(string $key): string
    {
        return str_starts_with($key, 'AQ.') ? 'vertex' : 'gemini';
    }

    /** The admin who added the saved key (only they may remove it). Null for .env keys. */
    public function keyOwnerId(): ?int
    {
        $id = AppSetting::where('key', self::KEY_SETTING)->value('updated_by');

        return $id === null ? null : (int) $id;
    }

    /**
     * Problem with the saved key seen on the last real call, or null while it works.
     *
     * @return array{state: 'exhausted'|'invalid', message: string, at: string}|null
     */
    public function keyHealth(): ?array
    {
        $raw = AppSetting::getValue(self::HEALTH_SETTING);
        $value = $raw ? json_decode($raw, true) : null;

        return is_array($value) && isset($value['state'], $value['message']) ? $value : null;
    }

    public function markKeyProblem(string $state, string $message): void
    {
        AppSetting::setValue(self::HEALTH_SETTING, json_encode([
            'state' => $state,
            'message' => $message,
            'at' => now()->toIso8601String(),
        ], JSON_UNESCAPED_UNICODE));
    }

    public function markKeyWorking(): void
    {
        if (AppSetting::getValue(self::HEALTH_SETTING) !== null) {
            AppSetting::setValue(self::HEALTH_SETTING, null);
        }
    }

    public function isLive(): bool
    {
        return $this->apiKey() !== null;
    }

    /** Safe description for the UI: never the key itself, only its last 4 characters. */
    public function publicStatus(): array
    {
        $key = $this->apiKey();

        return [
            'has_key' => $key !== null,
            'key_hint' => self::hint($key),
            'source' => $this->keySource(),
            'model' => $this->model(),
            'mode' => $key ? 'live' : 'demo',
            'endpoint' => $key ? $this->endpoint() : null,
            'key_updated' => self::lastUpdate(self::KEY_SETTING),
            'key_health' => $key ? $this->keyHealth() : null,
            'model_updated' => self::lastUpdate(self::MODEL_SETTING),
        ];
    }

    public static function hint(?string $key): ?string
    {
        return $key ? '••••' . substr($key, -4) : null;
    }

    /**
     * Who last saved a setting and when.
     *
     * @return array{by: ?array{id: int, name: string}, at: string}|null
     */
    public static function lastUpdate(string $setting): ?array
    {
        $row = AppSetting::with('updater:id,name')->where('key', $setting)->first();
        if (!$row) {
            return null;
        }

        return [
            'by' => $row->updater ? ['id' => $row->updater->id, 'name' => $row->updater->name] : null,
            'at' => $row->updated_at?->toIso8601String(),
        ];
    }

    /** Save key / model / endpoint and record every real change in the audit trail. */
    public function save(?string $key, ?string $model, int $userId, ?string $endpoint = null): void
    {
        if ($key !== null) {
            $oldKey = AppSetting::getSecret(self::KEY_SETTING);
            if ($oldKey !== $key) {
                AppSetting::setSecret(self::KEY_SETTING, $key, $userId);
                $this->markKeyWorking();
                AppSettingChange::log($userId, self::KEY_SETTING, $oldKey ? 'replaced' : 'added', self::hint($oldKey), self::hint($key));
            }
        }
        if ($endpoint !== null && AppSetting::getValue(self::ENDPOINT_SETTING) !== $endpoint) {
            AppSetting::setValue(self::ENDPOINT_SETTING, $endpoint, $userId);
        }
        if ($model !== null) {
            $oldModel = $this->model();
            if ($oldModel !== $model) {
                AppSetting::setValue(self::MODEL_SETTING, $model, $userId);
                AppSettingChange::log($userId, self::MODEL_SETTING, 'changed', $oldModel, $model);
            }
        }
    }

    public function removeKey(int $userId): void
    {
        $oldKey = AppSetting::getSecret(self::KEY_SETTING);
        AppSetting::setSecret(self::KEY_SETTING, null);
        AppSetting::setValue(self::ENDPOINT_SETTING, null);
        $this->markKeyWorking();
        if ($oldKey) {
            AppSettingChange::log($userId, self::KEY_SETTING, 'removed', self::hint($oldKey), null);
        }
    }

    /**
     * Recent changes to the assistant settings, newest first, described in Vietnamese.
     *
     * @return array<int, array{at: string, by: ?string, text: string}>
     */
    public static function history(int $limit = 15): array
    {
        $labels = [
            self::KEY_SETTING => 'khóa Gemini',
            self::MODEL_SETTING => 'model AI',
            AssistantUsage::PER_USER_SETTING => 'giới hạn mỗi người/ngày',
            AssistantUsage::COMPANY_SETTING => 'giới hạn toàn công ty/ngày',
        ];

        return AppSettingChange::with('user:id,name')
            ->whereIn('setting', array_keys($labels))
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(function (AppSettingChange $c) use ($labels) {
                $what = $labels[$c->setting];
                $limit = fn (?string $v) => $v === null ? '?' : ($v === '0' ? 'không giới hạn' : $v . ' lượt');
                $text = match (true) {
                    $c->setting === self::KEY_SETTING && $c->action === 'added' => "Thêm {$what} {$c->new_value}",
                    $c->setting === self::KEY_SETTING && $c->action === 'replaced' => "Thay {$what} {$c->old_value} → {$c->new_value}",
                    $c->setting === self::KEY_SETTING && $c->action === 'removed' => "Xóa {$what} {$c->old_value}",
                    $c->setting === self::MODEL_SETTING => "Đổi {$what}: {$c->old_value} → {$c->new_value}",
                    default => "Đổi {$what}: {$limit($c->old_value)} → {$limit($c->new_value)}",
                };

                return ['at' => $c->created_at?->toIso8601String(), 'by' => $c->user?->name, 'text' => $text];
            })
            ->all();
    }
}
