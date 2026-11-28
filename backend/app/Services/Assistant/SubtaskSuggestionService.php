<?php

namespace App\Services\Assistant;

use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reads a task's description and proposes subtasks. Nothing is created here:
 * the user reviews and edits the list, then confirms (see TaskApplyService::addSubtasks).
 *
 * Uses Gemini when configured and within the usage limits, otherwise reads the
 * description's own checklist / bullet / numbered lines.
 */
class SubtaskSuggestionService
{
    public const MAX = 30;

    public function __construct(private GeminiClient $gemini, private AssistantUsage $usage)
    {
    }

    /** @return array{engine: string, warnings: string[], subtasks: array<int, array{title: string, done: bool}>} */
    public function suggest(User $user, Task $task): array
    {
        $description = trim((string) $task->description);
        $warnings = [];

        if ($this->gemini->isConfigured()) {
            if ($blocked = $this->usage->blockReason($user)) {
                $warnings[] = $blocked . ' Em tách theo từng dòng của mô tả, anh/chị kiểm tra lại giúp em nhé.';
            } else {
                try {
                    $subtasks = self::withoutParent($this->withGemini($task, $description), $task);
                    if ($subtasks) {
                        return ['engine' => 'gemini', 'warnings' => [], 'subtasks' => $subtasks];
                    }
                } catch (Throwable $e) {
                    Log::warning('assistant.subtask_suggest.gemini_failed', ['task' => $task->id, 'error' => $e->getMessage()]);
                    $warnings[] = 'Không gọi được Gemini nên em tách theo từng dòng của mô tả. Anh/chị kiểm tra lại giúp em nhé.';
                }
            }
        } else {
            $warnings[] = 'Chưa cài khóa Gemini nên em tách theo từng dòng của mô tả.';
        }

        return ['engine' => 'rules', 'warnings' => $warnings, 'subtasks' => self::withoutParent(self::fromLines($description), $task)];
    }

    /** A line repeating the task's own title (e.g. the "1. Heading" above a checklist) is not a subtask. */
    private static function withoutParent(array $items, Task $task): array
    {
        $parent = mb_strtolower(trim((string) $task->title));

        return array_values(array_filter($items, fn ($s) => mb_strtolower($s['title']) !== $parent));
    }

    /**
     * Checklist, bullet and numbered lines become subtasks; with none, every non-empty line does
     * (except a single line, which is the task itself rather than a list).
     */
    public static function fromLines(string $text): array
    {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/u', $text)), fn ($l) => $l !== ''));
        $marked = [];
        foreach ($lines as $line) {
            if (preg_match('/^(?:[-*•+]\s*)?\[\s*([xX✓✔]?)\s*\]\s*(\S.*)$/u', $line, $m)) {
                $marked[] = ['title' => $m[2], 'done' => $m[1] !== ''];
            } elseif (preg_match('/^(?:[-*•+]|\d+\s*[.)]|[a-zA-Z]\s*[.)])\s*(\S.*)$/u', $line, $m)) {
                $marked[] = ['title' => $m[1], 'done' => false];
            }
        }
        $items = $marked ?: (count($lines) > 1 ? array_map(fn ($l) => ['title' => $l, 'done' => false], $lines) : []);

        return self::clean($items);
    }

    private function withGemini(Task $task, string $description): array
    {
        $system = <<<'PROMPT'
Bạn là trợ lý quản lý dự án. Đọc TÊN và MÔ TẢ của một công việc rồi chia thành các VIỆC CON cụ thể để giao và theo dõi.
Quy tắc:
- Nếu mô tả đã có danh sách (checklist "- [ ]", gạch đầu dòng, đánh số) thì mỗi mục là một việc con, GIỮ NGUYÊN nội dung, chỉ bỏ ký hiệu đầu dòng. Không gộp, không bỏ mục nào, không thêm mục không có.
- Nếu mô tả là đoạn văn, tách thành các bước hành động rõ ràng, mỗi việc con bắt đầu bằng động từ, tối đa 120 ký tự, theo thứ tự nên làm.
- Không lặp lại tên công việc cha thành một việc con. Bỏ qua lời chào, ghi chú chung, đường link đứng một mình.
- done = true chỉ khi mục được ghi [x], ✅ hoặc "đã xong".
- Tối đa 30 việc con. Viết tiếng Việt.
PROMPT;
        $user = "TÊN CÔNG VIỆC: {$task->title}\n\nMÔ TẢ:\n" . mb_substr($description, 0, 8000);
        $schema = [
            'type' => 'object',
            'properties' => [
                'subtasks' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => ['title' => ['type' => 'string'], 'done' => ['type' => 'boolean']],
                        'required' => ['title'],
                    ],
                ],
            ],
            'required' => ['subtasks'],
        ];

        $result = $this->gemini->generateJson($system, $user, $schema);

        return self::clean(array_map(fn ($s) => [
            'title' => (string) ($s['title'] ?? ''),
            'done' => (bool) ($s['done'] ?? false),
        ], (array) ($result['subtasks'] ?? [])));
    }

    /** Strip leftover list markers, drop empties and duplicates, cap the count and length. */
    private static function clean(array $items): array
    {
        $out = [];
        $seen = [];
        foreach ($items as $item) {
            $title = trim(preg_replace('/^(?:[-*•+]\s*)?(?:\[\s*[xX✓✔]?\s*\]\s*)?/u', '', (string) $item['title']));
            $key = mb_strtolower($title);
            if ($title === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = ['title' => mb_substr($title, 0, 255), 'done' => (bool) $item['done']];
            if (count($out) >= self::MAX) {
                break;
            }
        }

        return $out;
    }
}
