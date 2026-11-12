<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Models\UserAlias;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AssistantTest extends TestCase
{
    use RefreshDatabase;

    private const MESSAGE = <<<TXT
anh em xác nhận để biết triển khai việc nhé!
Công việc vào nhốm tất cả làm việc theo quy trình trên Workspace @All
TODO
1. Gửi LDP BĐS Demo cho KNQ @Nguyễn Nam Hùng @Nam Nam  Nam Review test trước khi gửi
2. @Ngọc Hân Test Gmail inform cho Masa One vào sử dùng flow up hỗ trợ DONE task này
3. Hùng IT lên các gói cho LAPILATES
4. Cổng thanh toán @Trần Danh Đại THÀNH
5. Gửi báo giá cho DC Center @Trang Phạm
6. @Phi Trần Review lại lên kế hoạch truyền thông Thu Lead cho Giải pháp Phần mềm
7. @Chú Nam Con Ông Thành Lên Video giới thiệu tính năng DANAVA Studio
8. @P T Mạnh Cường Chăm sóc khách đã được giao, Gửi mời trải nghiệm phần mềm 50 Club/ ngày A DATA Có sẵn và có thể tự tìm (Chiến đi em có cả đội hỗ trợ)
@Thuần Anh Thuần lên final giúp em DANAVAGo, để hẹn MEETING vời nhà xe sóm ạ

Còn nhiều việc pending cả nhà cố gắng phối hợp thực hiện!
Hôm nay quyết CHỐT DOANH NGHIỆP DC CENTER 9K hội viên
GẤP BÁO GIÁ
TXT;

    private User $boss;
    private array $u = [];
    private Board $sales;
    private Board $tech;

    protected function setUp(): void
    {
        parent::setUp();
        config(['assistant.mode' => 'demo', 'assistant.gemini.api_key' => null]);
        Notification::fake();

        $this->boss = $this->person('Admin Danava', 'admin');
        foreach ([
            'hung' => ['Nguyễn Nam Hùng', 'namhung'],
            'han' => ['Nguyễn Ngọc Hân', 'ngochan'],
            'dai' => ['Trần Danh Đại', 'danhdai'],
            'trang' => ['Trang Phạm', 'trangpham'],
            'phi' => ['Trần Phi', 'tranphi'],
            'outsider' => ['Lê Văn Ngoài', 'ngoai'],
        ] as $k => [$name, $username]) {
            $this->u[$k] = $this->person($name, $username);
        }

        $this->sales = $this->board('Kinh doanh DC Center', 'Báo giá và chăm sóc khách hàng doanh nghiệp DC Center');
        $this->tech = $this->board('Phát triển DANAVA Studio', 'Video, tính năng và sản phẩm DANAVA Studio');
        foreach (['hung', 'han', 'dai', 'trang', 'phi'] as $k) {
            foreach ([$this->sales, $this->tech] as $b) {
                DB::table('board_members')->insert(['board_id' => $b->id, 'user_id' => $this->u[$k]->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    private function person(string $name, string $username): User
    {
        return User::factory()->create(['name' => $name, 'username' => $username, 'account_status' => 'active', 'system_role' => 'user']);
    }

    private function board(string $name, string $description): Board
    {
        $board = Board::create(['name' => $name, 'description' => $description, 'owner_id' => $this->boss->id, 'workspace_id' => null]);
        DB::table('board_members')->insert(['board_id' => $board->id, 'user_id' => $this->boss->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()]);
        foreach (['Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành'] as $i => $title) {
            KanbanColumn::create(['board_id' => $board->id, 'title' => $title, 'order' => ($i + 1) * 1000]);
        }

        return $board;
    }

    private function preview(): array
    {
        return $this->actingAs($this->boss)->postJson('/api/assistant/tasks/preview', ['text' => self::MESSAGE])
            ->assertOk()->json();
    }

    public function test_rules_engine_splits_the_real_message_into_nine_tasks(): void
    {
        $p = $this->preview();

        $this->assertSame('rules', $p['engine']);
        $this->assertCount(9, $p['tasks']);
        $this->assertStringStartsWith('Gửi LDP BĐS Demo cho KNQ', $p['tasks'][0]['title']);
        $this->assertStringContainsString('final', $p['tasks'][8]['title']);
    }

    public function test_mentions_are_resolved_to_the_right_people(): void
    {
        $t = $this->preview()['tasks'];

        $this->assertSame([$this->u['hung']->id], $t[0]['assignee_ids']);
        $this->assertSame('unknown', collect($t[0]['mentions'])->firstWhere('raw', 'Nam Nam Nam')['status']);
        $this->assertSame([$this->u['han']->id], $t[1]['assignee_ids']);       // "@Ngọc Hân" -> Nguyễn Ngọc Hân
        $this->assertSame([$this->u['dai']->id], $t[3]['assignee_ids']);       // "@Trần Danh Đại THÀNH"
        $this->assertSame([$this->u['trang']->id], $t[4]['assignee_ids']);
        $this->assertSame([], $t[5]['assignee_ids']);                          // "Phi Trần" is reversed: not guessed
        $this->assertSame('Phi Trần', $t[5]['mentions'][0]['raw']);
        $this->assertSame('Chú Nam Con Ông Thành', $t[6]['mentions'][0]['raw']);
        $this->assertSame('P T Mạnh Cường', $t[7]['mentions'][0]['raw']);
        $this->assertStringNotContainsString('@', $t[4]['title']);
    }

    public function test_done_urgency_due_date_and_board_are_detected(): void
    {
        $t = $this->preview()['tasks'];

        $this->assertTrue($t[1]['done']);
        $this->assertFalse($t[0]['done']);
        // "GẤP BÁO GIÁ ... DC CENTER" at the end of the message applies to task 5.
        $this->assertSame('Khẩn cấp', $t[4]['priority']);
        $this->assertNotNull($t[4]['due_date']);
        $this->assertSame($this->sales->id, $t[4]['board_id']);
        $this->assertSame('Bình thường', $t[0]['priority']);
        $this->assertSame($this->tech->id, $t[6]['board_id']);               // "DANAVA Studio"
    }

    public function test_preview_only_offers_boards_the_user_belongs_to(): void
    {
        $other = Board::create(['name' => 'Bảng riêng DC Center báo giá', 'owner_id' => $this->u['outsider']->id, 'workspace_id' => null]);
        $p = $this->preview();

        $this->assertNotContains($other->id, array_column($p['boards'], 'id'));
        $this->assertNotContains($other->id, array_column($p['tasks'], 'board_id'));
    }

    public function test_apply_creates_tasks_assigns_members_and_respects_done(): void
    {
        $res = $this->actingAs($this->boss)->postJson('/api/assistant/tasks/apply', ['items' => [
            ['title' => 'Gửi báo giá cho DC Center', 'board_id' => $this->sales->id, 'assignee_ids' => [$this->u['trang']->id], 'priority' => 'Khẩn cấp', 'due_date' => '2026-11-11', 'done' => false],
            ['title' => 'Test Gmail inform', 'board_id' => $this->tech->id, 'assignee_ids' => [$this->u['han']->id], 'done' => true],
        ]])->assertOk();

        $this->assertSame('Đã tạo 2/2 công việc.', $res->json('message'));

        $quote = Task::where('title', 'Gửi báo giá cho DC Center')->firstOrFail();
        $this->assertSame('Chưa bắt đầu', $quote->column->title);
        $this->assertSame('Khẩn cấp', $quote->priority);
        $this->assertSame([$this->u['trang']->id], $quote->assignees->pluck('id')->all());
        $this->assertNull($quote->completed_at);

        $done = Task::where('title', 'Test Gmail inform')->firstOrFail();
        $this->assertSame('Hoàn thành', $done->column->title);
        $this->assertNotNull($done->completed_at);

        Notification::assertSentTo($this->u['trang'], \App\Notifications\TaskMemberAssignedNotification::class);
    }

    public function test_non_member_assignee_is_skipped_unless_admin_adds_them(): void
    {
        $item = ['title' => 'Việc mới', 'board_id' => $this->sales->id, 'assignee_ids' => [$this->u['outsider']->id]];

        $r1 = $this->actingAs($this->boss)->postJson('/api/assistant/tasks/apply', ['items' => [$item]])->json('results.0');
        $this->assertTrue($r1['ok']);
        $this->assertSame([], $r1['task']['assignee_ids']);
        $this->assertSame($this->u['outsider']->id, $r1['skipped_assignees'][0]['id']);

        $r2 = $this->actingAs($this->boss)->postJson('/api/assistant/tasks/apply', ['items' => [[...$item, 'add_to_board' => true]]])->json('results.0');
        $this->assertSame([$this->u['outsider']->id], $r2['task']['assignee_ids']);
        $this->assertTrue(DB::table('board_members')->where('board_id', $this->sales->id)->where('user_id', $this->u['outsider']->id)->exists());
    }

    public function test_cannot_create_tasks_on_a_board_without_access(): void
    {
        $private = Board::create(['name' => 'Riêng tư', 'owner_id' => $this->u['outsider']->id, 'workspace_id' => null]);
        KanbanColumn::create(['board_id' => $private->id, 'title' => 'Todo', 'order' => 1000]);

        $r = $this->actingAs($this->boss)->postJson('/api/assistant/tasks/apply', ['items' => [
            ['title' => 'Xâm nhập', 'board_id' => $private->id],
        ]])->assertOk()->json('results.0');

        $this->assertFalse($r['ok']);
        $this->assertSame(0, Task::count());
    }

    public function test_confirmed_nickname_is_learned_for_next_time(): void
    {
        $this->actingAs($this->boss)->postJson('/api/assistant/tasks/apply', ['items' => [[
            'title' => 'Kế hoạch truyền thông', 'board_id' => $this->tech->id,
            'assignee_ids' => [$this->u['phi']->id],
            'aliases' => [['alias' => 'Phi Trần', 'user_id' => $this->u['phi']->id]],
        ]]])->assertOk();

        $this->assertDatabaseHas('user_aliases', ['alias' => 'Phi Trần', 'user_id' => $this->u['phi']->id]);
        $t = $this->preview()['tasks'];
        $this->assertSame([$this->u['phi']->id], $t[5]['assignee_ids']);

        // Learned multi-word nicknames are recognised even without "@" ("Hùng IT").
        UserAlias::remember('Hùng IT', $this->u['hung']->id, $this->boss->id);
        $this->assertSame([$this->u['hung']->id], $this->preview()['tasks'][2]['assignee_ids']);
    }

    public function test_alias_is_not_learned_for_someone_who_was_not_assigned(): void
    {
        $this->actingAs($this->boss)->postJson('/api/assistant/tasks/apply', ['items' => [[
            'title' => 'X', 'board_id' => $this->tech->id, 'assignee_ids' => [],
            'aliases' => [['alias' => 'Sếp', 'user_id' => $this->u['phi']->id]],
        ]]])->assertOk();

        $this->assertDatabaseMissing('user_aliases', ['alias' => 'Sếp']);
    }

    public function test_chat_routes_assignment_messages_to_a_preview(): void
    {
        $res = $this->actingAs($this->boss)->postJson('/api/assistant/chat', ['message' => self::MESSAGE])->assertOk();

        $this->assertSame('task_preview', $res->json('reply.meta.type'));
        $this->assertCount(9, $res->json('reply.meta.preview.tasks'));
        $this->assertSame(0, Task::count()); // nothing created before confirmation
    }

    public function test_chat_demo_answers_questions_about_own_tasks(): void
    {
        $column = $this->sales->columns()->first();
        $task = $column->tasks()->create(['title' => 'Gọi khách DC Center', 'created_by' => $this->boss->id, 'order' => 1000, 'due_date' => '2020-01-01']);
        $task->syncAssigneesWithAutoSplit([$this->u['trang']->id], $this->boss->id);

        $reply = $this->actingAs($this->u['trang'])->postJson('/api/assistant/chat', ['message' => 'Tôi có việc nào quá hạn không?'])
            ->assertOk()
            ->assertJsonPath('reply.role', 'assistant')
            ->json('reply.content');
        $this->assertStringContainsString('Gọi khách DC Center', $reply);

        $this->actingAs($this->u['trang'])->getJson('/api/assistant')
            ->assertJsonPath('mode', 'demo')
            ->assertJsonCount(2, 'messages');
    }

    public function test_history_is_private_and_can_be_cleared(): void
    {
        $this->actingAs($this->u['han'])->postJson('/api/assistant/chat', ['message' => 'Xin chào']);
        $this->actingAs($this->u['dai'])->getJson('/api/assistant')->assertJsonCount(0, 'messages');

        $this->actingAs($this->u['han'])->deleteJson('/api/assistant/history')->assertOk();
        $this->actingAs($this->u['han'])->getJson('/api/assistant')->assertJsonCount(0, 'messages');
    }

    public function test_gemini_result_is_validated_before_use(): void
    {
        config(['assistant.mode' => 'live', 'assistant.gemini.api_key' => 'test-key']);
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode(['tasks' => [[
                'title' => 'Gửi báo giá DC Center',
                'details' => 'Chốt 9K hội viên',
                'assignee_user_ids' => [$this->u['trang']->id, 999999],
                'unmatched_mentions' => ['Nam Nam Nam'],
                'board_id' => 424242,
                'priority' => 'Khẩn cấp',
                'done' => false,
                'due_date' => 'không rõ',
            ]]])]]]]], 'usageMetadata' => ['totalTokenCount' => 10]]),
        ]);

        $p = $this->preview();

        $this->assertSame('gemini', $p['engine']);
        $this->assertSame([$this->u['trang']->id], $p['tasks'][0]['assignee_ids']); // unknown id dropped
        $this->assertNull($p['tasks'][0]['board_id']);                               // foreign board dropped
        $this->assertNull($p['tasks'][0]['due_date']);
        Http::assertSent(fn ($req) => $req->hasHeader('x-goog-api-key', 'test-key') && !str_contains($req->url(), 'test-key'));
    }

    public function test_gemini_failure_falls_back_to_rules(): void
    {
        config(['assistant.mode' => 'live', 'assistant.gemini.api_key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'quota']], 429)]);

        $p = $this->preview();

        $this->assertSame('rules', $p['engine']);
        $this->assertCount(9, $p['tasks']);
        $this->assertNotEmpty($p['warnings']);
    }

    public function test_preview_names_each_boards_project_and_picks_the_board_from_a_project_name(): void
    {
        $project = \App\Models\Project::create(['name' => 'DANAVAGo', 'owner_id' => $this->boss->id]);
        $go = $this->board('Thiết kế ứng dụng', 'Màn hình và luồng đặt xe');
        $go->update(['project_id' => $project->id]);
        DB::table('board_members')->insert(['board_id' => $go->id, 'user_id' => $this->u['hung']->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);

        $preview = $this->actingAs($this->boss)->postJson('/api/assistant/tasks/preview', [
            'text' => "1. @Nguyễn Nam Hùng lên final DANAVAGo để hẹn họp với nhà xe\n2. @Trang Phạm gửi báo giá DC Center",
        ])->assertOk()->json();

        $boards = collect($preview['boards'])->keyBy('id');
        $this->assertSame('DANAVAGo', $boards[$go->id]['project']);
        $this->assertArrayNotHasKey('type', $boards[$go->id]); // only the board is chosen; its project is fixed
        // The project name alone is enough because that project has only this board.
        $this->assertSame($go->id, $preview['tasks'][0]['board_id']);
        $this->assertSame($this->sales->id, $preview['tasks'][1]['board_id']);
    }

    public function test_project_managers_can_send_tasks_to_their_projects_boards_without_being_invited(): void
    {
        $project = \App\Models\Project::create(['name' => 'Dự án X', 'owner_id' => $this->boss->id, 'manager_id' => $this->u['phi']->id]);
        $board = Board::create(['owner_id' => $this->boss->id, 'name' => 'Bảng riêng của sếp', 'project_id' => $project->id]);
        KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chưa bắt đầu', 'order' => 1000]);

        $ids = collect($this->actingAs($this->u['phi'])->postJson('/api/assistant/tasks/preview', ['text' => "1. Việc một\n2. Việc hai"])
            ->assertOk()->json('boards'))->pluck('id');
        $this->assertContains($board->id, $ids->all());

        $this->actingAs($this->u['phi'])->postJson('/api/assistant/tasks/apply', ['items' => [
            ['title' => 'Việc một', 'board_id' => $board->id, 'assignee_ids' => [], 'priority' => 'Bình thường', 'done' => false, 'due_date' => null],
        ]])->assertOk()->assertJsonPath('results.0.ok', true);
    }
}
