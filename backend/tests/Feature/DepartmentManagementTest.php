<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $regularUser;
    protected User $activeEmployee;
    protected User $lockedEmployee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'name' => 'System Admin',
            'username' => 'sys_admin',
            'email' => 'admin@danava.vn',
            'system_role' => 'system_admin',
            'account_status' => 'active',
        ]);

        $this->regularUser = User::factory()->create([
            'name' => 'Regular Member',
            'username' => 'reg_user',
            'email' => 'member@danava.vn',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $this->activeEmployee = User::factory()->create([
            'name' => 'Employee Alice',
            'username' => 'alice',
            'email' => 'alice@danava.vn',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $this->lockedEmployee = User::factory()->create([
            'name' => 'Locked Bob',
            'username' => 'bob',
            'email' => 'bob@danava.vn',
            'system_role' => 'user',
            'account_status' => 'locked',
        ]);
    }

    /**
     * Test Admin can create a department successfully.
     */
    public function test_admin_can_create_department_successfully()
    {
        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/departments', [
            'name' => 'Phòng Kỹ thuật & Công nghệ',
            'code' => 'TECH',
            'description' => 'Phụ trách hệ thống hạ tầng và ứng dụng',
            'color' => '#3b82f6',
            'status' => 'active',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('departments', [
            'name' => 'Phòng Kỹ thuật & Công nghệ',
            'code' => 'TECH',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);
    }

    /**
     * Test regular user cannot create department (403 forbidden).
     */
    public function test_regular_user_cannot_create_department()
    {
        $response = $this->actingAs($this->regularUser, 'sanctum')->postJson('/api/admin/departments', [
            'name' => 'Phòng Trái phép',
            'code' => 'UNAUTH',
        ]);

        $response->assertStatus(403);
    }

    /**
     * Test department code must be unique.
     */
    public function test_department_code_must_be_unique()
    {
        Department::create([
            'name' => 'Phòng Kinh doanh',
            'code' => 'SALES',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/departments', [
            'name' => 'Phòng Bán lẻ',
            'code' => 'SALES',
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test Admin can update department information.
     */
    public function test_admin_can_update_department()
    {
        $dept = Department::create([
            'name' => 'Phòng Marketing',
            'code' => 'MKT',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/departments/{$dept->id}", [
            'name' => 'Phòng Truyền thông & Thương hiệu',
            'code' => 'BRAND',
            'description' => 'Mô tả mới',
            'color' => '#10b981',
            'status' => 'active',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('departments', [
            'id' => $dept->id,
            'name' => 'Phòng Truyền thông & Thương hiệu',
            'code' => 'BRAND',
        ]);
    }

    /**
     * Test appointing a manager and auto-assigning manager to department.
     */
    public function test_assigning_manager_to_department()
    {
        $dept = Department::create([
            'name' => 'Phòng Kế toán',
            'code' => 'ACC',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/departments/{$dept->id}", [
            'name' => $dept->name,
            'code' => $dept->code,
            'manager_id' => $this->activeEmployee->id,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('departments', [
            'id' => $dept->id,
            'manager_id' => $this->activeEmployee->id,
        ]);

        // Manager should be assigned to this department
        $this->assertEquals($dept->id, $this->activeEmployee->fresh()->department_id);
    }

    /**
     * Test cannot select locked user as department manager.
     */
    public function test_cannot_select_locked_user_as_manager()
    {
        $dept = Department::create([
            'name' => 'Phòng Nhân sự',
            'code' => 'HR',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/departments/{$dept->id}", [
            'name' => $dept->name,
            'code' => $dept->code,
            'manager_id' => $this->lockedEmployee->id,
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test assign employees to department.
     */
    public function test_assign_employees_to_department()
    {
        $dept = Department::create([
            'name' => 'Phòng IT',
            'code' => 'IT',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->postJson("/api/admin/departments/{$dept->id}/employees", [
            'user_ids' => [$this->activeEmployee->id],
        ]);

        $response->assertStatus(200);
        $this->assertEquals($dept->id, $this->activeEmployee->fresh()->department_id);
    }

    /**
     * Test cannot assign employees to inactive department.
     */
    public function test_cannot_assign_employee_to_inactive_department()
    {
        $inactiveDept = Department::create([
            'name' => 'Phòng Đã Tắt',
            'code' => 'CLOSED',
            'status' => 'inactive',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->postJson("/api/admin/departments/{$inactiveDept->id}/employees", [
            'user_ids' => [$this->activeEmployee->id],
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test transfer employee between departments.
     */
    public function test_transfer_employee_between_departments()
    {
        $deptA = Department::create(['name' => 'Phòng A', 'code' => 'DEPTA', 'status' => 'active']);
        $deptB = Department::create(['name' => 'Phòng B', 'code' => 'DEPTB', 'status' => 'active']);

        $this->activeEmployee->department_id = $deptA->id;
        $this->activeEmployee->save();

        $response = $this->actingAs($this->admin, 'sanctum')->patchJson("/api/admin/employees/{$this->activeEmployee->id}/department", [
            'department_id' => $deptB->id,
        ]);

        $response->assertStatus(200);
        $this->assertEquals($deptB->id, $this->activeEmployee->fresh()->department_id);
    }

    /**
     * Test cannot delete department that currently has employees.
     */
    public function test_cannot_delete_department_with_employees()
    {
        $dept = Department::create(['name' => 'Phòng Đang Có Người', 'code' => 'ACTIVE_PEOPLE', 'status' => 'active']);
        $this->activeEmployee->department_id = $dept->id;
        $this->activeEmployee->save();

        $response = $this->actingAs($this->admin, 'sanctum')->deleteJson("/api/admin/departments/{$dept->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('departments', ['id' => $dept->id, 'deleted_at' => null]);
    }

    /**
     * Test department_id cannot be modified by user via profile API.
     */
    public function test_user_cannot_self_modify_department_via_profile()
    {
        $dept = Department::create(['name' => 'Phòng VIP', 'code' => 'VIP', 'status' => 'active']);

        $response = $this->actingAs($this->regularUser, 'sanctum')->postJson('/api/me', [
            'name' => 'Họ Tên Mới',
            'department_id' => $dept->id,
        ]);

        $response->assertStatus(200);
        $this->assertNull($this->regularUser->fresh()->department_id);
    }

    /**
     * Test department membership does NOT auto-grant access to private boards.
     */
    public function test_department_does_not_auto_grant_board_access()
    {
        $dept = Department::create(['name' => 'Phòng Dự Án', 'code' => 'PROJ', 'status' => 'active']);
        $this->regularUser->department_id = $dept->id;
        $this->regularUser->save();

        $boardOwner = User::factory()->create(['department_id' => $dept->id, 'system_role' => 'user']);
        $board = Board::create([
            'name' => 'Bảng Nội Bộ Của Owner',
            'public_id' => 'BNDB1234',
            'owner_id' => $boardOwner->id,
        ]);

        // Regular user belongs to the same department as boardOwner, but was NOT invited to board
        $response = $this->actingAs($this->regularUser, 'sanctum')->getJson("/api/boards/{$board->id}");

        $response->assertStatus(403);
    }

    /**
     * Test departments options endpoint is accessible to authenticated users.
     */
    public function test_departments_options_accessible_to_users()
    {
        Department::create(['name' => 'Phòng Active 1', 'code' => 'ACT1', 'status' => 'active']);
        Department::create(['name' => 'Phòng Inactive', 'code' => 'INACT', 'status' => 'inactive']);

        $response = $this->actingAs($this->regularUser, 'sanctum')->getJson('/api/departments/options');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(1, $data);
        $this->assertEquals('ACT1', $data[0]['code']);
    }

    /**
     * Test admin can view department details with full stats and relations.
     */
    public function test_admin_can_view_department_details_successfully()
    {
        $dept = Department::create([
            'name' => 'Phòng Kỹ thuật Phần mềm',
            'code' => 'DEV',
            'description' => 'Mô tả phòng kỹ thuật',
            'manager_id' => $this->activeEmployee->id,
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $this->activeEmployee->department_id = $dept->id;
        $this->activeEmployee->save();

        $response = $this->actingAs($this->admin, 'sanctum')->getJson("/api/admin/departments/{$dept->id}");

        $response->assertStatus(200);
        $data = $response->json();

        // Validate top-level response structure
        $this->assertArrayHasKey('department', $data);
        $this->assertArrayHasKey('employees', $data);
        $this->assertArrayHasKey('stats', $data);
        $this->assertArrayHasKey('statistics', $data);

        // Validate department attributes
        $this->assertEquals($dept->id, $data['department']['id']);
        $this->assertEquals('Phòng Kỹ thuật Phần mềm', $data['department']['name']);
        $this->assertEquals('DEV', $data['department']['code']);
        $this->assertEquals('active', $data['department']['status']);
        $this->assertEquals(1, $data['department']['employee_count']);
        $this->assertNotNull($data['department']['manager']);
        $this->assertEquals($this->activeEmployee->id, $data['department']['manager']['id']);

        // Validate stats
        $this->assertArrayHasKey('total_tasks', $data['stats']);
        $this->assertArrayHasKey('completed_tasks', $data['stats']);
        $this->assertArrayHasKey('incomplete_tasks', $data['stats']);
        $this->assertArrayHasKey('overdue_tasks', $data['stats']);
    }

    /**
     * Test department without manager can be viewed successfully (manager is null).
     */
    public function test_department_without_manager_can_be_viewed_successfully()
    {
        $dept = Department::create([
            'name' => 'Phòng Chưa Có Trưởng',
            'code' => 'NO_MGR',
            'manager_id' => null,
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->getJson("/api/admin/departments/{$dept->id}");

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertNull($data['department']['manager']);
    }

    /**
     * Test department without employees can be viewed successfully without errors.
     */
    public function test_department_without_employees_can_be_viewed_successfully()
    {
        $dept = Department::create([
            'name' => 'Phòng Mới Tinh',
            'code' => 'EMPTY_DEPT',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->getJson("/api/admin/departments/{$dept->id}");

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertEmpty($data['employees']);
        $this->assertEquals(0, $data['department']['employee_count']);
        $this->assertEquals(0, $data['stats']['total_tasks']);
        $this->assertEquals(0, $data['stats']['completed_tasks']);
        $this->assertEquals(0, $data['stats']['incomplete_tasks']);
        $this->assertEquals(0, $data['stats']['overdue_tasks']);
    }

    /**
     * Test regular user cannot view department details (403 forbidden).
     */
    public function test_regular_user_cannot_view_department_details()
    {
        $dept = Department::create([
            'name' => 'Phòng Bí mật',
            'code' => 'SECRET',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->regularUser, 'sanctum')->getJson("/api/admin/departments/{$dept->id}");

        $response->assertStatus(403);
    }

    /**
     * Test non-existent department returns 404.
     */
    public function test_non_existent_department_returns_404()
    {
        $response = $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/departments/999999');

        $response->assertStatus(404);
    }
}
