<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MyTasksMentionScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_scope_filters_assigned_and_mentioned_tasks()
    {
        $me = User::factory()->create(['username' => 'hung']);
        $other = User::factory()->create(['username' => 'hung.nguyen']);

        $board = Board::create(['owner_id' => $other->id, 'name' => 'B']);
        $board->members()->attach($me->id, ['role' => 'member']);
        $board->members()->attach($other->id, ['role' => 'admin']);
        $col = KanbanColumn::create(['board_id' => $board->id, 'title' => 'To Do', 'order' => 1]);

        $assigned = Task::create(['column_id' => $col->id, 'assignee_id' => $me->id, 'title' => 'Assigned', 'order' => 1]);
        $tagged = Task::create(['column_id' => $col->id, 'assignee_id' => $other->id, 'title' => 'Tagged', 'order' => 2]);
        $lookalike = Task::create(['column_id' => $col->id, 'assignee_id' => $other->id, 'title' => 'Lookalike', 'order' => 3]);

        TaskComment::create(['task_id' => $tagged->id, 'user_id' => $other->id, 'content' => 'Nhờ @hung xem giúp']);
        TaskComment::create(['task_id' => $lookalike->id, 'user_id' => $other->id, 'content' => '@hung.nguyen tự làm']);

        $this->actingAs($me);
        $titles = fn ($q) => collect($this->getJson('/api/me/tasks' . $q)->assertOk()->json('data'))->pluck('title')->sort()->values()->all();

        $this->assertSame(['Assigned'], $titles(''));
        $this->assertSame(['Tagged'], $titles('?scope=mentioned'));
        $this->assertSame(['Assigned', 'Tagged'], $titles('?scope=assigned_or_mentioned'));
    }
}
