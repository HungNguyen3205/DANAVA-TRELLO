<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Board;
use App\Models\Workspace;
use App\Models\KanbanColumn;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

class BoardFirstArchitectureTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_only_sees_boards_they_own_or_are_invited_to(): void
    {
        $userA = User::factory()->create(['system_role' => 'user']);
        $userB = User::factory()->create(['system_role' => 'user']);
        $userC = User::factory()->create(['system_role' => 'user']);

        // Board owned by userA
        $boardA = Board::create(['name' => 'Board A', 'owner_id' => $userA->id]);
        DB::table('board_members')->insert([
            'board_id' => $boardA->id,
            'user_id' => $userA->id,
            'role' => 'admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Board owned by userB, userA is invited as member
        $boardB = Board::create(['name' => 'Board B', 'owner_id' => $userB->id]);
        DB::table('board_members')->insert([
            ['board_id' => $boardB->id, 'user_id' => $userB->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $boardB->id, 'user_id' => $userA->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Board owned by userC, userA has no access
        $boardC = Board::create(['name' => 'Board C', 'owner_id' => $userC->id]);
        DB::table('board_members')->insert([
            ['board_id' => $boardC->id, 'user_id' => $userC->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // User A fetches boards
        $this->actingAs($userA);
        $res = $this->getJson('/api/boards')->assertStatus(200);

        $boardIds = collect($res->json())->pluck('id')->all();
        $this->assertContains($boardA->id, $boardIds);
        $this->assertContains($boardB->id, $boardIds);
        $this->assertNotContains($boardC->id, $boardIds);
    }

    public function test_two_accounts_do_not_share_board_just_because_of_same_workspace(): void
    {
        $userA = User::factory()->create(['system_role' => 'user']);
        $userB = User::factory()->create(['system_role' => 'user']);

        // A legacy workspace containing both users
        $ws = Workspace::create(['name' => 'Shared WS', 'owner_id' => $userA->id]);
        DB::table('workspace_members')->insert([
            ['workspace_id' => $ws->id, 'user_id' => $userA->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['workspace_id' => $ws->id, 'user_id' => $userB->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Private Board in that workspace owned by userA only
        $privateBoard = Board::create([
            'name' => 'User A Private Board',
            'owner_id' => $userA->id,
            'workspace_id' => $ws->id,
        ]);
        DB::table('board_members')->insert([
            ['board_id' => $privateBoard->id, 'user_id' => $userA->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // User B should NOT see User A's private board despite being in the same workspace
        $this->actingAs($userB);
        $res = $this->getJson('/api/boards')->assertStatus(200);
        $boardIds = collect($res->json())->pluck('id')->all();
        $this->assertNotContains($privateBoard->id, $boardIds);

        // User B should be forbidden (403) when attempting to view it
        $this->getJson("/api/boards/{$privateBoard->id}")->assertStatus(403);
    }

    public function test_create_board_does_not_create_workspace(): void
    {
        $user = User::factory()->create(['system_role' => 'user']);
        $this->actingAs($user);

        $initialWorkspaceCount = DB::table('workspaces')->count();
        $initialWsMembersCount = DB::table('workspace_members')->count();

        $res = $this->postJson('/api/boards', [
            'name' => 'Direct Board-First Board',
            'color' => 'bg-gradient-to-br from-purple-500 to-indigo-600',
        ])->assertStatus(201);

        $boardId = $res->json('id');
        $this->assertNotNull($boardId);

        // No new workspace created
        $this->assertEquals($initialWorkspaceCount, DB::table('workspaces')->count());
        $this->assertEquals($initialWsMembersCount, DB::table('workspace_members')->count());

        // Board has owner_id set to user and workspace_id is null
        $board = Board::find($boardId);
        $this->assertEquals($user->id, $board->owner_id);
        $this->assertNull($board->workspace_id);

        // User is added as admin in board_members
        $this->assertTrue(DB::table('board_members')->where([
            'board_id' => $boardId,
            'user_id' => $user->id,
            'role' => 'admin',
        ])->exists());

        // 4 standard default columns created
        $this->assertEquals(4, KanbanColumn::where('board_id', $boardId)->count());
    }

    public function test_adding_member_to_board_does_not_create_workspace_members(): void
    {
        $owner = User::factory()->create(['system_role' => 'user']);
        $newMember = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);

        $board = Board::create(['name' => 'Board', 'owner_id' => $owner->id]);
        DB::table('board_members')->insert([
            ['board_id' => $board->id, 'user_id' => $owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $initialWsMembersCount = DB::table('workspace_members')->count();

        $this->actingAs($owner);
        $this->postJson("/api/boards/{$board->id}/members", [
            'user_id' => $newMember->id,
            'role' => 'member',
        ])->assertStatus(201);

        // Member added to board
        $this->assertTrue(DB::table('board_members')->where([
            'board_id' => $board->id,
            'user_id' => $newMember->id,
            'role' => 'member',
        ])->exists());

        // Workspace members table untouched
        $this->assertEquals($initialWsMembersCount, DB::table('workspace_members')->count());
    }

    public function test_removing_member_revokes_access_to_board(): void
    {
        $owner = User::factory()->create(['system_role' => 'user']);
        $member = User::factory()->create(['system_role' => 'user']);

        $board = Board::create(['name' => 'Board', 'owner_id' => $owner->id]);
        DB::table('board_members')->insert([
            ['board_id' => $board->id, 'user_id' => $owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $board->id, 'user_id' => $member->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Member can view before removal
        $this->actingAs($member);
        $this->getJson("/api/boards/{$board->id}")->assertStatus(200);

        // Admin removes member
        $this->actingAs($owner);
        $this->deleteJson("/api/boards/{$board->id}/members/{$member->id}")->assertStatus(200);

        // Member is now forbidden
        $this->actingAs($member);
        $this->getJson("/api/boards/{$board->id}")->assertStatus(403);
    }

    public function test_my_tasks_only_returns_tasks_from_permitted_boards(): void
    {
        $user = User::factory()->create(['system_role' => 'user']);
        $otherUser = User::factory()->create(['system_role' => 'user']);

        // Permitted Board
        $allowedBoard = Board::create(['name' => 'Allowed Board', 'owner_id' => $user->id]);
        DB::table('board_members')->insert([
            ['board_id' => $allowedBoard->id, 'user_id' => $user->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);
        $colA = KanbanColumn::create(['board_id' => $allowedBoard->id, 'title' => 'In Progress', 'order' => 1000]);
        $taskA = Task::create(['column_id' => $colA->id, 'title' => 'Allowed Task', 'assignee_id' => $user->id, 'order' => 1000]);

        // Forbidden Board
        $forbiddenBoard = Board::create(['name' => 'Forbidden Board', 'owner_id' => $otherUser->id]);
        DB::table('board_members')->insert([
            ['board_id' => $forbiddenBoard->id, 'user_id' => $otherUser->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);
        $colB = KanbanColumn::create(['board_id' => $forbiddenBoard->id, 'title' => 'In Progress', 'order' => 1000]);
        $taskB = Task::create(['column_id' => $colB->id, 'title' => 'Forbidden Task', 'assignee_id' => $user->id, 'order' => 1000]);

        $this->actingAs($user);
        $res = $this->getJson('/api/me/tasks')->assertStatus(200);

        $taskIds = collect($res->json('data'))->pluck('id')->all();
        $this->assertContains($taskA->id, $taskIds);
        $this->assertNotContains($taskB->id, $taskIds);
    }

    public function test_old_boards_with_workspace_id_remain_accessible(): void
    {
        $user = User::factory()->create(['system_role' => 'user']);
        $ws = Workspace::create(['name' => 'Old WS', 'owner_id' => $user->id]);

        $oldBoard = Board::create([
            'name' => 'Old Workspace Board',
            'owner_id' => $user->id,
            'workspace_id' => $ws->id,
        ]);
        DB::table('board_members')->insert([
            ['board_id' => $oldBoard->id, 'user_id' => $user->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->actingAs($user);
        $this->getJson("/api/boards/{$oldBoard->id}")->assertStatus(200)->assertJsonFragment([
            'name' => 'Old Workspace Board',
        ]);
    }

    public function test_search_never_returns_boards_or_tasks_user_is_not_in(): void
    {
        $user = User::factory()->create(['system_role' => 'user']);
        $stranger = User::factory()->create(['system_role' => 'user']);

        // User's board & task
        $myBoard = Board::create(['name' => 'Secret Project Alpha', 'owner_id' => $user->id]);
        DB::table('board_members')->insert([
            ['board_id' => $myBoard->id, 'user_id' => $user->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);
        $col1 = KanbanColumn::create(['board_id' => $myBoard->id, 'title' => 'Todo', 'order' => 1000]);
        $myTask = Task::create(['column_id' => $col1->id, 'title' => 'Project Alpha Blueprint', 'order' => 1000]);

        // Stranger's board & task with identical keyword
        $strangerBoard = Board::create(['name' => 'Secret Project Alpha Foreign', 'owner_id' => $stranger->id]);
        DB::table('board_members')->insert([
            ['board_id' => $strangerBoard->id, 'user_id' => $stranger->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ]);
        $col2 = KanbanColumn::create(['board_id' => $strangerBoard->id, 'title' => 'Todo', 'order' => 1000]);
        $strangerTask = Task::create(['column_id' => $col2->id, 'title' => 'Project Alpha Foreign Task', 'order' => 1000]);

        $this->actingAs($user);
        $res = $this->getJson('/api/search?q=Alpha')->assertStatus(200);

        $returnedBoardIds = collect($res->json('boards'))->pluck('id')->all();
        $this->assertContains($myBoard->id, $returnedBoardIds);
        $this->assertNotContains($strangerBoard->id, $returnedBoardIds);

        $returnedTaskIds = collect($res->json('tasks'))->pluck('id')->all();
        $this->assertContains($myTask->id, $returnedTaskIds);
        $this->assertNotContains($strangerTask->id, $returnedTaskIds);
    }
}
