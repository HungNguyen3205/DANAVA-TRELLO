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

        // Setup a workspace, board, column
        $workspace = Workspace::create(['name' => 'Test WS', 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'admin']);

        $board = Board::create(['workspace_id' => $workspace->id, 'name' => 'Board 1']);
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
        // Dump for seeing the real JSON
        echo "\n\n--- REAL DASHBOARD JSON ---\n";
        echo json_encode($response->json(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        echo "\n---------------------------\n\n";

        $response->assertStatus(200);
        $response->assertJsonStructure(['user', 'summary', 'focus_tasks', 'attention_items']);
        $this->assertCount(1, $response->json('focus_tasks'));

        $response2 = $this->getJson('/api/me/tasks');
        $response2->assertStatus(200);
    }

    public function test_user_cannot_see_tasks_from_revoked_workspaces()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $workspace = Workspace::create(['name' => 'Revoked WS', 'owner_id' => $user->id]);
        // Note: Not attached as member!

        $board = Board::create(['workspace_id' => $workspace->id, 'name' => 'Board 1']);
        $column = KanbanColumn::create(['board_id' => $board->id, 'title' => 'To Do', 'order' => 1]);

        // Assign task to user in a workspace they don't have access to
        Task::create([
            'column_id' => $column->id,
            'assignee_id' => $user->id,
            'title' => 'Task 1',
            'order' => 1,
        ]);

        $response = $this->getJson('/api/me/dashboard');
        $response->assertStatus(200);
        $this->assertCount(0, $response->json('focus_tasks')); // Should be 0 since no workspace access
    }
}
