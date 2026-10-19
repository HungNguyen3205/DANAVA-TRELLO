<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Department;
use App\Models\ActivityLog;
use App\Services\DepartmentMembershipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

class DepartmentAutoTitlesTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $regularUser;
    protected DepartmentMembershipService $membershipService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->membershipService = app(DepartmentMembershipService::class);

        // System Admin
        $this->admin = User::factory()->create([
            'username' => 'sysadmin',
            'name' => 'Nguyễn Nam Hùng',
            'email' => 'admin@danava.vn',
            'password' => Hash::make('Password@123'),
            'system_role' => 'system_admin',
            'account_status' => 'active',
            'position' => 'Giám đốc Công nghệ',
        ]);

        // Regular User
        $this->regularUser = User::factory()->create([
            'username' => 'staff1',
            'name' => 'Trần Văn Nhân',
            'email' => 'staff1@danava.vn',
            'password' => Hash::make('Password@123'),
            'system_role' => 'user',
            'account_status' => 'active',
            'position' => 'Lập trình viên Fullstack',
        ]);
    }

    /**
     * Test create department with manager:
     * - Manager receives "Trưởng phòng {Name}"
     * - Initial employees receive "Nhân viên {Name}"
     * - position is not overwritten
     * - system_role is not modified
     */
    public function test_create_department_with_manager_sets_correct_titles()
    {
        $employee2 = User::factory()->create([
            'username' => 'staff2',
            'name' => 'Lê Thị Mai',
            'email' => 'staff2@danava.vn',
            'position' => 'Chuyên viên Kiểm thử QA',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/departments', [
            'name' => 'Kỹ thuật',
            'code' => 'TECH',
            'description' => 'Phòng kỹ thuật',
            'manager_id' => $this->regularUser->id,
            'employee_ids' => [$employee2->id],
        ]);

        $response->assertStatus(201);
        $deptId = $response->json('department.id');

        // Check manager
        $this->regularUser->refresh();
        $this->assertEquals($deptId, $this->regularUser->department_id);
        $this->assertEquals('Trưởng phòng Kỹ thuật', $this->regularUser->department_title);
        $this->assertEquals('Lập trình viên Fullstack', $this->regularUser->position); // Position preserved!
        $this->assertEquals('user', $this->regularUser->system_role); // System role preserved!

        // Check member
        $employee2->refresh();
        $this->assertEquals($deptId, $employee2->department_id);
        $this->assertEquals('Nhân viên Kỹ thuật', $employee2->department_title);
        $this->assertEquals('Chuyên viên Kiểm thử QA', $employee2->position); // Position preserved!
        $this->assertEquals('user', $employee2->system_role);
    }

    /**
     * Test change manager updates both old and new manager titles.
     */
    public function test_change_manager_updates_both_old_and_new_manager_titles()
    {
        $dept = Department::create([
            'name' => 'Marketing',
            'code' => 'MKT',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $userA = User::factory()->create([
            'name' => 'Trần Văn A',
            'username' => 'usera',
            'position' => 'Trưởng nhóm Digital',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $userB = User::factory()->create([
            'name' => 'Nguyễn Thị B',
            'username' => 'userb',
            'position' => 'Chuyên viên Content',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        // Assign User A as initial manager, User B as employee
        $this->membershipService->assignManager($dept, $userA, $this->admin);
        $this->membershipService->addEmployees($dept, [$userB->id], $this->admin);

        $this->assertEquals('Trưởng phòng Marketing', $userA->fresh()->department_title);
        $this->assertEquals('Nhân viên Marketing', $userB->fresh()->department_title);

        // Now update department via API, promoting User B to manager
        $response = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/departments/{$dept->id}", [
            'name' => 'Marketing',
            'code' => 'MKT',
            'manager_id' => $userB->id,
        ]);

        $response->assertStatus(200);

        // Old manager (User A) should now have employee title
        $userA->refresh();
        $this->assertEquals('Nhân viên Marketing', $userA->department_title);
        $this->assertEquals('Trưởng nhóm Digital', $userA->position); // preserved

        // New manager (User B) should have manager title
        $userB->refresh();
        $this->assertEquals('Trưởng phòng Marketing', $userB->department_title);
        $this->assertEquals('Chuyên viên Content', $userB->position); // preserved

        // Department manager_id should be User B
        $this->assertEquals($userB->id, $dept->fresh()->manager_id);
    }

    /**
     * Test department rename updates titles for all members cleanly without touching position.
     */
    public function test_rename_department_updates_titles_for_all_members_without_touching_position()
    {
        $dept = Department::create([
            'name' => 'Kinh doanh',
            'code' => 'SALES',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $manager = User::factory()->create([
            'name' => 'Trưởng Phòng Cũ',
            'username' => 'salesmgr',
            'position' => 'Chuyên viên B2B',
            'account_status' => 'active',
        ]);

        $employee = User::factory()->create([
            'name' => 'Nhân viên Sales',
            'username' => 'salesemp',
            'position' => 'Tư vấn viên',
            'account_status' => 'active',
        ]);

        $this->membershipService->assignManager($dept, $manager, $this->admin);
        $this->membershipService->addEmployees($dept, [$employee->id], $this->admin);

        $this->assertEquals('Trưởng phòng Kinh doanh', $manager->fresh()->department_title);
        $this->assertEquals('Nhân viên Kinh doanh', $employee->fresh()->department_title);

        // Rename department from 'Kinh doanh' to 'Phát triển Khách hàng'
        $response = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/departments/{$dept->id}", [
            'name' => 'Phát triển Khách hàng',
            'code' => 'SALES',
            'manager_id' => $manager->id,
        ]);

        $response->assertStatus(200);

        // Titles updated automatically to new department name
        $this->assertEquals('Trưởng phòng Phát triển Khách hàng', $manager->fresh()->department_title);
        $this->assertEquals('Chuyên viên B2B', $manager->fresh()->position); // preserved!

        $this->assertEquals('Nhân viên Phát triển Khách hàng', $employee->fresh()->department_title);
        $this->assertEquals('Tư vấn viên', $employee->fresh()->position); // preserved!
    }

    /**
     * Test transfer employee updates title to new department and handles old manager transfer.
     */
    public function test_transfer_employee_updates_title_and_handles_manager_transfer()
    {
        $deptA = Department::create(['name' => 'Phòng A', 'code' => 'DEPTA', 'status' => 'active']);
        $deptB = Department::create(['name' => 'Phòng B', 'code' => 'DEPTB', 'status' => 'active']);

        $emp = User::factory()->create([
            'name' => 'Nhân viên A',
            'username' => 'empa',
            'position' => 'Thiết kế UI/UX',
            'account_status' => 'active',
        ]);

        // User is manager of Dept A
        $this->membershipService->assignManager($deptA, $emp, $this->admin);
        $this->assertEquals('Trưởng phòng Phòng A', $emp->fresh()->department_title);
        $this->assertEquals($emp->id, $deptA->fresh()->manager_id);

        // Transfer emp from Dept A to Dept B
        $response = $this->actingAs($this->admin, 'sanctum')->patchJson("/api/admin/employees/{$emp->id}/department", [
            'department_id' => $deptB->id,
        ]);

        $response->assertStatus(200);

        $emp->refresh();
        $this->assertEquals($deptB->id, $emp->department_id);
        $this->assertEquals('Nhân viên Phòng B', $emp->department_title);
        $this->assertEquals('Thiết kế UI/UX', $emp->position); // preserved

        // Dept A should no longer have emp as manager (cleared)
        $this->assertNull($deptA->fresh()->manager_id);
    }

    /**
     * Test remove employee clears department_id and department_title.
     */
    public function test_remove_employee_clears_department_and_title()
    {
        $dept = Department::create(['name' => 'Phòng Kế toán', 'code' => 'ACC', 'status' => 'active']);

        $emp = User::factory()->create([
            'name' => 'Nhân viên Kế toán',
            'username' => 'acc1',
            'position' => 'Kế toán tổng hợp',
            'account_status' => 'active',
        ]);

        $this->membershipService->addEmployees($dept, [$emp->id], $this->admin);
        $this->assertEquals('Nhân viên Phòng Kế toán', $emp->fresh()->department_title);

        $response = $this->actingAs($this->admin, 'sanctum')->deleteJson("/api/admin/departments/{$dept->id}/employees/{$emp->id}");

        $response->assertStatus(200);

        $emp->refresh();
        $this->assertNull($emp->department_id);
        $this->assertNull($emp->department_title);
        $this->assertEquals('Kế toán tổng hợp', $emp->position); // preserved!
    }

    /**
     * Test system_role is never changed by department membership or manager role.
     */
    public function test_system_role_is_never_changed_by_department_membership()
    {
        $dept = Department::create(['name' => 'Phòng Quản trị', 'code' => 'ADMIN_DEPT', 'status' => 'active']);

        // 1. Admin added to department as normal member should remain system_admin
        $adminUser = User::factory()->create([
            'username' => 'deptadmin',
            'system_role' => 'system_admin',
            'account_status' => 'active',
        ]);

        $this->membershipService->addEmployees($dept, [$adminUser->id], $this->admin);
        $adminUser->refresh();
        $this->assertEquals('system_admin', $adminUser->system_role); // Not demoted to user!
        $this->assertEquals('Nhân viên Phòng Quản trị', $adminUser->department_title);

        // 2. Regular user promoted to manager should NOT automatically become system_admin
        $regularStaff = User::factory()->create([
            'username' => 'regularmgr',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $this->membershipService->assignManager($dept, $regularStaff, $this->admin);
        $regularStaff->refresh();
        $this->assertEquals('user', $regularStaff->system_role); // Not elevated to system_admin!
        $this->assertEquals('Trưởng phòng Phòng Quản trị', $regularStaff->department_title);
    }

    /**
     * Test department without manager still assigns employee titles properly.
     */
    public function test_department_without_manager_assigns_employee_titles()
    {
        $dept = Department::create([
            'name' => 'Phòng Dự án Mới',
            'code' => 'NEWPROJ',
            'manager_id' => null,
            'status' => 'active',
        ]);

        $staff = User::factory()->create([
            'username' => 'staffnew',
            'position' => 'Chuyên viên dự án',
            'account_status' => 'active',
        ]);

        $this->membershipService->addEmployees($dept, [$staff->id], $this->admin);
        $staff->refresh();

        $this->assertNull($dept->fresh()->manager_id);
        $this->assertEquals('Nhân viên Phòng Dự án Mới', $staff->department_title);
    }

    /**
     * Test regular user cannot self-modify department_title or department_id via /api/me.
     */
    public function test_regular_user_cannot_modify_department_title_via_profile()
    {
        $this->regularUser->department_title = 'Nhân viên Kỹ thuật';
        $this->regularUser->save();

        $response = $this->actingAs($this->regularUser, 'sanctum')->postJson('/api/me', [
            'name' => 'Tên Mới',
            'department_title' => 'Tổng Giám đốc Tập đoàn',
            'department_id' => 999,
        ]);

        $response->assertStatus(200);

        $this->regularUser->refresh();
        $this->assertEquals('Tên Mới', $this->regularUser->name);
        $this->assertEquals('Nhân viên Kỹ thuật', $this->regularUser->department_title); // Cannot tamper!
    }

    /**
     * Test activity logs record manager and title updates.
     */
    public function test_activity_logs_record_manager_and_title_updates()
    {
        $dept = Department::create(['name' => 'Phòng Vận hành', 'code' => 'OPS', 'status' => 'active']);

        $manager = User::factory()->create([
            'name' => 'Nguyễn Vận Hành',
            'account_status' => 'active',
        ]);

        $this->membershipService->assignManager($dept, $manager, $this->admin);

        $this->assertDatabaseHas('activity_logs', [
            'department_id' => $dept->id,
            'action' => 'chỉ định trưởng phòng',
        ]);
    }
}
