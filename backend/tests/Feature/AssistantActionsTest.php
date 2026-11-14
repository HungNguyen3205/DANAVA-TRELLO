<?php

namespace Tests\Feature;

use App\Models\AssistantActionLog;
use App\Models\Board;
use App\Models\Department;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AssistantActionsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $staff;
    private User $colleague;
    private Board $board;
    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();
        config(['assistant.mode' => 'live', 'assistant.gemini.api_key' => 'test-key']);
        Notification::fake();

        $this->admin = User::factory()->create(['name' => 'Quản Trị', 'username' => 'quantri', 'system_role' => 'system_admin', 'account_status' => 'active']);
        $this->staff = User::factory()->create(['name' => 'Nguyễn Văn Nhân', 'username' => 'nhanvien', 'system_role' => 'user', 'account_status' => 'active']);
        $this->colleague = User::factory()->create(['name' => 'Trần Thị Lan', 'username' => 'lan', 'system_role' => 'user', 'account_status' => 'active']);

        // A board the admin is NOT a member of: the assistant still lets the admin work on it.
        $owner = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $this->board = Board::create(['name' => 'Kinh doanh', 'owner_id' => $owner->id, 'workspace_id' => null]);
        foreach ([$this->staff, $this->colleague] as $u) {
            DB::table('board_members')->insert(['board_id' => $this->board->id, 'user_id' => $u->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);
        }
        $todo = KanbanColumn::create(['board_id' => $this->board->id, 'title' => 'Cần làm', 'order' => 1000]);
        KanbanColumn::create(['board_id' => $this->board->id, 'title' => 'Hoàn thành', 'order' => 2000]);
        $this->task = $todo->tasks()->create(['title' => 'Gửi báo giá DC Center', 'priority' => 'Bình thường', 'created_by' => $owner->id, 'order' => 1000]);
        $this->task->assignees()->sync([$this->colleague->id => ['assigned_by' => $owner->id]]);
    }

    /** Gemini answers: first the given tool calls (one per step), then a plain text reply. */
    private function fakeGemini(array ...$steps): void
    {
        $responses = array_map(fn ($calls) => Http::response(['candidates' => [['content' => ['role' => 'model', 'parts' => array_map(
            fn ($c) => ['functionCall' => ['name' => $c[0], 'args' => $c[1]]],
            $calls
        )]]], 'usageMetadata' => ['totalTokenCount' => 5]]), $steps);
        $responses[] = Http::response(['candidates' => [['content' => ['role' => 'model', 'parts' => [['text' => 'Dạ em làm xong rồi ạ.']]]]], 'usageMetadata' => ['totalTokenCount' => 5]]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence($responses)]);
    }

    private function chat(User $user, string $message)
    {
        return $this->actingAs($user)->postJson('/api/assistant/chat', ['message' => $message])->assertOk();
    }

    public function test_admin_reassigns_a_task_on_any_board_and_it_is_logged(): void
    {
        $this->fakeGemini([['update_task', ['cong_viec_id' => $this->task->id, 'giao_cho_ids' => [$this->staff->id], 'han' => '2026-11-20']]]);

        $this->chat($this->admin, 'giao lại việc báo giá DC Center cho anh Nhân, hạn 20/11');

        $this->task->refresh();
        $this->assertSame([$this->staff->id], $this->task->assignees()->pluck('users.id')->all());
        $this->assertStringStartsWith('2026-11-20', (string) $this->task->due_date);

        $log = AssistantActionLog::where('tool', 'update_task')->sole();
        $this->assertSame('success', $log->status);
        $this->assertSame($this->admin->id, $log->user_id);
        $this->assertSame($this->task->id, $log->target_id);
        $this->assertSame('Trần Thị Lan', $log->changes['nguoi_phu_trach']['truoc']);
        $this->assertSame('Nguyễn Văn Nhân', $log->changes['nguoi_phu_trach']['sau']);
        $this->assertStringContainsString('giao lại', $log->request_text);

        // Tools were offered to Gemini.
        Http::assertSent(fn ($req) => isset($req->data()['tools'][0]['functionDeclarations']));
    }

    public function test_staff_can_edit_a_colleagues_task_on_their_board(): void
    {
        $this->fakeGemini([['update_task', ['cong_viec_id' => $this->task->id, 'them_nguoi_ids' => [$this->staff->id], 'uu_tien' => 'Cao']]]);

        $this->chat($this->staff, 'thêm em vào việc báo giá và sửa ưu tiên cao');

        $this->task->refresh();
        $this->assertEqualsCanonicalizing([$this->colleague->id, $this->staff->id], $this->task->assignees()->pluck('users.id')->all());
        $this->assertSame('Cao', $this->task->priority);
        $this->assertSame('success', AssistantActionLog::where('tool', 'update_task')->sole()->status);
    }

    public function test_staff_cannot_touch_tasks_on_boards_they_do_not_belong_to(): void
    {
        $outsider = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $this->fakeGemini([['update_task', ['cong_viec_id' => $this->task->id, 'tieu_de' => 'Bị đổi tên']]]);

        $this->chat($outsider, 'sửa tên việc báo giá');

        $this->assertSame('Gửi báo giá DC Center', $this->task->fresh()->title);
        $this->assertSame('denied', AssistantActionLog::where('tool', 'update_task')->sole()->status);
    }

    public function test_staff_cannot_create_accounts_or_change_employees(): void
    {
        $this->fakeGemini(
            [['create_account', ['ho_ten' => 'Lê Văn Mới', 'gioi_tinh' => 'Nam', 'phong_ban' => 'Kinh doanh']]],
            [['delete_employee', ['nhan_vien_id' => $this->colleague->id]]],
        );

        $this->chat($this->staff, 'tạo tài khoản cho Lê Văn Mới rồi xóa tài khoản Lan');

        $this->assertDatabaseMissing('users', ['name' => 'Lê Văn Mới']);
        $this->assertNull($this->colleague->fresh()->deleted_at);
        $this->assertSame(['denied', 'denied'], AssistantActionLog::orderBy('id')->pluck('status')->all());
    }

    public function test_admin_creates_an_account_without_logging_the_password(): void
    {
        Department::create(['name' => 'Kinh doanh', 'code' => 'KD', 'status' => 'active']);
        $this->fakeGemini([['create_account', ['ho_ten' => 'Lê Văn Mới', 'gioi_tinh' => 'Nam', 'phong_ban' => 'kinh doanh']]]);

        $this->chat($this->admin, 'tạo tài khoản cho Lê Văn Mới phòng kinh doanh, nam');

        $user = User::where('name', 'Lê Văn Mới')->sole();
        $this->assertSame('moilv', $user->username);
        $this->assertTrue((bool) $user->must_change_password);
        $log = AssistantActionLog::where('tool', 'create_account')->sole();
        $this->assertSame('success', $log->status);
        $this->assertSame($user->id, $log->target_id);
        $this->assertStringNotContainsString('Dnv@', json_encode($log->toArray()));
    }

    public function test_deleting_needs_a_yes_in_a_later_message(): void
    {
        $call = [['delete_task', ['cong_viec_id' => $this->task->id]]];

        // Same turn: asking and "confirming" at once is not enough.
        $this->fakeGemini($call, $call);
        $this->chat($this->staff, 'xóa việc báo giá DC Center');
        $this->assertNotNull($this->task->fresh());
        $this->assertSame(['needs_confirmation', 'needs_confirmation'], AssistantActionLog::orderBy('id')->pluck('status')->all());

        // Next message: the user agreed.
        Http::swap(new \Illuminate\Http\Client\Factory());
        $this->fakeGemini($call);
        $this->chat($this->staff, 'đồng ý');
        $this->assertNull(Task::find($this->task->id));
        $this->assertSoftDeleted('tasks', ['id' => $this->task->id]);
        $this->assertSame('success', AssistantActionLog::latest('id')->first()->status);
    }

    public function test_only_admins_can_read_the_action_log(): void
    {
        AssistantActionLog::create(['user_id' => $this->staff->id, 'tool' => 'update_task', 'status' => 'success', 'target_label' => 'Gửi báo giá']);
        AssistantActionLog::create(['user_id' => $this->staff->id, 'tool' => 'find_tasks', 'status' => 'success']);

        $this->actingAs($this->staff)->getJson('/api/admin/assistant/action-logs')->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/admin/assistant/action-logs')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.user.name', 'Nguyễn Văn Nhân');
        $this->actingAs($this->admin)->getJson('/api/admin/assistant/action-logs?include_reads=1')->assertOk()->assertJsonCount(2, 'data');
    }
}
