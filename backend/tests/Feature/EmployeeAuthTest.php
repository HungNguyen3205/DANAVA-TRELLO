<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class EmployeeAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_email()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'test@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['access_token']);
    }

    public function test_user_can_login_with_username()
    {
        $user = User::factory()->create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'testuser',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)->assertJsonStructure(['access_token']);
    }

    public function test_locked_user_cannot_login()
    {
        $user = User::factory()->create([
            'username' => 'lockeduser',
            'password' => Hash::make('password123'),
            'account_status' => 'locked'
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'lockeduser',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_public_registration_blocked_if_admin_exists()
    {
        User::factory()->create(['system_role' => 'system_admin']);

        $response = $this->postJson('/api/register', [
            'name' => 'Test',
            'email' => 'test@test.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
    }

    public function test_force_change_password_blocks_access()
    {
        $user = User::factory()->create(['must_change_password' => true]);
        $token = $user->createToken('auth')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer $token"])
                         ->getJson('/api/workspaces');

        $response->assertStatus(403)->assertJson(['code' => 'MUST_CHANGE_PASSWORD']);
    }
}
