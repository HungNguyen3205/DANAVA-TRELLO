<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BoardShareAndSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $regularMember;
    protected User $outsider;
    protected User $newUser;
    protected Board $board;
    protected KanbanColumn $column;
    protected Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->regularMember = User::factory()->create([
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->outsider = User::factory()->create([
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->newUser = User::factory()->create([
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        // Create board with public_id
        $this->board = Board::create([
            'name' => 'Project Danava Share',
            'owner_id' => $this->owner->id,
            'visibility' => 'private',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->regularMember->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->column = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'To Do',
            'order' => 1000,
        ]);

        $this->task = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Task for Share Test',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
    }

    /**
     * Test: Link Board mở đúng Board cho thành viên
     */
    public function test_board_link_opens_correct_board_for_members(): void
    {
        $this->actingAs($this->regularMember)
            ->getJson("/api/boards/by-code/{$this->board->public_id}")
            ->assertStatus(200)
            ->assertJson([
                'id' => $this->board->id,
                'public_id' => $this->board->public_id,
                'name' => 'Project Danava Share',
            ]);
    }

    /**
     * Test: Link Task mở đúng task cho thành viên
     */
    public function test_task_link_resolves_task_for_members(): void
    {
        $this->actingAs($this->regularMember)
            ->getJson("/api/tasks/{$this->task->id}")
            ->assertStatus(200)
            ->assertJson([
                'id' => $this->task->id,
                'title' => 'Task for Share Test',
            ]);
    }

    /**
     * Test: Người ngoài Board không truy cập được Board hoặc Task qua link (403)
     */
    public function test_outsider_cannot_access_board_or_task(): void
    {
        // Outsider accesses board link
        $this->actingAs($this->outsider)
            ->getJson("/api/boards/by-code/{$this->board->public_id}")
            ->assertStatus(403)
            ->assertJson([
                'message' => 'Bạn không phải là thành viên của bảng này',
            ]);

        // Outsider accesses task link
        $this->actingAs($this->outsider)
            ->getJson("/api/tasks/{$this->task->id}")
            ->assertStatus(403);
    }

    /**
     * Test: Member không thêm được người vào Board (403)
     */
    public function test_regular_member_cannot_add_members_to_board(): void
    {
        $this->actingAs($this->regularMember)
            ->postJson("/api/boards/{$this->board->id}/members", [
                'user_id' => $this->newUser->id,
                'role' => 'member',
            ])
            ->assertStatus(403);

        $this->assertDatabaseMissing('board_members', [
            'board_id' => $this->board->id,
            'user_id' => $this->newUser->id,
        ]);
    }

    /**
     * Test: Owner thêm người, notification và activity log được tạo, người mới truy cập được qua link
     */
    public function test_owner_adds_member_creates_notification_and_activity_log(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/members", [
                'user_id' => $this->newUser->id,
                'role' => 'member',
            ]);

        $response->assertStatus(201);

        // Verify member in board_members
        $this->assertDatabaseHas('board_members', [
            'board_id' => $this->board->id,
            'user_id' => $this->newUser->id,
            'role' => 'member',
        ]);

        // Verify notification was created for $this->newUser
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $this->newUser->id,
            'type' => 'App\Notifications\BoardMemberAddedNotification',
        ]);

        // Verify Activity Log was created
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'user_id' => $this->owner->id,
            'action' => 'add_board_member',
        ]);

        // Now newly added user can access the board link
        $this->actingAs($this->newUser)
            ->getJson("/api/boards/by-code/{$this->board->public_id}")
            ->assertStatus(200)
            ->assertJson([
                'id' => $this->board->id,
                'public_id' => $this->board->public_id,
            ]);

        // And newly added user can access task link
        $this->actingAs($this->newUser)
            ->getJson("/api/tasks/{$this->task->id}")
            ->assertStatus(200);
    }
}
