<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeRecreateAfterDeleteTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $admin = User::factory()->create(['system_role' => 'system_admin']);

        return $admin->createToken('auth')->plainTextToken;
    }

    public function test_deleted_employee_username_and_email_can_be_reused()
    {
        $token = $this->adminToken();

        $this->withToken($token)->postJson('/api/admin/employees', [
            'name' => 'Trần Danh Đại',
            'username' => 'daitd',
            'email' => 'daitd@danava.vn',
            'password' => 'Password@123',
        ])->assertStatus(201);

        $old = User::where('username', 'daitd')->firstOrFail();

        $this->withToken($token)->deleteJson("/api/admin/employees/{$old->id}")->assertOk();

        $this->withToken($token)->postJson('/api/admin/employees', [
            'name' => 'Trần Danh Đại',
            'username' => 'daitd',
            'email' => 'daitd@danava.vn',
            'password' => 'Password@123',
        ])->assertStatus(201);

        $this->assertSame(1, User::where('username', 'daitd')->count());
        $this->assertSoftDeleted('users', ['id' => $old->id, 'username' => 'daitd__deleted_' . $old->id]);
    }

    public function test_username_held_by_user_deleted_before_the_fix_is_released()
    {
        $token = $this->adminToken();

        // Simulates accounts deleted before this fix: still holding the original username
        $legacy = User::factory()->create(['username' => 'daitd', 'email' => 'daitd@danava.vn']);
        $legacy->delete();

        $this->withToken($token)->postJson('/api/admin/employees', [
            'name' => 'Trần Danh Đại',
            'username' => 'daitd',
            'email' => 'daitd@danava.vn',
            'password' => 'Password@123',
        ])->assertStatus(201);

        $this->assertSoftDeleted('users', ['id' => $legacy->id, 'username' => 'daitd__deleted_' . $legacy->id]);
    }

    public function test_active_username_is_still_rejected()
    {
        $token = $this->adminToken();
        User::factory()->create(['username' => 'daitd']);

        $this->withToken($token)->postJson('/api/admin/employees', [
            'name' => 'Someone',
            'username' => 'daitd',
            'password' => 'Password@123',
        ])->assertStatus(422);
    }
}
