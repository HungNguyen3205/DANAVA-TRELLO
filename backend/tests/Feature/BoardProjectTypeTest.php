<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BoardProjectTypeTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'account_status' => 'active',
            'system_role' => 'user',
        ]);
    }

    public function test_new_board_defaults_to_simple_task_board(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/boards', ['name' => 'Việc hằng ngày']);

        $response->assertCreated()->assertJsonPath('type', 'task');
        $this->assertNull(Board::first()->manager_id);
    }

    public function test_project_board_gets_manager_and_default_status(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/boards', [
            'name' => 'Triển khai ERP',
            'type' => 'project',
            'start_date' => '2026-11-01',
            'end_date' => '2026-12-31',
            'budget' => 150000000,
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'project')
            ->assertJsonPath('project_status', 'planning')
            ->assertJsonPath('start_date', '2026-11-01')
            ->assertJsonPath('end_date', '2026-12-31')
            ->assertJsonPath('manager_id', $this->owner->id);
    }

    public function test_end_date_before_start_date_is_rejected(): void
    {
        $this->actingAs($this->owner)->postJson('/api/boards', [
            'name' => 'Sai ngày',
            'type' => 'project',
            'start_date' => '2026-12-01',
            'end_date' => '2026-11-01',
        ])->assertStatus(422)->assertJsonValidationErrors('end_date');
    }

    public function test_invalid_type_is_rejected(): void
    {
        $this->actingAs($this->owner)->postJson('/api/boards', [
            'name' => 'Lạ',
            'type' => 'epic',
        ])->assertStatus(422)->assertJsonValidationErrors('type');
    }

    public function test_task_board_can_be_upgraded_to_project_and_back(): void
    {
        $board = $this->createBoard();

        $this->actingAs($this->owner)->putJson("/api/boards/{$board->id}", ['type' => 'project'])
            ->assertOk()
            ->assertJsonPath('type', 'project')
            ->assertJsonPath('project_status', 'planning')
            ->assertJsonPath('manager_id', $this->owner->id);

        $this->actingAs($this->owner)->putJson("/api/boards/{$board->id}", [
            'project_status' => 'in_progress',
            'end_date' => '2027-01-15',
        ])->assertOk()->assertJsonPath('project_status', 'in_progress');

        $this->actingAs($this->owner)->putJson("/api/boards/{$board->id}", ['type' => 'task'])
            ->assertOk()
            ->assertJsonPath('type', 'task')
            // Project data is preserved so switching back restores it.
            ->assertJsonPath('project_status', 'in_progress')
            ->assertJsonPath('end_date', '2027-01-15');
    }

    public function test_manager_must_be_board_member(): void
    {
        $board = $this->createBoard(['type' => 'project']);
        $outsider = User::factory()->create(['account_status' => 'active']);
        $member = User::factory()->create(['account_status' => 'active']);
        DB::table('board_members')->insert([
            'board_id' => $board->id, 'user_id' => $member->id, 'role' => 'member',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($this->owner)->putJson("/api/boards/{$board->id}", ['manager_id' => $outsider->id])
            ->assertStatus(422)->assertJsonValidationErrors('manager_id');

        $this->actingAs($this->owner)->putJson("/api/boards/{$board->id}", ['manager_id' => $member->id])
            ->assertOk()->assertJsonPath('manager_id', $member->id);
    }

    public function test_regular_member_cannot_change_board_type(): void
    {
        $board = $this->createBoard();
        $member = User::factory()->create(['account_status' => 'active', 'system_role' => 'user']);
        DB::table('board_members')->insert([
            'board_id' => $board->id, 'user_id' => $member->id, 'role' => 'member',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($member)->putJson("/api/boards/{$board->id}", ['type' => 'project'])
            ->assertForbidden();

        $this->assertSame('task', $board->fresh()->type);
    }

    public function test_show_returns_project_fields(): void
    {
        $board = $this->createBoard(['type' => 'project', 'project_status' => 'on_hold', 'manager_id' => $this->owner->id]);

        $this->actingAs($this->owner)->getJson("/api/boards/{$board->id}")
            ->assertOk()
            ->assertJsonPath('type', 'project')
            ->assertJsonPath('project_status', 'on_hold')
            ->assertJsonPath('manager.id', $this->owner->id);
    }

    private function createBoard(array $attributes = []): Board
    {
        $board = Board::create(array_merge([
            'name' => 'Bảng thử',
            'owner_id' => $this->owner->id,
            'workspace_id' => null,
        ], $attributes));

        DB::table('board_members')->insert([
            'board_id' => $board->id, 'user_id' => $this->owner->id, 'role' => 'admin',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $board;
    }
}
