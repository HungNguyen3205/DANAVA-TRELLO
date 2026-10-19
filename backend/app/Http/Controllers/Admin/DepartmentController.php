<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use App\Models\ActivityLog;
use App\Notifications\DepartmentTransferNotification;
use App\Notifications\DepartmentManagerAssignedNotification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    /**
     * GET /api/admin/departments
     * List departments with search, status filter, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Department::query()
            ->withCount('employees')
            ->with(['manager:id,name,username,email,avatar,position,department_title,account_status']);

        // Search by name or code
        if ($search = $request->input('search')) {
            $searchTerm = '%' . trim($search) . '%';
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', $searchTerm)
                  ->orWhere('code', 'like', $searchTerm);
            });
        }

        // Filter by status (active / inactive / all)
        if ($status = $request->input('status')) {
            if ($status === 'active' || $status === 'inactive') {
                $query->where('status', $status);
            }
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        if (in_array($sortBy, ['name', 'code', 'created_at', 'employees_count'])) {
            $query->orderBy($sortBy, $sortOrder === 'asc' ? 'asc' : 'desc');
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $perPage = min(100, max(1, (int) $request->input('per_page', 15)));
        $departments = $query->paginate($perPage);

        // Summary stats
        $summary = [
            'total_departments' => Department::count(),
            'active_departments' => Department::where('status', 'active')->count(),
            'assigned_employees' => User::whereNotNull('department_id')->whereNull('deleted_at')->count(),
            'unassigned_employees' => User::whereNull('department_id')->whereNull('deleted_at')->count(),
        ];

        return response()->json([
            'departments' => $departments,
            'summary' => $summary,
        ]);
    }

    /**
     * POST /api/admin/departments
     * Create a new department.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => 'required|string|max:50|unique:departments,code',
            'description' => 'nullable|string|max:1000',
            'color' => 'nullable|string|max:50',
            'manager_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,inactive',
            'employee_ids' => 'nullable|array',
            'employee_ids.*' => 'exists:users,id',
        ]);

        $code = strtoupper(trim($validated['code']));
        if (Department::where('code', $code)->exists()) {
            return response()->json(['message' => "Mã phòng ban '{$code}' đã tồn tại."], 422);
        }

        // Validate manager status
        $manager = null;
        if (!empty($validated['manager_id'])) {
            $manager = User::find($validated['manager_id']);
            if ($manager && $manager->account_status !== 'active') {
                return response()->json(['message' => 'Không thể chọn nhân viên đang bị khóa tài khoản làm Trưởng phòng.'], 422);
            }
        }

        DB::beginTransaction();
        try {
            $department = Department::create([
                'name' => trim($validated['name']),
                'code' => $code,
                'description' => $validated['description'] ?? null,
                'color' => $validated['color'] ?? '#6366f1',
                'manager_id' => null,
                'status' => $validated['status'] ?? 'active',
                'created_by' => $request->user()->id,
            ]);

            $membershipService = app(\App\Services\DepartmentMembershipService::class);

            // If manager selected, assign manager and give manager title
            if ($manager) {
                $membershipService->assignManager($department, $manager, $request->user());
            }

            // Assign initial employees if provided
            if (!empty($validated['employee_ids'])) {
                $membershipService->addEmployees($department, $validated['employee_ids'], $request->user());
            }

            // Activity Log
            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $request->user()->id,
                'action' => 'tạo phòng ban',
                'old_value' => null,
                'new_value' => "Tạo phòng ban {$department->name} ({$department->code})",
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Tạo phòng ban thành công.',
                'department' => $department->load(['manager:id,name,username,email,avatar,position,department_title']),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi tạo phòng ban: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/admin/departments/{department}
     * Get department details, employees list, task metrics and recent activity logs.
     */
    public function show(Request $request, Department $department): JsonResponse
    {
        try {
            $department->load([
                'manager:id,name,username,email,avatar,position,department_title,account_status',
                'creator:id,name,username',
            ]);

            // Employees list in this department
            $employees = User::where('department_id', $department->id)
                ->withCount('boards')
                ->select('id', 'name', 'username', 'email', 'avatar', 'position', 'department_title', 'account_status', 'phone', 'join_date')
                ->get();

            $employeeIds = $employees->pluck('id')->toArray();

            // Calculate accurate task statistics without double counting
            $distinctTaskIds = [];
            if (!empty($employeeIds)) {
                $assignedFromPivot = DB::table('task_assignees')
                    ->whereIn('user_id', $employeeIds)
                    ->pluck('task_id')
                    ->toArray();

                $assignedFromDirect = DB::table('tasks')
                    ->whereIn('assignee_id', $employeeIds)
                    ->whereNull('deleted_at')
                    ->pluck('id')
                    ->toArray();

                $distinctTaskIds = array_values(array_unique(array_merge($assignedFromPivot, $assignedFromDirect)));
            }

            $tasks = empty($distinctTaskIds)
                ? collect()
                : DB::table('tasks')
                    ->whereIn('id', $distinctTaskIds)
                    ->whereNull('deleted_at')
                    ->get(['id', 'completed_at', 'due_date']);

            $totalTasks = $tasks->count();
            $completedTasks = $tasks->whereNotNull('completed_at')->count();
            $incompleteTasks = max(0, $totalTasks - $completedTasks);

            $now = now();
            $overdueTasks = $tasks->filter(function ($t) use ($now) {
                if (!$t->due_date) return false;
                try {
                    $dueDate = \Carbon\Carbon::parse($t->due_date)->endOfDay();
                    if ($t->completed_at) {
                        return \Carbon\Carbon::parse($t->completed_at)->gt($dueDate);
                    }
                    return $now->gt($dueDate);
                } catch (\Throwable) {
                    return false;
                }
            })->count();

            $completedOnTimeTasks = $tasks->filter(function ($t) {
                if (!$t->completed_at || !$t->due_date) return false;
                try {
                    $dueDate = \Carbon\Carbon::parse($t->due_date)->endOfDay();
                    return \Carbon\Carbon::parse($t->completed_at)->lte($dueDate);
                } catch (\Throwable) {
                    return false;
                }
            })->count();

            // Calculate average performance score if available
            $avgPerformanceScore = null;
            if (!empty($employeeIds)) {
                try {
                    if (Schema::hasTable('performance_scores')) {
                        $avg = DB::table('performance_scores')
                            ->whereIn('user_id', $employeeIds)
                            ->where('is_provisional', false)
                            ->avg('final_score');
                        if ($avg !== null) {
                            $avgPerformanceScore = round((float) $avg, 2);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('Could not calculate avg performance score for department: ' . $e->getMessage());
                    $avgPerformanceScore = null;
                }
            }

            // Attach individual task counts to employees
            if (!empty($employeeIds)) {
                $pivotCounts = DB::table('task_assignees')
                    ->join('tasks', 'task_assignees.task_id', '=', 'tasks.id')
                    ->whereNull('tasks.deleted_at')
                    ->whereIn('task_assignees.user_id', $employeeIds)
                    ->select('task_assignees.user_id', 'tasks.id as task_id');

                $directCounts = DB::table('tasks')
                    ->whereNull('deleted_at')
                    ->whereIn('assignee_id', $employeeIds)
                    ->select('assignee_id as user_id', 'id as task_id');

                $allAssignedPairs = $pivotCounts->union($directCounts)->get();
                $tasksCountByUser = $allAssignedPairs->groupBy('user_id')->map->count();

                foreach ($employees as $emp) {
                    $emp->tasks_count = $tasksCountByUser[$emp->id] ?? 0;
                }
            }

            // Recent activity logs for this department
            $recentLogs = ActivityLog::where('department_id', $department->id)
                ->with(['user:id,name,username,avatar'])
                ->latest()
                ->limit(30)
                ->get();

            $stats = [
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'incomplete_tasks' => $incompleteTasks,
                'overdue_tasks' => $overdueTasks,
                'completed_on_time' => $completedOnTimeTasks,
                'total_employees' => $employees->count(),
                'active_employees' => $employees->where('account_status', 'active')->count(),
                'avg_performance_score' => $avgPerformanceScore,
            ];

            return response()->json([
                'department' => $department,
                'employees' => $employees,
                'stats' => [
                    'total_tasks' => $totalTasks,
                    'completed_tasks' => $completedTasks,
                    'incomplete_tasks' => $incompleteTasks,
                    'overdue_tasks' => $overdueTasks,
                ],
                'statistics' => $stats,
                'recent_activities' => $recentLogs,
            ]);
        } catch (\Throwable $e) {
            Log::error("Error loading department details [ID: {$department->id}]: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'message' => config('app.debug') ? $e->getMessage() : 'Không thể tải thông tin phòng ban. Vui lòng thử lại.',
            ], 500);
        }
    }

    /**
     * PUT/PATCH /api/admin/departments/{department}
     * Update department information.
     */
    public function update(Request $request, Department $department): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => ['required', 'string', 'max:50', Rule::unique('departments')->ignore($department->id)],
            'description' => 'nullable|string|max:1000',
            'color' => 'nullable|string|max:50',
            'manager_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:active,inactive',
        ]);

        $code = strtoupper(trim($validated['code']));

        // Check manager status
        $newManager = null;
        if (!empty($validated['manager_id'])) {
            $newManager = User::find($validated['manager_id']);
            if ($newManager && $newManager->account_status !== 'active') {
                return response()->json(['message' => 'Không thể chỉ định nhân viên đã bị khóa làm Trưởng phòng.'], 422);
            }
        }

        $oldName = $department->name;
        $oldManagerId = $department->manager_id;
        $oldStatus = $department->status;

        DB::beginTransaction();
        try {
            $department->name = trim($validated['name']);
            $department->code = $code;
            if (array_key_exists('description', $validated)) {
                $department->description = $validated['description'];
            }
            if (!empty($validated['color'])) {
                $department->color = $validated['color'];
            }
            if (array_key_exists('status', $validated)) {
                $department->status = $validated['status'];
            }
            $department->save();

            $membershipService = app(\App\Services\DepartmentMembershipService::class);

            // If department was renamed, sync titles for all members cleanly
            if ($oldName !== $department->name) {
                $membershipService->handleDepartmentRename($department, $oldName, $request->user());
            }

            // If manager changed or cleared
            if ((int)$oldManagerId !== (int)($newManager?->id)) {
                $membershipService->assignManager($department, $newManager, $request->user());
            }

            // Record Activity Log
            $logChanges = [];
            if ($oldName !== $department->name) {
                $logChanges[] = "đổi tên từ '{$oldName}' sang '{$department->name}'";
            }
            if ($oldStatus !== $department->status) {
                $logChanges[] = "đổi trạng thái từ '{$oldStatus}' sang '{$department->status}'";
            }
            if ((int)$oldManagerId !== (int)$department->manager_id) {
                $logChanges[] = $newManager ? "chỉ định Trưởng phòng mới: {$newManager->name}" : "hủy chỉ định Trưởng phòng";
            }

            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $request->user()->id,
                'action' => 'cập nhật phòng ban',
                'old_value' => $oldName,
                'new_value' => empty($logChanges) ? "Cập nhật thông tin phòng ban" : implode(', ', $logChanges),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Cập nhật phòng ban thành công.',
                'department' => $department->load(['manager:id,name,username,email,avatar,position,department_title']),
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi cập nhật phòng ban: ' . $e->getMessage()], 500);
        }
    }

    /**
     * DELETE /api/admin/departments/{department}
     * Soft delete department if no active employees.
     */
    public function destroy(Request $request, Department $department): JsonResponse
    {
        $employeeCount = $department->employees()->count();
        if ($employeeCount > 0) {
            return response()->json([
                'message' => "Không thể xóa phòng ban đang có {$employeeCount} nhân viên. Vui lòng điều chuyển nhân viên trước hoặc chuyển phòng ban sang trạng thái ngừng hoạt động.",
                'employee_count' => $employeeCount,
            ], 422);
        }

        DB::beginTransaction();
        try {
            $departmentName = $department->name;
            $departmentId = $department->id;

            // Log activity before soft delete
            ActivityLog::create([
                'department_id' => $departmentId,
                'user_id' => $request->user()->id,
                'action' => 'ngừng hoạt động / xóa mềm phòng ban',
                'old_value' => $departmentName,
                'new_value' => 'Đã chuyển vào thùng rác / xóa mềm',
            ]);

            $department->delete();

            DB::commit();

            return response()->json([
                'message' => "Đã xóa mềm phòng ban '{$departmentName}' thành công.",
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi xóa phòng ban: ' . $e->getMessage()], 500);
        }
    }

    /**
     * PATCH /api/admin/departments/{id}/restore
     * Restore a soft-deleted department.
     */
    public function restore(Request $request, int|string $id): JsonResponse
    {
        $department = Department::withTrashed()->findOrFail($id);

        if (!$department->trashed()) {
            return response()->json(['message' => 'Phòng ban không ở trạng thái đã xóa.'], 400);
        }

        DB::beginTransaction();
        try {
            $department->restore();

            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $request->user()->id,
                'action' => 'khôi phục phòng ban',
                'old_value' => null,
                'new_value' => "Khôi phục phòng ban {$department->name}",
            ]);

            DB::commit();

            return response()->json([
                'message' => "Đã khôi phục phòng ban '{$department->name}' thành công.",
                'department' => $department,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi khôi phục phòng ban: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/admin/departments/{department}/employees
     * Assign one or multiple employees to this department.
     */
    public function assignEmployees(Request $request, Department $department): JsonResponse
    {
        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
        ]);

        if ($department->status !== 'active') {
            return response()->json(['message' => 'Không thể thêm nhân viên vào phòng ban đang ngừng hoạt động.'], 422);
        }

        $userIds = $request->input('user_ids');
        $users = User::whereIn('id', $userIds)->get();

        try {
            $membershipService = app(\App\Services\DepartmentMembershipService::class);
            $added = $membershipService->addEmployees($department, $request->input('user_ids'), $request->user());

            return response()->json([
                'message' => "Đã thêm " . count($added) . " nhân viên vào phòng ban '{$department->name}'.",
                'transferred_count' => count($added),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Lỗi gán nhân viên: ' . $e->getMessage()], 422);
        }
    }

    /**
     * DELETE /api/admin/departments/{department}/employees/{user}
     * Remove an employee from this department (sets department_id = null).
     */
    public function removeEmployee(Request $request, Department $department, User $user): JsonResponse
    {
        if ((int)$user->department_id !== (int)$department->id) {
            return response()->json(['message' => 'Nhân viên này không thuộc phòng ban đã chọn.'], 422);
        }

        try {
            $membershipService = app(\App\Services\DepartmentMembershipService::class);
            $membershipService->removeEmployee($department, $user, $request->user());

            return response()->json([
                'message' => "Đã gỡ nhân viên '{$user->name}' khỏi phòng ban '{$department->name}'.",
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Lỗi gỡ nhân viên: ' . $e->getMessage()], 422);
        }
    }

    /**
     * PATCH /api/admin/employees/{user}/department
     * Transfer or unassign a specific employee.
     */
    public function transferEmployee(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'department_id' => 'nullable|exists:departments,id',
            'replacement_manager_id' => 'nullable|exists:users,id',
        ]);

        $newDeptId = $request->input('department_id');
        $targetDept = $newDeptId ? Department::find($newDeptId) : null;

        if ($targetDept && $targetDept->status !== 'active') {
            return response()->json(['message' => 'Không thể điều chuyển nhân viên vào phòng ban đang ngừng hoạt động.'], 422);
        }

        $oldDept = $user->department;

        if ($oldDept && $newDeptId && (int)$oldDept->id === (int)$newDeptId) {
            return response()->json(['message' => 'Nhân viên đã thuộc phòng ban này.'], 422);
        }

        try {
            $membershipService = app(\App\Services\DepartmentMembershipService::class);
            $membershipService->transferEmployee(
                $user,
                $targetDept,
                $request->input('replacement_manager_id'),
                $request->user()
            );

            // Dispatch Telegram notifications for department employee transfer
            try {
                $telegramService = app(\App\Services\TelegramService::class);
                if ($oldDept) {
                    $destinations = $telegramService->resolveDepartmentDestinations($oldDept, 'employee_transferred');
                    $formatted = $telegramService->formatEmployeeTransferred($user, $request->user(), $oldDept, $targetDept);
                    foreach ($destinations as $dest) {
                        \App\Jobs\SendTelegramNotificationJob::dispatch(
                            integrationId: $dest->id,
                            chatId: $dest->chat_id,
                            message: $formatted['text'],
                            options: [],
                            eventType: 'employee_transferred',
                            notifiableType: Department::class,
                            notifiableId: $oldDept->id,
                            idempotencyKey: "emp_trans_{$user->id}_{$oldDept->id}_" . time() . "_{$dest->chat_id}"
                        );
                    }
                }
                if ($targetDept) {
                    $destinations = $telegramService->resolveDepartmentDestinations($targetDept, 'employee_transferred');
                    $formatted = $telegramService->formatEmployeeTransferred($user, $request->user(), $oldDept, $targetDept);
                    foreach ($destinations as $dest) {
                        \App\Jobs\SendTelegramNotificationJob::dispatch(
                            integrationId: $dest->id,
                            chatId: $dest->chat_id,
                            message: $formatted['text'],
                            options: [],
                            eventType: 'employee_transferred',
                            notifiableType: Department::class,
                            notifiableId: $targetDept->id,
                            idempotencyKey: "emp_trans_{$user->id}_{$targetDept->id}_" . time() . "_{$dest->chat_id}"
                        );
                    }
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('Telegram dispatch error for employee transfer: ' . $e->getMessage());
            }

            return response()->json([
                'message' => 'Điều chuyển nhân viên thành công.',
                'user' => $user->load('department:id,name,code,color'),
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi điều chuyển nhân viên: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/admin/employees/bulk-department
     * Bulk transfer multiple employees to a department.
     */
    public function bulkTransferEmployees(Request $request): JsonResponse
    {
        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
            'department_id' => 'nullable|exists:departments,id',
        ]);

        $newDeptId = $request->input('department_id');
        $targetDept = $newDeptId ? Department::find($newDeptId) : null;

        if ($targetDept && $targetDept->status !== 'active') {
            return response()->json(['message' => 'Không thể điều chuyển nhân viên vào phòng ban đang ngừng hoạt động.'], 422);
        }

        $userIds = $request->input('user_ids');
        $users = User::whereIn('id', $userIds)->get();

        DB::beginTransaction();
        try {
            $membershipService = app(\App\Services\DepartmentMembershipService::class);
            $count = 0;
            foreach ($users as $user) {
                if ((int)$user->department_id === (int)$newDeptId) {
                    continue;
                }

                $membershipService->transferEmployee($user, $targetDept, null, $request->user());
                $count++;
            }

            DB::commit();

            if ($targetDept) {
                ActivityLog::create([
                    'department_id' => $targetDept->id,
                    'user_id' => $request->user()->id,
                    'action' => 'điều chuyển hàng loạt nhân viên',
                    'old_value' => null,
                    'new_value' => "Đã chuyển {$count} nhân viên vào {$targetDept->name}",
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => "Đã điều chuyển thành công {$count} nhân viên.",
                'transferred_count' => $count,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi điều chuyển hàng loạt: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/departments/options
     * Minimal options for dropdowns (active departments only).
     * Accessible by any authenticated user.
     */
    public static function options(Request $request): JsonResponse
    {
        $departments = Department::active()
            ->select('id', 'name', 'code', 'color')
            ->orderBy('name')
            ->get();

        return response()->json($departments);
    }
}
