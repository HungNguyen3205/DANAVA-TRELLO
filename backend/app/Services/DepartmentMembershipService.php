<?php

namespace App\Services;

use App\Models\Department;
use App\Models\User;
use App\Models\ActivityLog;
use App\Notifications\DepartmentTransferNotification;
use App\Notifications\DepartmentManagerAssignedNotification;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class DepartmentMembershipService
{
    /**
     * Generate standard manager title for a department.
     */
    public function getManagerTitle(string $departmentName): string
    {
        return 'Trưởng phòng ' . trim($departmentName);
    }

    /**
     * Generate standard employee title for a department.
     */
    public function getEmployeeTitle(string $departmentName): string
    {
        return 'Nhân viên ' . trim($departmentName);
    }

    /**
     * Assign a manager to a department, updating titles and relations.
     */
    public function assignManager(Department $department, ?User $manager, ?User $actor = null): void
    {
        DB::transaction(function () use ($department, $manager, $actor) {
            $oldManagerId = $department->manager_id;
            $oldManager = $oldManagerId ? User::find($oldManagerId) : null;

            if ($manager) {
                if ($manager->account_status !== 'active') {
                    throw new InvalidArgumentException('Không thể chỉ định nhân viên đã bị khóa làm Trưởng phòng.');
                }

                // If department already had a different manager, demote old manager to employee title if still in department
                if ($oldManager && (int)$oldManager->id !== (int)$manager->id) {
                    if ((int)$oldManager->department_id === (int)$department->id) {
                        $oldManager->department_title = $this->getEmployeeTitle($department->name);
                        $oldManager->save();
                    }
                }

                // If new manager came from another department, handle transfer
                $oldDept = $manager->department;
                if ($oldDept && (int)$oldDept->id !== (int)$department->id) {
                    if ((int)$oldDept->manager_id === (int)$manager->id) {
                        $oldDept->manager_id = null;
                        $oldDept->save();
                    }
                    $manager->notify(new DepartmentTransferNotification($oldDept->name, $department->name, $actor));
                }

                // Assign manager to this department and give manager title
                $manager->department_id = $department->id;
                $manager->department_title = $this->getManagerTitle($department->name);
                $manager->save();

                $department->manager_id = $manager->id;
                $department->save();

                $manager->notify(new DepartmentManagerAssignedNotification($department, $actor));

                ActivityLog::create([
                    'department_id' => $department->id,
                    'user_id' => $actor?->id,
                    'action' => 'chỉ định trưởng phòng',
                    'old_value' => $oldManager?->name,
                    'new_value' => "Chỉ định {$manager->name} làm {$this->getManagerTitle($department->name)}",
                ]);
            } else {
                // Clearing manager
                if ($oldManager) {
                    if ((int)$oldManager->department_id === (int)$department->id) {
                        $oldManager->department_title = $this->getEmployeeTitle($department->name);
                        $oldManager->save();
                    }
                }

                $department->manager_id = null;
                $department->save();

                ActivityLog::create([
                    'department_id' => $department->id,
                    'user_id' => $actor?->id,
                    'action' => 'hủy chức vụ trưởng phòng',
                    'old_value' => $oldManager?->name,
                    'new_value' => 'Để trống vị trí Trưởng phòng',
                ]);
            }
        });
    }

    /**
     * Add multiple employees to a department with automatic title assignment.
     */
    public function addEmployees(Department $department, array $userIds, ?User $actor = null): array
    {
        if ($department->status !== 'active') {
            throw new InvalidArgumentException('Không thể thêm nhân viên vào phòng ban đang ngừng hoạt động.');
        }

        return DB::transaction(function () use ($department, $userIds, $actor) {
            $users = User::whereIn('id', $userIds)->get();
            $added = [];

            foreach ($users as $user) {
                $oldDept = $user->department;

                // If user was manager of old department, clear old manager
                if ($oldDept && (int)$oldDept->id !== (int)$department->id && (int)$oldDept->manager_id === (int)$user->id) {
                    $oldDept->manager_id = null;
                    $oldDept->save();
                }

                // Determine appropriate title
                $isManager = (int)$department->manager_id === (int)$user->id;
                $title = $isManager
                    ? $this->getManagerTitle($department->name)
                    : $this->getEmployeeTitle($department->name);

                $user->department_id = $department->id;
                $user->department_title = $title;
                $user->save();

                if ($oldDept && (int)$oldDept->id !== (int)$department->id) {
                    $user->notify(new DepartmentTransferNotification($oldDept->name, $department->name, $actor));
                }

                ActivityLog::create([
                    'department_id' => $department->id,
                    'user_id' => $actor?->id,
                    'action' => 'thêm nhân viên vào phòng ban',
                    'old_value' => $oldDept ? "Từ {$oldDept->name}" : 'Chưa phân phòng',
                    'new_value' => "Gán {$user->name} vào {$department->name} ({$title})",
                ]);

                $added[] = $user;
            }

            return $added;
        });
    }

    /**
     * Transfer an employee to another department with auto title update and manager check.
     */
    public function transferEmployee(
        User $employee,
        ?Department $targetDepartment,
        ?int $replacementManagerId = null,
        ?User $actor = null
    ): void {
        DB::transaction(function () use ($employee, $targetDepartment, $replacementManagerId, $actor) {
            $oldDept = $employee->department;

            if ($targetDepartment && $targetDepartment->status !== 'active') {
                throw new InvalidArgumentException('Không thể điều chuyển nhân viên vào phòng ban đang ngừng hoạt động.');
            }

            if ($oldDept && $targetDepartment && (int)$oldDept->id === (int)$targetDepartment->id) {
                return;
            }

            // Check if employee was manager of old department
            if ($oldDept && (int)$oldDept->manager_id === (int)$employee->id) {
                if ($replacementManagerId) {
                    $repManager = User::where('id', $replacementManagerId)
                        ->where('department_id', $oldDept->id)
                        ->first();

                    if (!$repManager || $repManager->account_status !== 'active') {
                        throw new InvalidArgumentException('Trưởng phòng thay thế phải là nhân viên đang hoạt động thuộc phòng ban cũ.');
                    }

                    $this->assignManager($oldDept, $repManager, $actor);
                } else {
                    $oldDept->manager_id = null;
                    $oldDept->save();

                    ActivityLog::create([
                        'department_id' => $oldDept->id,
                        'user_id' => $actor?->id,
                        'action' => 'hủy chức vụ trưởng phòng do điều chuyển',
                        'old_value' => $employee->name,
                        'new_value' => "Trưởng phòng {$employee->name} đã chuyển phòng ban, vị trí để trống",
                    ]);
                }
            }

            if ($targetDepartment) {
                $isManager = (int)$targetDepartment->manager_id === (int)$employee->id;
                $title = $isManager
                    ? $this->getManagerTitle($targetDepartment->name)
                    : $this->getEmployeeTitle($targetDepartment->name);

                $employee->department_id = $targetDepartment->id;
                $employee->department_title = $title;
                $employee->save();

                $employee->notify(new DepartmentTransferNotification($oldDept?->name, $targetDepartment->name, $actor));

                $logMsg = "Điều chuyển {$employee->name} từ " . ($oldDept ? $oldDept->name : 'Chưa phân phòng') . " sang {$targetDepartment->name} ({$title})";

                ActivityLog::create([
                    'department_id' => $targetDepartment->id,
                    'user_id' => $actor?->id,
                    'action' => 'điều chuyển nhân viên',
                    'old_value' => $oldDept?->name ?? 'Chưa phân phòng',
                    'new_value' => $logMsg,
                ]);
            } else {
                // Unassigned
                $employee->department_id = null;
                $employee->department_title = null;
                $employee->save();

                $employee->notify(new DepartmentTransferNotification($oldDept?->name, null, $actor));

                if ($oldDept) {
                    ActivityLog::create([
                        'department_id' => $oldDept->id,
                        'user_id' => $actor?->id,
                        'action' => 'gỡ nhân viên khỏi phòng ban',
                        'old_value' => $oldDept->name,
                        'new_value' => "Đưa {$employee->name} về Chưa phân phòng",
                    ]);
                }
            }
        });
    }

    /**
     * Remove an employee from a department, clearing department_id and department_title.
     */
    public function removeEmployee(Department $department, User $employee, ?User $actor = null): void
    {
        if ((int)$employee->department_id !== (int)$department->id) {
            throw new InvalidArgumentException('Nhân viên này không thuộc phòng ban đã chọn.');
        }

        DB::transaction(function () use ($department, $employee, $actor) {
            // If employee was manager, clear manager_id
            if ((int)$department->manager_id === (int)$employee->id) {
                $department->manager_id = null;
                $department->save();
            }

            $employee->department_id = null;
            $employee->department_title = null;
            $employee->save();

            $employee->notify(new DepartmentTransferNotification($department->name, null, $actor));

            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $actor?->id,
                'action' => 'gỡ nhân viên khỏi phòng ban',
                'old_value' => "Thuộc {$department->name}",
                'new_value' => "Đưa {$employee->name} về Chưa phân phòng",
            ]);
        });
    }

    /**
     * Synchronize department_title for all members of a department.
     */
    public function syncDepartmentTitles(Department $department): void
    {
        DB::transaction(function () use ($department) {
            $managerTitle = $this->getManagerTitle($department->name);
            $employeeTitle = $this->getEmployeeTitle($department->name);

            if ($department->manager_id) {
                User::where('id', $department->manager_id)
                    ->update(['department_title' => $managerTitle]);

                User::where('department_id', $department->id)
                    ->where('id', '!=', $department->manager_id)
                    ->update(['department_title' => $employeeTitle]);
            } else {
                User::where('department_id', $department->id)
                    ->update(['department_title' => $employeeTitle]);
            }
        });
    }

    /**
     * Handle department rename: update titles of all members cleanly without touching position.
     */
    public function handleDepartmentRename(Department $department, string $oldName, ?User $actor = null): void
    {
        if (trim($department->name) === trim($oldName)) {
            return;
        }

        DB::transaction(function () use ($department, $oldName, $actor) {
            $this->syncDepartmentTitles($department);

            ActivityLog::create([
                'department_id' => $department->id,
                'user_id' => $actor?->id,
                'action' => 'đồng bộ chức vụ phòng ban',
                'old_value' => "Đổi tên từ {$oldName}",
                'new_value' => "Đã tự động cập nhật chức vụ toàn bộ nhân sự theo tên mới: {$department->name}",
            ]);
        });
    }
}
