<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\BoardMemberAddedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BoardMemberTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $adminMember;
    private User $regularMember;
    private User $outsider;
    private Board $board;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'name' => 'Board Owner',
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->adminMember = User::factory()->create([
            'name' => 'Admin Member',
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->regularMember = User::factory()->create([
            'name' => 'Regular Member',
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->outsider = User::factory()->create([
            'name' => 'Outsider User',
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        // Board-first board: No workspace
        $this->board = Board::create([
            'name' => 'Engineering Kanban',
            'owner_id' => $this->owner->id,
            'workspace_id' => null,
            'visibility' => 'private',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->adminMember->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->regularMember->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function test_board_members_can_list_members_on_board_first_board(): void
    {
        $this->actingAs($this->regularMember);

        $response = $this->getJson("/api/boards/{$this->board->id}/members");

        $response->assertStatus(200);
        $members = $response->json();
        $this->assertCount(3, $members);

        $memberIds = collect($members)->pluck('id')->all();
        $this->assertContains($this->owner->id, $memberIds);
        $this->assertContains($this->adminMember->id, $memberIds);
        $this->assertContains($this->regularMember->id, $memberIds);
    }

    public function test_outsider_cannot_list_board_members(): void
    {
        $this->actingAs($this->outsider);

        $response = $this->getJson("/api/boards/{$this->board->id}/members");

        $response->assertStatus(403);
    }

    public function test_admin_can_add_member_to_board_without_workspace(): void
    {
        Notification::fake();

        $initialWorkspaceCount = DB::table('workspaces')->count();
        $newCandidate = User::factory()->create([
            'name' => 'New Contributor',
            'account_status' => 'active',
        ]);

        $this->actingAs($this->adminMember);

        $response = $this->postJson("/api/boards/{$this->board->id}/members", [
            'user_id' => $newCandidate->id,
            'role' => 'member',
        ]);

        $response->assertStatus(201)
            ->assertJson(['message' => 'Đã thêm thành viên vào bảng thành công']);

        $this->assertTrue(DB::table('board_members')->where([
            'board_id' => $this->board->id,
            'user_id' => $newCandidate->id,
            'role' => 'member',
        ])->exists());

        // Verify Board-first invariant: Workspaces untouched
        $this->assertEquals($initialWorkspaceCount, DB::table('workspaces')->count());

        // Verify Activity Log
        $this->assertTrue(ActivityLog::where([
            'board_id' => $this->board->id,
            'user_id' => $this->adminMember->id,
            'action' => 'add_board_member',
        ])->exists());

        // Verify Notification sent to added member
        Notification::assertSentTo($newCandidate, BoardMemberAddedNotification::class);
    }

    public function test_regular_member_cannot_add_members(): void
    {
        $newCandidate = User::factory()->create(['account_status' => 'active']);

        $this->actingAs($this->regularMember);

        $response = $this->postJson("/api/boards/{$this->board->id}/members", [
            'user_id' => $newCandidate->id,
            'role' => 'member',
        ]);

        $response->assertStatus(403);
    }

    public function test_cannot_add_inactive_or_suspended_user(): void
    {
        $inactiveUser = User::factory()->create([
            'name' => 'Suspended Contributor',
            'account_status' => 'inactive',
        ]);

        $this->actingAs($this->owner);

        $response = $this->postJson("/api/boards/{$this->board->id}/members", [
            'user_id' => $inactiveUser->id,
            'role' => 'member',
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'Tài khoản này đang bị khóa hoặc không hoạt động.']);
    }

    public function test_admin_can_update_member_role(): void
    {
        $this->actingAs($this->owner);

        $response = $this->patchJson("/api/boards/{$this->board->id}/members/{$this->regularMember->id}", [
            'role' => 'admin',
        ]);

        $response->assertStatus(200);

        $role = DB::table('board_members')
            ->where('board_id', $this->board->id)
            ->where('user_id', $this->regularMember->id)
            ->value('role');

        $this->assertEquals('admin', $role);
    }

    public function test_cannot_demote_the_last_admin_of_board(): void
    {
        // First remove $this->adminMember so $this->owner is the only admin
        DB::table('board_members')
            ->where('board_id', $this->board->id)
            ->where('user_id', $this->adminMember->id)
            ->delete();

        $this->actingAs($this->owner);

        // Attempt to demote the sole remaining admin
        $response = $this->patchJson("/api/boards/{$this->board->id}/members/{$this->owner->id}", [
            'role' => 'member',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['role']);
    }

    public function test_admin_can_remove_another_member(): void
    {
        $this->actingAs($this->adminMember);

        $response = $this->deleteJson("/api/boards/{$this->board->id}/members/{$this->regularMember->id}");

        $response->assertStatus(200)
            ->assertJson(['message' => 'Đã gỡ thành viên khỏi bảng']);

        $this->assertFalse(DB::table('board_members')
            ->where('board_id', $this->board->id)
            ->where('user_id', $this->regularMember->id)
            ->exists());
    }

    public function test_regular_member_cannot_remove_another_member(): void
    {
        $this->actingAs($this->regularMember);

        $response = $this->deleteJson("/api/boards/{$this->board->id}/members/{$this->adminMember->id}");

        $response->assertStatus(403);
    }

    public function test_regular_member_can_remove_self_to_leave_board(): void
    {
        $this->actingAs($this->regularMember);

        // Member removes their own membership (self-leave)
        $response = $this->deleteJson("/api/boards/{$this->board->id}/members/{$this->regularMember->id}");

        $response->assertStatus(200);

        $this->assertFalse(DB::table('board_members')
            ->where('board_id', $this->board->id)
            ->where('user_id', $this->regularMember->id)
            ->exists());
    }

    public function test_cannot_remove_the_last_admin_from_board(): void
    {
        // Delete adminMember so owner is the only admin left
        DB::table('board_members')
            ->where('board_id', $this->board->id)
            ->where('user_id', $this->adminMember->id)
            ->delete();

        $this->actingAs($this->owner);

        // Sole admin attempts to leave/delete self
        $response = $this->deleteJson("/api/boards/{$this->board->id}/members/{$this->owner->id}");

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user_id']);
    }

    public function test_board_member_routes_support_workspace_prefixed_urls(): void
    {
        $ws = Workspace::create(['name' => 'Legacy Workspace', 'owner_id' => $this->owner->id]);
        $wsBoard = Board::create([
            'name' => 'Workspace Board',
            'owner_id' => $this->owner->id,
            'workspace_id' => $ws->id,
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $wsBoard->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $wsBoard->id, 'user_id' => $this->regularMember->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->actingAs($this->regularMember);

        $response = $this->getJson("/api/workspaces/{$ws->id}/boards/{$wsBoard->id}/members");
        $response->assertStatus(200);
        $this->assertCount(2, $response->json());
    }
}
