<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Who can add / edit / delete columns and tasks on a board.
 * Add/rename columns and tasks: every member of the board, plus project owners/managers.
 * Archive/delete columns and WIP limits: board owner/admins and project managers.
 * People who are not on the board (even system admins) cannot.
 */
class BoardPermissionMatrixTest extends TestCase
{
    use RefreshDatabase;

    private Board $board;
    private array $u = [];

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        foreach (['owner', 'boardAdmin', 'member', 'projectManager', 'sysAdmin', 'sysAdminOutside', 'outsider'] as $k) {
            $this->u[$k] = User::factory()->create([
                'account_status' => 'active',
                'system_role' => str_starts_with($k, 'sysAdmin') ? 'system_admin' : 'user',
            ]);
        }
        $project = Project::create(['name' => 'Team Marketing', 'owner_id' => $this->u['owner']->id, 'manager_id' => $this->u['projectManager']->id]);
        $this->board = Board::create(['owner_id' => $this->u['owner']->id, 'name' => 'Team Marketing', 'project_id' => $project->id]);
        foreach (['owner' => 'admin', 'boardAdmin' => 'admin', 'member' => 'member', 'sysAdmin' => 'member'] as $k => $role) {
            DB::table('board_members')->insert(['board_id' => $this->board->id, 'user_id' => $this->u[$k]->id, 'role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    private function column(): KanbanColumn
    {
        return KanbanColumn::create(['board_id' => $this->board->id, 'title' => 'Cột ' . uniqid(), 'order' => 1000]);
    }

    private function task(): Task
    {
        return Task::create(['column_id' => $this->column()->id, 'title' => 'Việc ' . uniqid(), 'order' => 1000, 'creator_id' => $this->u['owner']->id]);
    }

    /** @return array<string, array{string, bool, bool}> role => [can add/rename columns, can work on tasks] */
    public static function roles(): array
    {
        return [
            'chủ bảng' => ['owner', true, true],
            'quản trị viên bảng' => ['boardAdmin', true, true],
            'quản lý dự án (chưa được mời)' => ['projectManager', true, true],
            'admin hệ thống là thành viên' => ['sysAdmin', true, true],
            'thành viên thường' => ['member', true, true],
            'admin hệ thống chưa được mời' => ['sysAdminOutside', false, false],
            'người ngoài' => ['outsider', false, false],
        ];
    }

    /** @dataProvider roles */
    public function test_column_add_edit_delete(string $who, bool $canColumns, bool $canTasks): void
    {
        $user = $this->u[$who];
        $expect = fn ($res) => $canColumns ? $res->assertSuccessful() : $res->assertForbidden();

        $expect($this->actingAs($user)->postJson("/api/boards/{$this->board->id}/columns", ['title' => 'Cột mới']));
        $expect($this->actingAs($user)->putJson('/api/columns/' . $this->column()->id, ['title' => 'Đổi tên']));
        // Deleting a column stays with board managers (owner, board admin, project manager).
        $canDelete = in_array($who, ['owner', 'boardAdmin', 'projectManager'], true);
        $res = $this->actingAs($user)->deleteJson('/api/columns/' . $this->column()->id);
        $canDelete ? $res->assertSuccessful() : $res->assertForbidden();

        if (!$canColumns) {
            // The refusal explains itself in Vietnamese.
            $msg = $this->actingAs($user)->postJson("/api/boards/{$this->board->id}/columns", ['title' => 'X'])->json('message');
            $this->assertStringNotContainsString('This action is unauthorized', (string) $msg);
        }
    }

    /** @dataProvider roles */
    public function test_task_add_edit_delete(string $who, bool $canColumns, bool $canTasks): void
    {
        $user = $this->u[$who];
        $expect = fn ($res) => $canTasks ? $res->assertSuccessful() : $res->assertForbidden();

        $expect($this->actingAs($user)->postJson('/api/columns/' . $this->column()->id . '/tasks', ['title' => 'Việc mới']));
        $expect($this->actingAs($user)->putJson('/api/tasks/' . $this->task()->id, ['title' => 'Sửa tên việc']));
        $expect($this->actingAs($user)->deleteJson('/api/tasks/' . $this->task()->id));
    }

    public function test_board_reports_the_role_the_ui_should_use(): void
    {
        // System admin on the board: manages columns, but board settings stay with the board's admins.
        $this->actingAs($this->u['sysAdmin'])->getJson("/api/boards/{$this->board->id}")->assertOk()
            ->assertJsonPath('my_role', 'member')->assertJsonPath('can_manage_columns', true);
        $this->actingAs($this->u['member'])->getJson("/api/boards/{$this->board->id}")->assertOk()
            ->assertJsonPath('my_role', 'member')->assertJsonPath('can_manage_columns', true);
        $this->actingAs($this->u['projectManager'])->getJson("/api/boards/{$this->board->id}")->assertOk()->assertJsonPath('my_role', 'admin');
    }

    public function test_members_reorder_columns_but_only_managers_set_wip_limits(): void
    {
        $a = $this->column();
        $b = $this->column();
        $this->actingAs($this->u['member'])->putJson("/api/boards/{$this->board->id}/columns/reorder", ['columns' => [
            ['id' => $b->id, 'order' => 1000], ['id' => $a->id, 'order' => 2000],
        ]])->assertSuccessful();

        $this->actingAs($this->u['member'])->putJson("/api/columns/{$a->id}", ['wip_limit' => 5])->assertForbidden();
        $this->actingAs($this->u['boardAdmin'])->putJson("/api/columns/{$a->id}", ['wip_limit' => 5])->assertSuccessful();
    }
}
