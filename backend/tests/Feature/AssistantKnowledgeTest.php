<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** The assistant answers from data retrieved by keywords, scoped to what the asker may see. */
class AssistantKnowledgeTest extends TestCase
{
    use RefreshDatabase;

    private User $me;
    private User $trang;
    private User $stranger;
    private Board $sales;
    private Board $secret;

    protected function setUp(): void
    {
        parent::setUp();
        config(['assistant.mode' => 'demo', 'assistant.gemini.api_key' => null]);

        $this->me = $this->person('Nguyễn Nam Hùng', 'namhung');
        $this->trang = $this->person('Phạm Thu Trang', 'trangpham');
        $this->stranger = $this->person('Lê Bí Mật', 'bimat');

        $this->sales = $this->board('Kinh doanh DC Center', [$this->me, $this->trang]);
        $this->secret = $this->board('Ban giám đốc', [$this->stranger, $this->trang]);

        $this->task($this->sales, 'Gửi báo giá cho DC Center', [$this->trang], 'Khẩn cấp', '2020-01-02');
        $this->task($this->sales, 'Chuẩn bị hợp đồng DC Center', [$this->me], 'Cao', null);
        $this->task($this->sales, 'Đã gọi điện khách', [$this->me], 'Bình thường', null, done: true);
        $this->task($this->secret, 'Báo giá mật cho đối thủ', [$this->trang], 'Cao', null);
    }

    private function person(string $name, string $username): User
    {
        return User::factory()->create(['name' => $name, 'username' => $username, 'account_status' => 'active', 'system_role' => 'user']);
    }

    private function board(string $name, array $members): Board
    {
        $board = Board::create(['name' => $name, 'owner_id' => $members[0]->id, 'workspace_id' => null]);
        foreach ($members as $m) {
            DB::table('board_members')->insert(['board_id' => $board->id, 'user_id' => $m->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);
        }
        KanbanColumn::create(['board_id' => $board->id, 'title' => 'Đang làm', 'order' => 1000]);
        KanbanColumn::create(['board_id' => $board->id, 'title' => 'Hoàn thành', 'order' => 2000]);

        return $board;
    }

    private function task(Board $board, string $title, array $assignees, string $priority, ?string $due, bool $done = false): Task
    {
        $column = $board->columns()->orderBy('order')->get()[$done ? 1 : 0];
        $task = $column->tasks()->create([
            'title' => $title, 'priority' => $priority, 'due_date' => $due, 'created_by' => $board->owner_id,
            'order' => 1000, 'completed_at' => $done ? now() : null,
        ]);
        $task->syncAssigneesWithAutoSplit(array_map(fn ($u) => $u->id, $assignees), $board->owner_id);

        return $task;
    }

    private function ask(string $question, ?User $as = null): string
    {
        return $this->actingAs($as ?? $this->me)->postJson('/api/assistant/chat', ['message' => $question])
            ->assertOk()->json('reply.content');
    }

    public function test_board_question_returns_progress_and_tasks_of_that_board(): void
    {
        $answer = $this->ask('Bảng Kinh doanh DC Center đang thế nào?');

        $this->assertStringContainsString('### ', $answer);
        $this->assertStringContainsString('Kinh doanh DC Center', $answer);
        $this->assertStringContainsString('**1/3**', $answer); // 1 of 3 tasks done
        $this->assertStringContainsString('Gửi báo giá cho DC Center', $answer);
        $this->assertStringNotContainsString('Báo giá mật', $answer);
    }

    public function test_person_question_only_shows_tasks_on_shared_boards(): void
    {
        $answer = $this->ask('Phạm Thu Trang đang làm những việc gì?');

        $this->assertStringContainsString('Phạm Thu Trang', $answer);
        $this->assertStringContainsString('Gửi báo giá cho DC Center', $answer);
        $this->assertStringNotContainsString('Báo giá mật cho đối thủ', $answer); // board the asker is not in
    }

    public function test_keyword_search_is_accent_insensitive_and_scoped(): void
    {
        $answer = $this->ask('tim giup em viec bao gia');

        $this->assertStringContainsString('Gửi báo giá cho DC Center', $answer);
        $this->assertStringNotContainsString('Báo giá mật', $answer);
    }

    public function test_answers_are_personal(): void
    {
        $mine = $this->ask('Tôi có việc gì cần làm?');
        $hers = $this->ask('Tôi có việc gì cần làm?', $this->trang);

        $this->assertStringContainsString('**Hùng**', $mine);
        $this->assertStringContainsString('Chuẩn bị hợp đồng DC Center', $mine);
        $this->assertStringNotContainsString('Gửi báo giá cho DC Center', $mine);

        $this->assertStringContainsString('**Trang**', $hers);
        $this->assertStringContainsString('Gửi báo giá cho DC Center', $hers);
    }

    public function test_overdue_question_lists_overdue_tasks(): void
    {
        $answer = $this->ask('Việc nào của tôi bị quá hạn?', $this->trang);

        $this->assertStringContainsString('quá hạn', $answer);
        $this->assertStringContainsString('Gửi báo giá cho DC Center', $answer);
        $this->assertStringContainsString('🔴', $answer);
    }

    public function test_attendance_question_returns_attendance_section(): void
    {
        $answer = $this->ask('Tháng này tôi đi trễ mấy lần?');

        $this->assertStringContainsString('🕘', $answer);
        $this->assertStringContainsString('Đi trễ', $answer);
    }

    public function test_gemini_receives_only_retrieved_scoped_data_and_formatting_rules(): void
    {
        config(['assistant.mode' => 'live', 'assistant.gemini.api_key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => "### 📋 Bảng Kinh doanh\n- **Gửi báo giá**"]]]]],
        ])]);

        $answer = $this->ask('Bảng Kinh doanh DC Center có việc gì gấp?');

        $this->assertStringContainsString('### 📋 Bảng Kinh doanh', $answer);
        Http::assertSent(function ($req) {
            $system = $req['systemInstruction']['parts'][0]['text'];

            return str_contains($system, 'Markdown')
                && str_contains($system, 'Gửi báo giá cho DC Center')
                && !str_contains($system, 'Báo giá mật')
                && !str_contains($system, '@'); // no e-mail addresses
        });
    }

    public function test_how_to_questions_are_answered_from_the_user_guide(): void
    {
        $reply = $this->ask('Làm sao để mời người vào bảng?');

        $this->assertStringContainsString('Mời thành viên', $reply);
        $this->assertStringContainsString('1. ', $reply);
        $this->assertStringContainsString('Hướng dẫn sử dụng', $reply);
        $this->assertStringNotContainsString('Việc của anh/chị', $reply); // no task list mixed in
    }

    public function test_guide_page_lists_sections_without_internal_keywords(): void
    {
        $sections = $this->actingAs($this->me)->getJson('/api/guide')->assertOk()->json('sections');

        $this->assertNotEmpty($sections);
        $this->assertArrayHasKey('steps', $sections[0]);
        $this->assertArrayNotHasKey('keywords', $sections[0]);
    }
}
