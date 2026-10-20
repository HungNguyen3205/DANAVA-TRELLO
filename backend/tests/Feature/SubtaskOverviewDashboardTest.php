<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskGroup;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

class SubtaskOverviewDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_subtask_assignee_is_counted_in_personal_overview_dashboard(): void
    {
        $owner = User::factory()->create(['name' => 'Owner Alice']);
        $worker = User::factory()->create(['name' => 'Worker Bob']);

        $board = Board::create(['owner_id' => $owner->id, 'name' => 'Product Board']);
        $board->members()->attach([
            $owner->id => ['role' => 'admin'],
            $worker->id => ['role' => 'member'],
        ]);

        $todoCol = KanbanColumn::create(['board_id' => $board->id, 'title' => 'To Do', 'order' => 1]);
        $doneCol = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Done', 'order' => 2]);

        // Parent task assigned to Owner Alice
        $parentTask = Task::create([
            'column_id' => $todoCol->id,
            'title' => 'Main Feature Spec',
            'assignee_id' => $owner->id,
            'order' => 1,
            'created_by' => $owner->id,
        ]);

        // Subtask 1 assigned to Worker Bob (active)
        $subtask1 = Task::create([
            'parent_task_id' => $parentTask->id,
            'column_id' => $todoCol->id,
            'title' => 'Build API Subtask',
            'assignee_id' => $worker->id,
            'order' => 1,
            'due_date' => Carbon::now()->addDays(3)->toDateString(),
            'created_by' => $owner->id,
        ]);
        DB::table('task_assignees')->insert([
            'task_id' => $subtask1->id,
            'user_id' => $worker->id,
            'contribution_percent' => 100,
            'assigned_by' => $owner->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Subtask 2 assigned to Worker Bob (completed via completed_at)
        $subtask2 = Task::create([
            'parent_task_id' => $parentTask->id,
            'column_id' => $todoCol->id,
            'title' => 'Write Unit Tests Subtask',
            'assignee_id' => $worker->id,
            'order' => 2,
            'completed_at' => Carbon::now(),
            'created_by' => $owner->id,
        ]);
        DB::table('task_assignees')->insert([
            'task_id' => $subtask2->id,
            'user_id' => $worker->id,
            'contribution_percent' => 100,
            'assigned_by' => $owner->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Worker Bob requests personal dashboard
        $this->actingAs($worker);

        $response = $this->getJson('/api/analytics/overview?scope=personal&refresh=1');
        $response->assertStatus(200);

        $data = $response->json();
        $summary = $data['summary'];

        // Worker Bob should have 2 total tasks (both subtasks)
        $this->assertEquals(2, $summary['total_tasks']);
        $this->assertEquals(1, $summary['completed_tasks']);
        $this->assertEquals(1, $summary['active_tasks']);
        $this->assertEquals(50, $summary['completion_rate']);

        // Check workload for Worker Bob
        $workload = collect($data['workload']);
        $boardWorkload = $workload->firstWhere('name', 'Product Board');
        $this->assertNotNull($boardWorkload, 'Personal workload should group by board');
        $this->assertEquals(1, $boardWorkload['tasks']);
        $this->assertEquals(1, $boardWorkload['completed']);

        // Check upcoming deadlines contains the subtask
        $deadlines = collect($data['upcoming_deadlines']);
        $deadlineTask = $deadlines->firstWhere('id', $subtask1->id);
        $this->assertNotNull($deadlineTask);
        $this->assertEquals('Build API Subtask', $deadlineTask['title']);
    }

    public function test_subtask_assignee_is_counted_in_team_overview_workload(): void
    {
        $owner = User::factory()->create(['name' => 'Alice Admin']);
        $dev1 = User::factory()->create(['name' => 'Bob Dev']);
        $dev2 = User::factory()->create(['name' => 'Charlie Subtasker']);

        $board = Board::create(['owner_id' => $owner->id, 'name' => 'Engineering']);
        $board->members()->attach([
            $owner->id => ['role' => 'admin'],
            $dev1->id => ['role' => 'member'],
            $dev2->id => ['role' => 'member'],
        ]);

        $col = KanbanColumn::create(['board_id' => $board->id, 'title' => 'In Progress', 'order' => 1]);

        // Parent task assigned to Dev 1
        $parentTask = Task::create([
            'column_id' => $col->id,
            'title' => 'Backend Refactoring',
            'assignee_id' => $dev1->id,
            'order' => 1,
            'created_by' => $owner->id,
        ]);
        DB::table('task_assignees')->insert([
            'task_id' => $parentTask->id,
            'user_id' => $dev1->id,
            'contribution_percent' => 100,
            'assigned_by' => $owner->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Subtask assigned to Dev 2 via task_assignees (with null assignee_id on tasks table)
        $subtask = Task::create([
            'parent_task_id' => $parentTask->id,
            'column_id' => $col->id,
            'title' => 'Database Index Optimization',
            'assignee_id' => null, // legacy null, only in task_assignees
            'order' => 1,
            'completed_at' => Carbon::now(),
            'created_by' => $owner->id,
        ]);
        DB::table('task_assignees')->insert([
            'task_id' => $subtask->id,
            'user_id' => $dev2->id,
            'contribution_percent' => 100,
            'assigned_by' => $owner->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($owner);

        $response = $this->getJson('/api/analytics/overview?scope=team&refresh=1');
        $response->assertStatus(200);

        $data = $response->json();
        $workload = collect($data['workload']);

        // Charlie Subtasker must be in workload with 1 completed task
        $charlie = $workload->firstWhere('name', 'Charlie Subtasker');
        $this->assertNotNull($charlie, 'Charlie who worked on subtask must be counted in team workload');
        $this->assertEquals(1, $charlie['completed']);
        $this->assertEquals(0, $charlie['tasks']);

        // Dev 1 should also be present with 1 in-progress task
        $bob = $workload->firstWhere('name', 'Bob Dev');
        $this->assertNotNull($bob);
        $this->assertEquals(1, $bob['tasks']);
    }

    public function test_board_member_workload_includes_subtask_with_null_column(): void
    {
        $owner = User::factory()->create(['name' => 'Lead']);
        $worker = User::factory()->create(['name' => 'Coder']);

        $board = Board::create(['owner_id' => $owner->id, 'name' => 'Sprint Alpha']);
        $board->members()->attach([
            $owner->id => ['role' => 'admin'],
            $worker->id => ['role' => 'member'],
        ]);

        $col = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Dev', 'order' => 1]);

        $parent = Task::create([
            'column_id' => $col->id,
            'title' => 'Epic Feature',
            'assignee_id' => $owner->id,
            'order' => 1,
        ]);

        $deletedCol = KanbanColumn::create([
            'board_id' => $board->id,
            'title' => 'Old Archive',
            'order' => 2,
            'deleted_at' => Carbon::now(),
        ]);

        $sub = Task::create([
            'parent_task_id' => $parent->id,
            'column_id' => $deletedCol->id,
            'title' => 'Child Implementation',
            'assignee_id' => $worker->id,
            'order' => 1,
            'completed_at' => Carbon::now(),
        ]);
        DB::table('task_assignees')->insert([
            'task_id' => $sub->id,
            'user_id' => $worker->id,
            'contribution_percent' => 100,
            'assigned_by' => $owner->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($owner);

        $response = $this->getJson("/api/boards/{$board->id}/dashboard/member-workload");
        $response->assertStatus(200);

        $members = $response->json('members');
        $coderData = collect($members)->firstWhere('id', $worker->id);
        $this->assertNotNull($coderData);
        $this->assertEquals(1, $coderData['assigned']);
        $this->assertEquals(1, $coderData['completed']);
    }
}
