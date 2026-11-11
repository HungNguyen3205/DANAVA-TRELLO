<?php

namespace App\Services\Assistant;

use App\Models\User;
use App\Models\UserAlias;
use App\Support\VietnameseText;
use Illuminate\Support\Collection;

/**
 * Resolves names written in chat messages ("@Ngọc Hân", "Hùng IT") to employees.
 *
 * A name key maps to every user it could mean, so ambiguous names (two people
 * called "Nguyễn Nam Hùng") are reported as ambiguous instead of guessed.
 */
class PeopleDirectory
{
    /** Words that start the task text right after a name, never part of a name. */
    private const NAME_STOP_WORDS = [
        'review', 'test', 'gui', 'len', 'cham', 'tao', 'lam', 'check', 'hoan', 'thuc', 'ho', 'gap', 'done',
        'cho', 'va', 'giup', 'nhe', 'xem', 'sua', 'viet', 'goi', 'hen', 'bao', 'ke', 'dang', 'chot', 'phu',
    ];

    /** @var Collection<int, User> */
    private Collection $people;

    /** @var array<string, int[]> name key => user ids */
    private array $index = [];

    /** @var array<string, int[]> learned aliases and multi-word full names, matched anywhere in a line */
    private array $freeIndex = [];

    public function __construct()
    {
        $this->people = User::query()
            ->where('account_status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'username', 'position']);

        foreach ($this->people as $user) {
            $base = trim(preg_replace('/\s*\(.*?\)\s*/u', ' ', $user->name)); // drop "(Giám đốc Dự án)"
            foreach (array_unique([$user->name, $base]) as $name) {
                $this->add($name, $user->id, true);
                // Trailing parts of a full name: "Nguyễn Ngọc Hân" -> "Ngọc Hân"
                $words = preg_split('/\s+/u', $base);
                for ($i = 1; $i < count($words) - 1; $i++) {
                    $this->add(implode(' ', array_slice($words, $i)), $user->id, false);
                }
            }
            if ($user->username) {
                $this->add($user->username, $user->id, false);
            }
        }

        foreach (UserAlias::whereIn('user_id', $this->people->pluck('id'))->get() as $alias) {
            $this->add($alias->alias, $alias->user_id, true);
        }
    }

    public function people(): Collection
    {
        return $this->people;
    }

    /** Compact list for the AI prompt and the preview UI (no emails / phone numbers). */
    public function summary(): array
    {
        $aliases = UserAlias::whereIn('user_id', $this->people->pluck('id'))->get()->groupBy('user_id');

        return $this->people->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'username' => $u->username,
            'position' => $u->position,
            'aliases' => ($aliases->get($u->id) ?? collect())->pluck('alias')->values()->all(),
        ])->values()->all();
    }

    /**
     * Resolve the name right after an "@".
     *
     * @return array{raw: string, user_ids: int[]}|null
     */
    public function matchMention(string $afterAt): ?array
    {
        $words = preg_split('/\s+/u', trim($afterAt), -1, PREG_SPLIT_NO_EMPTY);
        $max = min(6, count($words));

        for ($n = $max; $n >= 1; $n--) {
            $candidate = implode(' ', array_slice($words, 0, $n));
            $key = VietnameseText::key($candidate);
            if ($key !== '' && isset($this->index[$key])) {
                return ['raw' => $candidate, 'user_ids' => $this->index[$key]];
            }
        }

        // Unknown name: take the capitalised words before the task text starts.
        $raw = [];
        foreach (array_slice($words, 0, 5) as $i => $word) {
            $folded = VietnameseText::key($word);
            if ($folded === '' || str_starts_with($word, '@')) {
                break;
            }
            if ($i > 0 && (in_array($folded, self::NAME_STOP_WORDS, true) || !preg_match('/^\p{Lu}/u', $word))) {
                break;
            }
            $raw[] = $word;
        }

        return $raw ? ['raw' => implode(' ', $raw), 'user_ids' => []] : null;
    }

    /**
     * Learned aliases / full names written without "@" ("Hùng IT lên các gói ...").
     *
     * @return array<int, array{raw: string, user_ids: int[]}>
     */
    public function matchFreeText(string $line): array
    {
        $folded = ' ' . VietnameseText::key($line) . ' ';
        $found = [];
        foreach ($this->freeIndex as $key => $ids) {
            if (str_contains($folded, ' ' . $key . ' ')) {
                $found[$key] = ['raw' => $key, 'user_ids' => $ids];
            }
        }

        // Drop keys contained in a longer match ("nam hung" inside "nguyen nam hung").
        return array_values(array_filter($found, function ($m) use ($found) {
            foreach ($found as $other) {
                if ($other['raw'] !== $m['raw'] && str_contains(' ' . $other['raw'] . ' ', ' ' . $m['raw'] . ' ')) {
                    return false;
                }
            }

            return true;
        }));
    }

    public function exists(int $userId): bool
    {
        return $this->people->contains('id', $userId);
    }

    private function add(string $name, int $userId, bool $free): void
    {
        $key = VietnameseText::key($name);
        if ($key === '') {
            return;
        }
        $this->index[$key] = array_values(array_unique([...($this->index[$key] ?? []), $userId]));
        // Only multi-word names are safe to spot without an "@".
        if ($free && str_contains($key, ' ')) {
            $this->freeIndex[$key] = array_values(array_unique([...($this->freeIndex[$key] ?? []), $userId]));
        }
    }
}
