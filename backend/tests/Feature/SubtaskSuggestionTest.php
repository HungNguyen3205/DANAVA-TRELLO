<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SubtaskSuggestionTest extends TestCase
{
    use RefreshDatabase;

    private const DESCRIPTION = "1. Nền tảng DANAVA Go\n"
        . "- [ ] Tìm kiếm chuyến xe theo điểm đi, điểm đến và ngày khởi hành.\n"
        . "- [ ] Hiển thị thông tin nhà xe, lịch trình, giá vé và số ghế còn trống.\n"
        . "- [x] Hỗ trợ tiếng Việt và tiếng Anh.";

    private User $member;
    private User $colleague;
    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();
        config(['assistant.mode' => 'demo', 'assistant.gemini.api_key' => null]);
        Notification::fake();

        $this->member = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $this->colleague = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $board = Board::create(['name' => 'DANAVA Go', 'owner_id' => $this->member->id, 'workspace_id' => null]);
        foreach ([$this->member, $this->colleague] as $u) {
            DB::table('board_members')->insert(['board_id' => $board->id, 'user_id' => $u->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);
        }
        $column = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Cần làm', 'order' => 1000]);
        $this->task = $column->tasks()->create(['title' => 'Nền tảng DANAVA Go', 'description' => self::DESCRIPTION, 'priority' => 'Bình thường', 'created_by' => $this->member->id, 'order' => 1000]);
        $this->task->assignees()->sync([$this->colleague->id => ['assigned_by' => $this->member->id]]);
    }

    public function test_suggest_reads_the_checklist_without_creating_anything(): void
    {
        $res = $this->actingAs($this->member)->postJson("/api/tasks/{$this->task->id}/subtasks/ai-suggest")->assertOk();

        $this->assertSame('rules', $res->json('engine'));
        $this->assertSame([
            ['title' => 'Tìm kiếm chuyến xe theo điểm đi, điểm đến và ngày khởi hành.', 'done' => false],
            ['title' => 'Hiển thị thông tin nhà xe, lịch trình, giá vé và số ghế còn trống.', 'done' => false],
            ['title' => 'Hỗ trợ tiếng Việt và tiếng Anh.', 'done' => true],
        ], $res->json('subtasks'));
        $this->assertSame(0, $this->task->subtasks()->count());
    }

    public function test_suggest_uses_gemini_when_configured(): void
    {
        config(['assistant.mode' => 'live', 'assistant.gemini.api_key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => json_encode(['subtasks' => [
                ['title' => '- [ ] Tìm kiếm chuyến xe', 'done' => false],
                ['title' => 'Tìm kiếm chuyến xe', 'done' => false],
                ['title' => 'Hỗ trợ tiếng Anh', 'done' => true],
            ]])]]]]],
            'usageMetadata' => ['totalTokenCount' => 10],
        ])]);

        $res = $this->actingAs($this->member)->postJson("/api/tasks/{$this->task->id}/subtasks/ai-suggest")->assertOk();

        $this->assertSame('gemini', $res->json('engine'));
        // Markers stripped and the duplicate dropped.
        $this->assertSame([['title' => 'Tìm kiếm chuyến xe', 'done' => false], ['title' => 'Hỗ trợ tiếng Anh', 'done' => true]], $res->json('subtasks'));
    }

    public function test_suggest_needs_a_description_and_board_membership(): void
    {
        $outsider = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $this->actingAs($outsider)->postJson("/api/tasks/{$this->task->id}/subtasks/ai-suggest")->assertForbidden();

        $this->task->update(['description' => '']);
        $this->actingAs($this->member)->postJson("/api/tasks/{$this->task->id}/subtasks/ai-suggest")->assertStatus(422);
    }

    public function test_bulk_creates_reviewed_subtasks_with_the_parents_assignees(): void
    {
        $this->actingAs($this->member)->postJson("/api/tasks/{$this->task->id}/subtasks/bulk", [
            'subtasks' => [['title' => 'Tìm kiếm chuyến xe', 'done' => false], ['title' => 'Hỗ trợ tiếng Anh', 'done' => true]],
            'copy_parent_assignees' => true,
        ])->assertCreated()->assertJson(['created' => 2]);

        $subs = $this->task->subtasks()->with('assignees')->get();
        $this->assertSame(['Tìm kiếm chuyến xe', 'Hỗ trợ tiếng Anh'], $subs->pluck('title')->all());
        $this->assertSame([$this->colleague->id], $subs[0]->assignees->pluck('id')->all());
        $this->assertNull($subs[0]->completed_at);
        $this->assertNotNull($subs[1]->completed_at);
    }

    public function test_outsider_cannot_bulk_create(): void
    {
        $outsider = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $this->actingAs($outsider)->postJson("/api/tasks/{$this->task->id}/subtasks/bulk", ['subtasks' => [['title' => 'X']]])->assertForbidden();
        $this->assertSame(0, $this->task->subtasks()->count());
    }
}
