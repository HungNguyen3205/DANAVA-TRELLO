<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Department;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Employee check-in / check-out and attendance statistics.
 *
 * Timestamps are stored in UTC (app timezone); the working day, working hours,
 * lateness and early leave are all evaluated in config('attendance.timezone').
 */
class AttendanceService
{
    public function timezone(): string
    {
        return config('attendance.timezone', 'Asia/Ho_Chi_Minh');
    }

    public function localNow(): Carbon
    {
        return Carbon::now($this->timezone());
    }

    public function today(): string
    {
        return $this->localNow()->toDateString();
    }

    public function todayRecord(User $user): ?Attendance
    {
        return Attendance::where('user_id', $user->id)->whereDate('work_date', $this->today())->first();
    }

    public function checkIn(User $user, ?string $ip): Attendance
    {
        $today = $this->today();

        try {
            return DB::transaction(function () use ($user, $ip, $today) {
                $record = Attendance::where('user_id', $user->id)
                    ->whereDate('work_date', $today)
                    ->lockForUpdate()
                    ->first();

                if ($record && $record->check_in_at) {
                    throw ValidationException::withMessages([
                        'attendance' => ['Bạn đã xác nhận đi làm hôm nay lúc ' . $this->localTime($record->check_in_at) . '.'],
                    ]);
                }

                $record ??= new Attendance(['user_id' => $user->id, 'work_date' => $today]);
                $record->check_in_at = now();
                $record->check_in_ip = $ip;
                $record->save();

                return $record;
            });
        } catch (QueryException $e) {
            // Two simultaneous clicks: the unique (user_id, work_date) index rejects the second one.
            $existing = $this->todayRecord($user);
            if ($existing && $existing->check_in_at) {
                throw ValidationException::withMessages([
                    'attendance' => ['Bạn đã xác nhận đi làm hôm nay lúc ' . $this->localTime($existing->check_in_at) . '.'],
                ]);
            }
            throw $e;
        }
    }

    public function checkOut(User $user, ?string $ip): Attendance
    {
        return DB::transaction(function () use ($user, $ip) {
            $record = Attendance::where('user_id', $user->id)
                ->whereDate('work_date', $this->today())
                ->lockForUpdate()
                ->first();

            if (!$record || !$record->check_in_at) {
                throw ValidationException::withMessages([
                    'attendance' => ['Bạn chưa xác nhận đi làm hôm nay nên chưa thể xác nhận tan làm.'],
                ]);
            }

            if ($record->check_out_at) {
                throw ValidationException::withMessages([
                    'attendance' => ['Bạn đã xác nhận tan làm hôm nay lúc ' . $this->localTime($record->check_out_at) . '.'],
                ]);
            }

            $record->check_out_at = now();
            $record->check_out_ip = $ip;
            $record->save();

            return $record;
        });
    }

    /**
     * Parse "YYYY-MM" into the first and last local day of that month.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function monthRange(?string $month): array
    {
        $start = $month
            ? Carbon::createFromFormat('Y-m-d', $month . '-01', $this->timezone())->startOfDay()
            : $this->localNow()->startOfMonth();

        return [$start, $start->copy()->endOfMonth()->startOfDay()];
    }

    /** Go-live date (YYYY-MM-DD), or null while attendance is still in demo mode. */
    public function liveSince(): ?string
    {
        $value = config('attendance.live_since');

        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    public function isDemo(): bool
    {
        return $this->liveSince() === null;
    }

    /** First date whose records count: demo data before the go-live date is ignored. */
    public function effectiveFrom(Carbon $from): string
    {
        $live = $this->liveSince();

        return $live !== null && $live > $from->toDateString() ? $live : $from->toDateString();
    }

    public function recordsBetween(User $user, Carbon $from, Carbon $to): Collection
    {
        return Attendance::where('user_id', $user->id)
            ->whereBetween('work_date', [$this->effectiveFrom($from), $to->toDateString()])
            ->orderBy('work_date')
            ->get();
    }

    /** API shape of one record, with computed lateness / early leave / worked time. */
    public function present(Attendance $record): array
    {
        $date = $record->work_date->toDateString();
        [$start, $end] = $this->workWindow($date);
        $checkIn = $record->check_in_at?->copy()->setTimezone($this->timezone());
        $checkOut = $record->check_out_at?->copy()->setTimezone($this->timezone());

        $graceStart = $start->copy()->addMinutes((int) config('attendance.late_grace_minutes', 5));
        $lateMinutes = $checkIn && $checkIn->gt($graceStart) ? (int) $start->diffInMinutes($checkIn) : 0;
        $earlyMinutes = $checkOut && $checkOut->lt($end) ? (int) $checkOut->diffInMinutes($end) : 0;
        $workedMinutes = $checkIn && $checkOut ? (int) $checkIn->diffInMinutes($checkOut) : null;

        return [
            'id' => $record->id,
            'work_date' => $date,
            'check_in_at' => $record->check_in_at?->toIso8601String(),
            'check_out_at' => $record->check_out_at?->toIso8601String(),
            'check_in_time' => $checkIn?->format('H:i'),
            'check_out_time' => $checkOut?->format('H:i'),
            'is_late' => $lateMinutes > 0,
            'late_minutes' => $lateMinutes,
            'is_early_leave' => $earlyMinutes > 0,
            'early_minutes' => $earlyMinutes,
            'worked_minutes' => $workedMinutes,
            'missing_checkout' => $checkIn !== null && $checkOut === null && $date < $this->today(),
            'note' => $record->note,
        ];
    }

    /**
     * First day anyone used check-in. Days before the company started using the
     * feature must not count as absences. Not memoized: controllers (and this
     * service) can live across requests.
     */
    public function systemStartDate(): ?string
    {
        if ($live = $this->liveSince()) {
            return $live;
        }

        $first = Attendance::min('work_date');

        return $first ? Carbon::parse($first)->toDateString() : null;
    }

    /**
     * First day attendance is expected from this employee: the later of the
     * feature go-live day and the day their account was created.
     * Pass $systemStart (from systemStartDate()) when computing many users at once.
     */
    public function trackingStart(User $user, ?string $systemStart = null): string
    {
        $candidates = array_filter([
            $systemStart ?? $this->systemStartDate() ?? $this->today(),
            $user->created_at?->copy()->setTimezone($this->timezone())->toDateString(),
        ]);

        return max($candidates);
    }

    /**
     * Month statistics for one employee.
     *
     * @param array<int, array> $presented records already passed through present()
     * @param string|null $trackingStart days before this date are never counted as absent
     */
    public function summarize(array $presented, Carbon $from, Carbon $to, ?string $trackingStart = null): array
    {
        $today = $this->today();
        $byDate = collect($presented)->keyBy('work_date');

        // Working days that have already happened; today counts only once the person checked in.
        $elapsedWorkingDays = 0;
        $absentDays = 0;
        foreach (CarbonPeriod::create($from, $to) as $day) {
            $d = $day->toDateString();
            if (!$this->isWorkingDay($day) || $d > $today) {
                continue;
            }
            if ($trackingStart !== null && $d < $trackingStart && !$byDate->has($d)) {
                continue;
            }
            if ($d === $today && !$byDate->has($d)) {
                continue;
            }
            $elapsedWorkingDays++;
            if (!$byDate->has($d)) {
                $absentDays++;
            }
        }

        $records = collect($presented)->filter(fn ($r) => $r['check_in_time'] !== null);

        return [
            'working_days' => $elapsedWorkingDays,
            'present_days' => $records->count(),
            'absent_days' => $absentDays,
            'late_days' => $records->where('is_late', true)->count(),
            'late_minutes' => $records->sum('late_minutes'),
            'early_leave_days' => $records->where('is_early_leave', true)->count(),
            'missing_checkout_days' => $records->where('missing_checkout', true)->count(),
            'worked_minutes' => (int) $records->sum(fn ($r) => $r['worked_minutes'] ?? 0),
        ];
    }

    public function isWorkingDay(Carbon $day): bool
    {
        return in_array($day->isoWeekday(), config('attendance.work_days', [1, 2, 3, 4, 5]), true);
    }

    public function settings(): array
    {
        return [
            'timezone' => $this->timezone(),
            'work_start' => config('attendance.work_start'),
            'work_end' => config('attendance.work_end'),
            'late_grace_minutes' => (int) config('attendance.late_grace_minutes'),
            'work_days' => config('attendance.work_days'),
            'mode' => $this->isDemo() ? 'demo' : 'live',
            'live_since' => $this->liveSince(),
        ];
    }

    public function isSystemAdmin(User $user): bool
    {
        return in_array($user->system_role, ['system_admin', 'admin'], true);
    }

    /** Department ids whose attendance this user may view (null = every department). */
    public function viewableDepartmentIds(User $viewer): ?array
    {
        if ($this->isSystemAdmin($viewer)) {
            return null;
        }

        return Department::where('manager_id', $viewer->id)->pluck('id')->all();
    }

    public function canViewReports(User $viewer): bool
    {
        $ids = $this->viewableDepartmentIds($viewer);

        return $ids === null || count($ids) > 0;
    }

    /** Employees the viewer may see in the report, optionally limited to one department. */
    public function reportUsersQuery(User $viewer, ?int $departmentId): Builder
    {
        $allowed = $this->viewableDepartmentIds($viewer);
        $departmentIds = $departmentId !== null ? [$departmentId] : $allowed;

        if ($allowed !== null && $departmentId !== null && !in_array($departmentId, $allowed, true)) {
            $departmentIds = [];
        }

        $query = User::query()->where('account_status', '!=', 'locked');

        if ($departmentIds !== null) {
            $query->where(function (Builder $q) use ($departmentIds) {
                $q->whereIn('department_id', $departmentIds)
                    ->orWhereHas('departments', fn (Builder $d) => $d->whereIn('departments.id', $departmentIds));
            });
        }

        return $query;
    }

    public function canViewUser(User $viewer, User $employee): bool
    {
        if ($viewer->id === $employee->id) {
            return true;
        }

        return $this->canViewReports($viewer)
            && $this->reportUsersQuery($viewer, null)->whereKey($employee->id)->exists();
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function workWindow(string $date): array
    {
        $tz = $this->timezone();

        return [
            Carbon::parse($date . ' ' . config('attendance.work_start', '08:00'), $tz),
            Carbon::parse($date . ' ' . config('attendance.work_end', '17:00'), $tz),
        ];
    }

    private function localTime(Carbon $time): string
    {
        return $time->copy()->setTimezone($this->timezone())->format('H:i');
    }
}
