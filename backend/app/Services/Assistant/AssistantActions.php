<?php

namespace App\Services\Assistant;

use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\TaskDetailController;
use App\Models\ActivityLog;
use App\Models\AssistantActionLog;
use App\Models\Board;
use App\Models\Department;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Notifications\BoardMemberAddedNotification;
use App\Services\BoardAccessService;
use App\Support\VietnameseText;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Actions the chat assistant can take for the person chatting with it (Gemini function calling).
 *
 * Rights are those of that person, checked here on the server (never left to the model):
 *  - System admins: every board, task and employee account.
 *  - Everyone else: tasks on boards they belong to (including other people's tasks);
 *    never accounts or employees.
 * Every call, allowed or refused, is written to assistant_action_logs.
 */
class AssistantActions
{
    /** Tools that change accounts: system admins only. */
    private const ADMIN_TOOLS = ['create_account', 'update_employee', 'set_account_status', 'reset_password', 'delete_employee'];

    /** Tools that only read data (logged too, but shown as lookups). */
    public const READ_TOOLS = ['find_tasks', 'find_people', 'list_boards', 'list_departments'];

    private const DONE_COLUMN_NAMES = ['done', 'hoàn thành', 'completed'];

    /** Admin whose assistant action is running: lets policies treat them as a member of every board. */
    private static ?int $actingAdminId = null;

    public function __construct(private BoardAccessService $access, private TaskApplyService $applier)
    {
    }

    /** Used by Gate::before: true only while an admin's assistant action runs. */
    public static function bypasses(?User $user): bool
    {
        return $user && self::$actingAdminId !== null && (int) $user->id === self::$actingAdminId;
    }

    public function isAdmin(User $user): bool
    {
        return $this->access->isSystemAdmin($user);
    }

    /** Function declarations sent to Gemini. */
    public function declarations(): array
    {
        $id = fn (string $d) => ['type' => 'integer', 'description' => $d];
        $ids = fn (string $d) => ['type' => 'array', 'items' => ['type' => 'integer'], 'description' => $d];
        $str = fn (string $d) => ['type' => 'string', 'description' => $d];
        $priority = ['type' => 'string', 'enum' => TaskExtractionService::PRIORITIES, 'description' => 'Mức ưu tiên'];

        return [
            ['name' => 'find_tasks', 'description' => 'Tìm công việc (lấy id) theo từ khóa, người phụ trách, bảng hoặc trạng thái. Luôn gọi trước khi sửa/xóa một việc mà chưa biết id.',
                'parameters' => ['type' => 'object', 'properties' => [
                    'tu_khoa' => $str('Từ khóa trong tên hoặc mô tả công việc'),
                    'nguoi_phu_trach_id' => $id('Chỉ lấy việc của người này (id từ find_people)'),
                    'bang_id' => $id('Chỉ lấy việc trong bảng này'),
                    'trang_thai' => ['type' => 'string', 'enum' => ['dang_lam', 'da_xong', 'qua_han', 'tat_ca'], 'description' => 'Mặc định dang_lam'],
                ]]],
            ['name' => 'find_people', 'description' => 'Tìm nhân viên theo tên, tên đăng nhập hoặc phòng ban để lấy id.',
                'parameters' => ['type' => 'object', 'properties' => ['tu_khoa' => $str('Tên, tên gọi hoặc tên đăng nhập')], 'required' => ['tu_khoa']]],
            ['name' => 'list_boards', 'description' => 'Liệt kê các bảng công việc (id, tên, dự án, các cột) mà người dùng được phép thao tác.',
                'parameters' => ['type' => 'object', 'properties' => ['tu_khoa' => $str('Lọc theo tên bảng hoặc dự án')]]],
            ['name' => 'list_departments', 'description' => 'Liệt kê phòng ban (id, tên).',
                'parameters' => ['type' => 'object', 'properties' => (object) []]],
            ['name' => 'create_task', 'description' => 'Tạo một công việc mới trong bảng và giao cho người phụ trách.',
                'parameters' => ['type' => 'object', 'properties' => [
                    'bang_id' => $id('Bảng chứa công việc'),
                    'tieu_de' => $str('Tên công việc'),
                    'mo_ta' => $str('Mô tả chi tiết'),
                    'nguoi_phu_trach_ids' => $ids('Người phụ trách'),
                    'han' => $str('Hạn hoàn thành YYYY-MM-DD'),
                    'uu_tien' => $priority,
                    'cot_id' => $id('Cột đặt công việc (mặc định cột đầu tiên)'),
                ], 'required' => ['bang_id', 'tieu_de']]],
            ['name' => 'update_task', 'description' => 'Sửa công việc: đổi tên, mô tả, hạn, ưu tiên, giao lại/thêm/bớt người phụ trách, chuyển cột, đánh dấu xong hoặc mở lại. Chỉ truyền những trường cần đổi.',
                'parameters' => ['type' => 'object', 'properties' => [
                    'cong_viec_id' => $id('Id công việc (từ find_tasks)'),
                    'tieu_de' => $str('Tên mới'),
                    'mo_ta' => $str('Mô tả mới'),
                    'uu_tien' => $priority,
                    'han' => $str('Hạn mới YYYY-MM-DD, hoặc "xoa" để bỏ hạn'),
                    'ngay_bat_dau' => $str('Ngày bắt đầu YYYY-MM-DD, hoặc "xoa"'),
                    'giao_cho_ids' => $ids('Thay toàn bộ người phụ trách bằng danh sách này (giao lại việc)'),
                    'them_nguoi_ids' => $ids('Thêm người phụ trách, giữ người cũ'),
                    'bo_nguoi_ids' => $ids('Bỏ người khỏi công việc'),
                    'cot_id' => $id('Chuyển sang cột này (cùng bảng)'),
                    'hoan_thanh' => ['type' => 'boolean', 'description' => 'true: đánh dấu đã xong; false: mở lại'],
                ], 'required' => ['cong_viec_id']]],
            ['name' => 'delete_task', 'description' => 'Xóa công việc (vào thùng rác, khôi phục được). Cần người dùng xác nhận.',
                'parameters' => ['type' => 'object', 'properties' => ['cong_viec_id' => $id('Id công việc')], 'required' => ['cong_viec_id']]],
            ['name' => 'comment_task', 'description' => 'Viết bình luận vào công việc.',
                'parameters' => ['type' => 'object', 'properties' => ['cong_viec_id' => $id('Id công việc'), 'noi_dung' => $str('Nội dung bình luận')], 'required' => ['cong_viec_id', 'noi_dung']]],
            ['name' => 'create_account', 'description' => 'Tạo tài khoản nhân viên mới (chỉ quản trị viên hệ thống). Cần họ tên, giới tính, phòng ban.',
                'parameters' => ['type' => 'object', 'properties' => [
                    'ho_ten' => $str('Họ và tên'),
                    'gioi_tinh' => ['type' => 'string', 'enum' => ['Nam', 'Nữ', 'Khác']],
                    'phong_ban' => $str('Tên hoặc id phòng ban'),
                    'ten_dang_nhap' => $str('Tên đăng nhập (bỏ trống để tự tạo từ họ tên)'),
                    'chuc_vu' => $str('Chức vụ'),
                    'email' => $str('Email'),
                    'quyen' => ['type' => 'string', 'enum' => ['user', 'admin'], 'description' => 'Mặc định user'],
                ], 'required' => ['ho_ten', 'gioi_tinh', 'phong_ban']]],
            ['name' => 'update_employee', 'description' => 'Sửa thông tin nhân viên: họ tên, chức vụ, giới tính, email, số điện thoại, phòng ban, quyền (chỉ quản trị viên hệ thống).',
                'parameters' => ['type' => 'object', 'properties' => [
                    'nhan_vien_id' => $id('Id nhân viên'),
                    'ho_ten' => $str('Họ tên mới'),
                    'chuc_vu' => $str('Chức vụ'),
                    'gioi_tinh' => ['type' => 'string', 'enum' => ['Nam', 'Nữ', 'Khác']],
                    'email' => $str('Email'),
                    'so_dien_thoai' => $str('Số điện thoại'),
                    'phong_ban' => $str('Tên hoặc id phòng ban mới'),
                    'quyen' => ['type' => 'string', 'enum' => ['user', 'admin']],
                ], 'required' => ['nhan_vien_id']]],
            ['name' => 'set_account_status', 'description' => 'Khóa hoặc mở khóa tài khoản nhân viên (chỉ quản trị viên hệ thống). Khóa cần xác nhận.',
                'parameters' => ['type' => 'object', 'properties' => [
                    'nhan_vien_id' => $id('Id nhân viên'),
                    'trang_thai' => ['type' => 'string', 'enum' => ['active', 'locked']],
                ], 'required' => ['nhan_vien_id', 'trang_thai']]],
            ['name' => 'reset_password', 'description' => 'Đặt lại mật khẩu tạm cho nhân viên (chỉ quản trị viên hệ thống). Cần xác nhận.',
                'parameters' => ['type' => 'object', 'properties' => ['nhan_vien_id' => $id('Id nhân viên')], 'required' => ['nhan_vien_id']]],
            ['name' => 'delete_employee', 'description' => 'Xóa tài khoản nhân viên (chỉ quản trị viên hệ thống). Cần xác nhận.',
                'parameters' => ['type' => 'object', 'properties' => ['nhan_vien_id' => $id('Id nhân viên')], 'required' => ['nhan_vien_id']]],
        ];
    }

    /**
     * Run one tool call and log it.
     *
     * @param int $turnId id of the user message being answered (confirmations must come from a later message)
     * @return array result sent back to the model (always has "ok")
     */
    public function execute(User $actor, string $tool, array $args, int $turnId, string $requestText = ''): array
    {
        $this->target = null;
        $this->changes = null;
        $status = 'success';

        try {
            if (in_array($tool, self::ADMIN_TOOLS, true) && !$this->isAdmin($actor)) {
                $status = 'denied';
                $result = ['ok' => false, 'loi' => 'Tài khoản này không có quyền tạo, sửa, khóa hay xóa tài khoản nhân viên. Chỉ quản trị viên hệ thống làm được việc này.'];
            } elseif (!method_exists($this, $method = 'tool' . Str::studly($tool))) {
                $status = 'failed';
                $result = ['ok' => false, 'loi' => "Không có công cụ {$tool}."];
            } else {
                self::$actingAdminId = $this->isAdmin($actor) ? (int) $actor->id : null;
                $result = $this->{$method}($actor, $args, $turnId);
                $status = $result['_status'] ?? (($result['ok'] ?? false) ? 'success' : 'failed');
            }
        } catch (ValidationException $e) {
            $status = 'failed';
            $result = ['ok' => false, 'loi' => implode(' ', array_merge(...array_values($e->errors())))];
        } catch (AuthorizationException $e) {
            $status = 'denied';
            $result = ['ok' => false, 'loi' => 'Không có quyền: ' . ($e->getMessage() ?: 'thao tác này.')];
        } catch (HttpExceptionInterface $e) {
            $status = $e->getStatusCode() === 403 ? 'denied' : 'failed';
            $result = ['ok' => false, 'loi' => $e->getMessage() ?: 'Không thực hiện được.'];
        } catch (Throwable $e) {
            Log::error('assistant.action_failed', ['tool' => $tool, 'error' => $e->getMessage()]);
            $status = 'failed';
            $result = ['ok' => false, 'loi' => 'Lỗi hệ thống khi thực hiện, vui lòng thử lại.'];
        } finally {
            self::$actingAdminId = null;
        }
        unset($result['_status']);

        AssistantActionLog::create([
            'user_id' => $actor->id,
            'tool' => mb_substr($tool, 0, 60),
            'status' => $status,
            'target_type' => $this->target['type'] ?? null,
            'target_id' => $this->target['id'] ?? null,
            'target_label' => isset($this->target['label']) ? mb_substr($this->target['label'], 0, 250) : null,
            'arguments' => self::redact($args),
            'changes' => $this->changes,
            'message' => mb_substr((string) ($result['thong_bao'] ?? $result['loi'] ?? ''), 0, 2000) ?: null,
            'request_text' => $requestText !== '' ? mb_substr($requestText, 0, 2000) : null,
        ]);

        return $result;
    }

    /** @var array{type: string, id: int, label: string}|null */
    private ?array $target = null;
    private ?array $changes = null;

    private static function redact(array $args): array
    {
        return array_diff_key($args, ['mat_khau' => 1, 'password' => 1]);
    }

    // ---------------------------------------------------------------- lookups

    private function toolFindTasks(User $actor, array $a): array
    {
        $boards = $this->boardsFor($actor);
        if (!empty($a['bang_id'])) {
            $boards = $boards->where('id', (int) $a['bang_id']);
        }
        $now = Carbon::now(config('attendance.timezone', 'Asia/Ho_Chi_Minh'));
        $columnIds = DB::table('kanban_columns')->whereIn('board_id', $boards->pluck('id'))->pluck('id');

        $q = Task::query()->whereIn('column_id', $columnIds)->whereNull('archived_at')
            ->with(['column.board:id,name', 'assignees:id,name']);
        $state = $a['trang_thai'] ?? 'dang_lam';
        match ($state) {
            'da_xong' => $q->whereNotNull('completed_at'),
            'qua_han' => $q->whereNull('completed_at')->whereNotNull('due_date')->whereDate('due_date', '<', $now->toDateString()),
            'tat_ca' => null,
            default => $q->whereNull('completed_at'),
        };
        if (!empty($a['nguoi_phu_trach_id'])) {
            $uid = (int) $a['nguoi_phu_trach_id'];
            $q->where(fn ($w) => $w->where('assignee_id', $uid)->orWhereHas('assignees', fn ($s) => $s->where('users.id', $uid)));
        }
        $tasks = $q->latest('id')->limit(800)->get();

        $keywords = VietnameseText::words((string) ($a['tu_khoa'] ?? ''));
        if ($keywords) {
            $tasks = $tasks->map(function (Task $t) use ($keywords) {
                $text = ' ' . VietnameseText::key($t->title . ' ' . $t->description) . ' ';

                return [$t, count(array_filter($keywords, fn ($w) => str_contains($text, ' ' . $w . ' ') || str_contains($text, $w)))];
            })->filter(fn ($p) => $p[1] > 0)->sortByDesc(fn ($p) => $p[1])->map(fn ($p) => $p[0]);
        }

        $rows = $tasks->take(15)->map(fn (Task $t) => array_filter([
            'id' => $t->id,
            'tieu_de' => $t->title,
            'bang_id' => $t->column?->board_id,
            'bang' => $t->column?->board?->name,
            'cot' => $t->column?->title,
            'nguoi_phu_trach' => $t->assignees->map(fn ($u) => ['id' => $u->id, 'ten' => $u->name])->values()->all() ?: null,
            'han' => $t->due_date ? Carbon::parse($t->due_date)->toDateString() : null,
            'uu_tien' => $t->priority,
            'da_xong' => $t->completed_at !== null,
            'la_viec_con' => $t->parent_task_id !== null ?: null,
        ], fn ($v) => $v !== null))->values()->all();

        return ['ok' => true, 'so_luong' => count($rows), 'cong_viec' => $rows];
    }

    private function toolFindPeople(User $actor, array $a): array
    {
        $admin = $this->isAdmin($actor);
        $needle = VietnameseText::fold((string) ($a['tu_khoa'] ?? ''));
        $users = User::query()->with('department:id,name')
            ->when(!$admin, fn ($q) => $q->where('account_status', 'active'))
            ->get(['id', 'name', 'username', 'position', 'gender', 'department_id', 'system_role', 'account_status']);

        $found = $users->filter(function (User $u) use ($needle) {
            if ($needle === '') {
                return true;
            }
            $hay = VietnameseText::fold($u->name . ' ' . $u->username . ' ' . ($u->department?->name ?? ''));

            return collect(explode(' ', $needle))->filter()->every(fn ($w) => str_contains($hay, $w));
        })->take(20)->map(fn (User $u) => array_filter([
            'id' => $u->id,
            'ho_ten' => $u->name,
            'ten_dang_nhap' => $u->username,
            'phong_ban' => $u->department?->name,
            'chuc_vu' => $u->position,
            'gioi_tinh' => $u->gender,
            'quyen' => $admin ? ($this->access->isSystemAdmin($u) ? 'admin' : 'user') : null,
            'trang_thai' => $admin ? $u->account_status : null,
        ], fn ($v) => $v !== null && $v !== ''))->values()->all();

        return ['ok' => true, 'so_luong' => count($found), 'nhan_vien' => $found];
    }

    private function toolListBoards(User $actor, array $a): array
    {
        $needle = VietnameseText::fold((string) ($a['tu_khoa'] ?? ''));
        $boards = $this->boardsFor($actor)->load(['project:id,name', 'columns' => fn ($q) => $q->whereNull('archived_at')->orderBy('order')]);
        $rows = $boards->filter(fn (Board $b) => $needle === '' || str_contains(VietnameseText::fold($b->name . ' ' . ($b->project?->name ?? '')), $needle))
            ->take(40)
            ->map(fn (Board $b) => array_filter([
                'id' => $b->id,
                'ten' => $b->name,
                'du_an' => $b->project?->name,
                'cot' => $b->columns->map(fn ($c) => ['id' => $c->id, 'ten' => $c->title])->values()->all(),
            ]))->values()->all();

        return ['ok' => true, 'bang' => $rows];
    }

    private function toolListDepartments(User $actor, array $a): array
    {
        return ['ok' => true, 'phong_ban' => Department::query()->where('status', 'active')->orderBy('name')->get(['id', 'name'])
            ->map(fn ($d) => ['id' => $d->id, 'ten' => $d->name])->all()];
    }

    // ---------------------------------------------------------------- tasks

    private function toolCreateTask(User $actor, array $a): array
    {
        $board = Board::find((int) ($a['bang_id'] ?? 0));
        if (!$board || !$this->canUseBoard($actor, $board)) {
            return ['ok' => false, '_status' => 'denied', 'loi' => 'Không tìm thấy bảng hoặc bạn không phải thành viên của bảng này.'];
        }
        $assignees = array_values(array_unique(array_map('intval', (array) ($a['nguoi_phu_trach_ids'] ?? []))));
        if ($error = $this->ensureMembers($actor, $board, $assignees)) {
            return ['ok' => false, 'loi' => $error];
        }

        $result = $this->applier->apply($actor, [[
            'title' => mb_substr(trim((string) ($a['tieu_de'] ?? '')), 0, 255),
            'description' => $a['mo_ta'] ?? null,
            'board_id' => $board->id,
            'assignee_ids' => $assignees,
            'priority' => in_array($a['uu_tien'] ?? null, TaskExtractionService::PRIORITIES, true) ? $a['uu_tien'] : 'Bình thường',
            'due_date' => self::date($a['han'] ?? null),
        ]])[0];
        if (!$result['ok']) {
            return ['ok' => false, 'loi' => $result['message']];
        }

        $task = Task::find($result['task']['id']);
        if (!empty($a['cot_id']) && (int) $a['cot_id'] !== (int) $task->column_id) {
            $this->callTaskUpdate($actor, $task, ['column_id' => (int) $a['cot_id']]);
            $task->refresh();
        }
        $this->target = ['type' => 'task', 'id' => $task->id, 'label' => $task->title];
        $this->activity($board->id, $task->id, $actor, 'tạo công việc qua Trợ lý AI', null, $task->title);

        return ['ok' => true, 'thong_bao' => "Đã tạo công việc \"{$task->title}\" trong bảng \"{$board->name}\".", 'cong_viec' => $this->taskSummary($task)];
    }

    private function toolUpdateTask(User $actor, array $a): array
    {
        [$task, $board, $error] = $this->loadTask($actor, $a['cong_viec_id'] ?? null);
        if ($error) {
            return $error;
        }
        $before = $this->taskSummary($task);
        $payload = [];

        foreach (['tieu_de' => 'title', 'mo_ta' => 'description'] as $from => $to) {
            if (isset($a[$from]) && trim((string) $a[$from]) !== '') {
                $payload[$to] = $from === 'tieu_de' ? mb_substr(trim($a[$from]), 0, 255) : (string) $a[$from];
            }
        }
        if (isset($a['uu_tien'])) {
            if (!in_array($a['uu_tien'], TaskExtractionService::PRIORITIES, true)) {
                return ['ok' => false, 'loi' => 'Mức ưu tiên phải là: ' . implode(', ', TaskExtractionService::PRIORITIES) . '.'];
            }
            $payload['priority'] = $a['uu_tien'];
        }
        foreach (['han' => 'due_date', 'ngay_bat_dau' => 'start_date'] as $from => $to) {
            if (!isset($a[$from]) || $a[$from] === '') {
                continue;
            }
            if (in_array(VietnameseText::fold((string) $a[$from]), ['xoa', 'null', 'none', 'bo'], true)) {
                $payload[$to] = null;
            } elseif ($d = self::date($a[$from])) {
                $payload[$to] = $d;
            } else {
                return ['ok' => false, 'loi' => "Ngày \"{$a[$from]}\" không hợp lệ, cần dạng YYYY-MM-DD."];
            }
        }

        // Assignees: replace, add or remove.
        $current = $task->assignees()->pluck('users.id')->map(fn ($id) => (int) $id)->all();
        $next = $current;
        if (isset($a['giao_cho_ids'])) {
            $next = array_map('intval', (array) $a['giao_cho_ids']);
        }
        $next = array_merge($next, array_map('intval', (array) ($a['them_nguoi_ids'] ?? [])));
        $next = array_values(array_unique(array_diff($next, array_map('intval', (array) ($a['bo_nguoi_ids'] ?? [])))));
        if ($next !== $current || isset($a['giao_cho_ids'])) {
            $unknown = array_diff($next, User::whereIn('id', $next)->where('account_status', 'active')->pluck('id')->map(fn ($id) => (int) $id)->all());
            if ($unknown) {
                return ['ok' => false, 'loi' => 'Không tìm thấy nhân viên (hoặc tài khoản đã khóa) có id: ' . implode(', ', $unknown) . '.'];
            }
            if ($error = $this->ensureMembers($actor, $board, $next)) {
                return ['ok' => false, 'loi' => $error];
            }
            $payload['assignee_ids'] = $next;
        }

        // Column / done state.
        if (!empty($a['cot_id'])) {
            $payload['column_id'] = (int) $a['cot_id'];
        }
        if (array_key_exists('hoan_thanh', $a) && $a['hoan_thanh'] !== null) {
            $columns = $board->columns()->whereNull('archived_at')->orderBy('order')->get();
            $done = $columns->first(fn ($c) => in_array(mb_strtolower(trim($c->title)), self::DONE_COLUMN_NAMES, true));
            if ($a['hoan_thanh']) {
                if ($done && empty($payload['column_id'])) {
                    $payload['column_id'] = $done->id;
                } else {
                    $payload['completed_at'] = now()->toDateTimeString();
                }
            } else {
                if ($done && (int) $task->column_id === (int) $done->id && empty($payload['column_id'])) {
                    $payload['column_id'] = $columns->first()->id;
                } else {
                    $payload['completed_at'] = null;
                }
            }
        }

        if (!$payload) {
            return ['ok' => false, 'loi' => 'Chưa có thông tin nào cần sửa.'];
        }

        $this->callTaskUpdate($actor, $task, $payload);
        $task->refresh();
        $after = $this->taskSummary($task);

        $diff = [];
        foreach ($after as $k => $v) {
            if (($before[$k] ?? null) !== $v) {
                $diff[$k] = ['truoc' => $before[$k] ?? null, 'sau' => $v];
            }
        }
        $this->changes = $diff;
        $this->activity($board->id, $task->id, $actor, 'sửa công việc qua Trợ lý AI', json_encode(array_map(fn ($d) => $d['truoc'], $diff), JSON_UNESCAPED_UNICODE), json_encode(array_map(fn ($d) => $d['sau'], $diff), JSON_UNESCAPED_UNICODE));

        return ['ok' => true, 'thong_bao' => "Đã cập nhật công việc \"{$task->title}\".", 'thay_doi' => $diff, 'cong_viec' => $after];
    }

    private function toolDeleteTask(User $actor, array $a, int $turnId): array
    {
        [$task, $board, $error] = $this->loadTask($actor, $a['cong_viec_id'] ?? null);
        if ($error) {
            return $error;
        }
        if ($ask = $this->needsConfirmation($actor, 'delete_task', $task->id, $turnId, "xóa công việc \"{$task->title}\" (bảng {$board->name})")) {
            return $ask;
        }

        $this->callController(TaskDetailController::class, 'destroy', $actor, 'DELETE', [], $task);
        $this->activity($board->id, $task->id, $actor, 'xóa công việc qua Trợ lý AI', $task->title, null);

        return ['ok' => true, 'thong_bao' => "Đã xóa công việc \"{$task->title}\" (có thể khôi phục trong Thùng rác)."];
    }

    private function toolCommentTask(User $actor, array $a): array
    {
        [$task, , $error] = $this->loadTask($actor, $a['cong_viec_id'] ?? null);
        if ($error) {
            return $error;
        }
        $content = trim((string) ($a['noi_dung'] ?? ''));
        if ($content === '') {
            return ['ok' => false, 'loi' => 'Nội dung bình luận đang trống.'];
        }
        $this->callController(TaskDetailController::class, 'addComment', $actor, 'POST', ['content' => $content], $task);

        return ['ok' => true, 'thong_bao' => "Đã bình luận vào công việc \"{$task->title}\"."];
    }

    // ---------------------------------------------------------------- employees (admins only)

    private function toolCreateAccount(User $actor, array $a): array
    {
        $department = $this->findDepartment($a['phong_ban'] ?? null);
        if (!$department) {
            return ['ok' => false, 'loi' => 'Không tìm thấy phòng ban "' . ($a['phong_ban'] ?? '') . '". Gọi list_departments để xem danh sách.'];
        }
        $name = trim((string) ($a['ho_ten'] ?? ''));
        $username = trim((string) ($a['ten_dang_nhap'] ?? '')) ?: $this->suggestUsername($name);
        $password = self::temporaryPassword();

        $response = $this->callController(EmployeeController::class, 'store', $actor, 'POST', array_filter([
            'name' => $name,
            'username' => $username,
            'password' => $password,
            'gender' => $a['gioi_tinh'] ?? null,
            'department_id' => $department->id,
            'position' => $a['chuc_vu'] ?? null,
            'email' => $a['email'] ?? null,
            'system_role' => ($a['quyen'] ?? 'user') === 'admin' ? 'system_admin' : 'user',
        ], fn ($v) => $v !== null && $v !== ''));
        $body = $response->getData(true);
        if ($response->getStatusCode() >= 300) {
            return ['ok' => false, 'loi' => $body['message'] ?? 'Không tạo được tài khoản.'];
        }

        $user = $body['user'];
        $this->target = ['type' => 'user', 'id' => (int) $user['id'], 'label' => $user['name']];

        return [
            'ok' => true,
            'thong_bao' => "Đã tạo tài khoản cho {$user['name']} (phòng {$department->name}).",
            'ten_dang_nhap' => $user['username'],
            'mat_khau_tam' => $password,
            'ghi_chu' => 'Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu tiên.',
        ];
    }

    private function toolUpdateEmployee(User $actor, array $a, int $turnId): array
    {
        $employee = User::find((int) ($a['nhan_vien_id'] ?? 0));
        if (!$employee) {
            return ['ok' => false, 'loi' => 'Không tìm thấy nhân viên.'];
        }
        $this->target = ['type' => 'user', 'id' => $employee->id, 'label' => $employee->name];

        $payload = [
            'name' => trim((string) ($a['ho_ten'] ?? '')) ?: $employee->name,
            'username' => $employee->username,
            'email' => array_key_exists('email', $a) ? $a['email'] : $employee->email,
        ];
        foreach (['chuc_vu' => 'position', 'gioi_tinh' => 'gender', 'so_dien_thoai' => 'phone'] as $from => $to) {
            if (isset($a[$from])) {
                $payload[$to] = $a[$from];
            }
        }
        if (!empty($a['phong_ban'])) {
            $department = $this->findDepartment($a['phong_ban']);
            if (!$department) {
                return ['ok' => false, 'loi' => "Không tìm thấy phòng ban \"{$a['phong_ban']}\"."];
            }
            $payload['department_id'] = $department->id;
        }
        if (isset($a['quyen'])) {
            $toAdmin = $a['quyen'] === 'admin';
            if ($toAdmin && !$this->access->isSystemAdmin($employee)
                && ($ask = $this->needsConfirmation($actor, 'grant_admin', $employee->id, $turnId, "cấp quyền quản trị viên hệ thống cho {$employee->name}"))) {
                return $ask;
            }
            $payload['system_role'] = $toAdmin ? 'system_admin' : 'user';
        }

        $before = $this->employeeSummary($employee);
        $response = $this->callController(EmployeeController::class, 'update', $actor, 'PUT', $payload, $employee);
        if ($response->getStatusCode() >= 300) {
            return ['ok' => false, 'loi' => $response->getData(true)['message'] ?? 'Không cập nhật được.'];
        }
        $after = $this->employeeSummary($employee->fresh());
        $this->changes = [];
        foreach ($after as $k => $v) {
            if (($before[$k] ?? null) !== $v) {
                $this->changes[$k] = ['truoc' => $before[$k] ?? null, 'sau' => $v];
            }
        }

        return ['ok' => true, 'thong_bao' => "Đã cập nhật thông tin {$employee->name}.", 'thay_doi' => $this->changes];
    }

    private function toolSetAccountStatus(User $actor, array $a, int $turnId): array
    {
        $employee = User::find((int) ($a['nhan_vien_id'] ?? 0));
        if (!$employee) {
            return ['ok' => false, 'loi' => 'Không tìm thấy nhân viên.'];
        }
        $this->target = ['type' => 'user', 'id' => $employee->id, 'label' => $employee->name];
        $status = ($a['trang_thai'] ?? '') === 'locked' ? 'locked' : 'active';
        if ($status === 'locked' && ($ask = $this->needsConfirmation($actor, 'lock_account', $employee->id, $turnId, "khóa tài khoản của {$employee->name}"))) {
            return $ask;
        }

        $response = $this->callController(EmployeeController::class, 'updateStatus', $actor, 'PATCH', ['status' => $status], $employee);
        if ($response->getStatusCode() >= 300) {
            return ['ok' => false, 'loi' => $response->getData(true)['message'] ?? 'Không đổi được trạng thái.'];
        }
        $this->changes = ['trang_thai' => ['truoc' => $employee->account_status, 'sau' => $status]];

        return ['ok' => true, 'thong_bao' => ($status === 'locked' ? 'Đã khóa' : 'Đã mở khóa') . " tài khoản của {$employee->name}."];
    }

    private function toolResetPassword(User $actor, array $a, int $turnId): array
    {
        $employee = User::find((int) ($a['nhan_vien_id'] ?? 0));
        if (!$employee) {
            return ['ok' => false, 'loi' => 'Không tìm thấy nhân viên.'];
        }
        $this->target = ['type' => 'user', 'id' => $employee->id, 'label' => $employee->name];
        if ($ask = $this->needsConfirmation($actor, 'reset_password', $employee->id, $turnId, "đặt lại mật khẩu của {$employee->name}")) {
            return $ask;
        }

        $password = self::temporaryPassword();
        $this->callController(EmployeeController::class, 'resetPassword', $actor, 'POST', ['password' => $password, 'must_change_password' => true], $employee);

        return ['ok' => true, 'thong_bao' => "Đã đặt lại mật khẩu cho {$employee->name}.", 'ten_dang_nhap' => $employee->username, 'mat_khau_tam' => $password];
    }

    private function toolDeleteEmployee(User $actor, array $a, int $turnId): array
    {
        $employee = User::find((int) ($a['nhan_vien_id'] ?? 0));
        if (!$employee) {
            return ['ok' => false, 'loi' => 'Không tìm thấy nhân viên.'];
        }
        $this->target = ['type' => 'user', 'id' => $employee->id, 'label' => $employee->name];
        if ($ask = $this->needsConfirmation($actor, 'delete_employee', $employee->id, $turnId, "xóa tài khoản của {$employee->name} ({$employee->username})")) {
            return $ask;
        }

        $response = $this->callController(EmployeeController::class, 'destroy', $actor, 'DELETE', [], $employee);
        if ($response->getStatusCode() >= 300) {
            return ['ok' => false, 'loi' => $response->getData(true)['message'] ?? 'Không xóa được.'];
        }

        return ['ok' => true, 'thong_bao' => "Đã xóa tài khoản của {$employee->name}."];
    }

    // ---------------------------------------------------------------- helpers

    /**
     * Risky actions need a "yes" in a later message: the first call only asks, a call
     * from a later turn (after the user agreed) carries it out.
     */
    private function needsConfirmation(User $actor, string $action, int $targetId, int $turnId, string $description): ?array
    {
        $key = "assistant.confirm.{$actor->id}.{$action}.{$targetId}";
        $askedIn = Cache::get($key);
        if ($askedIn !== null && (int) $askedIn !== $turnId) {
            Cache::forget($key);

            return null;
        }
        Cache::put($key, $turnId, now()->addMinutes(15));

        return [
            'ok' => false,
            '_status' => 'needs_confirmation',
            'can_xac_nhan' => true,
            'thong_bao' => "Chưa thực hiện. Hãy hỏi người dùng có chắc muốn {$description} không. Chỉ khi họ đồng ý ở tin nhắn tiếp theo thì gọi lại đúng công cụ này.",
        ];
    }

    /** @return array{0: ?Task, 1: ?Board, 2: ?array} */
    private function loadTask(User $actor, mixed $id): array
    {
        $task = Task::with('column.board')->find((int) $id);
        $board = $task?->column?->board;
        if (!$task || !$board) {
            return [null, null, ['ok' => false, 'loi' => 'Không tìm thấy công việc. Dùng find_tasks để lấy đúng id.']];
        }
        $this->target = ['type' => 'task', 'id' => $task->id, 'label' => $task->title];
        if (!$this->canUseBoard($actor, $board)) {
            return [null, null, ['ok' => false, '_status' => 'denied', 'loi' => "Bạn không phải thành viên bảng \"{$board->name}\" nên không sửa được công việc này."]];
        }

        return [$task, $board, null];
    }

    private function canUseBoard(User $actor, Board $board): bool
    {
        return $this->isAdmin($actor) || $this->access->canView($actor, $board);
    }

    private function boardsFor(User $actor): Collection
    {
        $boards = Board::query()->orderBy('name')->get();

        return $this->isAdmin($actor) ? $boards : $boards->filter(fn (Board $b) => $this->access->canView($actor, $b))->values();
    }

    /**
     * Only board members can be assigned. Admins and board managers bring missing people onto the board;
     * other members get a clear message instead.
     */
    private function ensureMembers(User $actor, Board $board, array $userIds): ?string
    {
        $memberIds = DB::table('board_members')->where('board_id', $board->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
        $missing = array_values(array_diff($userIds, $memberIds));
        if (!$missing) {
            return null;
        }
        if (!$this->isAdmin($actor) && !$this->access->canManage($actor, $board)) {
            $names = User::whereIn('id', $missing)->pluck('name')->implode(', ');

            return "{$names} chưa là thành viên bảng \"{$board->name}\". Nhờ quản trị bảng thêm họ vào bảng trước.";
        }
        foreach (User::whereIn('id', $missing)->get() as $user) {
            DB::table('board_members')->insertOrIgnore([
                'board_id' => $board->id, 'user_id' => $user->id, 'role' => 'member',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $user->notify(new BoardMemberAddedNotification($board, $actor));
        }

        return null;
    }

    private function callTaskUpdate(User $actor, Task $task, array $payload): void
    {
        $response = $this->callController(TaskDetailController::class, 'update', $actor, 'PUT', $payload, $task);
        if ($response->getStatusCode() >= 300) {
            throw ValidationException::withMessages(['task' => $response->getData(true)['message'] ?? 'Không cập nhật được công việc.']);
        }
    }

    /** Run an existing controller action as $actor so the same rules, notifications and side effects apply. */
    private function callController(string $controller, string $method, User $actor, string $httpMethod, array $data, mixed ...$params): JsonResponse
    {
        $request = Request::create('/assistant-action', $httpMethod, $data);
        $request->setUserResolver(fn () => $actor);

        return app($controller)->{$method}($request, ...$params);
    }

    private function activity(int $boardId, int $taskId, User $actor, string $action, ?string $old, ?string $new): void
    {
        try {
            ActivityLog::create(['board_id' => $boardId, 'task_id' => $taskId, 'user_id' => $actor->id, 'action' => $action, 'old_value' => $old, 'new_value' => $new]);
        } catch (Throwable $e) {
            Log::warning('assistant.activity_log_failed', ['error' => $e->getMessage()]);
        }
    }

    private function taskSummary(Task $task): array
    {
        $task->loadMissing('column');

        return [
            'id' => $task->id,
            'tieu_de' => $task->title,
            'mo_ta' => $task->description,
            'cot' => $task->column?->title,
            'nguoi_phu_trach' => $task->assignees()->orderBy('users.name')->pluck('users.name')->implode(', ') ?: null,
            'han' => $task->due_date ? Carbon::parse($task->due_date)->toDateString() : null,
            'ngay_bat_dau' => $task->start_date ? Carbon::parse($task->start_date)->toDateString() : null,
            'uu_tien' => $task->priority,
            'da_xong' => $task->completed_at !== null,
        ];
    }

    private function employeeSummary(User $u): array
    {
        $u->loadMissing('department:id,name');

        return [
            'ho_ten' => $u->name,
            'email' => $u->email,
            'chuc_vu' => $u->position,
            'gioi_tinh' => $u->gender,
            'so_dien_thoai' => $u->phone,
            'phong_ban' => $u->department?->name,
            'quyen' => $this->access->isSystemAdmin($u) ? 'admin' : 'user',
        ];
    }

    private function findDepartment(mixed $value): ?Department
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value) && ($d = Department::find((int) $value))) {
            return $d;
        }
        $needle = VietnameseText::fold((string) $value);
        $all = Department::query()->where('status', 'active')->get();

        return $all->first(fn ($d) => VietnameseText::fold($d->name) === $needle || VietnameseText::fold((string) $d->code) === $needle)
            ?? $all->first(fn ($d) => str_contains(VietnameseText::fold($d->name), $needle));
    }

    /** "Nguyễn Văn An" -> "annv" (+ number when taken). */
    private function suggestUsername(string $name): string
    {
        $words = array_values(array_filter(explode(' ', VietnameseText::fold($name))));
        $base = $words ? end($words) . implode('', array_map(fn ($w) => $w[0], array_slice($words, 0, -1))) : 'nhanvien';
        $base = preg_replace('/[^a-z0-9]/', '', $base) ?: 'nhanvien';
        $candidate = $base;
        for ($i = 2; User::withTrashed()->where('username', $candidate)->whereNull('deleted_at')->exists(); $i++) {
            $candidate = $base . $i;
        }

        return $candidate;
    }

    private static function temporaryPassword(): string
    {
        return 'Dnv@' . Str::password(8, symbols: false);
    }

    private static function date(mixed $value): ?string
    {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }
        try {
            return Carbon::createFromFormat('Y-m-d', $value)->toDateString();
        } catch (Throwable) {
            return null;
        }
    }
}
