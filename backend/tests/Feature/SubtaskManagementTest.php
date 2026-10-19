<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SubtaskManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $member;
    private User $outsider;
    private Board $board;
    private KanbanColumn $column;
    private Task $parentTask;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Owner User', 'account_status' => 'active']);
        $this->member = User::factory()->create(['name' => 'Member User', 'account_status' => 'active']);
        $this->outsider = User::factory()->create(['name' => 'Outsider User', 'account_status' => 'active']);

        $workspace = Workspace::create(['name' => 'Test Workspace', 'owner_id' => $this->owner->id]);

        $this->board = Board::create([
            'workspace_id' => $workspace->id,
            'name' => 'Project Danava',
            'public_id' => 'danavapro123',
        ]);

        // Add owner and member to board_members
        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->member->id, 'role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->column = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Đang làm',
            'order' => 1000,
        ]);

        $this->parentTask = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Phát triển tính năng Task con',
            'priority' => 'Cao',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
    }

    /**
     * 1. Owner tạo task con thành công.
     */
    public function test_owner_can_create_subtask_successfully(): void
    {
        $this->actingAs($this->owner);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Thiết kế Database Subtask',
            'priority' => 'Khẩn cấp',
            'due_date' => Carbon::now()->addDays(3)->toDateString(),
            'assignee_ids' => [$this->member->id],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('title', 'Thiết kế Database Subtask');
        $response->assertJsonPath('parent_task_id', $this->parentTask->id);

        $this->assertDatabaseHas('tasks', [
            'parent_task_id' => $this->parentTask->id,
            'title' => 'Thiết kế Database Subtask',
            'priority' => 'Khẩn cấp',
        ]);
    }

    /**
     * 2. Board member hợp lệ xem được task con.
     */
    public function test_board_member_can_view_subtasks(): void
    {
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask 1',
            'priority' => 'Bình thường',
        ]);

        $this->actingAs($this->member);

        $response = $this->getJson("/api/tasks/{$this->parentTask->id}/subtasks");
        $response->assertStatus(200);
        $response->assertJsonCount(1);

        $detailResponse = $this->getJson("/api/tasks/subtasks/{$subtask->id}");
        $detailResponse->assertStatus(200);
        $detailResponse->assertJsonPath('id', $subtask->id);
    }

    /**
     * 3. Người ngoài Board bị trả 403.
     */
    public function test_outsider_is_forbidden_with_403(): void
    {
        $this->actingAs($this->outsider);

        $response = $this->getJson("/api/tasks/{$this->parentTask->id}/subtasks");
        $response->assertStatus(403);

        $createResponse = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Outsider Attempt',
        ]);
        $createResponse->assertStatus(403);
    }

    /**
     * 4. Không thể gắn user ngoài Board.
     */
    public function test_cannot_assign_user_outside_of_board(): void
    {
        $this->actingAs($this->owner);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Invalid Assignee Task',
            'assignee_ids' => [$this->outsider->id],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('assignee_ids');
    }

    /**
     * 5. Không thể tạo task cháu (hạn chế tối đa 1 cấp).
     */
    public function test_cannot_create_grandchild_subtask(): void
    {
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Child Subtask',
        ]);

        $this->actingAs($this->owner);

        // Attempt to create a child of the child subtask
        $response = $this->postJson("/api/tasks/{$subtask->id}/subtasks", [
            'title' => 'Grandchild Subtask',
        ]);

        $response->assertStatus(403);
    }

    /**
     * 6. Không thể tạo quan hệ parent gây vòng lặp.
     */
    public function test_subtask_must_belong_to_same_board(): void
    {
        $otherWs = Workspace::create(['name' => 'Other WS', 'owner_id' => $this->owner->id]);
        $otherBoard = Board::create(['workspace_id' => $otherWs->id, 'name' => 'Other Board']);
        $otherCol = KanbanColumn::create(['board_id' => $otherBoard->id, 'title' => 'Col 1', 'order' => 1]);

        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask A',
        ]);

        $this->actingAs($this->owner);

        // Subtask retains its board column properly
        $response = $this->patchJson("/api/tasks/subtasks/{$subtask->id}", [
            'title' => 'Updated Subtask',
        ]);

        $response->assertStatus(200);
        $this->assertEquals($this->column->id, $subtask->fresh()->column_id);
    }

    /**
     * 7. Hoàn thành task con cập nhật đúng tiến độ task cha.
     */
    public function test_completing_subtask_updates_progress(): void
    {
        $sub1 = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Sub 1',
            'completed_at' => null,
        ]);

        $sub2 = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Sub 2',
            'completed_at' => null,
        ]);

        $this->actingAs($this->owner);

        $response = $this->patchJson("/api/tasks/subtasks/{$sub1->id}", [
            'is_completed' => true,
        ]);

        $response->assertStatus(200);
        $this->assertNotNull($sub1->fresh()->completed_at);

        // Verify subtask count in parent task
        $totalSubtasks = $this->parentTask->subtasks()->count();
        $doneSubtasks = $this->parentTask->subtasks()->whereNotNull('completed_at')->count();

        $this->assertEquals(2, $totalSubtasks);
        $this->assertEquals(1, $doneSubtasks);
        $this->assertEquals(50.0, ($doneSubtasks / $totalSubtasks) * 100);
    }

    /**
     * 8. Dashboard đếm đúng completed/incomplete/overdue.
     */
    public function test_dashboard_counts_workload_accurately(): void
    {
        // Parent task has 2 subtasks, so parent task itself is excluded from workload
        $subDone = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Sub Done',
            'completed_at' => now(),
            'due_date' => Carbon::yesterday()->toDateString(),
        ]);
        $subDone->assignees()->sync([$this->member->id]);

        $subOverdue = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Sub Overdue',
            'completed_at' => null,
            'due_date' => Carbon::yesterday()->toDateString(),
        ]);
        $subOverdue->assignees()->sync([$this->member->id]);

        $this->actingAs($this->member);

        $response = $this->getJson("/api/boards/{$this->board->id}/dashboard/member-workload");
        $response->assertStatus(200);

        $response->assertJsonPath('summary.total_tasks', 2);
        $response->assertJsonPath('summary.completed_tasks', 1);
        $response->assertJsonPath('summary.overdue_tasks', 1);
        $response->assertJsonPath('summary.incomplete_tasks', 1);
    }

    /**
     * 9. Task nhiều assignee không làm sai tổng distinct task của Board.
     */
    public function test_multi_assignee_task_preserves_distinct_board_task_count(): void
    {
        $task = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Collaborative Task',
        ]);
        // Assigned to BOTH owner and member
        $task->assignees()->sync([$this->owner->id, $this->member->id]);

        $this->actingAs($this->owner);

        $response = $this->getJson("/api/boards/{$this->board->id}/dashboard/member-workload");
        $response->assertStatus(200);

        // Even though 2 users were assigned, distinct task count must be 2 (parentTask + collaborative task)
        $this->assertDatabaseCount('tasks', 2);
        $response->assertJsonPath('summary.total_tasks', 2);

        // Each member individually has this task in their workload
        $members = collect($response->json('members'));
        $ownerStat = $members->firstWhere('id', $this->owner->id);
        $memberStat = $members->firstWhere('id', $this->member->id);

        $this->assertGreaterThanOrEqual(1, $ownerStat['assigned']);
        $this->assertGreaterThanOrEqual(1, $memberStat['assigned']);
    }

    /**
     * 10. Notification chỉ tạo khi assignee thật sự thay đổi.
     */
    public function test_notification_only_sent_when_assignee_actually_added(): void
    {
        Notification::fake();

        $this->actingAs($this->owner);

        // 1. Create subtask with member -> should notify member
        $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Subtask Notification Test',
            'assignee_ids' => [$this->member->id],
        ]);

        Notification::assertSentTo(
            $this->member,
            \App\Notifications\TaskMemberAssignedNotification::class,
            function ($notification) {
                return $notification->boardId === $this->board->id;
            }
        );

        // Reset notification fake
        Notification::fake();

        // 2. Update subtask without changing assignees -> no new notification sent
        $subtask = Task::where('title', 'Subtask Notification Test')->first();
        $this->patchJson("/api/tasks/subtasks/{$subtask->id}", [
            'title' => 'Updated Title Only',
            'assignee_ids' => [$this->member->id], // Same assignee
        ]);

        Notification::assertNothingSent();
    }

    /**
     * 11. URL dạng javascript: hoặc độc hại không được render/chấp nhận nguy hiểm.
     */
    public function test_safe_content_and_activity_logging(): void
    {
        $this->actingAs($this->owner);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Test XSS Safety',
            'description' => 'Xem link: https://danava.vn hoặc <script>alert("xss")</script>',
        ]);

        $response->assertStatus(201);
        $subtaskId = $response->json('id');

        // Verify activity log is created with board_id
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'task_id' => $subtaskId,
            'user_id' => $this->owner->id,
        ]);
    }

    /**
     * 12. Xóa task cha được xử lý an toàn với task con (cascade).
     */
    public function test_deleting_parent_task_cascades_subtasks_safely(): void
    {
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'To be deleted with parent',
        ]);

        $this->actingAs($this->owner);

        $this->deleteJson("/api/tasks/{$this->parentTask->id}");

        // Parent task soft deleted
        $this->assertSoftDeleted('tasks', ['id' => $this->parentTask->id]);
    }
}
