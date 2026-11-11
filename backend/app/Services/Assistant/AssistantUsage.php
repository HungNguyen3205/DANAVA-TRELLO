<?php

namespace App\Services\Assistant;

use App\Models\AppSetting;
use App\Models\AppSettingChange;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Counts Gemini calls per user per day (Vietnam time) and applies the limits the admin set:
 * messages per person per day and messages for the whole company per day (0 = no limit).
 * When a limit is reached the assistant keeps working without AI (rule-based answers).
 */
class AssistantUsage
{
    public const PER_USER_SETTING = 'assistant.limit_per_user_daily';
    public const COMPANY_SETTING = 'assistant.limit_company_daily';
    public const DEFAULT_PER_USER = 50;
    public const DEFAULT_COMPANY = 0;

    public function today(): string
    {
        return Carbon::now(config('attendance.timezone', 'Asia/Ho_Chi_Minh'))->toDateString();
    }

    public function limits(): array
    {
        return [
            'per_user_daily' => (int) (AppSetting::getValue(self::PER_USER_SETTING) ?? self::DEFAULT_PER_USER),
            'company_daily' => (int) (AppSetting::getValue(self::COMPANY_SETTING) ?? self::DEFAULT_COMPANY),
        ];
    }

    public function saveLimits(?int $perUser, ?int $company, int $userId): void
    {
        $current = $this->limits();
        foreach ([[self::PER_USER_SETTING, $perUser, $current['per_user_daily']], [self::COMPANY_SETTING, $company, $current['company_daily']]] as [$setting, $new, $old]) {
            if ($new === null || $new === $old) {
                continue;
            }
            AppSetting::setValue($setting, (string) $new, $userId);
            AppSettingChange::log($userId, $setting, 'changed', (string) $old, (string) $new);
        }
    }

    /** Who last changed either limit, and when. */
    public function limitsUpdated(): ?array
    {
        $a = AssistantSettings::lastUpdate(self::PER_USER_SETTING);
        $b = AssistantSettings::lastUpdate(self::COMPANY_SETTING);
        if (!$a || !$b) {
            return $a ?? $b;
        }

        return $a['at'] >= $b['at'] ? $a : $b;
    }

    public function record(?int $userId, int $tokens): void
    {
        $date = $this->today();
        $now = now();
        // Atomic upsert so concurrent chats do not lose counts.
        DB::table('assistant_usage')->upsert(
            [['usage_date' => $date, 'user_id' => $userId, 'requests' => 1, 'tokens' => max(0, $tokens), 'created_at' => $now, 'updated_at' => $now]],
            ['usage_date', 'user_id'],
            ['requests' => DB::raw('requests + 1'), 'tokens' => DB::raw('tokens + ' . max(0, $tokens)), 'updated_at' => $now],
        );
    }

    public function userToday(User $user): array
    {
        $row = DB::table('assistant_usage')->where('usage_date', $this->today())->where('user_id', $user->id)->first();

        return ['requests' => (int) ($row->requests ?? 0), 'tokens' => (int) ($row->tokens ?? 0)];
    }

    public function companyToday(): array
    {
        $row = DB::table('assistant_usage')->where('usage_date', $this->today())
            ->selectRaw('COALESCE(SUM(requests), 0) AS requests, COALESCE(SUM(tokens), 0) AS tokens, COUNT(DISTINCT user_id) AS users')
            ->first();

        return ['requests' => (int) $row->requests, 'tokens' => (int) $row->tokens, 'users' => (int) $row->users];
    }

    /** Last 7 days for the company, oldest first. */
    public function lastDays(int $days = 7): array
    {
        $from = Carbon::parse($this->today())->subDays($days - 1)->toDateString();
        $rows = DB::table('assistant_usage')->where('usage_date', '>=', $from)
            ->groupBy('usage_date')
            ->selectRaw('usage_date, SUM(requests) AS requests, SUM(tokens) AS tokens')
            ->get()
            ->keyBy(fn ($r) => Carbon::parse($r->usage_date)->toDateString());

        $out = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $d = Carbon::parse($this->today())->subDays($i)->toDateString();
            $out[] = ['date' => $d, 'requests' => (int) ($rows[$d]->requests ?? 0), 'tokens' => (int) ($rows[$d]->tokens ?? 0)];
        }

        return $out;
    }

    /** Reason the user cannot use AI right now, or null when allowed. */
    public function blockReason(User $user): ?string
    {
        $limits = $this->limits();
        if ($limits['per_user_daily'] > 0 && $this->userToday($user)['requests'] >= $limits['per_user_daily']) {
            return "Hôm nay anh/chị đã dùng hết {$limits['per_user_daily']} lượt hỏi AI.";
        }
        if ($limits['company_daily'] > 0 && $this->companyToday()['requests'] >= $limits['company_daily']) {
            return "Hôm nay công ty đã dùng hết {$limits['company_daily']} lượt hỏi AI.";
        }

        return null;
    }

    public function statusFor(User $user): array
    {
        $limits = $this->limits();
        $mine = $this->userToday($user);

        return [
            'limits' => $limits,
            'me_today' => $mine,
            'me_remaining' => $limits['per_user_daily'] > 0 ? max(0, $limits['per_user_daily'] - $mine['requests']) : null,
        ];
    }
}
