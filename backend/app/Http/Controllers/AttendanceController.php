<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AttendanceService;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(private AttendanceService $attendance)
    {
    }

    /** GET /attendance/today — today's status for the signed-in employee. */
    public function today(Request $request)
    {
        $record = $this->attendance->todayRecord($request->user());

        return response()->json([
            'today' => $this->attendance->today(),
            'server_time' => now()->toIso8601String(),
            'record' => $record ? $this->attendance->present($record) : null,
            'settings' => $this->attendance->settings(),
            'can_view_reports' => $this->attendance->canViewReports($request->user()),
        ]);
    }

    /** POST /attendance/check-in */
    public function checkIn(Request $request)
    {
        $record = $this->attendance->checkIn($request->user(), $request->ip());
        $data = $this->attendance->present($record);

        return response()->json([
            'message' => 'Đã xác nhận đi làm lúc ' . $data['check_in_time'] . '.',
            'record' => $data,
        ]);
    }

    /** POST /attendance/check-out */
    public function checkOut(Request $request)
    {
        $record = $this->attendance->checkOut($request->user(), $request->ip());
        $data = $this->attendance->present($record);

        return response()->json([
            'message' => 'Đã xác nhận tan làm lúc ' . $data['check_out_time'] . '.',
            'record' => $data,
        ]);
    }

    /** GET /attendance/me?month=YYYY-MM — the employee's own month history. */
    public function myMonth(Request $request)
    {
        $request->validate(['month' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/']]);

        return response()->json($this->monthFor($request->user(), $request->input('month')));
    }

    /** GET /attendance/report?month=YYYY-MM&department_id= — per-employee statistics (admin / department managers). */
    public function report(Request $request)
    {
        $viewer = $request->user();
        abort_unless($this->attendance->canViewReports($viewer), 403, 'Bạn không có quyền xem thống kê chấm công.');

        $request->validate([
            'month' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'department_id' => ['nullable', 'integer'],
        ]);

        [$from, $to] = $this->attendance->monthRange($request->input('month'));
        $departmentId = $request->filled('department_id') ? (int) $request->input('department_id') : null;

        $users = $this->attendance->reportUsersQuery($viewer, $departmentId)
            ->with(['departments:id,name,code', 'department:id,name,code'])
            ->orderBy('name')
            ->get(['id', 'name', 'username', 'avatar', 'position', 'department_id', 'created_at']);

        $records = \App\Models\Attendance::whereIn('user_id', $users->pluck('id'))
            ->whereBetween('work_date', [$this->attendance->effectiveFrom($from), $to->toDateString()])
            ->get()
            ->groupBy('user_id');

        $systemStart = $this->attendance->systemStartDate();

        $rows = $users->map(function (User $user) use ($records, $from, $to, $systemStart) {
            $presented = ($records->get($user->id) ?? collect())
                ->map(fn ($r) => $this->attendance->present($r))
                ->values()
                ->all();

            $departments = $user->departments->isNotEmpty()
                ? $user->departments
                : collect([$user->department])->filter();

            return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'avatar' => $user->avatar,
                    'position' => $user->position,
                    'departments' => $departments->map(fn ($d) => ['id' => $d->id, 'name' => $d->name])->values(),
                ],
                'summary' => $this->attendance->summarize($presented, $from, $to, $this->attendance->trackingStart($user, $systemStart)),
            ];
        })->values();

        $allowed = $this->attendance->viewableDepartmentIds($viewer);
        $departments = \App\Models\Department::query()
            ->when($allowed !== null, fn ($q) => $q->whereIn('id', $allowed))
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json([
            'month' => $from->format('Y-m'),
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'settings' => $this->attendance->settings(),
            'departments' => $departments,
            'rows' => $rows,
        ]);
    }

    /** GET /attendance/report/users/{user}?month=YYYY-MM — one employee's daily records. */
    public function userMonth(Request $request, User $user)
    {
        abort_unless($this->attendance->canViewUser($request->user(), $user), 403, 'Bạn không có quyền xem chấm công của nhân viên này.');
        $request->validate(['month' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/']]);

        return response()->json(array_merge(
            ['user' => $user->only(['id', 'name', 'username', 'avatar', 'position'])],
            $this->monthFor($user, $request->input('month'))
        ));
    }

    private function monthFor(User $user, ?string $month): array
    {
        [$from, $to] = $this->attendance->monthRange($month);
        $presented = $this->attendance->recordsBetween($user, $from, $to)
            ->map(fn ($r) => $this->attendance->present($r))
            ->values()
            ->all();

        $trackingStart = $this->attendance->trackingStart($user);

        return [
            'month' => $from->format('Y-m'),
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'tracking_start' => $trackingStart,
            'settings' => $this->attendance->settings(),
            'records' => $presented,
            'summary' => $this->attendance->summarize($presented, $from, $to, $trackingStart),
        ];
    }
}
