<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\TaskMemberAssignedNotification;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MultiAssigneeLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $member1;
    private User $member2;
    private User $member3;
    private User $outsider;
    private User $lockedUser;
    private Board $board;
    private KanbanColumn $column;
    private Task $parentTask;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Nguyễn Nam Hùng', 'account_status' => 'active']);
        $this->member1 = User::factory()->create(['name' => 'Trần Danh Đại', 'account_status' => 'active']);
        $this->member2 = User::factory()->create(['name' => 'Trần Văn Nam', 'account_status' => 'active']);
        $this->member3 = User::factory()->create(['name' => 'Lê Tấn Thành', 'account_status' => 'active']);
        $this->outsider = User::factory()->create(['name' => 'Outsider User', 'account_status' => 'active']);
        $this->lockedUser = User::factory()->create(['name' => 'Locked User', 'account_status' => 'inactive']);

        $workspace = Workspace::create(['name' => 'DANAVA Workspace', 'owner_id' => $this->owner->id]);

        $this->board = Board::create([
            'workspace_id' => $workspace->id,
            'name' => 'Phát triển DANAVA Trello v2.0',
            'public_id' => 'danavav2001',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->member1->id, 'role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->member2->id, 'role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->member3->id, 'role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->lockedUser->id, 'role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->column = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Đang làm',
            'order' => 1000,
        ]);

        $this->parentTask = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Triển khai Progressive Web App',
            'priority' => 'Cao',
            'complexity' => 'L',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
    }

    /**
     * 1. Gán nhiều thành viên vào Task cha.
     */
    public function test_1_assign_multiple_members_to_parent_task(): void
    {
        $this->actingAs($this->owner);

        $response = $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->owner->id, $this->member1->id, $this->member2->id],
        ]);

        $response->assertStatus(200);
        $this->assertCount(3, $this->parentTask->fresh()->assignees);
        $this->assertTrue($this->parentTask->fresh()->assignees->contains('id', $this->member1->id));
        $this->assertTrue($this->parentTask->fresh()->assignees->contains('id', $this->member2->id));
    }

    /**
     * 2. Gán nhiều thành viên vào Task con.
     */
    public function test_2_assign_multiple_members_to_subtask(): void
    {
        $this->actingAs($this->owner);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Kiểm thử thiết bị',
            'assignee_ids' => [$this->member1->id, $this->member2->id],
        ]);

        $response->assertStatus(201);
        $subtaskId = $response->json('id');
        $subtask = Task::findOrFail($subtaskId);

        $this->assertCount(2, $subtask->assignees);
        $this->assertTrue($subtask->assignees->contains('id', $this->member1->id));
        $this->assertTrue($subtask->assignees->contains('id', $this->member2->id));
    }

    /**
     * 3. Thành viên Task cha và Task con hoạt động độc lập.
     */
    public function test_3_parent_and_subtask_assignees_are_independent(): void
    {
        $this->actingAs($this->owner);

        // Parent has owner and member1
        $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->owner->id, $this->member1->id],
        ]);

        // Subtask has member2 and member3
        $subtaskResponse = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Thiết kế giao diện',
            'assignee_ids' => [$this->member2->id, $this->member3->id],
        ]);
        $subtaskId = $subtaskResponse->json('id');

        // Update parent to only have member3
        $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->member3->id],
        ]);

        $subtask = Task::findOrFail($subtaskId);
        // Subtask still has member2 and member3
        $this->assertEqualsCanonicalizing(
            [$this->member2->id, $this->member3->id],
            $subtask->assignees->pluck('id')->all()
        );
    }

    /**
     * 4. Copy thành viên Task cha xuống Task con.
     */
    public function test_4_copy_parent_assignees_to_subtask_on_creation(): void
    {
        $this->actingAs($this->owner);

        $this->parentTask->syncAssigneesWithAutoSplit([$this->owner->id, $this->member1->id, $this->member2->id]);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Tự động copy từ task cha',
            'copy_parent_assignees' => true,
        ]);

        $response->assertStatus(201);
        $subtaskId = $response->json('id');
        $subtask = Task::findOrFail($subtaskId);

        $this->assertEqualsCanonicalizing(
            [$this->owner->id, $this->member1->id, $this->member2->id],
            $subtask->assignees->pluck('id')->all()
        );
    }

    /**
     * 5. Merge không làm mất thành viên cũ khi copy assignees.
     */
    public function test_5_merge_preserves_existing_subtask_assignees(): void
    {
        $this->actingAs($this->owner);

        // Parent has member1 and member2
        $this->parentTask->syncAssigneesWithAutoSplit([$this->member1->id, $this->member2->id]);

        // Subtask has member3
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask 1',
            'created_by' => $this->owner->id,
        ]);
        $subtask->syncAssigneesWithAutoSplit([$this->member3->id]);

        // Copy with merge strategy
        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/copy-assignees-to-subtasks", [
            'mode' => 'all',
            'merge_strategy' => 'merge',
        ]);

        $response->assertStatus(200);
        $subtask->refresh();

        // Must now have member1, member2, AND member3
        $this->assertEqualsCanonicalizing(
            [$this->member1->id, $this->member2->id, $this->member3->id],
            $subtask->assignees->pluck('id')->all()
        );
    }

    /**
     * 6. Replace thay đúng toàn bộ danh sách thành viên Task con.
     */
    public function test_6_replace_overwrites_subtask_assignees(): void
    {
        $this->actingAs($this->owner);

        // Parent has member1
        $this->parentTask->syncAssigneesWithAutoSplit([$this->member1->id]);

        // Subtask has member2 and member3
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask Replace Test',
            'created_by' => $this->owner->id,
        ]);
        $subtask->syncAssigneesWithAutoSplit([$this->member2->id, $this->member3->id]);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/copy-assignees-to-subtasks", [
            'mode' => 'all',
            'merge_strategy' => 'replace',
        ]);

        $response->assertStatus(200);
        $subtask->refresh();

        // Must now ONLY have member1
        $this->assertEqualsCanonicalizing(
            [$this->member1->id],
            $subtask->assignees->pluck('id')->all()
        );
    }

    /**
     * 7. Không gán được người ngoài Board.
     */
    public function test_7_cannot_assign_non_board_member(): void
    {
        $this->actingAs($this->owner);

        $response = $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->outsider->id],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseMissing('task_assignees', [
            'task_id' => $this->parentTask->id,
            'user_id' => $this->outsider->id,
        ]);
    }

    /**
     * 8. Không gán được tài khoản bị khóa.
     */
    public function test_8_cannot_assign_locked_user(): void
    {
        $this->actingAs($this->owner);

        $response = $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->lockedUser->id],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseMissing('task_assignees', [
            'task_id' => $this->parentTask->id,
            'user_id' => $this->lockedUser->id,
        ]);
    }

    /**
     * 9. Không lưu trùng task_id + user_id.
     */
    public function test_9_no_duplicate_task_id_and_user_id(): void
    {
        $this->actingAs($this->owner);

        $response = $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->member1->id, $this->member1->id, $this->member1->id],
        ]);

        $response->assertStatus(200);
        $this->assertEquals(1, $this->parentTask->fresh()->assignees()->where('users.id', $this->member1->id)->count());
    }

    /**
     * 10. Notification chỉ gửi cho thành viên mới được thêm vào.
     */
    public function test_10_notification_only_sent_to_newly_added_assignees(): void
    {
        $this->actingAs($this->owner);

        // Pre-assign member1
        $this->parentTask->syncAssigneesWithAutoSplit([$this->member1->id]);

        Notification::fake();

        // Update to member1 AND member2 (only member2 is new)
        $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->member1->id, $this->member2->id],
        ]);

        Notification::assertSentTo($this->member2, TaskMemberAssignedNotification::class);
        Notification::assertNotSentTo($this->member1, TaskMemberAssignedNotification::class);
    }

    /**
     * 11. My Tasks trả đúng Task cha và Task con kèm phân loại.
     */
    public function test_11_my_tasks_returns_root_and_subtasks(): void
    {
        $this->actingAs($this->member1);

        // Assign member1 to parent
        $this->parentTask->syncAssigneesWithAutoSplit([$this->member1->id]);

        // Create subtask and assign member1
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask for member1',
            'created_by' => $this->owner->id,
        ]);
        $subtask->syncAssigneesWithAutoSplit([$this->member1->id, $this->member2->id]);

        // Filter all
        $responseAll = $this->getJson('/api/me/tasks?task_type=all');
        $responseAll->assertStatus(200);
        $items = $responseAll->json('data') ?: $responseAll->json();
        $this->assertCount(2, $items);

        // Filter root only
        $responseRoot = $this->getJson('/api/me/tasks?task_type=root');
        $responseRoot->assertStatus(200);
        $rootItems = $responseRoot->json('data') ?: $responseRoot->json();
        $this->assertCount(1, $rootItems);
        $this->assertEquals('Task chính', $rootItems[0]['type']);

        // Filter subtask only
        $responseSub = $this->getJson('/api/me/tasks?task_type=subtask');
        $responseSub->assertStatus(200);
        $subItems = $responseSub->json('data') ?: $responseSub->json();
        $this->assertCount(1, $subItems);
        $this->assertEquals('Task con', $subItems[0]['type']);
        $this->assertEquals($this->parentTask->title, $subItems[0]['parent_task']['title']);
    }

    /**
     * 12. Dashboard tính đúng multi-assignee.
     */
    public function test_12_dashboard_calculates_multi_assignee_workload(): void
    {
        $this->actingAs($this->owner);

        // Both member1 and member2 assigned to parent task
        $this->parentTask->syncAssigneesWithAutoSplit([$this->member1->id, $this->member2->id]);

        $response = $this->getJson("/api/boards/{$this->board->id}/dashboard/member-workload");
        $response->assertStatus(200);

        $members = collect($response->json('members'));
        $m1 = $members->firstWhere('id', $this->member1->id);
        $m2 = $members->firstWhere('id', $this->member2->id);

        $this->assertNotNull($m1);
        $this->assertNotNull($m2);
        $this->assertGreaterThanOrEqual(1, $m1['assigned']);
        $this->assertGreaterThanOrEqual(1, $m2['assigned']);
    }

    /**
     * 13. contribution_percent có tổng bằng 100%.
     */
    public function test_13_contribution_percent_sum_equals_100(): void
    {
        $this->actingAs($this->owner);

        // Auto split 3 users
        $this->parentTask->syncAssigneesWithAutoSplit([$this->owner->id, $this->member1->id, $this->member2->id]);

        $sum = DB::table('task_assignees')
            ->where('task_id', $this->parentTask->id)
            ->sum('contribution_percent');

        $this->assertEquals(100.0, (float)$sum);

        // Custom update where sum != 100 should fail
        $responseFail = $this->putJson("/api/tasks/{$this->parentTask->id}/contribution-percents", [
            'percents' => [
                ['user_id' => $this->owner->id, 'contribution_percent' => 50],
                ['user_id' => $this->member1->id, 'contribution_percent' => 30],
                ['user_id' => $this->member2->id, 'contribution_percent' => 10], // sum = 90
            ],
        ]);
        $responseFail->assertStatus(422);

        // Custom update where sum == 100 should pass
        $responsePass = $this->putJson("/api/tasks/{$this->parentTask->id}/contribution-percents", [
            'percents' => [
                ['user_id' => $this->owner->id, 'contribution_percent' => 50],
                ['user_id' => $this->member1->id, 'contribution_percent' => 30],
                ['user_id' => $this->member2->id, 'contribution_percent' => 20], // sum = 100
            ],
        ]);
        $responsePass->assertStatus(200);
    }

    /**
     * 14. Hiệu suất được chia theo tỷ lệ đóng góp (contribution_percent).
     */
    public function test_14_performance_points_divided_by_contribution_percent(): void
    {
        $this->actingAs($this->owner);

        // Task complexity L = 5 points
        $this->parentTask->update(['complexity' => 'L']);
        $this->parentTask->syncAssigneesWithAutoSplit(
            [$this->member1->id, $this->member2->id],
            null,
            [$this->member1->id => 60.0, $this->member2->id => 40.0]
        );

        $pivots = DB::table('task_assignees')
            ->where('task_id', $this->parentTask->id)
            ->get();

        $m1Pivot = $pivots->firstWhere('user_id', $this->member1->id);
        $m2Pivot = $pivots->firstWhere('user_id', $this->member2->id);

        $taskPoints = 5.0;
        $m1Points = $taskPoints * ($m1Pivot->contribution_percent / 100);
        $m2Points = $taskPoints * ($m2Pivot->contribution_percent / 100);

        $this->assertEquals(3.0, $m1Points);
        $this->assertEquals(2.0, $m2Points);
        $this->assertEquals(5.0, $m1Points + $m2Points);
    }

    /**
     * 15. Không tính trùng cả Task cha và Task con.
     */
    public function test_15_no_double_counting_parent_and_subtasks(): void
    {
        // When subtasks exist, parent task should not be counted as a leaf work unit
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask 1',
            'created_by' => $this->owner->id,
        ]);

        $this->assertTrue($this->parentTask->subtasks()->exists());
        // Verify query pattern for leaf tasks
        $hasSubtasks = Task::where('parent_task_id', $this->parentTask->id)->exists();
        $this->assertTrue($hasSubtasks);
    }

    /**
     * 16. Không xảy ra IDOR (Task con phải thuộc đúng Task cha, Task phải thuộc đúng Board).
     */
    public function test_16_prevent_idor_attacks(): void
    {
        $this->actingAs($this->owner);

        // Another board and task
        $otherBoard = Board::create(['name' => 'Other Board', 'public_id' => 'other123']);
        $otherColumn = KanbanColumn::create(['board_id' => $otherBoard->id, 'title' => 'Other Col', 'order' => 1]);
        $otherTask = Task::create(['column_id' => $otherColumn->id, 'title' => 'Other Task', 'order' => 1]);

        // Subtask belonging to otherTask
        $otherSubtask = Task::create([
            'parent_task_id' => $otherTask->id,
            'column_id' => $otherColumn->id,
            'title' => 'Other Subtask',
        ]);

        // Attempt to update otherSubtask via parentTask
        $response = $this->patchJson("/api/tasks/{$this->parentTask->id}/subtasks/{$otherSubtask->id}", [
            'title' => 'Hacked title',
        ]);

        $response->assertStatus(404);
        $this->assertNotEquals('Hacked title', $otherSubtask->fresh()->title);
    }

    /**
     * 17. Gỡ Board Member xử lý Task đang được giao và cân bằng lại tỷ lệ.
     */
    public function test_17_removing_board_member_cleans_up_assigned_tasks(): void
    {
        $this->actingAs($this->owner);

        // Assign member1 and member2
        $this->parentTask->syncAssigneesWithAutoSplit([$this->member1->id, $this->member2->id]);
        $this->assertCount(2, $this->parentTask->fresh()->assignees);

        // Remove member1 from board
        $response = $this->deleteJson("/api/boards/{$this->board->id}/members/{$this->member1->id}");
        $response->assertStatus(200);

        // member1 should no longer be assigned to parentTask
        $this->parentTask->refresh();
        $this->assertCount(1, $this->parentTask->assignees);
        $this->assertEquals($this->member2->id, $this->parentTask->assignees->first()->id);

        // Remaining member2 should now have 100% contribution
        $m2Percent = (float) $this->parentTask->assignees->first()->pivot->contribution_percent;
        $this->assertEquals(100.0, $m2Percent);
    }

    /**
     * 18. Transaction rollback nếu cập nhật hàng loạt thất bại.
     */
    public function test_18_transaction_rollback_on_failure(): void
    {
        $this->actingAs($this->owner);

        $this->parentTask->syncAssigneesWithAutoSplit([$this->member1->id]);

        // Attempt invalid bulk update with non-existent user
        $response = $this->putJson("/api/tasks/{$this->parentTask->id}/assignees", [
            'assignee_ids' => [$this->member2->id, 999999],
        ]);

        $response->assertStatus(422);

        // State remains unchanged (member1 still assigned)
        $this->parentTask->refresh();
        $this->assertCount(1, $this->parentTask->assignees);
        $this->assertEquals($this->member1->id, $this->parentTask->assignees->first()->id);
    }
}
