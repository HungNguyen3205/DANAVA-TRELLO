<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Department;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase;

    private User $employee;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'attendance.timezone' => 'Asia/Ho_Chi_Minh',
            'attendance.work_start' => '08:00',
            'attendance.work_end' => '17:00',
            'attendance.late_grace_minutes' => 5,
            'attendance.work_days' => [1, 2, 3, 4, 5],
            'attendance.live_since' => null,
        ]);
        $this->employee = $this->makeUser(['created_at' => '2026-10-01 00:00:00']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Freeze "now" at a Vietnam local time. */
    private function at(string $local): void
    {
        Carbon::setTestNow(Carbon::parse($local, 'Asia/Ho_Chi_Minh')->utc());
    }

    private function makeUser(array $attrs = []): User
    {
        return User::factory()->create(array_merge(['account_status' => 'active', 'system_role' => 'user'], $attrs));
    }

    public function test_check_in_on_time_then_check_out(): void
    {
        $this->at('2026-11-10 07:55');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-in')
            ->assertOk()
            ->assertJsonPath('record.work_date', '2026-11-10')
            ->assertJsonPath('record.check_in_time', '07:55')
            ->assertJsonPath('record.is_late', false);

        $this->at('2026-11-10 17:10');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-out')
            ->assertOk()
            ->assertJsonPath('record.check_out_time', '17:10')
            ->assertJsonPath('record.is_early_leave', false)
            ->assertJsonPath('record.worked_minutes', 555);
    }

    public function test_late_and_early_leave_are_measured_in_local_time(): void
    {
        $this->at('2026-11-10 08:20');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-in')
            ->assertJsonPath('record.is_late', true)
            ->assertJsonPath('record.late_minutes', 20);

        $this->at('2026-11-10 16:30');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-out')
            ->assertJsonPath('record.is_early_leave', true)
            ->assertJsonPath('record.early_minutes', 30)
            ->assertJsonPath('record.worked_minutes', 490);
    }

    public function test_check_in_within_grace_period_is_not_late(): void
    {
        $this->at('2026-11-10 08:05');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-in')
            ->assertJsonPath('record.is_late', false)
            ->assertJsonPath('record.late_minutes', 0);
    }

    public function test_work_date_follows_vietnam_day_not_utc(): void
    {
        // 06:30 on the 11th in Vietnam is still the 10th in UTC.
        $this->at('2026-11-11 06:30');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-in')
            ->assertJsonPath('record.work_date', '2026-11-11');
    }

    public function test_cannot_check_in_twice_or_check_out_twice(): void
    {
        $this->at('2026-11-10 08:00');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-in')->assertOk();
        $this->actingAs($this->employee)->postJson('/api/attendance/check-in')
            ->assertStatus(422)->assertJsonValidationErrors('attendance');

        $this->at('2026-11-10 17:00');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-out')->assertOk();
        $this->actingAs($this->employee)->postJson('/api/attendance/check-out')
            ->assertStatus(422)->assertJsonValidationErrors('attendance');

        $this->assertSame(1, Attendance::count());
    }

    public function test_cannot_check_out_without_checking_in(): void
    {
        $this->at('2026-11-10 17:00');
        $this->actingAs($this->employee)->postJson('/api/attendance/check-out')
            ->assertStatus(422)->assertJsonValidationErrors('attendance');
    }

    public function test_today_endpoint_reports_status(): void
    {
        $this->at('2026-11-10 09:00');
        $this->actingAs($this->employee)->getJson('/api/attendance/today')
            ->assertOk()->assertJsonPath('record', null)->assertJsonPath('can_view_reports', false);

        $this->actingAs($this->employee)->postJson('/api/attendance/check-in');
        $this->actingAs($this->employee)->getJson('/api/attendance/today')
            ->assertJsonPath('record.check_in_time', '09:00');
    }

    public function test_month_summary_counts_present_absent_late_and_missing_checkout(): void
    {
        // Mon 2 Nov: on time, full day. Tue 3 Nov: late, forgot to check out.
        // Wed 4 Nov: absent. Today Thu 5 Nov at 07:00: not checked in yet -> not counted.
        $this->makeRecord('2026-11-02', '08:00', '17:00');
        $this->makeRecord('2026-11-03', '08:30', null);
        $this->at('2026-11-05 07:00');

        $this->actingAs($this->employee)->getJson('/api/attendance/me?month=2026-11')
            ->assertOk()
            ->assertJsonCount(2, 'records')
            ->assertJsonPath('summary.working_days', 3)
            ->assertJsonPath('summary.present_days', 2)
            ->assertJsonPath('summary.absent_days', 1)
            ->assertJsonPath('summary.late_days', 1)
            ->assertJsonPath('summary.missing_checkout_days', 1)
            ->assertJsonPath('summary.worked_minutes', 540);
    }

    public function test_days_before_company_started_using_check_in_are_not_absences(): void
    {
        // Nobody has ever checked in: nothing counts as absent yet.
        $this->at('2026-11-05 10:00');
        $this->actingAs($this->employee)->getJson('/api/attendance/me?month=2026-11')
            ->assertJsonPath('summary.absent_days', 0)
            ->assertJsonPath('tracking_start', '2026-11-05');

        // First check-in in the company happens on Wed 4 Nov (by a colleague).
        $colleague = $this->makeUser();
        Attendance::create([
            'user_id' => $colleague->id,
            'work_date' => '2026-11-04',
            'check_in_at' => Carbon::parse('2026-11-04 08:00', 'Asia/Ho_Chi_Minh')->utc(),
        ]);

        // Only Wed 4 Nov counts as absent for this employee; Mon 2 and Tue 3 were before go-live.
        $this->actingAs($this->employee)->getJson('/api/attendance/me?month=2026-11')
            ->assertJsonPath('tracking_start', '2026-11-04')
            ->assertJsonPath('summary.working_days', 1)
            ->assertJsonPath('summary.absent_days', 1);
    }

    public function test_days_before_account_creation_are_not_absences(): void
    {
        $this->makeRecord('2026-11-02', '08:00', '17:00'); // go-live on Mon 2 Nov
        $newcomer = $this->makeUser(['created_at' => Carbon::parse('2026-11-04 09:00', 'Asia/Ho_Chi_Minh')->utc()]);
        $this->at('2026-11-05 10:00');

        $this->actingAs($newcomer)->getJson('/api/attendance/me?month=2026-11')
            ->assertJsonPath('tracking_start', '2026-11-04')
            ->assertJsonPath('summary.absent_days', 1);
    }

    public function test_demo_mode_is_reported_until_a_go_live_date_is_set(): void
    {
        $this->at('2026-11-10 09:00');
        $this->actingAs($this->employee)->getJson('/api/attendance/today')
            ->assertJsonPath('settings.mode', 'demo')
            ->assertJsonPath('settings.live_since', null);

        config(['attendance.live_since' => '2026-11-09']);
        $this->actingAs($this->employee)->getJson('/api/attendance/today')
            ->assertJsonPath('settings.mode', 'live')
            ->assertJsonPath('settings.live_since', '2026-11-09');
    }

    public function test_going_live_ignores_demo_records_and_counts_absences_from_go_live(): void
    {
        // Demo usage on Mon 2 and Tue 3 Nov (late, forgot checkout).
        $this->makeRecord('2026-11-02', '08:00', '17:00');
        $this->makeRecord('2026-11-03', '09:00', null);

        // Company goes live on Thu 5 Nov; employee checks in on Thu, skips Fri.
        config(['attendance.live_since' => '2026-11-05']);
        $this->makeRecord('2026-11-05', '08:00', '17:00');
        $this->at('2026-11-09 07:00'); // Monday morning, not checked in yet

        $this->actingAs($this->employee)->getJson('/api/attendance/me?month=2026-11')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.work_date', '2026-11-05')
            ->assertJsonPath('tracking_start', '2026-11-05')
            ->assertJsonPath('summary.working_days', 2)
            ->assertJsonPath('summary.present_days', 1)
            ->assertJsonPath('summary.absent_days', 1)
            ->assertJsonPath('summary.late_days', 0)
            ->assertJsonPath('summary.missing_checkout_days', 0);

        $admin = $this->makeUser(['system_role' => 'system_admin', 'created_at' => '2026-10-01 00:00:00']);
        $row = collect($this->actingAs($admin)->getJson('/api/attendance/report?month=2026-11')->json('rows'))
            ->firstWhere('user.id', $this->employee->id);
        $this->assertSame(1, $row['summary']['present_days']);
        $this->assertSame(0, $row['summary']['late_days']);
    }

    public function test_regular_employee_cannot_view_report(): void
    {
        $this->actingAs($this->employee)->getJson('/api/attendance/report')->assertForbidden();
        $other = $this->makeUser();
        $this->actingAs($this->employee)->getJson("/api/attendance/report/users/{$other->id}")->assertForbidden();
    }

    public function test_admin_sees_every_employee(): void
    {
        $admin = $this->makeUser(['system_role' => 'system_admin']);
        $this->makeUser();

        $response = $this->actingAs($admin)->getJson('/api/attendance/report?month=2026-11')->assertOk();
        $this->assertCount(User::where('account_status', '!=', 'locked')->count(), $response->json('rows'));
    }

    public function test_department_manager_sees_only_their_department(): void
    {
        $manager = $this->makeUser();
        $outsider = $this->makeUser();
        $dept = Department::create([
            'name' => 'Phòng Kỹ thuật', 'code' => 'TECH', 'status' => 'active',
            'created_by' => $manager->id, 'manager_id' => $manager->id,
        ]);
        $dept->employees()->attach($this->employee->id, ['role' => 'member', 'is_primary' => true]);

        $rows = $this->actingAs($manager)->getJson('/api/attendance/report?month=2026-11')->assertOk()->json('rows');
        $ids = collect($rows)->pluck('user.id')->all();
        $this->assertContains($this->employee->id, $ids);
        $this->assertNotContains($outsider->id, $ids);

        $this->actingAs($manager)->getJson("/api/attendance/report/users/{$this->employee->id}?month=2026-11")->assertOk();
        $this->actingAs($manager)->getJson("/api/attendance/report/users/{$outsider->id}?month=2026-11")->assertForbidden();
    }

    public function test_invalid_month_is_rejected(): void
    {
        $this->actingAs($this->employee)->getJson('/api/attendance/me?month=2026-13')->assertStatus(422);
    }

    private function makeRecord(string $date, string $in, ?string $out): void
    {
        Attendance::create([
            'user_id' => $this->employee->id,
            'work_date' => $date,
            'check_in_at' => Carbon::parse("$date $in", 'Asia/Ho_Chi_Minh')->utc(),
            'check_out_at' => $out ? Carbon::parse("$date $out", 'Asia/Ho_Chi_Minh')->utc() : null,
        ]);
    }
}
