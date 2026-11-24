<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskGroup;
use App\Models\TrelloImport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TrelloImportTest extends TestCase
{
    use RefreshDatabase;

    private function id(int $number): string
    {
        return str_pad(dechex($number), 24, '0', STR_PAD_LEFT);
    }

    private function snapshot(): array
    {
        return [
            'id' => $this->id(1), 'name' => 'DANAVA DEV BUG', 'desc' => 'Bảng kiểm thử',
            'lists' => [
                ['id' => $this->id(2), 'name' => 'Đã lưu trữ', 'closed' => true, 'pos' => 2000],
                ['id' => $this->id(3), 'name' => 'Đang làm', 'closed' => false, 'pos' => 1000],
            ],
            'labels' => [['id' => $this->id(4), 'name' => 'Lỗi', 'color' => 'red']],
            'members' => [['id' => $this->id(5), 'fullName' => 'Hùng IT', 'username' => 'hungit']],
            'cards' => [[
                'id' => $this->id(6), 'idList' => $this->id(2), 'name' => 'Sửa đăng ký', 'desc' => 'Giữ mô tả',
                'idLabels' => [$this->id(4)], 'idMembers' => [$this->id(5)], 'idChecklists' => [$this->id(7)],
                'closed' => true, 'dueComplete' => true, 'due' => '2026-11-25T08:00:00Z', 'start' => null,
                'dateLastActivity' => '2026-11-24T08:00:00Z', 'pos' => 1000,
                'attachments' => [['id' => $this->id(8), 'name' => 'Ảnh lỗi', 'url' => 'https://trello.com/attachment/example.png']],
            ]],
            'checklists' => [[
                'id' => $this->id(7), 'idCard' => $this->id(6), 'name' => 'Kiểm tra', 'checkItems' => [
                    ['id' => $this->id(9), 'name' => 'Đã kiểm tra', 'state' => 'complete', 'pos' => 2],
                    ['id' => $this->id(10), 'name' => 'Cần kiểm tra', 'state' => 'incomplete', 'pos' => 1],
                ],
            ]],
            'actions' => [[
                'id' => $this->id(11), 'type' => 'commentCard', 'idMemberCreator' => $this->id(5),
                'date' => '2026-11-20T10:30:00Z',
                'data' => ['card' => ['id' => $this->id(6)], 'text' => 'Nội dung gốc'],
                'memberCreator' => ['id' => $this->id(5), 'fullName' => 'Hùng IT'],
            ]],
        ];
    }

    private function preview(?array $snapshot = null): string
    {
        return $this->postJson('/api/imports/trello/preview', [
            'source' => 'json',
            'file' => UploadedFile::fake()->createWithContent('board.json', json_encode($snapshot ?? $this->snapshot())),
        ])->assertOk()->assertJsonPath('summary.cards', 1)->json('preview_token');
    }

    public function test_preview_suggests_employees_by_username_or_name_ignoring_accents(): void
    {
        $this->actingAs(User::factory()->create());
        $hung = User::factory()->create(['name' => 'Nguyễn Nam Hùng', 'username' => 'namhung']);
        $trang = User::factory()->create(['name' => 'Phạm Thu Trang', 'username' => 'trangpham']);
        User::factory()->count(2)->create(['name' => 'Trần An']);
        User::factory()->create(['name' => 'Lê Văn Bình', 'account_status' => 'inactive']);
        $snapshot = $this->snapshot();
        $snapshot['members'] = [
            ['id' => $this->id(21), 'fullName' => 'nguyen  NAM hung', 'username' => 'nguynnamhung2'],
            ['id' => $this->id(22), 'fullName' => 'Trang Pham', 'username' => 'TrangPham'],
            ['id' => $this->id(23), 'fullName' => 'Tran An', 'username' => 'tranan9'],
            ['id' => $this->id(24), 'fullName' => 'Le Van Binh', 'username' => 'binhle'],
        ];

        $members = collect($this->postJson('/api/imports/trello/preview', [
            'source' => 'json',
            'file' => UploadedFile::fake()->createWithContent('board.json', json_encode($snapshot)),
        ])->assertOk()->json('members'))->keyBy('id');

        // Same name without accents, case or spacing differences.
        $this->assertSame($hung->id, $members[$this->id(21)]['suggested_user']['id']);
        // Same username, even though the names differ.
        $this->assertSame($trang->id, $members[$this->id(22)]['suggested_user']['id']);
        // Two employees share the name: no guess.
        $this->assertNull($members[$this->id(23)]['suggested_user']);
        // Inactive employees are never suggested.
        $this->assertNull($members[$this->id(24)]['suggested_user']);
    }

    public function test_import_preserves_content_archives_checklist_order_and_comment_attribution(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $this->actingAs($owner);
        $token = $this->preview();
        $result = $this->postJson('/api/imports/trello/confirm', [
            'preview_token' => $token, 'member_map' => [$this->id(5) => $member->id],
        ])->assertOk();

        $board = Board::findOrFail($result->json('board_id'));
        $this->assertSame('DANAVA DEV BUG', $board->name);
        $this->assertSame($owner->id, $board->owner_id);
        $this->assertSame(2, $board->members()->count());
        $this->assertSame(['Đang làm', 'Đã lưu trữ'], $board->columns()->orderBy('order')->pluck('title')->all());
        $task = Task::whereNull('parent_task_id')->sole();
        $this->assertNotNull($task->archived_at);
        $this->assertNotNull($task->completed_at);
        $this->assertSame('Giữ mô tả', $task->description);
        $this->assertSame([$member->id], $task->assignees()->pluck('users.id')->all());
        $this->assertSame('Lỗi', $task->labels()->sole()->name);
        $this->assertSame('https://trello.com/attachment/example.png', $task->trello_source['attachments'][0]['url']);
        $this->assertSame('Kiểm tra', TaskGroup::sole()->title);
        $this->assertSame(['Cần kiểm tra', 'Đã kiểm tra'], $task->subtasks()->pluck('title')->all());
        $this->assertNull($task->subtasks()->first()->completed_at);
        $this->assertNotNull($task->subtasks()->get()->last()->completed_at);
        $comment = TaskComment::sole();
        $this->assertSame($member->id, $comment->user_id);
        $this->assertSame("[Trello · Hùng IT]\nNội dung gốc", $comment->content);
        $this->assertSame('2026-11-20 10:30:00', $comment->created_at->format('Y-m-d H:i:s'));
        $this->assertStringNotContainsString('DANAVA DEV BUG', DB::table('trello_imports')->sole()->payload);

        $this->getJson('/api/imports/trello/'.$token.'/snapshot')->assertOk()->assertDownload('trello-source.json');
        $this->getJson('/api/tasks/'.$task->id)->assertOk()->assertJsonPath('trello_source.id', $this->id(6));
    }

    public function test_retry_and_repreview_return_existing_board_without_duplicates(): void
    {
        $this->actingAs(User::factory()->create());
        $token = $this->preview();
        $body = ['preview_token' => $token, 'member_map' => []];
        $first = $this->postJson('/api/imports/trello/confirm', $body)->assertOk()->json();
        $this->postJson('/api/imports/trello/confirm', $body)->assertOk()->assertJsonPath('board_id', $first['board_id']);
        $this->assertDatabaseCount('boards', 1);
        $this->assertDatabaseCount('tasks', 3);
        $this->assertDatabaseCount('task_comments', 1);
        $this->postJson('/api/imports/trello/preview', [
            'source' => 'json', 'file' => UploadedFile::fake()->createWithContent('again.json', json_encode($this->snapshot())),
        ])->assertOk()->assertJsonPath('existing.board_id', $first['board_id']);
    }

    public function test_private_preview_cannot_be_confirmed_or_downloaded_by_another_user(): void
    {
        $this->actingAs(User::factory()->create());
        $token = $this->preview();
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/imports/trello/confirm', ['preview_token' => $token, 'member_map' => []])->assertNotFound();
        $this->getJson('/api/imports/trello/'.$token.'/snapshot')->assertNotFound();
        $this->assertDatabaseCount('boards', 0);
    }

    public function test_invalid_mapping_or_private_project_does_not_create_partial_boards(): void
    {
        $owner = User::factory()->create();
        $this->actingAs($owner);
        $token = $this->preview();
        $this->postJson('/api/imports/trello/confirm', [
            'preview_token' => $token, 'member_map' => [$this->id(99) => $owner->id],
        ])->assertUnprocessable();
        $project = Project::create(['name' => 'Private', 'owner_id' => User::factory()->create()->id]);
        $this->postJson('/api/imports/trello/confirm', [
            'preview_token' => $token, 'member_map' => [], 'project_id' => $project->id,
        ])->assertForbidden();
        $this->assertDatabaseCount('boards', 0);
        $this->assertDatabaseCount('tasks', 0);
    }

    public function test_expired_preview_and_missing_references_are_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        $snapshot = $this->snapshot();
        $snapshot['lists'] = [];
        $this->postJson('/api/imports/trello/preview', [
            'source' => 'json', 'file' => UploadedFile::fake()->createWithContent('bad.json', json_encode($snapshot)),
        ])->assertUnprocessable();
        $token = $this->preview();
        TrelloImport::query()->update(['expires_at' => now()->subMinute()]);
        $this->postJson('/api/imports/trello/confirm', ['preview_token' => $token, 'member_map' => []])->assertUnprocessable();
        $this->assertDatabaseCount('boards', 0);
    }

    public function test_transaction_rolls_back_all_objects_on_late_failure_and_can_retry(): void
    {
        $this->actingAs(User::factory()->create());
        $token = $this->preview();
        // A database failure at the final comment write must undo the entire board import.
        // (Model event, not a DB trigger: CREATE TRIGGER implicitly commits on MySQL and would break the test transaction.)
        $failComments = true;
        TaskComment::creating(function () use (&$failComments) {
            if ($failComments) {
                throw new \RuntimeException('test failure');
            }
        });
        $this->postJson('/api/imports/trello/confirm', ['preview_token' => $token, 'member_map' => []])->assertStatus(500);
        $this->assertDatabaseCount('boards', 0);
        $this->assertDatabaseCount('tasks', 0);
        $this->assertNull(TrelloImport::sole()->result);
        $failComments = false;
        $this->postJson('/api/imports/trello/confirm', ['preview_token' => $token, 'member_map' => []])->assertOk();
        $this->assertDatabaseCount('boards', 1);
    }

    public function test_api_reads_all_action_pages_without_persisting_credentials(): void
    {
        $this->actingAs(User::factory()->create());
        $data = $this->snapshot();
        $page = [];
        for ($index = 100; $index < 1100; $index++) {
            $action = $data['actions'][0];
            $action['id'] = $this->id($index);
            $page[] = $action;
        }
        Http::preventStrayRequests();
        Http::fake(function ($request) use ($data, $page) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            $part = str_replace('/1/boards/bhpZYZbw', '', $path);
            $response = match ($part) {
                '' => ['id' => $data['id'], 'name' => $data['name']],
                '/lists' => $data['lists'], '/cards/all' => $data['cards'], '/checklists' => $data['checklists'],
                '/members' => $data['members'], '/labels' => $data['labels'], '/customFields' => [],
                '/actions' => isset($request['before']) ? $data['actions'] : $page,
            };

            return Http::response($response);
        });
        $this->postJson('/api/imports/trello/preview', [
            'source' => 'api', 'board_url' => 'https://trello.com/b/bhpZYZbw/danava-dev-bug',
            'api_key' => 'testkey', 'api_token' => 'verysecrettoken',
        ])->assertOk()->assertJsonPath('summary.comments', 1001);
        Http::assertSentCount(9);
        Http::assertSent(fn ($request) => $request->hasHeader('Authorization') && ! str_contains($request->url(), 'verysecrettoken'));
        $payload = TrelloImport::sole()->payload;
        $this->assertStringNotContainsString('verysecrettoken', json_encode($payload));
    }

    public function test_api_rejects_arbitrary_urls_and_reports_rate_limits(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(['*' => Http::response([], 429)]);
        $body = ['source' => 'api', 'board_url' => 'http://127.0.0.1/private', 'api_key' => 'testkey', 'api_token' => 'testtoken'];
        $this->postJson('/api/imports/trello/preview', $body)->assertUnprocessable();
        Http::assertNothingSent();
        $body['board_url'] = 'bhpZYZbw';
        $this->postJson('/api/imports/trello/preview', $body)->assertUnprocessable()->assertJsonValidationErrors('source');
        $this->assertDatabaseCount('trello_imports', 0);
    }
}
