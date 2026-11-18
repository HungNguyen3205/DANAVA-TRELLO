<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** "Việc của tôi" on a board keeps cards whose sub-tasks are assigned to me. */
class KanbanMySubtaskFlagTest extends TestCase
{
    use RefreshDatabase;

    public function test_cards_are_flagged_when_a_subtask_at_any_depth_is_mine()
    {
        $me = User::factory()->create();
        $other = User::factory()->create();

        $board = Board::create(['owner_id' => $other->id, 'name' => 'B']);
        $board->members()->attach($me->id, ['role' => 'member']);
        $board->members()->attach($other->id, ['role' => 'admin']);
        $col = KanbanColumn::create(['board_id' => $board->id, 'title' => 'To Do', 'order' => 1]);

        $task = fn (array $a) => Task::create(array_merge(['column_id' => $col->id, 'order' => 1], $a));

        $viaAssignee = $task(['title' => 'Sub assignee', 'assignee_id' => $other->id]);
        $task(['title' => 's1', 'parent_task_id' => $viaAssignee->id, 'assignee_id' => $me->id]);

        $viaCoAssignee = $task(['title' => 'Sub co-assignee', 'assignee_id' => $other->id]);
        $s2 = $task(['title' => 's2', 'parent_task_id' => $viaCoAssignee->id, 'assignee_id' => $other->id]);
        $s2->assignees()->attach($me->id);

        $nested = $task(['title' => 'Nested', 'assignee_id' => $other->id]);
        $mid = $task(['title' => 'mid', 'parent_task_id' => $nested->id, 'assignee_id' => $other->id]);
        $task(['title' => 'deep', 'parent_task_id' => $mid->id, 'assignee_id' => $me->id]);

        $notMine = $task(['title' => 'Not mine', 'assignee_id' => $other->id]);
        $task(['title' => 's4', 'parent_task_id' => $notMine->id, 'assignee_id' => $other->id]);

        $archived = $task(['title' => 'Archived sub', 'assignee_id' => $other->id]);
        $task(['title' => 's5', 'parent_task_id' => $archived->id, 'assignee_id' => $me->id, 'archived_at' => now()]);

        $this->actingAs($me);
        $flags = collect($this->getJson("/api/boards/{$board->id}/kanban")->assertOk()->json('0.tasks'))
            ->mapWithKeys(fn ($t) => [$t['title'] => $t['has_my_subtask']])
            ->all();

        $this->assertSame([
            'Sub assignee' => true,
            'Sub co-assignee' => true,
            'Nested' => true,
            'Not mine' => false,
            'Archived sub' => false,
        ], $flags);
    }
}
