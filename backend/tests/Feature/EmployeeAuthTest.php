<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class EmployeeAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_call_register()
    {
        // Public registration must always be blocked (403)
        $response = $this->postJson('/api/register', [
            'name' => 'Self Register User',
            'email' => 'self@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
    }

    public function test_user_can_login_with_email()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('Password@123'),
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'test@example.com',
            'password' => 'Password@123',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['access_token', 'user']);
    }

    public function test_user_can_login_with_username()
    {
        $user = User::factory()->create([
            'username' => 'testuser',
            'password' => Hash::make('Password@123'),
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'testuser',
            'password' => 'Password@123',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['access_token', 'user']);
    }

    public function test_locked_user_cannot_login()
    {
        $user = User::factory()->create([
            'username' => 'lockeduser',
            'password' => Hash::make('Password@123'),
            'account_status' => 'locked'
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'lockeduser',
            'password' => 'Password@123',
        ]);

        $response->assertStatus(422);
    }

    public function test_soft_deleted_user_cannot_login()
    {
        $user = User::factory()->create([
            'username' => 'deleteduser',
            'password' => Hash::make('Password@123'),
        ]);
        $user->delete(); // Soft delete

        $response = $this->postJson('/api/login', [
            'login' => 'deleteduser',
            'password' => 'Password@123',
        ]);

        $response->assertStatus(422);
    }

    public function test_regular_user_cannot_create_employee()
    {
        $regularUser = User::factory()->create([
            'system_role' => 'user'
        ]);
        $token = $regularUser->createToken('auth')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->postJson('/api/admin/employees', [
                             'name' => 'New Employee',
                             'username' => 'newemp',
                             'password' => 'Password@123',
                         ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_create_employee()
    {
        $admin = User::factory()->create([
            'system_role' => 'system_admin'
        ]);
        $token = $admin->createToken('auth')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->postJson('/api/admin/employees', [
                             'name' => 'Nguyễn Văn A',
                             'username' => 'nguyenvana',
                             'password' => 'Password@123',
                             'email' => 'nguyenvana@danava.vn',
                             'position' => 'Lập trình viên backend',
                         ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'username' => 'nguyenvana',
            'email' => 'nguyenvana@danava.vn',
            'system_role' => 'user',
            'account_status' => 'active',
            'must_change_password' => true,
            'position' => 'Lập trình viên backend',
            'created_by' => $admin->id
        ]);
    }

    public function test_employee_creation_fails_if_password_under_8_chars()
    {
        $admin = User::factory()->create([
            'system_role' => 'system_admin'
        ]);
        $token = $admin->createToken('auth')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->postJson('/api/admin/employees', [
                             'name' => 'Short Pass User',
                             'username' => 'shortpass',
                             'password' => '123456', // only 6 chars
                         ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['password']);
    }

    public function test_employee_creation_fails_if_username_not_unique()
    {
        User::factory()->create(['username' => 'existinguser']);

        $admin = User::factory()->create([
            'system_role' => 'system_admin'
        ]);
        $token = $admin->createToken('auth')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->postJson('/api/admin/employees', [
                             'name' => 'Duplicate User',
                             'username' => 'existinguser',
                             'password' => 'Password@123',
                         ]);

        $response->assertStatus(422);
    }

    public function test_new_user_must_change_password_blocks_access()
    {
        $user = User::factory()->create([
            'must_change_password' => true
        ]);
        $token = $user->createToken('auth')->plainTextToken;

        // Trying to access protected business routes
        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->getJson('/api/boards');

        $response->assertStatus(403)->assertJson(['code' => 'MUST_CHANGE_PASSWORD']);

        $changePassResponse = $this->withHeaders(['Authorization' => "Bearer $token"])
                                   ->postJson('/api/auth/change-password', [
                                       'password' => 'NewSecurePassword@123',
                                       'password_confirmation' => 'NewSecurePassword@123',
                                   ]);
        $changePassResponse->assertStatus(200);

        // After change, must_change_password is false and user can access boards
        $this->assertFalse($user->fresh()->must_change_password);
        $allowedResponse = $this->withHeaders(['Authorization' => "Bearer $token"])
                                ->getJson('/api/boards');
        $allowedResponse->assertStatus(200);
    }

    public function test_user_cannot_self_escalate_system_role_or_status()
    {
        $user = User::factory()->create([
            'system_role' => 'user',
            'account_status' => 'active',
            'created_by' => null,
            'must_change_password' => false
        ]);
        $token = $user->createToken('auth')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->postJson('/api/me', [
                             'name' => 'Tên Mới',
                             'phone' => '0912345678',
                             'gender' => 'Nam',
                             'position' => 'Chuyên viên kỹ thuật',
                             'dob' => '1995-05-15',
                             'address' => 'Hải Châu, Đà Nẵng',
                             'join_date' => '2026-01-10',
                             // Attacker tries to escalate:
                             'system_role' => 'system_admin',
                             'account_status' => 'locked',
                             'created_by' => 999
                         ]);

        $response->assertStatus(200);

        $freshUser = $user->fresh();
        // Allowed fields were updated
        $this->assertEquals('Tên Mới', $freshUser->name);
        $this->assertEquals('0912345678', $freshUser->phone);
        $this->assertEquals('Chuyên viên kỹ thuật', $freshUser->position);
        $this->assertEquals('Nam', $freshUser->gender);

        // Protected fields MUST NOT be modified
        $this->assertEquals('user', $freshUser->system_role);
        $this->assertEquals('active', $freshUser->account_status);
        $this->assertNull($freshUser->created_by);
    }

    public function test_admin_can_update_and_soft_delete_employee()
    {
        $admin = User::factory()->create([
            'system_role' => 'system_admin'
        ]);
        $employee = User::factory()->create([
            'name' => 'Cũ',
            'username' => 'empcu',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);
        $token = $admin->createToken('auth')->plainTextToken;

        // Admin updates employee
        $updateRes = $this->withHeaders(['Authorization' => "Bearer $token"])
                          ->putJson("/api/admin/employees/{$employee->id}", [
                              'name' => 'Tên Mới Admin Sửa',
                              'username' => 'empmoi',
                              'position' => 'Quản lý dự án',
                              'account_status' => 'active'
                          ]);
        $updateRes->assertStatus(200);
        $this->assertEquals('Tên Mới Admin Sửa', $employee->fresh()->name);
        $this->assertEquals('empmoi', $employee->fresh()->username);
        $this->assertEquals('Quản lý dự án', $employee->fresh()->position);

        // Admin soft deletes employee
        $deleteRes = $this->withHeaders(['Authorization' => "Bearer $token"])
                          ->deleteJson("/api/admin/employees/{$employee->id}");
        $deleteRes->assertStatus(200);

        // Exists in trash (soft deleted)
        $this->assertSoftDeleted('users', ['id' => $employee->id]);
    }
}
