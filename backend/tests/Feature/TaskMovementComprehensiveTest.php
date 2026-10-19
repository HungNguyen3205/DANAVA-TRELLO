<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskMovementComprehensiveTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $member;
    private User $outsider;
    private Board $board;
    private KanbanColumn $sourceCol;
    private KanbanColumn $targetCol;
    private Task $task1;
    private Task $task2;
    private Task $task3;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Owner', 'system_role' => 'user']);
        $this->member = User::factory()->create(['name' => 'Member', 'system_role' => 'user']);
        $this->outsider = User::factory()->create(['name' => 'Outsider', 'system_role' => 'user']);

        // Board-first board
        $this->board = Board::create([
            'name' => 'Task Movement Board',
            'owner_id' => $this->owner->id,
            'workspace_id' => null,
            'visibility' => 'private',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->member->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->sourceCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'To Do',
            'order' => 1000,
        ]);

        $this->targetCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'In Progress',
            'order' => 2000,
        ]);

        $this->task1 = Task::create(['column_id' => $this->sourceCol->id, 'title' => 'Task 1', 'order' => 1000]);
        $this->task2 = Task::create(['column_id' => $this->targetCol->id, 'title' => 'Target Task A', 'order' => 1000]);
        $this->task3 = Task::create(['column_id' => $this->targetCol->id, 'title' => 'Target Task B', 'order' => 2000]);
    }

    public function test_member_can_move_task_to_another_column(): void
    {
        $this->actingAs($this->member);

        $response = $this->putJson("/api/tasks/{$this->task1->id}/move", [
            'column_id' => $this->targetCol->id,
        ]);

        $response->assertStatus(200);

        $freshTask = $this->task1->fresh();
        $this->assertEquals($this->targetCol->id, $freshTask->column_id);
    }

    public function test_move_task_between_two_existing_tasks_uses_fractional_ordering(): void
    {
        $this->actingAs($this->member);

        // Moving task1 between task2 (order 1000) and task3 (order 2000)
        $response = $this->putJson("/api/tasks/{$this->task1->id}/move", [
            'column_id' => $this->targetCol->id,
            'prev_id' => $this->task2->id,
            'next_id' => $this->task3->id,
        ]);

        $response->assertStatus(200);

        $freshTask = $this->task1->fresh();
        $this->assertEquals($this->targetCol->id, $freshTask->column_id);
        $this->assertGreaterThan(1000, $freshTask->order);
        $this->assertLessThan(2000, $freshTask->order);
        $this->assertEquals(1500, (int) round($freshTask->order));
    }

    public function test_move_task_to_beginning_of_column(): void
    {
        $this->actingAs($this->member);

        // Moving task1 before task2 (next_id = task2)
        $response = $this->putJson("/api/tasks/{$this->task1->id}/move", [
            'column_id' => $this->targetCol->id,
            'next_id' => $this->task2->id,
        ]);

        $response->assertStatus(200);

        $freshTask = $this->task1->fresh();
        $this->assertEquals($this->targetCol->id, $freshTask->column_id);
        $this->assertLessThan(1000, $freshTask->order);
    }

    public function test_move_task_to_end_of_column(): void
    {
        $this->actingAs($this->member);

        // Moving task1 after task3 (prev_id = task3)
        $response = $this->putJson("/api/tasks/{$this->task1->id}/move", [
            'column_id' => $this->targetCol->id,
            'prev_id' => $this->task3->id,
        ]);

        $response->assertStatus(200);

        $freshTask = $this->task1->fresh();
        $this->assertEquals($this->targetCol->id, $freshTask->column_id);
        $this->assertGreaterThan(2000, $freshTask->order);
    }

    public function test_cannot_move_task_to_foreign_board_column(): void
    {
        $foreignBoard = Board::create(['name' => 'Foreign Board', 'owner_id' => $this->owner->id]);
        $foreignCol = KanbanColumn::create(['board_id' => $foreignBoard->id, 'title' => 'Foreign Col', 'order' => 1000]);

        $this->actingAs($this->member);

        $response = $this->putJson("/api/tasks/{$this->task1->id}/move", [
            'column_id' => $foreignCol->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['column_id']);
    }

    public function test_outsider_cannot_move_task(): void
    {
        $this->actingAs($this->outsider);

        $response = $this->putJson("/api/tasks/{$this->task1->id}/move", [
            'column_id' => $this->targetCol->id,
        ]);

        $response->assertStatus(403);
    }
}
