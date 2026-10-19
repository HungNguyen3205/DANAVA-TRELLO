<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TrashManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $adminMember;
    private User $regularMember;
    private User $outsider;
    private Board $board;
    private KanbanColumn $col1;
    private KanbanColumn $col2;
    private Task $task1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Board Owner', 'username' => 'owner_user']);
        $this->adminMember = User::factory()->create(['name' => 'Board Admin', 'username' => 'admin_user']);
        $this->regularMember = User::factory()->create(['name' => 'Regular Member', 'username' => 'member_user']);
        $this->outsider = User::factory()->create(['name' => 'Outsider', 'username' => 'outsider_user']);

        $this->board = Board::create([
            'name' => 'Dự án Website',
            'code' => 'WEB',
            'public_id' => 'web-trash-test',
            'owner_id' => $this->owner->id,
        ]);

        $this->board->members()->attach($this->adminMember->id, ['role' => 'admin']);
        $this->board->members()->attach($this->regularMember->id, ['role' => 'member']);

        $this->col1 = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Cần làm',
            'order' => 1000,
        ]);

        $this->col2 = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Đang làm',
            'order' => 2000,
        ]);

        $this->task1 = Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Công việc thử nghiệm',
            'created_by' => $this->owner->id,
        ]);
    }

    /**
     * Test: Normal delete performs SoftDelete (does not hard delete) and records deleted_by.
     */
    public function test_normal_deletion_performs_soft_delete_with_deleted_by(): void
    {
        // 1. Delete Task
        $this->actingAs($this->owner)
            ->deleteJson("/api/tasks/{$this->task1->id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('tasks', ['id' => $this->task1->id]);
        $trashedTask = Task::onlyTrashed()->find($this->task1->id);
        $this->assertNotNull($trashedTask);
        $this->assertEquals($this->owner->id, $trashedTask->deleted_by);

        // 2. Delete Column
        $this->actingAs($this->owner)
            ->deleteJson("/api/columns/{$this->col2->id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('kanban_columns', ['id' => $this->col2->id]);
        $trashedCol = KanbanColumn::onlyTrashed()->find($this->col2->id);
        $this->assertNotNull($trashedCol);
        $this->assertEquals($this->owner->id, $trashedCol->deleted_by);

        // 3. Delete Board
        $this->actingAs($this->owner)
            ->deleteJson("/api/boards/{$this->board->id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('boards', ['id' => $this->board->id]);
        $trashedBoard = Board::onlyTrashed()->find($this->board->id);
        $this->assertNotNull($trashedBoard);
        $this->assertEquals($this->owner->id, $trashedBoard->deleted_by);
    }

    /**
     * Test: Viewing trash has role authorization (Owner/Admin allowed, Regular member/Outsider gets 403).
     */
    public function test_trash_listing_authorization(): void
    {
        $this->task1->update(['deleted_by' => $this->owner->id]);
        $this->task1->delete();

        // Board Owner can view trash
        $resOwner = $this->actingAs($this->owner)
            ->getJson("/api/trash?board_id={$this->board->id}");
        $resOwner->assertStatus(200);
        $resOwner->assertJsonStructure(['data', 'counts']);
        $this->assertEquals(1, $resOwner->json('counts.task'));

        // Board Admin can view trash
        $resAdmin = $this->actingAs($this->adminMember)
            ->getJson("/api/trash?board_id={$this->board->id}");
        $resAdmin->assertStatus(200);

        // Regular Member is denied (403)
        $this->actingAs($this->regularMember)
            ->getJson("/api/trash?board_id={$this->board->id}")
            ->assertStatus(403);

        // Outsider is denied (403)
        $this->actingAs($this->outsider)
            ->getJson("/api/trash?board_id={$this->board->id}")
            ->assertStatus(403);
    }

    /**
     * Test: Restoring a task when old column is active.
     */
    public function test_restore_task_to_existing_column(): void
    {
        $this->task1->update(['deleted_by' => $this->owner->id]);
        $this->task1->delete();

        $this->assertSoftDeleted('tasks', ['id' => $this->task1->id]);

        $res = $this->actingAs($this->owner)
            ->postJson("/api/trash/task/{$this->task1->id}/restore");

        $res->assertStatus(200);
        $res->assertJson(['success' => true]);

        // Task is active again and deleted_by is cleared
        $restored = Task::find($this->task1->id);
        $this->assertNotNull($restored);
        $this->assertNull($restored->deleted_at);
        $this->assertNull($restored->deleted_by);
        $this->assertEquals($this->col1->id, $restored->column_id);
    }

    /**
     * Test: Restoring a task when old column has been deleted requires choosing a target column.
     */
    public function test_restore_task_requires_target_column_if_old_column_deleted(): void
    {
        // Delete col1 and task1
        $this->task1->delete();
        $this->col1->delete();

        // 1. Attempting restore without target_column_id returns 422 with available columns
        $resNoTarget = $this->actingAs($this->owner)
            ->postJson("/api/trash/task/{$this->task1->id}/restore");

        $resNoTarget->assertStatus(422);
        $resNoTarget->assertJson([
            'require_target_column' => true,
        ]);
        $this->assertNotEmpty($resNoTarget->json('available_columns'));

        // 2. Providing valid target_column_id succeeds
        $resWithTarget = $this->actingAs($this->owner)
            ->postJson("/api/trash/task/{$this->task1->id}/restore", [
                'target_column_id' => $this->col2->id,
            ]);

        $resWithTarget->assertStatus(200);
        $resWithTarget->assertJson(['success' => true]);

        $restored = Task::find($this->task1->id);
        $this->assertNotNull($restored);
        $this->assertEquals($this->col2->id, $restored->column_id);
    }

    /**
     * Test: Restoring a column preserves/places reasonable order.
     */
    public function test_restore_column_maintains_order(): void
    {
        $this->col2->delete();

        $res = $this->actingAs($this->owner)
            ->postJson("/api/trash/column/{$this->col2->id}/restore");

        $res->assertStatus(200);

        $restoredCol = KanbanColumn::find($this->col2->id);
        $this->assertNotNull($restoredCol);
        $this->assertNull($restoredCol->deleted_at);
        $this->assertGreaterThan(0, $restoredCol->order);
    }

    /**
     * Test: Force delete requires 2-step exact name confirmation and blocks regular members.
     */
    public function test_force_delete_requires_confirmation_and_blocks_members(): void
    {
        $this->task1->delete();

        // 1. Regular member attempting force delete gets 403
        $this->actingAs($this->regularMember)
            ->deleteJson("/api/trash/task/{$this->task1->id}/force", [
                'confirm_name' => $this->task1->title,
            ])
            ->assertStatus(403);

        // 2. Owner attempting force delete with wrong name gets 422
        $this->actingAs($this->owner)
            ->deleteJson("/api/trash/task/{$this->task1->id}/force", [
                'confirm_name' => 'Sai tên hoàn toàn',
            ])
            ->assertStatus(422);

        // Task is still in trash
        $this->assertSoftDeleted('tasks', ['id' => $this->task1->id]);

        // 3. Owner attempting force delete with exact matching name succeeds
        $resSuccess = $this->actingAs($this->owner)
            ->deleteJson("/api/trash/task/{$this->task1->id}/force", [
                'confirm_name' => $this->task1->title,
            ]);

        $resSuccess->assertStatus(200);
        $resSuccess->assertJson(['success' => true]);

        // Task is permanently gone from DB
        $this->assertNull(Task::withTrashed()->find($this->task1->id));

        // ActivityLog was recorded
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'action' => 'force_deleted_task',
        ]);
    }

    /**
     * Test: Scheduler purge command permanently purges items older than 30 days.
     */
    public function test_purge_trash_command_cleans_expired_items(): void
    {
        // Item 1: Soft deleted 35 days ago (should be purged)
        $oldTask = Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Old Expired Task',
            'created_by' => $this->owner->id,
        ]);
        $oldTask->delete();
        Task::withTrashed()->where('id', $oldTask->id)->update(['deleted_at' => now()->subDays(35)]);

        // Item 2: Soft deleted 5 days ago (should NOT be purged)
        $freshTask = Task::create([
            'column_id' => $this->col1->id,
            'title' => 'Fresh Trash Task',
            'created_by' => $this->owner->id,
        ]);
        $freshTask->delete();
        Task::withTrashed()->where('id', $freshTask->id)->update(['deleted_at' => now()->subDays(5)]);

        // Run artisan command
        $this->artisan('trash:purge')
            ->assertSuccessful();

        // Old task is purged
        $this->assertNull(Task::withTrashed()->find($oldTask->id));

        // Fresh task remains in trash
        $this->assertNotNull(Task::onlyTrashed()->find($freshTask->id));
    }
}
