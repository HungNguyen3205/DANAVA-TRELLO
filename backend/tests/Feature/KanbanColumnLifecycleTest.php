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

class KanbanColumnLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $adminMember;
    protected User $regularMember;
    protected User $outsider;
    protected User $systemAdmin;
    protected Board $board;
    protected KanbanColumn $col1;
    protected KanbanColumn $col2;
    protected KanbanColumn $col3;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->adminMember = User::factory()->create([
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

        $this->systemAdmin = User::factory()->create([
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'system_admin',
        ]);

        // Create board owned by $this->owner
        $this->board = Board::create([
            'name' => 'Kanban Test Board',
            'owner_id' => $this->owner->id,
            'visibility' => 'private',
        ]);

        // Memberships
        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->adminMember->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->regularMember->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Setup 3 initial columns
        $this->col1 = KanbanColumn::create(['board_id' => $this->board->id, 'title' => 'To Do', 'color' => 'slate', 'order' => 1000]);
        $this->col2 = KanbanColumn::create(['board_id' => $this->board->id, 'title' => 'In Progress', 'color' => 'blue', 'order' => 2000]);
        $this->col3 = KanbanColumn::create(['board_id' => $this->board->id, 'title' => 'Done', 'color' => 'green', 'order' => 3000]);
    }

    /**
     * Test: Regular member cannot delete or archive column (403).
     * System Admin outside the board also cannot delete or archive (403).
     */
    public function test_member_and_uninvited_system_admin_cannot_delete_or_archive_column(): void
    {
        // Regular member cannot delete
        $this->actingAs($this->regularMember)
            ->deleteJson("/api/columns/{$this->col3->id}")
            ->assertStatus(403);

        // Regular member cannot archive
        $this->actingAs($this->regularMember)
            ->postJson("/api/columns/{$this->col3->id}/archive")
            ->assertStatus(403);

        // System admin not in board cannot delete
        $this->actingAs($this->systemAdmin)
            ->deleteJson("/api/columns/{$this->col3->id}")
            ->assertStatus(403);

        // Outsider cannot delete
        $this->actingAs($this->outsider)
            ->deleteJson("/api/columns/{$this->col3->id}")
            ->assertStatus(403);
    }

    /**
     * Test: Owner can delete empty column (200, soft deleted, activity log recorded).
     */
    public function test_owner_can_delete_empty_column(): void
    {
        $response = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col3->id}");

        $response->assertStatus(200)
            ->assertJson([
                'action' => 'delete_empty_column',
            ]);

        $this->assertSoftDeleted('kanban_columns', ['id' => $this->col3->id]);

        // Check activity log
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'user_id' => $this->owner->id,
            'action' => 'delete_empty_column',
            'old_value' => 'Done',
        ]);
    }

    /**
     * Test: Cannot delete or archive the last active column on the board (422).
     */
    public function test_cannot_delete_or_archive_last_active_column(): void
    {
        // Delete col2 and col3 so only col1 remains
        $this->col2->delete();
        $this->col3->delete();

        // Attempt to delete last column
        $delResponse = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col1->id}");

        $delResponse->assertStatus(422)
            ->assertJson([
                'error_code' => 'CANNOT_DELETE_LAST_COLUMN',
            ]);

        // Attempt to archive last column
        $archResponse = $this->actingAs($this->owner)
            ->postJson("/api/columns/{$this->col1->id}/archive");

        $archResponse->assertStatus(422)
            ->assertJson([
                'error_code' => 'CANNOT_ARCHIVE_LAST_COLUMN',
            ]);
    }

    /**
     * Test: Column with tasks cannot be deleted without action (422 COLUMN_HAS_TASKS).
     */
    public function test_column_with_tasks_cannot_be_deleted_without_action(): void
    {
        Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Task in col 1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col1->id}");

        $response->assertStatus(422)
            ->assertJson([
                'error_code' => 'COLUMN_HAS_TASKS',
                'tasks_count' => 1,
            ]);

        // Column still exists
        $this->assertDatabaseHas('kanban_columns', [
            'id' => $this->col1->id,
            'deleted_at' => null,
        ]);
    }

    /**
     * Test: Column with tasks cannot select itself as target_column_id.
     */
    public function test_cannot_select_same_column_as_target(): void
    {
        Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Task in col 1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col1->id}", [
                'action' => 'move_tasks',
                'target_column_id' => $this->col1->id,
            ]);

        $response->assertStatus(422);
    }

    /**
     * Test: Column with tasks cannot move tasks to a column of another board.
     */
    public function test_cannot_move_tasks_to_another_board(): void
    {
        $otherBoard = Board::create([
            'name' => 'Foreign Board',
            'owner_id' => $this->owner->id,
            'visibility' => 'private',
        ]);
        $foreignCol = KanbanColumn::create([
            'board_id' => $otherBoard->id,
            'title' => 'Foreign Col',
            'order' => 1000,
        ]);

        Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Task in col 1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col1->id}", [
                'action' => 'move_tasks',
                'target_column_id' => $foreignCol->id,
            ]);

        $response->assertStatus(422);
    }

    /**
     * Test: Action move_tasks moves tasks to valid target column, soft deletes source column,
     * resequences remaining column orders, and creates activity log.
     */
    public function test_move_tasks_action_moves_tasks_and_deletes_column(): void
    {
        $task1 = Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Task 1',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
        $task2 = Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Task 2',
            'order' => 2000,
            'created_by' => $this->owner->id,
        ]);
        $existingTaskInCol2 = Task::create([
            'column_id' => $this->col2->id,
            'title' => 'Existing Col 2 Task',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col1->id}", [
                'action' => 'move_tasks',
                'target_column_id' => $this->col2->id,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'action' => 'move_tasks',
                'target_column_id' => $this->col2->id,
            ]);

        // Tasks moved
        $this->assertEquals($this->col2->id, $task1->fresh()->column_id);
        $this->assertEquals($this->col2->id, $task2->fresh()->column_id);
        $this->assertGreaterThan($existingTaskInCol2->order, $task1->fresh()->order);
        $this->assertGreaterThan($task1->fresh()->order, $task2->fresh()->order);

        // Source column soft deleted
        $this->assertSoftDeleted('kanban_columns', ['id' => $this->col1->id]);

        // Orders resequenced
        $this->assertEquals(1000, $this->col2->fresh()->order);
        $this->assertEquals(2000, $this->col3->fresh()->order);

        // Activity log recorded
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'user_id' => $this->owner->id,
            'action' => 'delete_column_move_tasks',
        ]);
    }

    /**
     * Test: Action archive_all archives column and all its tasks.
     */
    public function test_archive_all_action_archives_column_and_tasks(): void
    {
        $task = Task::create([
            'column_id' => $this->col2->id,
            'title' => 'Task in col 2',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col2->id}", [
                'action' => 'archive_all',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'action' => 'archive_all',
            ]);

        $col2Fresh = $this->col2->fresh();
        $this->assertNotNull($col2Fresh->archived_at);
        $this->assertEquals($this->owner->id, $col2Fresh->archived_by);

        $taskFresh = $task->fresh();
        $this->assertNotNull($taskFresh->archived_at);
        $this->assertEquals($this->owner->id, $taskFresh->archived_by);

        // Not soft-deleted
        $this->assertNull($col2Fresh->deleted_at);

        // Activity log
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'user_id' => $this->owner->id,
            'action' => 'archive_column_and_tasks',
        ]);
    }

    /**
     * Test: Action delete_all requires board owner. Non-owner admin receives 403.
     */
    public function test_delete_all_action_restricted_to_owner(): void
    {
        Task::create([
            'column_id' => $this->col2->id,
            'title' => 'Task in col 2',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        // Admin member (not owner) attempts delete_all
        $res = $this->actingAs($this->adminMember)
            ->deleteJson("/api/columns/{$this->col2->id}", [
                'action' => 'delete_all',
            ]);

        $res->assertStatus(403)
            ->assertJson([
                'error_code' => 'ONLY_OWNER_CAN_DELETE_ALL',
            ]);

        // Owner succeeds
        $resOwner = $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col2->id}", [
                'action' => 'delete_all',
            ]);

        $resOwner->assertStatus(200);

        // Both column and task are soft deleted
        $this->assertSoftDeleted('kanban_columns', ['id' => $this->col2->id]);
        $this->assertSoftDeleted('tasks', ['title' => 'Task in col 2']);

        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'user_id' => $this->owner->id,
            'action' => 'delete_column_and_tasks',
        ]);
    }

    /**
     * Test: Direct archive and restore column lifecycle.
     */
    public function test_archive_and_restore_column_lifecycle(): void
    {
        $task = Task::create([
            'column_id' => $this->col2->id,
            'title' => 'Archived Task',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        // 1. Archive col2
        $archRes = $this->actingAs($this->owner)
            ->postJson("/api/columns/{$this->col2->id}/archive");

        $archRes->assertStatus(200);

        $this->assertNotNull($this->col2->fresh()->archived_at);
        $this->assertNotNull($task->fresh()->archived_at);

        // 2. GET archived columns list
        $listRes = $this->actingAs($this->owner)
            ->getJson("/api/boards/{$this->board->id}/columns/archived");

        $listRes->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonFragment(['id' => $this->col2->id, 'title' => 'In Progress']);

        // 3. Restore col2
        $restRes = $this->actingAs($this->owner)
            ->postJson("/api/columns/{$this->col2->id}/restore");

        $restRes->assertStatus(200);

        $this->assertNull($this->col2->fresh()->archived_at);
        $this->assertNull($task->fresh()->archived_at);

        // 4. Activity log recorded for both archive and restore
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'action' => 'archive_column',
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'action' => 'restore_column',
        ]);
    }

    /**
     * Test: DB Transaction rollback if an exception occurs during move_tasks.
     */
    public function test_transaction_rollback_on_failure(): void
    {
        $task = Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Task for Rollback',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);

        // Trigger rollback by throwing an exception inside model events or verifying state
        // We simulate failure by setting an invalid task order or temporarily hooking deleting event
        KanbanColumn::deleting(function ($col) {
            if ($col->title === 'To Do Fail') {
                throw new \Exception('Simulated failure during column deletion');
            }
        });

        $this->col1->update(['title' => 'To Do Fail']);

        try {
            $this->actingAs($this->owner)
                ->deleteJson("/api/columns/{$this->col1->id}", [
                    'action' => 'move_tasks',
                    'target_column_id' => $this->col2->id,
                ]);
        } catch (\Exception $e) {
            // caught
        }

        // Verify task was NOT moved because transaction rolled back
        $this->assertEquals($this->col1->id, $task->fresh()->column_id);
        $this->assertDatabaseHas('kanban_columns', [
            'id' => $this->col1->id,
            'deleted_at' => null,
        ]);
    }
}
