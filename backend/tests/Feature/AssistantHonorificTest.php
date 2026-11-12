<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssistantHonorificTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['assistant.mode' => 'demo', 'assistant.gemini.api_key' => null]);
    }

    private function ask(User $user, string $message): string
    {
        return $this->actingAs($user)->postJson('/api/assistant/chat', ['message' => $message])->assertOk()->json('reply.content');
    }

    public function test_people_are_addressed_by_gender(): void
    {
        $man = User::factory()->create(['name' => 'Nguyễn Nam Hùng', 'gender' => 'Nam', 'account_status' => 'active']);
        $woman = User::factory()->create(['name' => 'Trần Thị Lan', 'gender' => 'Nữ', 'account_status' => 'active']);
        $unknown = User::factory()->create(['name' => 'Lê Minh', 'gender' => null, 'account_status' => 'active']);

        $this->assertStringContainsString('Em chào anh **Hùng**', $reply = $this->ask($man, 'xin chào'));
        $this->assertStringContainsString('Anh cứ hỏi em', $reply);
        $this->assertStringContainsString('Em chào chị **Lan**', $this->ask($woman, 'xin chào'));
        $this->assertStringContainsString('Em chào anh/chị **Minh**', $this->ask($unknown, 'xin chào'));
    }

    public function test_renaming_yourself_is_answered_from_the_guide(): void
    {
        $user = User::factory()->create(['name' => 'Nguyễn Nam', 'gender' => 'Nam', 'account_status' => 'active']);

        $reply = $this->ask($user, 'Đổi tên thành Nguyễn Nam Hùng cho tôi nhé');
        $this->assertStringContainsString('Hồ sơ cá nhân', $reply);
    }

    public function test_new_accounts_need_name_department_and_gender(): void
    {
        $admin = User::factory()->create(['system_role' => 'system_admin', 'account_status' => 'active']);

        $this->actingAs($admin)->postJson('/api/admin/employees', [
            'username' => 'thieuthongtin',
            'password' => 'Password@123',
        ])->assertStatus(422)->assertJsonValidationErrors(['name', 'gender', 'department_id']);

        $dept = Department::create(['name' => 'Phòng Kinh doanh', 'code' => 'KD', 'status' => 'active', 'created_by' => $admin->id]);
        $this->actingAs($admin)->postJson('/api/admin/employees', [
            'name' => 'Phạm Thu Hà',
            'username' => 'hapt',
            'password' => 'Password@123',
            'gender' => 'Nữ',
            'department_id' => $dept->id,
        ])->assertCreated();
        $this->assertDatabaseHas('users', ['username' => 'hapt', 'gender' => 'Nữ', 'department_id' => $dept->id]);
    }
}
