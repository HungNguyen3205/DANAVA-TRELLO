<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WipLimitManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $member;
    protected User $outsider;
    protected Board $board;
    protected KanbanColumn $columnA;
    protected KanbanColumn $columnB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Board Owner']);
        $this->member = User::factory()->create(['name' => 'Regular Member']);
        $this->outsider = User::factory()->create(['name' => 'Outsider']);

        $workspace = Workspace::create([
            'name' => 'WIP Test Workspace',
            'owner_id' => $this->owner->id,
        ]);

        $this->board = Board::create([
            'workspace_id' => $workspace->id,
            'owner_id' => $this->owner->id,
            'name' => 'WIP Test Board',
            'public_id' => 'WIP-TEST',
        ]);

        $this->board->members()->attach($this->owner->id, ['role' => 'owner']);
        $this->board->members()->attach($this->member->id, ['role' => 'member']);

        $this->columnA = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'To Do',
            'order' => 1000,
            'wip_limit' => null,
            'wip_enforcement' => 'warning',
        ]);

        $this->columnB = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'In Progress',
            'order' => 2000,
            'wip_limit' => 2,
            'wip_enforcement' => 'strict',
        ]);
    }

    public function test_owner_or_admin_can_configure_wip_limit_and_enforcement(): void
    {
        $response = $this->actingAs($this->owner, 'sanctum')
            ->putJson("/api/columns/{$this->columnA->id}", [
                'wip_limit' => 5,
                'wip_enforcement' => 'strict',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('kanban_columns', [
            'id' => $this->columnA->id,
            'wip_limit' => 5,
            'wip_enforcement' => 'strict',
        ]);

        // Removing limit sets wip_limit to null
        $response2 = $this->actingAs($this->owner, 'sanctum')
            ->putJson("/api/columns/{$this->columnA->id}", [
                'wip_limit' => null,
                'wip_enforcement' => 'warning',
            ]);

        $response2->assertOk();
        $this->columnA->refresh();
        $this->assertNull($this->columnA->wip_limit);
        $this->assertEquals('warning', $this->columnA->wip_enforcement);
    }

    public function test_regular_member_and_outsider_cannot_configure_wip_limit(): void
    {
        // Regular member cannot update column
        $resMember = $this->actingAs($this->member, 'sanctum')
            ->putJson("/api/columns/{$this->columnA->id}", [
                'wip_limit' => 10,
                'wip_enforcement' => 'strict',
            ]);
        $resMember->assertForbidden();

        // Outsider cannot update column
        $resOutsider = $this->actingAs($this->outsider, 'sanctum')
            ->putJson("/api/columns/{$this->columnA->id}", [
                'wip_limit' => 10,
                'wip_enforcement' => 'strict',
            ]);
        $resOutsider->assertForbidden();
    }

    public function test_strict_mode_blocks_creating_task_when_wip_limit_reached(): void
    {
        // ColumnB has wip_limit = 2, strict
        // Create 2 root tasks
        Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Task 1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
        Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Task 2',
            'order' => 2000,
            'created_by' => $this->owner->id,
        ]);

        $this->columnB->refresh();
        $this->assertEquals(2, $this->columnB->wip_count);

        // Attempt to create 3rd task via POST /columns/{column}/tasks
        $response = $this->actingAs($this->member, 'sanctum')
            ->postJson("/api/columns/{$this->columnB->id}/tasks", [
                'title' => 'Task 3 (Should Fail)',
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'error_code' => 'WIP_LIMIT_EXCEEDED',
                'enforcement' => 'strict',
                'wip_limit' => 2,
            ]);
    }

    public function test_strict_mode_blocks_moving_task_when_wip_limit_reached(): void
    {
        // ColumnB has wip_limit = 2, strict
        Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Task B1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
        Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Task B2',
            'order' => 2000,
            'created_by' => $this->owner->id,
        ]);

        $taskInColA = Task::create([
            'column_id' => $this->columnA->id,
            'title' => 'Task A1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        // Attempt to move taskInColA to columnB
        $response = $this->actingAs($this->owner, 'sanctum')
            ->putJson("/api/tasks/{$taskInColA->id}/move", [
                'column_id' => $this->columnB->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'error_code' => 'WIP_LIMIT_EXCEEDED',
                'enforcement' => 'strict',
            ]);

        // Task remains in Column A
        $taskInColA->refresh();
        $this->assertEquals($this->columnA->id, $taskInColA->column_id);

        // Reordering within columnB is permitted
        $taskB1 = Task::where('column_id', $this->columnB->id)->first();
        $resReorder = $this->actingAs($this->owner, 'sanctum')
            ->putJson("/api/tasks/{$taskB1->id}/move", [
                'column_id' => $this->columnB->id,
            ]);
        $resReorder->assertOk();
    }

    public function test_warning_mode_allows_creating_and_moving_task_after_confirmation(): void
    {
        // ColumnA configured with wip_limit = 1, warning
        $this->columnA->update([
            'wip_limit' => 1,
            'wip_enforcement' => 'warning',
        ]);

        Task::create([
            'column_id' => $this->columnA->id,
            'title' => 'Task A1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        // Creating 2nd task in warning mode is allowed
        $resCreate = $this->actingAs($this->member, 'sanctum')
            ->postJson("/api/columns/{$this->columnA->id}/tasks", [
                'title' => 'Task A2 (Warning Allowed)',
            ]);
        $resCreate->assertStatus(201);

        // Moving task into warning column is allowed
        $taskInColB = Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Task B1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        $resMove = $this->actingAs($this->owner, 'sanctum')
            ->putJson("/api/tasks/{$taskInColB->id}/move", [
                'column_id' => $this->columnA->id,
            ]);
        $resMove->assertOk();
    }

    public function test_subtasks_do_not_count_towards_column_wip_limit(): void
    {
        // ColumnB has wip_limit = 1, strict
        $this->columnB->update(['wip_limit' => 1, 'wip_enforcement' => 'strict']);

        $parentTask = Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Parent Task',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        $this->columnB->refresh();
        $this->assertEquals(1, $this->columnB->wip_count);

        // Adding subtasks to parentTask must succeed and not be blocked by WIP limit
        $resSubtask1 = $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/tasks/{$parentTask->id}/subtasks", [
                'title' => 'Subtask 1',
            ]);
        $resSubtask1->assertStatus(201);

        $resSubtask2 = $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/tasks/{$parentTask->id}/subtasks", [
                'title' => 'Subtask 2',
            ]);
        $resSubtask2->assertStatus(201);

        // Column wip_count is still 1 (only parent task counted)
        $this->columnB->refresh();
        $this->assertEquals(1, $this->columnB->wip_count);
    }

    public function test_archived_and_soft_deleted_tasks_do_not_count_towards_wip(): void
    {
        $this->columnB->update(['wip_limit' => 1, 'wip_enforcement' => 'strict']);

        // Soft deleted task
        $deletedTask = Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Deleted Task',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
        $deletedTask->delete();

        // Archived task
        Task::create([
            'column_id' => $this->columnB->id,
            'title' => 'Archived Task',
            'order' => 2000,
            'archived_at' => now(),
            'created_by' => $this->owner->id,
        ]);

        $this->columnB->refresh();
        $this->assertEquals(0, $this->columnB->wip_count);

        // Can create a task since current WIP is 0
        $response = $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/columns/{$this->columnB->id}/tasks", [
                'title' => 'Fresh Task',
            ]);
        $response->assertStatus(201);
    }
}
