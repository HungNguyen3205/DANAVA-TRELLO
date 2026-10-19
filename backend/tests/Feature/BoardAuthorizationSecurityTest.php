<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BoardAuthorizationSecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $member;
    private User $outsider;
    private User $systemAdmin;
    private Board $boardA;
    private Board $boardB;
    private KanbanColumn $colA1;
    private KanbanColumn $colA2;
    private KanbanColumn $colB1;
    private Task $taskA;
    private Task $taskB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Owner', 'system_role' => 'user']);
        $this->member = User::factory()->create(['name' => 'Member', 'system_role' => 'user']);
        $this->outsider = User::factory()->create(['name' => 'Outsider', 'system_role' => 'user']);
        $this->systemAdmin = User::factory()->create(['name' => 'SysAdmin', 'system_role' => 'admin']);

        $ws = Workspace::create(['name' => 'Test WS', 'owner_id' => $this->owner->id]);

        // Board A
        $this->boardA = Board::create(['name' => 'Board A', 'workspace_id' => $ws->id]);
        DB::table('board_members')->insert([
            ['board_id' => $this->boardA->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->boardA->id, 'user_id' => $this->member->id, 'role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->colA1 = KanbanColumn::create(['board_id' => $this->boardA->id, 'title' => 'Col A1', 'order' => 1000]);
        $this->colA2 = KanbanColumn::create(['board_id' => $this->boardA->id, 'title' => 'Col A2', 'order' => 2000]);
        $this->taskA = Task::create(['column_id' => $this->colA1->id, 'title' => 'Task A1', 'order' => 1000]);

        // Board B (Outsider's Board)
        $this->boardB = Board::create(['name' => 'Board B', 'workspace_id' => $ws->id]);
        DB::table('board_members')->insert([
            ['board_id' => $this->boardB->id, 'user_id' => $this->outsider->id, 'role' => 'admin', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
        $this->colB1 = KanbanColumn::create(['board_id' => $this->boardB->id, 'title' => 'Col B1', 'order' => 1000]);
        $this->taskB = Task::create(['column_id' => $this->colB1->id, 'title' => 'Task B1', 'order' => 1000]);
    }

    public function test_outsider_cannot_view_or_modify_board_data(): void
    {
        $this->actingAs($this->outsider);

        // Cannot view kanban
        $this->getJson("/api/boards/{$this->boardA->id}/kanban")->assertStatus(403);

        // Cannot store column
        $this->postJson("/api/boards/{$this->boardA->id}/columns", ['title' => 'Hacked Col'])->assertStatus(403);

        // Cannot update column
        $this->putJson("/api/columns/{$this->colA1->id}", ['title' => 'Renamed'])->assertStatus(403);

        // Cannot delete column
        $this->deleteJson("/api/columns/{$this->colA1->id}")->assertStatus(403);

        // Cannot store task in column
        $this->postJson("/api/columns/{$this->colA1->id}/tasks", ['title' => 'Hacked Task'])->assertStatus(403);

        // Cannot view task detail
        $this->getJson("/api/tasks/{$this->taskA->id}")->assertStatus(403);

        // Cannot update task
        $this->putJson("/api/tasks/{$this->taskA->id}", ['title' => 'Renamed Task'])->assertStatus(403);

        // Cannot delete task
        $this->deleteJson("/api/tasks/{$this->taskA->id}")->assertStatus(403);

        // Cannot view board members
        $this->getJson("/api/boards/{$this->boardA->id}/members")->assertStatus(403);

        // Cannot reorder columns
        $this->putJson("/api/boards/{$this->boardA->id}/columns/reorder", [
            'columns' => [['id' => $this->colA1->id, 'order' => 5000]]
        ])->assertStatus(403);

        // Cannot reorder tasks
        $this->putJson("/api/boards/{$this->boardA->id}/tasks/reorder", [
            'tasks' => [['id' => $this->taskA->id, 'column_id' => $this->colA1->id, 'order' => 5000]]
        ])->assertStatus(403);
    }

    public function test_member_cannot_delete_column(): void
    {
        // Regular member is forbidden
        $this->actingAs($this->member);
        $this->deleteJson("/api/columns/{$this->colA1->id}")->assertStatus(403);

        // Admin is allowed with explicit action when column has tasks
        $this->actingAs($this->owner);
        $this->deleteJson("/api/columns/{$this->colA1->id}", ['action' => 'delete_all'])->assertStatus(200);
        $this->assertSoftDeleted('kanban_columns', ['id' => $this->colA1->id]);
    }

    public function test_cannot_move_task_to_different_board(): void
    {
        // Member of Board A tries to move Task A to Column of Board B
        $this->actingAs($this->owner);

        $response = $this->putJson("/api/tasks/{$this->taskA->id}/move", [
            'column_id' => $this->colB1->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['column_id']);

        // Verify task is still in Board A's column
        $this->assertEquals($this->colA1->id, $this->taskA->fresh()->column_id);
    }

    public function test_cannot_reorder_tasks_from_another_board(): void
    {
        $this->actingAs($this->owner);

        // Reordering in Board A but including taskB from Board B
        $response = $this->putJson("/api/boards/{$this->boardA->id}/tasks/reorder", [
            'tasks' => [
                ['id' => $this->taskA->id, 'column_id' => $this->colA2->id, 'order' => 100],
                ['id' => $this->taskB->id, 'column_id' => $this->colA2->id, 'order' => 200],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['tasks']);
    }

    public function test_cannot_reorder_tasks_to_column_of_another_board(): void
    {
        $this->actingAs($this->owner);

        // Reordering taskA into colB1
        $response = $this->putJson("/api/boards/{$this->boardA->id}/tasks/reorder", [
            'tasks' => [
                ['id' => $this->taskA->id, 'column_id' => $this->colB1->id, 'order' => 100],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['column_id']);
    }

    public function test_cannot_reorder_columns_with_foreign_column_id(): void
    {
        $this->actingAs($this->owner);

        // Including colB1 in Board A reorder
        $response = $this->putJson("/api/boards/{$this->boardA->id}/columns/reorder", [
            'columns' => [
                ['id' => $this->colA1->id, 'order' => 2000],
                ['id' => $this->colB1->id, 'order' => 1000],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['columns']);
    }

    public function test_move_task_prev_and_next_id_must_belong_to_destination_column(): void
    {
        $this->actingAs($this->owner);

        $taskA2 = Task::create(['column_id' => $this->colA1->id, 'title' => 'Task A2', 'order' => 2000]);

        // Trying to move taskA to colA2, but referencing prev_id from colA1
        $response = $this->putJson("/api/tasks/{$this->taskA->id}/move", [
            'column_id' => $this->colA2->id,
            'prev_id' => $taskA2->id, // Belongs to colA1, not colA2!
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['prev_id']);
    }

    public function test_update_task_cannot_change_column_to_another_board(): void
    {
        $this->actingAs($this->owner);

        // Updating taskA with column_id = colB1
        $response = $this->putJson("/api/tasks/{$this->taskA->id}", [
            'column_id' => $this->colB1->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['column_id']);
    }

    public function test_cannot_assign_user_outside_of_board(): void
    {
        $this->actingAs($this->owner);

        // Assigning outsider to taskA
        $response = $this->putJson("/api/tasks/{$this->taskA->id}", [
            'assignee_ids' => [$this->outsider->id],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['assignee_ids']);
    }

    public function test_regular_member_cannot_change_member_roles(): void
    {
        $this->actingAs($this->member);

        // Member tries to promote themselves to admin
        $response = $this->patchJson("/api/boards/{$this->boardA->id}/members/{$this->member->id}", [
            'role' => 'admin',
        ]);

        $response->assertStatus(403);

        // Admin can promote member
        $this->actingAs($this->owner);
        $response2 = $this->patchJson("/api/boards/{$this->boardA->id}/members/{$this->member->id}", [
            'role' => 'admin',
        ]);
        $response2->assertStatus(200);
    }

    public function test_system_admin_cannot_access_board_without_membership(): void
    {
        $this->actingAs($this->systemAdmin);

        // System Admin has no membership in Board A
        $this->getJson("/api/boards/{$this->boardA->id}/kanban")->assertStatus(403);
        $this->getJson("/api/boards/{$this->boardA->id}/members")->assertStatus(403);
        $this->postJson("/api/boards/{$this->boardA->id}/members", ['user_id' => $this->systemAdmin->id, 'role' => 'admin'])->assertStatus(403);
        $this->putJson("/api/tasks/{$this->taskA->id}/move", ['column_id' => $this->colA2->id])->assertStatus(403);
    }

    public function test_cannot_remove_or_demote_the_last_admin(): void
    {
        $this->actingAs($this->owner);

        // Only owner is admin on boardA. Try demoting owner:
        $response = $this->patchJson("/api/boards/{$this->boardA->id}/members/{$this->owner->id}", [
            'role' => 'member',
        ]);
        $response->assertStatus(422);

        // Try removing owner from boardA:
        $response2 = $this->deleteJson("/api/boards/{$this->boardA->id}/members/{$this->owner->id}");
        $response2->assertStatus(422);
    }

    public function test_checklist_and_attachment_and_labels_authorized(): void
    {
        $this->actingAs($this->outsider);

        // Outsider cannot add checklist to taskA
        $this->postJson("/api/tasks/{$this->taskA->id}/checklists", ['title' => 'Checklist 1'])->assertStatus(403);

        // Member of board can add checklist
        $this->actingAs($this->member);
        $res = $this->postJson("/api/tasks/{$this->taskA->id}/checklists", ['title' => 'Checklist 1']);
        $res->assertStatus(201);
        $checklistId = $res->json('id');

        // Outsider cannot delete checklist
        $this->actingAs($this->outsider);
        $this->deleteJson("/api/checklists/{$checklistId}")->assertStatus(403);

        // Syncing labels with foreign label from Board B is rejected with 422
        $labelB = $this->boardB->labels()->create(['name' => 'Foreign Label', 'color' => 'red']);
        $this->actingAs($this->owner);
        $this->postJson("/api/tasks/{$this->taskA->id}/labels", [
            'label_ids' => [$labelB->id],
        ])->assertStatus(422);
    }
}
