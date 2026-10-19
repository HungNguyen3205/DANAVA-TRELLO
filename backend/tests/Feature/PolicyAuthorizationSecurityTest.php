<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Policies\BoardPolicy;
use App\Policies\KanbanColumnPolicy;
use App\Policies\TaskPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PolicyAuthorizationSecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $boardAdmin;
    private User $boardMember;
    private User $outsider;
    private User $systemAdmin;
    private Board $board;
    private KanbanColumn $column;
    private Task $rootTask;
    private Task $subtask;

    private BoardPolicy $boardPolicy;
    private KanbanColumnPolicy $columnPolicy;
    private TaskPolicy $taskPolicy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->boardPolicy = new BoardPolicy();
        $this->columnPolicy = new KanbanColumnPolicy();
        $this->taskPolicy = new TaskPolicy();

        $this->boardAdmin = User::factory()->create(['name' => 'Board Admin', 'system_role' => 'user']);
        $this->boardMember = User::factory()->create(['name' => 'Board Member', 'system_role' => 'user']);
        $this->outsider = User::factory()->create(['name' => 'Outsider', 'system_role' => 'user']);
        $this->systemAdmin = User::factory()->create(['name' => 'System Admin', 'system_role' => 'system_admin']);

        // Board-first architecture: no workspace required
        $this->board = Board::create([
            'name' => 'Policy Test Board',
            'owner_id' => $this->boardAdmin->id,
            'workspace_id' => null,
            'visibility' => 'private',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->boardAdmin->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->boardMember->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->column = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'In Progress',
            'order' => 1000,
        ]);

        $this->rootTask = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Parent Task',
            'order' => 1000,
            'parent_task_id' => null,
        ]);

        $this->subtask = Task::create([
            'column_id' => $this->column->id,
            'title' => 'Child Subtask',
            'order' => 2000,
            'parent_task_id' => $this->rootTask->id,
        ]);
    }

    public function test_board_policy_rules(): void
    {
        // view
        $this->assertTrue($this->boardPolicy->view($this->boardAdmin, $this->board));
        $this->assertTrue($this->boardPolicy->view($this->boardMember, $this->board));
        $this->assertFalse($this->boardPolicy->view($this->outsider, $this->board));
        $this->assertFalse($this->boardPolicy->view($this->systemAdmin, $this->board));

        // viewDashboard
        $this->assertTrue($this->boardPolicy->viewDashboard($this->boardAdmin, $this->board));
        $this->assertTrue($this->boardPolicy->viewDashboard($this->boardMember, $this->board));
        $this->assertFalse($this->boardPolicy->viewDashboard($this->outsider, $this->board));
        $this->assertFalse($this->boardPolicy->viewDashboard($this->systemAdmin, $this->board));

        // update
        $this->assertTrue($this->boardPolicy->update($this->boardAdmin, $this->board));
        $this->assertFalse($this->boardPolicy->update($this->boardMember, $this->board));
        $this->assertFalse($this->boardPolicy->update($this->outsider, $this->board));

        // delete
        $this->assertTrue($this->boardPolicy->delete($this->boardAdmin, $this->board));
        $this->assertFalse($this->boardPolicy->delete($this->boardMember, $this->board));
        $this->assertFalse($this->boardPolicy->delete($this->outsider, $this->board));

        // manageMembers
        $this->assertTrue($this->boardPolicy->manageMembers($this->boardAdmin, $this->board));
        $this->assertFalse($this->boardPolicy->manageMembers($this->boardMember, $this->board));
        $this->assertFalse($this->boardPolicy->manageMembers($this->outsider, $this->board));
    }

    public function test_column_policy_rules(): void
    {
        // view
        $this->assertTrue($this->columnPolicy->view($this->boardAdmin, $this->column));
        $this->assertTrue($this->columnPolicy->view($this->boardMember, $this->column));
        $this->assertFalse($this->columnPolicy->view($this->outsider, $this->column));
        $this->assertFalse($this->columnPolicy->view($this->systemAdmin, $this->column));

        // create
        $this->assertTrue($this->columnPolicy->create($this->boardAdmin, $this->board));
        $this->assertFalse($this->columnPolicy->create($this->boardMember, $this->board));
        $this->assertFalse($this->columnPolicy->create($this->outsider, $this->board));

        // update
        $this->assertTrue($this->columnPolicy->update($this->boardAdmin, $this->column));
        $this->assertFalse($this->columnPolicy->update($this->boardMember, $this->column));
        $this->assertFalse($this->columnPolicy->update($this->outsider, $this->column));

        // archive
        $this->assertTrue($this->columnPolicy->archive($this->boardAdmin, $this->column));
        $this->assertFalse($this->columnPolicy->archive($this->boardMember, $this->column));
        $this->assertFalse($this->columnPolicy->archive($this->outsider, $this->column));

        // restore
        $this->assertTrue($this->columnPolicy->restore($this->boardAdmin, $this->column));
        $this->assertFalse($this->columnPolicy->restore($this->boardMember, $this->column));
        $this->assertFalse($this->columnPolicy->restore($this->outsider, $this->column));

        // delete
        $this->assertTrue($this->columnPolicy->delete($this->boardAdmin, $this->column));
        $this->assertFalse($this->columnPolicy->delete($this->boardMember, $this->column));
        $this->assertFalse($this->columnPolicy->delete($this->outsider, $this->column));
    }

    public function test_task_policy_rules(): void
    {
        // resolveBoardId
        $this->assertEquals($this->board->id, $this->taskPolicy->resolveBoardId($this->rootTask));

        // view
        $this->assertTrue($this->taskPolicy->view($this->boardAdmin, $this->rootTask));
        $this->assertTrue($this->taskPolicy->view($this->boardMember, $this->rootTask));
        $this->assertFalse($this->taskPolicy->view($this->outsider, $this->rootTask));
        $this->assertFalse($this->taskPolicy->view($this->systemAdmin, $this->rootTask));

        // createSubtask: allowed on root task for board members, blocked for outsider
        $this->assertTrue($this->taskPolicy->createSubtask($this->boardAdmin, $this->rootTask));
        $this->assertTrue($this->taskPolicy->createSubtask($this->boardMember, $this->rootTask));
        $this->assertFalse($this->taskPolicy->createSubtask($this->outsider, $this->rootTask));

        // createSubtask: strictly forbidden on subtask (depth limit 1)
        $this->assertFalse($this->taskPolicy->createSubtask($this->boardAdmin, $this->subtask));
        $this->assertFalse($this->taskPolicy->createSubtask($this->boardMember, $this->subtask));

        // update
        $this->assertTrue($this->taskPolicy->update($this->boardAdmin, $this->rootTask));
        $this->assertTrue($this->taskPolicy->update($this->boardMember, $this->rootTask));
        $this->assertFalse($this->taskPolicy->update($this->outsider, $this->rootTask));

        // delete
        $this->assertTrue($this->taskPolicy->delete($this->boardAdmin, $this->rootTask));
        $this->assertTrue($this->taskPolicy->delete($this->boardMember, $this->rootTask));
        $this->assertFalse($this->taskPolicy->delete($this->outsider, $this->rootTask));

        // assignMember: allowed for user belonging to board, blocked for outsider
        $this->assertTrue($this->taskPolicy->assignMember($this->boardMember, $this->rootTask, $this->boardAdmin->id));
        $this->assertFalse($this->taskPolicy->assignMember($this->boardMember, $this->rootTask, $this->outsider->id));
        $this->assertFalse($this->taskPolicy->assignMember($this->outsider, $this->rootTask, $this->boardMember->id));
    }
}
