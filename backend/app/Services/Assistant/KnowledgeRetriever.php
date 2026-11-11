<?php

namespace App\Services\Assistant;

use App\Models\Board;
use App\Models\Task;
use App\Models\User;
use App\Services\AttendanceService;
use App\Support\VietnameseText;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Keyword-based retrieval for the assistant.
 *
 * Reads the question, detects what it is about (boards, people, task keywords,
 * time ranges, topics) and collects only the matching data the asker is allowed
 * to see: boards they belong to, colleagues on those boards, and attendance only
 * where AttendanceService permits. The result feeds Gemini or the offline composer.
 */
class KnowledgeRetriever
{
    private const TASK_LIMIT = 15;

    /** Words that describe the question itself rather than task content. */
    private const QUESTION_WORDS = [
        'toi', 'minh', 'nao', 'gi', 'bao', 'nhieu', 'khong', 'chua', 'hay', 'cho', 'xem', 'liet', 'ke', 'danh', 'sach',
        'nhung', 'cac', 'co', 'dang', 'can', 'phai', 'tinh', 'hinh', 'trang', 'thai', 'the', 'nao', 'ai', 'cua', 'tuan',
        'thang', 'nay', 'hom', 'qua', 'han', 'tre', 'sap', 'den', 'bang', 'du', 'an', 'viec', 'cong', 'task', 'giup',
        'em', 'anh', 'chi', 'oi', 'nhe', 'voi', 'trong', 'tren', 'duoc', 'giao', 'lam', 'xong', 'hoan', 'thanh', 'cham',
        'di', 've', 'som', 'muon', 'tong', 'hop', 'tien', 'do', 'uu', 'khan', 'cap', 'gap', 'dana', 'tim', 'kiem', 'lien', 'quan', 've'
    ];

    public function __construct(private AttendanceService $attendance)
    {
    }

    public function retrieve(User $user, string $question): array
    {
        $tz = config('attendance.timezone', 'Asia/Ho_Chi_Minh');
        $now = Carbon::now($tz);
        $q = VietnameseText::fold($question);
        $boards = $this->boardsFor($user);
        $boardIds = $boards->pluck('id')->all();

        $topics = $this->topics($q);
        $range = $this->timeRange($q, $now);

        $context = [
            'hom_nay' => $now->toDateString() . ' (' . $this->weekday($now) . ')',
            'nguoi_hoi' => [
                'ten' => $user->name,
                'ten_goi' => $this->firstName($user->name),
                'chuc_vu' => $user->position,
            ],
            'chu_de' => $topics,
            'tong_quan_cua_toi' => $this->mySummary($user, $now),
        ];

        // Boards named in the question.
        $matchedBoards = $this->matchBoards($q, $boards);
        if ($matchedBoards->isNotEmpty()) {
            $context['bang_duoc_hoi'] = $matchedBoards->map(fn ($b) => $this->boardDetail($b, $now))->values()->all();
        } elseif (in_array('du_an', $topics, true)) {
            $context['du_an'] = $boards->where('type', 'project')->map(fn ($b) => $this->boardDetail($b, $now, 5))->values()->all();
        }

        // People named in the question (colleagues sharing a board with the asker).
        $people = $this->matchPeople($question, $user, $boardIds);
        foreach ($people as $person) {
            $context['nguoi_duoc_hoi'][] = $this->personDetail($user, $person, $boardIds, $now, in_array('cham_cong', $topics, true));
        }

        // My own tasks for the requested time range / topic.
        if ($people === [] && $matchedBoards->isEmpty()) {
            $context['viec_cua_toi'] = $this->myTasks($user, $range, $topics, $now);
        }

        // Free keyword search across my boards ("báo giá", "LDP", "DC Center").
        $keywords = array_values(array_diff(VietnameseText::words($question), self::QUESTION_WORDS));
        $keywords = array_values(array_filter($keywords, fn ($w) => mb_strlen($w) >= 3));
        if ($keywords) {
            $found = $this->searchTasks($keywords, $boardIds, $now);
            if ($found) {
                $context['ket_qua_tim_kiem'] = ['tu_khoa' => $keywords, 'cong_viec' => $found];
            }
        }

        if (in_array('cham_cong', $topics, true)) {
            $context['cham_cong_cua_toi'] = $this->attendanceSummary($user, $now);
        }

        return $context;
    }

    // ------------------------------------------------------------ detection

    private function topics(string $q): array
    {
        $map = [
            'qua_han' => '/qua han|tre han|tre deadline|tre hen|bi tre/',
            'cham_cong' => '/cham cong|di lam|tan lam|di tre|ve som|vang|nghi lam|gio lam/',
            'du_an' => '/du an|project/',
            'uu_tien' => '/khan cap|gap|uu tien|quan trong/',
            'hoan_thanh' => '/da xong|hoan thanh|xong roi|done/',
            'tien_do' => '/tien do|bao cao|tong hop|tinh hinh|thong ke/',
            'chao_hoi' => '/^(chao|hello|hi|xin chao|alo)\b/',
            'huong_dan' => '/cach|huong dan|lam sao|lam the nao|su dung|dung nhu the nao/',
        ];

        return array_keys(array_filter($map, fn ($re) => preg_match($re, $q)));
    }

    /** @return array{from: ?string, to: ?string, label: string} */
    private function timeRange(string $q, Carbon $now): array
    {
        return match (true) {
            str_contains($q, 'hom nay') => ['from' => $now->toDateString(), 'to' => $now->toDateString(), 'label' => 'hôm nay'],
            str_contains($q, 'ngay mai') => ['from' => $now->copy()->addDay()->toDateString(), 'to' => $now->copy()->addDay()->toDateString(), 'label' => 'ngày mai'],
            str_contains($q, 'tuan sau') => ['from' => $now->copy()->addWeek()->startOfWeek()->toDateString(), 'to' => $now->copy()->addWeek()->endOfWeek()->toDateString(), 'label' => 'tuần sau'],
            str_contains($q, 'tuan nay') => ['from' => $now->copy()->startOfWeek()->toDateString(), 'to' => $now->copy()->endOfWeek()->toDateString(), 'label' => 'tuần này'],
            str_contains($q, 'thang nay') => ['from' => $now->copy()->startOfMonth()->toDateString(), 'to' => $now->copy()->endOfMonth()->toDateString(), 'label' => 'tháng này'],
            default => ['from' => null, 'to' => null, 'label' => ''],
        };
    }

    private function boardsFor(User $user): Collection
    {
        return Board::query()
            ->where(fn ($q) => $q->where('owner_id', $user->id)
                ->orWhereHas('members', fn ($m) => $m->where('users.id', $user->id)))
            ->get(['id', 'public_id', 'name', 'type', 'description', 'project_status', 'start_date', 'end_date', 'manager_id']);
    }

    /** Boards whose distinctive name words appear in the question. */
    private function matchBoards(string $q, Collection $boards): Collection
    {
        $qWords = VietnameseText::words($q);

        return $boards->filter(function (Board $b) use ($q, $qWords) {
            $key = VietnameseText::key($b->name);
            if ($key !== '' && str_contains(' ' . VietnameseText::key($q) . ' ', ' ' . $key . ' ')) {
                return true;
            }
            $nameWords = array_filter(VietnameseText::words($b->name), fn ($w) => mb_strlen($w) >= 3);
            $hits = array_intersect($qWords, $nameWords);

            return count($hits) >= 2 || (count($hits) === 1 && count($nameWords) === 1);
        })->take(3);
    }

    /** @return User[] colleagues named in the question who share a board with the asker */
    private function matchPeople(string $question, User $asker, array $boardIds): array
    {
        $dir = new PeopleDirectory();
        $ids = [];
        foreach ($dir->matchFreeText($question) as $m) {
            if (count($m['user_ids']) === 1) {
                $ids[] = $m['user_ids'][0];
            }
        }
        if (preg_match_all('/@(\S[^@]*)/u', $question, $mm)) {
            foreach ($mm[1] as $after) {
                $match = $dir->matchMention($after);
                if ($match && count($match['user_ids']) === 1) {
                    $ids[] = $match['user_ids'][0];
                }
            }
        }
        $ids = array_values(array_diff(array_unique($ids), [$asker->id]));
        if (!$ids) {
            return [];
        }

        $shared = DB::table('board_members')->whereIn('board_id', $boardIds)->whereIn('user_id', $ids)->pluck('user_id')->unique()->all();

        return User::whereIn('id', $shared)->limit(3)->get()->all();
    }

    // ------------------------------------------------------------ data

    private function mySummary(User $user, Carbon $now): array
    {
        $open = $this->openTasksQuery()->whereHas('assignees', fn ($a) => $a->where('users.id', $user->id));
        $today = $now->toDateString();

        return [
            'viec_chua_xong' => (clone $open)->count(),
            'qua_han' => (clone $open)->whereDate('due_date', '<', $today)->count(),
            'han_hom_nay' => (clone $open)->whereDate('due_date', $today)->count(),
            'khan_cap' => (clone $open)->where('priority', 'Khẩn cấp')->count(),
            'cham_cong_hom_nay' => $this->todayAttendance($user),
        ];
    }

    private function myTasks(User $user, array $range, array $topics, Carbon $now): array
    {
        $query = $this->openTasksQuery()->whereHas('assignees', fn ($a) => $a->where('users.id', $user->id));
        $today = $now->toDateString();

        if (in_array('hoan_thanh', $topics, true)) {
            $query = Task::query()->whereNotNull('completed_at')->whereNull('parent_task_id')
                ->whereHas('assignees', fn ($a) => $a->where('users.id', $user->id))
                ->where('completed_at', '>=', $range['from'] ? Carbon::parse($range['from'], $now->getTimezone())->utc() : $now->copy()->subDays(7)->utc())
                ->orderByDesc('completed_at');
        } elseif (in_array('qua_han', $topics, true)) {
            $query->whereDate('due_date', '<', $today);
        } elseif ($range['from']) {
            $query->whereBetween('due_date', [$range['from'], $range['to'] . ' 23:59:59']);
        }
        if (in_array('uu_tien', $topics, true)) {
            $query->whereIn('priority', ['Khẩn cấp', 'Cao']);
        }

        return [
            'pham_vi' => $range['label'] ?: (in_array('qua_han', $topics, true) ? 'quá hạn' : 'tất cả việc đang mở'),
            'danh_sach' => $query->with(['column.board:id,name,public_id', 'assignees:id,name'])
                ->orderByRaw('due_date IS NULL, due_date')
                ->limit(self::TASK_LIMIT)
                ->get()
                ->map(fn (Task $t) => $this->taskRow($t, $now))
                ->all(),
        ];
    }

    private function boardDetail(Board $board, Carbon $now, int $taskLimit = 10): array
    {
        $today = $now->toDateString();
        $columns = $board->columns()->whereNull('archived_at')->orderBy('order')->get(['id', 'title']);
        $base = Task::query()->whereIn('column_id', $columns->pluck('id'))->whereNull('archived_at')->whereNull('parent_task_id');
        $open = (clone $base)->whereNull('completed_at');

        return [
            'ten' => $board->name,
            'loai' => $board->type === 'project' ? 'dự án' : 'bảng công việc',
            'ma' => $board->public_id,
            'trang_thai_du_an' => $board->project_status,
            'han_du_an' => $board->end_date?->toDateString(),
            'tong_viec' => (clone $base)->count(),
            'da_xong' => (clone $base)->whereNotNull('completed_at')->count(),
            'qua_han' => (clone $open)->whereDate('due_date', '<', $today)->count(),
            'theo_cot' => $columns->map(fn ($c) => ['cot' => $c->title, 'so_viec' => (clone $base)->where('column_id', $c->id)->count()])->all(),
            'viec_can_chu_y' => (clone $open)->with(['column:id,title,board_id', 'assignees:id,name'])
                ->orderByRaw("CASE WHEN priority = 'Khẩn cấp' THEN 0 WHEN priority = 'Cao' THEN 1 ELSE 2 END")
                ->orderByRaw('due_date IS NULL, due_date')
                ->limit($taskLimit)
                ->get()
                ->map(fn (Task $t) => $this->taskRow($t, $now, false))
                ->all(),
        ];
    }

    private function personDetail(User $viewer, User $person, array $boardIds, Carbon $now, bool $withAttendance): array
    {
        $columnIds = DB::table('kanban_columns')->whereIn('board_id', $boardIds)->pluck('id');
        $tasks = $this->openTasksQuery()
            ->whereIn('column_id', $columnIds)
            ->whereHas('assignees', fn ($a) => $a->where('users.id', $person->id))
            ->with(['column.board:id,name,public_id', 'assignees:id,name'])
            ->orderByRaw('due_date IS NULL, due_date')
            ->limit(self::TASK_LIMIT)
            ->get();

        $data = [
            'ten' => $person->name,
            'chuc_vu' => $person->position,
            'viec_dang_mo_trong_cac_bang_chung' => $tasks->map(fn (Task $t) => $this->taskRow($t, $now))->all(),
        ];
        if ($withAttendance && $this->attendance->canViewUser($viewer, $person)) {
            $data['cham_cong_thang_nay'] = $this->attendanceSummary($person, $now);
        }

        return $data;
    }

    private function searchTasks(array $keywords, array $boardIds, Carbon $now): array
    {
        // Rank in PHP on accent-folded text: SQL LIKE is accent-sensitive on some databases
        // ("bao gia" must find "báo giá"). Candidates are limited to the asker's boards.
        $columnIds = DB::table('kanban_columns')->whereIn('board_id', $boardIds)->pluck('id');
        $candidates = Task::query()
            ->whereIn('column_id', $columnIds)
            ->whereNull('archived_at')
            ->where(fn ($q) => $q->whereNull('completed_at')->orWhere('completed_at', '>=', $now->copy()->subDays(60)->utc()))
            ->with(['column.board:id,name,public_id', 'assignees:id,name'])
            ->latest('id')
            ->limit(500)
            ->get();

        return $candidates
            ->map(function (Task $t) use ($keywords) {
                $text = ' ' . VietnameseText::key($t->title . ' ' . $t->description) . ' ';
                $score = count(array_filter($keywords, fn ($w) => str_contains($text, ' ' . $w . ' ')));

                return [$t, $score];
            })
            ->filter(fn ($pair) => $pair[1] > 0)
            ->sortByDesc(fn ($pair) => $pair[1])
            ->take(8)
            ->map(fn ($pair) => $this->taskRow($pair[0], $now))
            ->values()
            ->all();
    }

    private function attendanceSummary(User $user, Carbon $now): array
    {
        [$from, $to] = $this->attendance->monthRange($now->format('Y-m'));
        $records = $this->attendance->recordsBetween($user, $from, $to)->map(fn ($r) => $this->attendance->present($r))->values()->all();
        $s = $this->attendance->summarize($records, $from, $to, $this->attendance->trackingStart($user));

        return [
            'thang' => $now->format('m/Y'),
            'che_do' => $this->attendance->isDemo() ? 'chạy thử' : 'chính thức',
            'ngay_di_lam' => $s['present_days'] . '/' . $s['working_days'],
            'tong_gio' => round($s['worked_minutes'] / 60, 1),
            'so_ngay_di_tre' => $s['late_days'],
            'so_ngay_ve_som' => $s['early_leave_days'],
            'so_ngay_vang' => $s['absent_days'],
            'quen_cham_tan_lam' => $s['missing_checkout_days'],
            'hom_nay' => $this->todayAttendance($user),
        ];
    }

    private function todayAttendance(User $user): array|string
    {
        $r = $this->attendance->todayRecord($user);
        if (!$r) {
            return 'chưa chấm công';
        }
        $p = $this->attendance->present($r);

        return ['di_lam' => $p['check_in_time'], 'tan_lam' => $p['check_out_time'], 'tre_phut' => $p['late_minutes']];
    }

    private function openTasksQuery()
    {
        return Task::query()->whereNull('completed_at')->whereNull('archived_at')->whereNull('parent_task_id');
    }

    private function taskRow(Task $t, Carbon $now, bool $withBoard = true): array
    {
        $due = $t->due_date ? Carbon::parse($t->due_date)->toDateString() : null;

        return array_filter([
            'tieu_de' => $t->title,
            'bang' => $withBoard ? $t->column?->board?->name : null,
            'ma_bang' => $withBoard ? $t->column?->board?->public_id : null,
            'cot' => $t->column?->title,
            'nguoi_phu_trach' => $t->assignees->pluck('name')->implode(', ') ?: null,
            'uu_tien' => $t->priority,
            'han' => $due,
            'qua_han' => $due !== null && $t->completed_at === null && $due < $now->toDateString(),
            'da_xong' => $t->completed_at !== null,
        ], fn ($v) => $v !== null && $v !== false);
    }

    private function firstName(string $name): string
    {
        $base = trim(preg_replace('/\s*\(.*?\)\s*/u', ' ', $name));
        $parts = preg_split('/\s+/u', $base);

        return end($parts) ?: $base;
    }

    private function weekday(Carbon $d): string
    {
        return ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][$d->dayOfWeek];
    }
}
