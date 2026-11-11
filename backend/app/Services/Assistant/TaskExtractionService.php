<?php

namespace App\Services\Assistant;

use App\Models\Board;
use App\Models\User;
use App\Support\VietnameseText;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Turns a pasted work-assignment message into reviewable task drafts:
 * title, assignees (from @mentions / learned aliases), board, priority, done state, due date.
 *
 * Uses Gemini when configured, otherwise (or if Gemini fails) a rule-based parser.
 * Nothing is created here; see TaskApplyService.
 */
class TaskExtractionService
{
    public const PRIORITIES = ['Thấp', 'Bình thường', 'Cao', 'Khẩn cấp'];

    private const URGENT = '/\b(gap|khan|khan cap|urgent|asap|ngay lap tuc)\b/';

    public function __construct(private GeminiClient $gemini, private AssistantUsage $usage)
    {
    }

    /** Heuristic: does this chat message look like a list of assignments? */
    public function looksLikeTaskList(string $text): bool
    {
        $folded = VietnameseText::fold($text);
        if (preg_match('/^(giao viec|tao (task|cong viec|viec)|them (task|cong viec))/u', $folded)) {
            return true;
        }
        $lines = preg_split('/\R/u', trim($text));
        $itemLines = count(array_filter($lines, fn ($l) => preg_match('/^\s*(\d+\s*[.)]|[-*•]|@)\s*\S/u', $l)));
        $mentions = preg_match_all('/@\p{L}/u', $text);

        return $itemLines >= 2 || ($mentions >= 2 && count($lines) >= 3);
    }

    /** Boards the user belongs to (where tasks may be created). */
    public function boardsFor(User $user): Collection
    {
        return Board::query()
            ->where(fn ($q) => $q->where('owner_id', $user->id)
                ->orWhereHas('members', fn ($m) => $m->where('users.id', $user->id)))
            ->orderBy('name')
            ->get(['id', 'public_id', 'name', 'type', 'description', 'project_status']);
    }

    public function extract(User $user, string $text): array
    {
        $directory = new PeopleDirectory();
        $boards = $this->boardsFor($user);
        $warnings = [];
        $engine = 'rules';

        $drafts = null;
        $blocked = $this->gemini->isConfigured() ? $this->usage->blockReason($user) : null;
        if ($blocked) {
            $warnings[] = $blocked . ' Em dùng cách đọc cơ bản, anh/chị kiểm tra kỹ giúp em nhé.';
        } elseif ($this->gemini->isConfigured()) {
            try {
                $drafts = $this->extractWithGemini($text, $directory, $boards);
                $engine = 'gemini';
            } catch (Throwable $e) {
                Log::warning('assistant.extract.gemini_failed', ['error' => $e->getMessage()]);
                $warnings[] = 'Không gọi được Gemini nên em dùng cách đọc cơ bản. Anh/chị kiểm tra kỹ giúp em nhé.';
            }
        }
        $drafts ??= $this->extractWithRules($text, $directory, $boards);

        return [
            'engine' => $engine,
            'warnings' => $warnings,
            'tasks' => array_values($drafts),
            'boards' => $boards->map(fn ($b) => [
                'id' => $b->id,
                'name' => $b->name,
                'type' => $b->type,
                'public_id' => $b->public_id,
            ])->values()->all(),
            'people' => array_map(fn ($p) => ['id' => $p['id'], 'name' => $p['name'], 'position' => $p['position']], $directory->summary()),
            'priorities' => self::PRIORITIES,
        ];
    }

    // ---------------------------------------------------------------- rules

    private function extractWithRules(string $text, PeopleDirectory $directory, Collection $boards): array
    {
        $tasks = [];
        $contextLines = [];

        foreach (preg_split('/\R/u', $text) as $line) {
            $trim = trim($line);
            if ($trim === '') {
                $contextLines[] = '';
                continue;
            }
            $isItem = preg_match('/^\s*(\d+\s*[.)]|[-*•])\s*\S/u', $trim)
                || (str_starts_with($trim, '@') && !preg_match('/^@all\b/i', $trim));
            if ($isItem) {
                $tasks[] = $this->draftFromLine($trim, $directory, $boards);
            } else {
                $contextLines[] = $trim;
            }
        }

        // Urgent notes elsewhere in the message ("GẤP BÁO GIÁ ... DC CENTER") mark matching tasks.
        foreach ($this->blocks($contextLines) as $block) {
            $folded = VietnameseText::fold($block);
            if (!preg_match(self::URGENT, $folded)) {
                continue;
            }
            $blockWords = VietnameseText::words($block);
            foreach ($tasks as &$task) {
                $overlap = array_intersect(VietnameseText::words($task['source_line']), $blockWords);
                if (count($overlap) >= 2) {
                    $task['priority'] = 'Khẩn cấp';
                    $task['due_date'] ??= str_contains($folded, 'hom nay') ? $this->today() : null;
                    $task['description'] = trim($task['description'] . "\n\nGhi chú: " . $block);
                }
            }
            unset($task);
        }

        return $tasks;
    }

    private function draftFromLine(string $line, PeopleDirectory $directory, Collection $boards): array
    {
        $body = preg_replace('/^\s*(\d+\s*[.)]|[-*•])\s*/u', '', $line);
        $mentions = [];
        $title = $body;

        // "@Name" mentions, resolved against the people directory.
        $offset = 0;
        while (preg_match('/@(?!all\b)/iu', $body, $m, PREG_OFFSET_CAPTURE, $offset)) {
            $pos = $m[0][1];
            $match = $directory->matchMention(substr($body, $pos + 1));
            $offset = $pos + 1;
            if (!$match) {
                continue;
            }
            $mentions[] = $match;
            $namePattern = implode('\s+', array_map(fn ($w) => preg_quote($w, '/'), preg_split('/\s+/u', $match['raw'])));
            $title = preg_replace('/@\s*' . $namePattern . '/u', ' ', $title, 1);
        }

        // Learned aliases / full names written without "@".
        foreach ($directory->matchFreeText($body) as $match) {
            $already = collect($mentions)->contains(fn ($x) => $x['user_ids'] == $match['user_ids']);
            if (!$already) {
                $mentions[] = $match;
            }
        }

        $folded = VietnameseText::fold($body);
        $done = (bool) preg_match('/\bDONE\b/', $body) || str_contains($folded, 'da xong') || str_contains($folded, 'da hoan thanh');
        $title = preg_replace('/\bDONE\b|@all\b/iu', ' ', $title);
        $title = trim(preg_replace('/\s+/u', ' ', $title), " \t-–:,.");
        $title = mb_strtoupper(mb_substr($title, 0, 1)) . mb_substr($title, 1);

        $assignees = [];
        foreach ($mentions as $mention) {
            if (count($mention['user_ids']) === 1) {
                $assignees[] = $mention['user_ids'][0];
            }
        }

        [$boardId, $boardReason] = $this->guessBoard($body, $boards);

        return [
            'title' => mb_substr($title !== '' ? $title : $body, 0, 255),
            'description' => $body,
            'source_line' => $line,
            'assignee_ids' => array_values(array_unique($assignees)),
            'mentions' => array_map(fn ($m) => [
                'raw' => $m['raw'],
                'user_ids' => $m['user_ids'],
                'status' => count($m['user_ids']) === 1 ? 'matched' : (count($m['user_ids']) > 1 ? 'ambiguous' : 'unknown'),
            ], $mentions),
            'board_id' => $boardId,
            'board_reason' => $boardReason,
            'priority' => preg_match(self::URGENT, $folded) ? 'Khẩn cấp' : 'Bình thường',
            'done' => $done,
            'due_date' => $this->dueDate($folded),
        ];
    }

    /** Board whose name/description shares at least two meaningful words with the task. */
    private function guessBoard(string $text, Collection $boards): array
    {
        $words = VietnameseText::words($text);
        $best = null;
        $bestScore = 0;
        foreach ($boards as $board) {
            $nameHits = array_intersect($words, VietnameseText::words($board->name));
            $descHits = array_intersect($words, VietnameseText::words((string) $board->description));
            $score = count(array_unique([...$nameHits, ...$descHits]));
            if ($score > $bestScore) {
                $best = [$board->id, 'Trùng từ khóa: ' . implode(', ', array_slice(array_unique([...$nameHits, ...$descHits]), 0, 4))];
                $bestScore = $score;
            }
        }

        return $bestScore >= 2 ? $best : [null, null];
    }

    private function dueDate(string $folded): ?string
    {
        if (str_contains($folded, 'hom nay')) {
            return $this->today();
        }
        if (str_contains($folded, 'ngay mai')) {
            return Carbon::now(config('attendance.timezone', 'Asia/Ho_Chi_Minh'))->addDay()->toDateString();
        }
        if (preg_match('/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/', $folded, $m)) {
            $year = isset($m[3]) ? (int) $m[3] : (int) Carbon::now()->year;
            if (checkdate((int) $m[2], (int) $m[1], $year)) {
                return sprintf('%04d-%02d-%02d', $year, $m[2], $m[1]);
            }
        }

        return null;
    }

    /** Consecutive non-empty context lines joined into paragraphs. */
    private function blocks(array $lines): array
    {
        $blocks = [];
        $current = [];
        foreach ([...$lines, ''] as $line) {
            if ($line === '') {
                if ($current) {
                    $blocks[] = implode(' ', $current);
                }
                $current = [];
            } else {
                $current[] = $line;
            }
        }

        return $blocks;
    }

    private function today(): string
    {
        return Carbon::now(config('attendance.timezone', 'Asia/Ho_Chi_Minh'))->toDateString();
    }

    // ---------------------------------------------------------------- gemini

    private function extractWithGemini(string $text, PeopleDirectory $directory, Collection $boards): array
    {
        $people = $directory->summary();
        $boardList = $boards->map(fn ($b) => [
            'id' => $b->id,
            'name' => $b->name,
            'type' => $b->type === 'project' ? 'dự án' : 'bảng công việc',
            'description' => mb_substr((string) $b->description, 0, 300),
        ])->values()->all();

        $system = <<<PROMPT
Bạn là trợ lý điều phối công việc của công ty. Nhiệm vụ: đọc một tin nhắn giao việc tiếng Việt (thường copy từ Zalo/Telegram) và tách thành danh sách công việc.
Quy tắc:
- Mỗi việc là một mục riêng (thường là dòng có số thứ tự, gạch đầu dòng, hoặc dòng bắt đầu bằng @tên). Bỏ qua lời chào, lời động viên chung.
- title: ngắn gọn, rõ hành động, KHÔNG chứa tên người, tối đa 120 ký tự. details: giữ nguyên ý gốc và bổ sung ngữ cảnh liên quan trong tin nhắn.
- assignee_user_ids: chỉ dùng id có trong danh sách NHÂN VIÊN. So khớp theo tên, tên gọi tắt, biệt danh (aliases); không phân biệt dấu/hoa thường. Nếu tên có thể là nhiều người hoặc không chắc, KHÔNG đoán: để trống và ghi tên gốc vào unmatched_mentions.
- "@All" nghĩa là cả nhóm, không phải một người.
- board_id: chọn bảng/dự án phù hợp nhất theo nội dung từ danh sách BẢNG; không chắc thì null. board_reason: giải thích ngắn.
- priority: một trong "Thấp", "Bình thường", "Cao", "Khẩn cấp". Có chữ GẤP/khẩn/chốt hôm nay thì "Khẩn cấp". Ghi chú gấp ở cuối tin nhắn áp dụng cho việc liên quan.
- done = true nếu việc được ghi là DONE/đã xong.
- due_date: YYYY-MM-DD nếu có hạn (hôm nay = {$this->today()}), ngược lại null.
PROMPT;

        $user = "NHÂN VIÊN:\n" . json_encode($people, JSON_UNESCAPED_UNICODE)
            . "\n\nBẢNG:\n" . json_encode($boardList, JSON_UNESCAPED_UNICODE)
            . "\n\nTIN NHẮN:\n" . mb_substr($text, 0, 8000);

        $schema = [
            'type' => 'object',
            'properties' => [
                'tasks' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => ['type' => 'string'],
                            'details' => ['type' => 'string'],
                            'source_line' => ['type' => 'string'],
                            'assignee_user_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                            'unmatched_mentions' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'board_id' => ['type' => ['integer', 'null']],
                            'board_reason' => ['type' => ['string', 'null']],
                            'priority' => ['type' => 'string', 'enum' => self::PRIORITIES],
                            'done' => ['type' => 'boolean'],
                            'due_date' => ['type' => ['string', 'null']],
                        ],
                        'required' => ['title', 'assignee_user_ids', 'board_id', 'priority', 'done'],
                    ],
                ],
            ],
            'required' => ['tasks'],
        ];

        $result = $this->gemini->generateJson($system, $user, $schema);
        $boardIds = $boards->pluck('id')->all();

        // Never trust ids from the model: keep only real employees and the user's own boards.
        return array_map(function (array $t) use ($directory, $boardIds) {
            $ids = array_values(array_unique(array_filter(
                array_map('intval', $t['assignee_user_ids'] ?? []),
                fn ($id) => $directory->exists($id)
            )));
            $boardId = isset($t['board_id']) && in_array((int) $t['board_id'], $boardIds, true) ? (int) $t['board_id'] : null;
            $due = isset($t['due_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $t['due_date']) ? $t['due_date'] : null;

            $mentions = array_map(fn ($id) => ['raw' => optional($directory->people()->firstWhere('id', $id))->name, 'user_ids' => [$id], 'status' => 'matched'], $ids);
            foreach ($t['unmatched_mentions'] ?? [] as $raw) {
                $mentions[] = ['raw' => mb_substr((string) $raw, 0, 120), 'user_ids' => [], 'status' => 'unknown'];
            }

            return [
                'title' => mb_substr(trim((string) ($t['title'] ?? '')), 0, 255) ?: 'Công việc',
                'description' => trim((string) ($t['details'] ?? '')),
                'source_line' => (string) ($t['source_line'] ?? ''),
                'assignee_ids' => $ids,
                'mentions' => $mentions,
                'board_id' => $boardId,
                'board_reason' => $boardId ? ($t['board_reason'] ?? null) : null,
                'priority' => in_array($t['priority'] ?? '', self::PRIORITIES, true) ? $t['priority'] : 'Bình thường',
                'done' => (bool) ($t['done'] ?? false),
                'due_date' => $due,
            ];
        }, $result['tasks'] ?? []);
    }
}
