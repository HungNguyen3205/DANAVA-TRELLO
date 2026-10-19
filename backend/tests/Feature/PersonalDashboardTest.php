<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class PersonalDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_user_cannot_access_dashboard()
    {
        $response = $this->getJson('/api/me/dashboard');
        $response->assertStatus(401);
    }

    public function test_user_can_access_dashboard_and_see_assigned_tasks()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        // Setup board and column directly (Board-first)
        $board = Board::create(['owner_id' => $user->id, 'name' => 'Board 1']);
        $board->members()->attach($user->id, ['role' => 'admin']);
        $column = KanbanColumn::create(['board_id' => $board->id, 'title' => 'To Do', 'order' => 1]);

        // Create tasks for user
        Task::create([
            'column_id' => $column->id,
            'assignee_id' => $user->id,
            'title' => 'Task 1',
            'order' => 1,
            'due_date' => Carbon::now()->addDays(2),
        ]);

        $response = $this->getJson('/api/me/dashboard');
        $response->assertStatus(200);
        $response->assertJsonStructure(['user', 'summary', 'focus_tasks', 'attention_items']);
        $this->assertCount(1, $response->json('focus_tasks'));

        $response2 = $this->getJson('/api/me/tasks');
        $response2->assertStatus(200);
    }

    public function test_user_cannot_see_tasks_from_unauthorized_boards()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $this->actingAs($user);

        // Board owned by other user, user is NOT a member
        $board = Board::create(['owner_id' => $otherUser->id, 'name' => 'Private Board']);
        $column = KanbanColumn::create(['board_id' => $board->id, 'title' => 'To Do', 'order' => 1]);

        // Assign task to user in a board they don't have access to
        Task::create([
            'column_id' => $column->id,
            'assignee_id' => $user->id,
            'title' => 'Task 1',
            'order' => 1,
        ]);

        $response = $this->getJson('/api/me/dashboard');
        $response->assertStatus(200);
        $this->assertCount(0, $response->json('focus_tasks')); // Should be 0 since no board access
    }

    public function test_board_member_workload_dashboard_and_double_counting_rule(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $this->actingAs($member);

        $board = Board::create(['owner_id' => $owner->id, 'name' => 'Sprint Board']);
        $board->members()->attach([
            $owner->id => ['role' => 'admin'],
            $member->id => ['role' => 'member'],
        ]);

        $col = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Active', 'order' => 1]);

        // Parent task with a child subtask
        $parentTask = Task::create([
            'column_id' => $col->id,
            'title' => 'Parent Feature',
            'assignee_id' => $member->id,
            'order' => 1,
            'estimated_points' => 5,
        ]);

        $subtask = Task::create([
            'column_id' => $col->id,
            'title' => 'Child Subtask A',
            'parent_task_id' => $parentTask->id,
            'assignee_id' => $member->id,
            'order' => 2,
            'estimated_points' => 3,
        ]);

        $response = $this->getJson("/api/boards/{$board->id}/dashboard/member-workload");
        $response->assertStatus(200);

        $members = $response->json('members');
        $memberData = collect($members)->firstWhere('id', $member->id);
        $this->assertNotNull($memberData);

        // Under double counting rule, parent task is excluded because it has subtasks
        $this->assertEquals(1, $memberData['assigned']);
        $this->assertCount(1, $memberData['tasks']);
        $this->assertEquals($subtask->id, $memberData['tasks'][0]['id']);
    }

    public function test_outsider_cannot_access_board_workload_dashboard(): void
    {
        $owner = User::factory()->create();
        $outsider = User::factory()->create();
        $this->actingAs($outsider);

        $board = Board::create(['owner_id' => $owner->id, 'name' => 'Secret Board']);
        $board->members()->attach($owner->id, ['role' => 'admin']);

        $response = $this->getJson("/api/boards/{$board->id}/dashboard/member-workload");
        $response->assertStatus(403);
    }
}
