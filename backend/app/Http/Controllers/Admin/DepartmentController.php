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
            ->with(['manager:id,name,username,email,avatar,position,account_status']);

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
                'manager_id' => $manager?->id,
                'status' => $validated['status'] ?? 'active',
                'created_by' => $request->user()->id,
            ]);

            // If manager selected, ensure manager belongs to this department
            if ($manager) {
                $oldDept = $manager->department;
                $manager->department_id = $department->id;
                $manager->save();

                // Send manager assigned notification
                $manager->notify(new DepartmentManagerAssignedNotification($department, $request->user()));

                if ($oldDept && $oldDept->id !== $department->id) {
                    $manager->notify(new DepartmentTransferNotification($oldDept->name, $department->name, $request->user()));
                }
            }

            // Assign initial employees if provided
            if (!empty($validated['employee_ids'])) {
                $employees = User::whereIn('id', $validated['employee_ids'])->get();
                foreach ($employees as $emp) {
                    $oldDept = $emp->department;
                    $emp->department_id = $department->id;
                    $emp->save();

                    $emp->notify(new DepartmentTransferNotification($oldDept?->name, $department->name, $request->user()));
                }
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
                'department' => $department->load(['manager:id,name,username,email,avatar']),
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
        $department->load([
            'manager:id,name,username,email,avatar,position,account_status',
            'creator:id,name,username',
        ]);

        // Employees list in this department
        $employees = User::where('department_id', $department->id)
            ->withCount('boards')
            ->select('id', 'name', 'username', 'email', 'avatar', 'position', 'account_status', 'phone', 'join_date')
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
        $incompleteTasks = $totalTasks - $completedTasks;

        $now = now();
        $overdueTasks = $tasks->filter(function ($t) use ($now) {
            if (!$t->due_date) return false;
            $dueDate = \Carbon\Carbon::parse($t->due_date)->endOfDay();
            if ($t->completed_at) {
                return \Carbon\Carbon::parse($t->completed_at)->gt($dueDate);
            }
            return $now->gt($dueDate);
        })->count();

        $completedOnTimeTasks = $tasks->filter(function ($t) {
            if (!$t->completed_at || !$t->due_date) return false;
            $dueDate = \Carbon\Carbon::parse($t->due_date)->endOfDay();
            return \Carbon\Carbon::parse($t->completed_at)->lte($dueDate);
        })->count();

        // Calculate average performance score if available
        $avgPerformanceScore = null;
        if (!empty($employeeIds) && Schema::hasTable('performance_scores')) {
            $avgPerformanceScore = DB::table('performance_scores')
                ->whereIn('user_id', $employeeIds)
                ->where('is_provisional', false)
                ->avg('final_score');
            if ($avgPerformanceScore !== null) {
                $avgPerformanceScore = round($avgPerformanceScore, 2);
            }
        }

        // Attach individual task counts to employees
        if (!empty($employeeIds)) {
            $employeeTaskCounts = DB::table('task_assignees')
                ->join('tasks', 'task_assignees.task_id', '=', 'tasks.id')
                ->whereNull('tasks.deleted_at')
                ->whereIn('task_assignees.user_id', $employeeIds)
                ->groupBy('task_assignees.user_id')
                ->select('task_assignees.user_id', DB::raw('count(distinct tasks.id) as tasks_count'))
                ->pluck('tasks_count', 'user_id');

            foreach ($employees as $emp) {
                $emp->tasks_count = $employeeTaskCounts[$emp->id] ?? 0;
            }
        }

        // Recent activity logs for this department
        $recentLogs = ActivityLog::where('department_id', $department->id)
            ->with(['user:id,name,username,avatar'])
            ->latest()
            ->limit(30)
            ->get();

        return response()->json([
            'department' => $department,
            'employees' => $employees,
            'statistics' => [
                'total_employees' => $employees->count(),
                'active_employees' => $employees->where('account_status', 'active')->count(),
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'incomplete_tasks' => $incompleteTasks,
                'overdue_tasks' => $overdueTasks,
                'completed_on_time' => $completedOnTimeTasks,
                'avg_performance_score' => $avgPerformanceScore,
            ],
            'recent_activities' => $recentLogs,
        ]);
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
            $department->manager_id = $newManager?->id;
            $department->save();

            // If manager changed, assign new manager to this department and notify
            if ($newManager && (int)$oldManagerId !== (int)$newManager->id) {
                $oldDept = $newManager->department;
                $newManager->department_id = $department->id;
                $newManager->save();

                $newManager->notify(new DepartmentManagerAssignedNotification($department, $request->user()));

                if ($oldDept && $oldDept->id !== $department->id) {
                    $newManager->notify(new DepartmentTransferNotification($oldDept->name, $department->name, $request->user()));
                }
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
                'department' => $department->load(['manager:id,name,username,email,avatar']),
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

        DB::beginTransaction();
        try {
            $transferredCount = 0;
            foreach ($users as $user) {
                if ((int)$user->department_id === (int)$department->id) {
                    continue;
                }

                $oldDept = $user->department;
                $user->department_id = $department->id;
                $user->save();

                $user->notify(new DepartmentTransferNotification($oldDept?->name, $department->name, $request->user()));

                ActivityLog::create([
                    'department_id' => $department->id,
                    'user_id' => $request->user()->id,
                    'action' => 'thêm nhân viên vào phòng ban',
                    'old_value' => $oldDept ? "Từ {$oldDept->name}" : 'Chưa phân phòng',
                    'new_value' => "Gán {$user->name} vào {$department->name}",
                ]);

                $transferredCount++;
            }

            DB::commit();

            return response()->json([
                'message' => "Đã thêm {$transferredCount} nhân viên vào phòng ban '{$department->name}'.",
                'transferred_count' => $transferredCount,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi gán nhân viên: ' . $e->getMessage()], 500);
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

        DB::beginTransaction();
        try {
            $user->department_id = null;
            $user->save();

            // If user was manager, clear manager_id
            if ((int)$department->manager_id === (int)$user->id) {
                $department->manager_id = null;
                $department->save();
            }

            $user->notify(new DepartmentTransferNotification($department->name, null, $request->user()));

            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $request->user()->id,
                'action' => 'gỡ nhân viên khỏi phòng ban',
                'old_value' => "Thuộc {$department->name}",
                'new_value' => "Đưa {$user->name} về Chưa phân phòng",
            ]);

            DB::commit();

            return response()->json([
                'message' => "Đã gỡ nhân viên '{$user->name}' khỏi phòng ban '{$department->name}'.",
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Lỗi gỡ nhân viên: ' . $e->getMessage()], 500);
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
        ]);

        $newDeptId = $request->input('department_id');
        $targetDept = $newDeptId ? Department::find($newDeptId) : null;

        if ($targetDept && $targetDept->status !== 'active') {
            return response()->json(['message' => 'Không thể điều chuyển nhân viên vào phòng ban đang ngừng hoạt động.'], 422);
        }

        $oldDept = $user->department;

        if ($oldDept && (int)$oldDept->id === (int)$newDeptId) {
            return response()->json(['message' => 'Nhân viên đã thuộc phòng ban này.'], 422);
        }

        DB::beginTransaction();
        try {
            // If user was manager of old department, clear manager_id
            if ($oldDept && (int)$oldDept->manager_id === (int)$user->id) {
                $oldDept->manager_id = null;
                $oldDept->save();
            }

            $user->department_id = $newDeptId;
            $user->save();

            // Send notification
            $user->notify(new DepartmentTransferNotification($oldDept?->name, $targetDept?->name, $request->user()));

            // Activity Log
            $actionLog = $targetDept
                ? "Điều chuyển {$user->name} từ " . ($oldDept ? $oldDept->name : 'Chưa phân phòng') . " sang {$targetDept->name}"
                : "Gỡ {$user->name} khỏi " . ($oldDept ? $oldDept->name : 'phòng ban');

            if ($targetDept) {
                ActivityLog::create([
                    'department_id' => $targetDept->id,
                    'user_id' => $request->user()->id,
                    'action' => 'điều chuyển nhân viên',
                    'old_value' => $oldDept?->name ?? 'Chưa phân phòng',
                    'new_value' => $actionLog,
                ]);
            }
            if ($oldDept) {
                ActivityLog::create([
                    'department_id' => $oldDept->id,
                    'user_id' => $request->user()->id,
                    'action' => 'điều chuyển nhân viên đi',
                    'old_value' => $oldDept->name,
                    'new_value' => $actionLog,
                ]);
            }

            DB::commit();

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
            $count = 0;
            foreach ($users as $user) {
                if ((int)$user->department_id === (int)$newDeptId) {
                    continue;
                }

                $oldDept = $user->department;
                if ($oldDept && (int)$oldDept->manager_id === (int)$user->id) {
                    $oldDept->manager_id = null;
                    $oldDept->save();
                }

                $user->department_id = $newDeptId;
                $user->save();

                $user->notify(new DepartmentTransferNotification($oldDept?->name, $targetDept?->name, $request->user()));

                $count++;
            }

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
