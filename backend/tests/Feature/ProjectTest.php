<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $alice;
    private User $bob;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['system_role' => 'system_admin', 'account_status' => 'active']);
        $this->alice = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $this->bob = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
    }

    private function board(User $owner, ?Project $project = null, string $name = 'Bảng'): Board
    {
        $board = Board::create(['owner_id' => $owner->id, 'name' => $name, 'project_id' => $project?->id]);
        DB::table('board_members')->insert(['board_id' => $board->id, 'user_id' => $owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()]);

        return $board;
    }

    private function task(Board $board, string $column, array $attrs = []): Task
    {
        $col = KanbanColumn::firstOrCreate(['board_id' => $board->id, 'title' => $column], ['order' => 1000]);

        return Task::create(array_merge(['column_id' => $col->id, 'title' => 'Việc ' . uniqid(), 'order' => 1000, 'creator_id' => $board->owner_id], $attrs));
    }

    public function test_create_project_and_a_board_inside_it(): void
    {
        $id = $this->actingAs($this->alice)->postJson('/api/projects', ['name' => 'Ra mắt app', 'status' => 'in_progress'])
            ->assertCreated()->assertJsonPath('can_manage', true)->json('id');

        $board = $this->actingAs($this->alice)->postJson('/api/boards', ['name' => 'Thiết kế', 'project_id' => $id])
            ->assertCreated()->json();

        $this->assertSame($id, $board['project_id']);
        $this->actingAs($this->alice)->getJson('/api/projects/' . $id)
            ->assertOk()->assertJsonPath('boards.0.name', 'Thiết kế')->assertJsonPath('boards_count', 1);
    }

    public function test_progress_counts_done_and_overdue_main_tasks(): void
    {
        $project = Project::create(['name' => 'P', 'owner_id' => $this->alice->id]);
        $board = $this->board($this->alice, $project);
        $this->task($board, 'Hoàn thành');
        $this->task($board, 'Đang thực hiện', ['due_date' => now()->subDays(3)]);
        $parent = $this->task($board, 'Đang thực hiện');
        $this->task($board, 'Đang thực hiện', ['parent_task_id' => $parent->id]); // subtasks are not counted
        $this->task($board, 'Đang thực hiện', ['completed_at' => now()]);

        $this->actingAs($this->alice)->getJson('/api/projects/' . $project->id)
            ->assertOk()
            ->assertJsonPath('stats.tasks', 4)
            ->assertJsonPath('stats.done', 2)
            ->assertJsonPath('stats.overdue', 1)
            ->assertJsonPath('stats.progress', 50);
    }

    public function test_people_only_see_projects_they_work_in_and_only_their_boards(): void
    {
        $project = Project::create(['name' => 'Chung', 'owner_id' => $this->admin->id]);
        $this->board($this->alice, $project, 'Của Alice');
        $this->board($this->bob, $project, 'Của Bob');
        $other = Project::create(['name' => 'Khác', 'owner_id' => $this->admin->id]);
        $this->board($this->bob, $other);

        $this->actingAs($this->alice)->getJson('/api/projects')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Chung');
        $this->actingAs($this->alice)->getJson('/api/projects/' . $project->id)
            ->assertOk()->assertJsonCount(1, 'boards')->assertJsonPath('boards.0.name', 'Của Alice')->assertJsonPath('hidden_boards_count', 1);
        $this->actingAs($this->alice)->getJson('/api/projects/' . $other->id)->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/projects')->assertOk()->assertJsonCount(2);
    }

    public function test_only_owner_manager_or_admin_edit_or_delete_and_boards_are_kept(): void
    {
        $project = Project::create(['name' => 'P', 'owner_id' => $this->alice->id]);
        $board = $this->board($this->bob, $project);

        $this->actingAs($this->bob)->putJson('/api/projects/' . $project->id, ['name' => 'X'])->assertForbidden();
        $this->actingAs($this->alice)->putJson('/api/projects/' . $project->id, ['name' => 'Đổi tên', 'manager_id' => $this->bob->id])
            ->assertOk()->assertJsonPath('name', 'Đổi tên');
        $this->actingAs($this->bob)->putJson('/api/projects/' . $project->id, ['status' => 'on_hold'])->assertOk();

        $this->actingAs($this->admin)->deleteJson('/api/projects/' . $project->id)->assertOk();
        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
        $this->assertNull($board->fresh()->project_id);
    }

    public function test_moving_boards_between_projects_needs_board_admin(): void
    {
        $a = Project::create(['name' => 'A', 'owner_id' => $this->alice->id]);
        $board = $this->board($this->alice, null);
        DB::table('board_members')->insert(['board_id' => $board->id, 'user_id' => $this->bob->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);
        $b = Project::create(['name' => 'B', 'owner_id' => $this->bob->id]);

        // Bob is only a member of the board: he cannot move it into his project.
        $this->actingAs($this->bob)->postJson("/api/projects/{$b->id}/boards", ['board_id' => $board->public_id])->assertForbidden();

        $this->actingAs($this->alice)->postJson("/api/projects/{$a->id}/boards", ['board_id' => $board->public_id])->assertOk();
        $this->assertSame($a->id, $board->fresh()->project_id);

        $this->actingAs($this->alice)->putJson('/api/boards/' . $board->id, ['project_id' => null])->assertOk();
        $this->assertNull($board->fresh()->project_id);

        $this->actingAs($this->alice)->postJson('/api/boards', ['name' => 'Lén', 'project_id' => $b->id])->assertForbidden();
    }

    public function test_project_owner_and_manager_have_full_rights_on_the_projects_boards(): void
    {
        $project = Project::create(['name' => 'P', 'owner_id' => $this->admin->id, 'manager_id' => $this->alice->id]);
        $board = $this->board($this->bob, $project, 'Bảng của Bob'); // Alice was never invited
        $column = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Việc cần làm', 'order' => 1000]);

        $this->actingAs($this->alice)->getJson('/api/boards/' . $board->id)
            ->assertOk()->assertJsonPath('my_role', 'admin')->assertJsonPath('is_owner', true)->assertJsonPath('via_project', true);
        $this->actingAs($this->alice)->getJson('/api/me/boards')->assertOk()->assertJsonFragment(['name' => 'Bảng của Bob', 'my_role' => 'admin']);
        $this->actingAs($this->alice)->putJson('/api/boards/' . $board->id, ['name' => 'Đổi tên'])->assertOk();
        $this->actingAs($this->alice)->postJson('/api/boards/' . $board->id . '/columns', ['title' => 'Cột mới'])->assertSuccessful();
        $this->actingAs($this->alice)->postJson('/api/columns/' . $column->id . '/tasks', ['title' => 'Việc do quản lý tạo'])->assertSuccessful();
        $this->actingAs($this->alice)->getJson('/api/projects/' . $project->id)->assertOk()->assertJsonPath('hidden_boards_count', 0);

        // The project owner too, and both may delete the board.
        $this->actingAs($this->admin)->getJson('/api/boards/' . $board->id)->assertOk()->assertJsonPath('my_role', 'admin');
        $this->actingAs($this->alice)->deleteJson('/api/boards/' . $board->id)->assertSuccessful();
    }

    public function test_managing_one_project_gives_no_rights_on_other_projects_boards(): void
    {
        Project::create(['name' => 'Của Alice', 'owner_id' => $this->alice->id]);
        $other = Project::create(['name' => 'Khác', 'owner_id' => $this->bob->id]);
        $board = $this->board($this->bob, $other);
        $loose = $this->board($this->bob, null);

        $this->actingAs($this->alice)->getJson('/api/boards/' . $board->id)->assertForbidden();
        $this->actingAs($this->alice)->getJson('/api/boards/' . $loose->id)->assertForbidden();
        $this->actingAs($this->alice)->putJson('/api/boards/' . $board->id, ['name' => 'X'])->assertForbidden();
        $this->actingAs($this->alice)->getJson('/api/me/boards')->assertOk()->assertJsonMissing(['id' => $board->id]);
    }

    public function test_project_cover_photo_upload_and_remove(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $project = Project::create(['name' => 'P', 'owner_id' => $this->alice->id]);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');

        $this->actingAs($this->bob)->post("/api/projects/{$project->id}/cover", ['image' => \Illuminate\Http\UploadedFile::fake()->createWithContent('bia.png', $png)], ['Accept' => 'application/json'])
            ->assertForbidden();
        $cover = $this->actingAs($this->alice)->post("/api/projects/{$project->id}/cover", ['image' => \Illuminate\Http\UploadedFile::fake()->createWithContent('bia.png', $png)], ['Accept' => 'application/json'])
            ->assertOk()->json('cover_image');
        $this->assertStringStartsWith('/storage/project-covers/', $cover);
        \Illuminate\Support\Facades\Storage::disk('public')->assertExists(substr($cover, strlen('/storage/')));

        $this->actingAs($this->alice)->deleteJson("/api/projects/{$project->id}/cover")->assertOk()->assertJsonPath('cover_image', null);
        \Illuminate\Support\Facades\Storage::disk('public')->assertMissing(substr($cover, strlen('/storage/')));
    }
}
