<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskGroup;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskGroupLifecycleTest extends TestCase
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

        $workspace = Workspace::create(['name' => 'Danava Workspace', 'owner_id' => $this->owner->id]);

        $this->board = Board::create([
            'workspace_id' => $workspace->id,
            'name' => 'Board Unification Test',
            'public_id' => 'unification-board-123',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->member->id, 'role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->column = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Cần làm',
            'order' => 1000,
        ]);

        $this->parentTask = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Task cha chính',
            'priority' => 'Cao',
            'order' => 1000,
            'created_by' => $this->owner->id,
        ]);
    }

    /**
     * 1. Tạo nhóm việc cần làm thành công
     */
    public function test_can_create_task_group_successfully(): void
    {
        $this->actingAs($this->owner);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/groups", [
            'title' => 'Nhóm thiết kế UI',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('title', 'Nhóm thiết kế UI');
        $response->assertJsonPath('task_id', $this->parentTask->id);

        $this->assertDatabaseHas('task_groups', [
            'task_id' => $this->parentTask->id,
            'title' => 'Nhóm thiết kế UI',
        ]);
    }

    /**
     * 2. Không thể tạo nhóm việc cho Task con (chỉ cho phép tối đa 1 cấp)
     */
    public function test_cannot_create_task_group_on_a_subtask(): void
    {
        $this->actingAs($this->owner);

        $group = TaskGroup::create([
            'task_id' => $this->parentTask->id,
            'title' => 'Nhóm cha',
            'position' => 1,
            'created_by' => $this->owner->id,
        ]);

        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $group->id,
            'column_id' => $this->column->id,
            'title' => 'Task con cấp 1',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->postJson("/api/tasks/{$subtask->id}/groups", [
            'title' => 'Nhóm con cấp 2',
        ]);

        $response->assertStatus(403);
    }

    /**
     * 3. Đổi tên nhóm và sắp xếp lại thứ tự nhóm
     */
    public function test_can_update_and_reorder_task_groups(): void
    {
        $this->actingAs($this->owner);

        $g1 = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Nhóm 1', 'position' => 1, 'created_by' => $this->owner->id]);
        $g2 = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Nhóm 2', 'position' => 2, 'created_by' => $this->owner->id]);

        // Đổi tên nhóm 1
        $updateRes = $this->putJson("/api/tasks/{$this->parentTask->id}/groups/{$g1->id}", [
            'title' => 'Nhóm 1 Đã Đổi Tên',
        ]);
        $updateRes->assertStatus(200);
        $updateRes->assertJsonPath('title', 'Nhóm 1 Đã Đổi Tên');

        // Sắp xếp đảo vị trí
        $reorderRes = $this->patchJson("/api/tasks/{$this->parentTask->id}/groups/reorder", [
            'group_ids' => [$g2->id, $g1->id],
        ]);
        $reorderRes->assertStatus(200);

        $this->assertEquals(0, $g2->fresh()->position);
        $this->assertEquals(1, $g1->fresh()->position);
    }

    /**
     * 4. Tạo Task con bên trong nhóm cụ thể với multi-assignee
     */
    public function test_can_create_subtask_inside_specific_task_group(): void
    {
        $this->actingAs($this->owner);

        $group = TaskGroup::create([
            'task_id' => $this->parentTask->id,
            'title' => 'Frontend Tasks',
            'position' => 1,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/groups/{$group->id}/subtasks", [
            'title' => 'Xây dựng SubtaskList component',
            'priority' => 'Cao',
            'assignee_ids' => [$this->member->id],
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('title', 'Xây dựng SubtaskList component');
        $response->assertJsonPath('parent_task_id', $this->parentTask->id);
        $response->assertJsonPath('task_group_id', $group->id);

        $this->assertDatabaseHas('tasks', [
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $group->id,
            'title' => 'Xây dựng SubtaskList component',
        ]);

        $this->assertDatabaseHas('task_assignees', [
            'user_id' => $this->member->id,
        ]);
    }

    /**
     * 5. Ngăn chặn IDOR: Không thể tạo Task con vào Group thuộc Task khác
     */
    public function test_cannot_create_subtask_in_group_belonging_to_another_task_idor(): void
    {
        $this->actingAs($this->owner);

        $anotherTask = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Another Task',
            'created_by' => $this->owner->id,
        ]);

        $foreignGroup = TaskGroup::create([
            'task_id' => $anotherTask->id,
            'title' => 'Foreign Group',
            'position' => 1,
            'created_by' => $this->owner->id,
        ]);

        // Cố tình gửi task_group_id của anotherTask vào parentTask
        $response = $this->postJson("/api/tasks/{$this->parentTask->id}/subtasks", [
            'title' => 'Hacker subtask',
            'task_group_id' => $foreignGroup->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonFragment([
            'message' => 'Nhóm việc cần làm không thuộc công việc này.',
        ]);
    }

    /**
     * 6. Ngăn chặn tạo Task con cấp 3 (subtask of subtask)
     */
    public function test_cannot_create_subtask_on_a_subtask(): void
    {
        $this->actingAs($this->owner);

        $group = TaskGroup::create([
            'task_id' => $this->parentTask->id,
            'title' => 'Group 1',
            'position' => 1,
            'created_by' => $this->owner->id,
        ]);

        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $group->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask 1',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->postJson("/api/tasks/{$subtask->id}/subtasks", [
            'title' => 'Sub-subtask cấp 3',
        ]);

        $response->assertStatus(403);
    }

    /**
     * 7. Di chuyển Task con sang nhóm khác cùng thuộc Task cha
     */
    public function test_can_move_subtask_to_another_group_within_parent(): void
    {
        $this->actingAs($this->owner);

        $g1 = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Group A', 'position' => 1, 'created_by' => $this->owner->id]);
        $g2 = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Group B', 'position' => 2, 'created_by' => $this->owner->id]);

        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $g1->id,
            'column_id' => $this->column->id,
            'title' => 'Moveable subtask',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->patchJson("/api/tasks/subtasks/{$subtask->id}", [
            'task_group_id' => $g2->id,
        ]);

        $response->assertStatus(200);
        $this->assertEquals($g2->id, $subtask->fresh()->task_group_id);
    }

    /**
     * 8. Xóa nhóm rỗng: xóa ngay lập tức
     */
    public function test_delete_empty_task_group_succeeds_immediately(): void
    {
        $this->actingAs($this->owner);

        $emptyGroup = TaskGroup::create([
            'task_id' => $this->parentTask->id,
            'title' => 'Nhóm rỗng',
            'position' => 1,
            'created_by' => $this->owner->id,
        ]);

        $response = $this->deleteJson("/api/tasks/{$this->parentTask->id}/groups/{$emptyGroup->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('action', 'deleted');
        $this->assertSoftDeleted('task_groups', ['id' => $emptyGroup->id]);
    }

    /**
     * 9. Xóa nhóm đang có Task con mà không chọn phương án -> báo lỗi 422 yêu cầu chọn
     */
    public function test_delete_task_group_with_subtasks_requires_action(): void
    {
        $this->actingAs($this->owner);

        $group = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Nhóm có subtask', 'position' => 1, 'created_by' => $this->owner->id]);
        Task::create([
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $group->id,
            'column_id' => $this->column->id,
            'title' => 'Subtask 1',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->deleteJson("/api/tasks/{$this->parentTask->id}/groups/{$group->id}");

        $response->assertStatus(422);
        $response->assertJsonPath('has_subtasks', true);
        $response->assertJsonPath('subtasks_count', 1);
    }

    /**
     * 10. Xóa nhóm có Task con với action 'move': chuyển Task con sang nhóm khác
     */
    public function test_delete_task_group_with_move_action_transfers_subtasks(): void
    {
        $this->actingAs($this->owner);

        $sourceGroup = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Source Group', 'position' => 1, 'created_by' => $this->owner->id]);
        $targetGroup = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Target Group', 'position' => 2, 'created_by' => $this->owner->id]);

        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $sourceGroup->id,
            'column_id' => $this->column->id,
            'title' => 'Moving task',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->deleteJson("/api/tasks/{$this->parentTask->id}/groups/{$sourceGroup->id}", [
            'action' => 'move',
            'target_group_id' => $targetGroup->id,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('action', 'moved');
        $this->assertEquals($targetGroup->id, $subtask->fresh()->task_group_id);
        $this->assertSoftDeleted('task_groups', ['id' => $sourceGroup->id]);
    }

    /**
     * 11. Xóa nhóm có Task con với action 'trash': đưa cả nhóm và task con vào thùng rác
     */
    public function test_delete_task_group_with_trash_action_trashes_all(): void
    {
        $this->actingAs($this->owner);

        $group = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Trashable Group', 'position' => 1, 'created_by' => $this->owner->id]);
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $group->id,
            'column_id' => $this->column->id,
            'title' => 'Trashable subtask',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->deleteJson("/api/tasks/{$this->parentTask->id}/groups/{$group->id}", [
            'action' => 'trash',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('action', 'trashed');
        $this->assertSoftDeleted('task_groups', ['id' => $group->id]);
        $this->assertSoftDeleted('tasks', ['id' => $subtask->id]);
    }

    /**
     * 12. TaskDetail show API tải đúng taskGroups với subtasks và assignees
     */
    public function test_task_detail_api_eager_loads_task_groups_with_subtasks(): void
    {
        $this->actingAs($this->owner);

        $group = TaskGroup::create(['task_id' => $this->parentTask->id, 'title' => 'Eager Loaded Group', 'position' => 1, 'created_by' => $this->owner->id]);
        $subtask = Task::create([
            'parent_task_id' => $this->parentTask->id,
            'task_group_id' => $group->id,
            'column_id' => $this->column->id,
            'title' => 'Eager subtask',
            'created_by' => $this->owner->id,
        ]);
        $subtask->syncAssigneesWithAutoSplit([$this->member->id], $this->owner->id);

        $response = $this->getJson("/api/tasks/{$this->parentTask->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('task_groups.0.id', $group->id);
        $response->assertJsonPath('task_groups.0.title', 'Eager Loaded Group');
        $response->assertJsonPath('task_groups.0.subtasks.0.id', $subtask->id);
        $response->assertJsonPath('task_groups.0.subtasks.0.title', 'Eager subtask');
        $response->assertJsonPath('task_groups.0.subtasks.0.assignees.0.id', $this->member->id);
    }
}
