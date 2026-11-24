<?php

namespace App\Services;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Label;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskGroup;
use App\Models\TrelloImport;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TrelloImportService
{
    public function preview(array $data, User $user, bool $fromApi): array
    {
        $this->validateSnapshot($data);
        $warnings = [
            'Tệp đính kèm được giữ bằng liên kết Trello gốc, có thể cần đăng nhập Trello để mở. Nội dung tệp chưa được sao chép.',
            'Custom Fields, ngày giờ gốc và thông tin người phụ trách được lưu ở phần nguồn Trello của công việc. Butler và Power-Up cần cấu hình lại.',
            'Ngày bắt đầu và hạn chót hiển thị theo ngày của hệ thống. Thời gian gốc được giữ trong nguồn Trello.',
        ];
        if (! $fromApi) {
            $warnings[] = 'JSON chỉ chứa dữ liệu có trong bản xuất. Lịch sử/bình luận có thể chưa đầy đủ. Dùng API để lấy toàn bộ lịch sử còn truy cập được.';
        }
        if ($data['closed'] ?? false) {
            $warnings[] = 'Bảng nguồn đã đóng trên Trello. Bảng mới sẽ được tạo để tiếp tục sử dụng.';
        }
        if (collect($data['cards'])->contains(fn ($c) => mb_strlen($c['name']) > 255)) {
            $warnings[] = 'Tiêu đề dài hơn 255 ký tự được rút gọn khi hiển thị, tên đầy đủ vẫn được giữ trong nguồn Trello.';
        }
        $members = collect($data['members'])->keyBy('id');
        foreach ($data['actions'] as $action) {
            if (isset($action['memberCreator']['id'])) {
                $members->put($action['memberCreator']['id'], $action['memberCreator']);
            }
        }
        foreach ($data['cards'] as $card) {
            foreach ($card['idMembers'] ?? [] as $id) {
                if (! $members->has($id)) {
                    $members->put($id, ['id' => $id, 'fullName' => 'Thành viên Trello '.$id]);
                }
            }
        }
        foreach ($data['checklists'] as $checklist) {
            foreach ($checklist['checkItems'] as $item) {
                $id = $item['idMember'] ?? null;
                if ($id && ! $members->has($id)) {
                    $members->put($id, ['id' => $id, 'fullName' => 'Thành viên Trello '.$id]);
                }
            }
        }
        $data['members'] = $members->values()->all();
        $summary = [
            'name' => $data['name'], 'lists' => count($data['lists']), 'cards' => count($data['cards']),
            'archived_cards' => collect($data['cards'])->where('closed', true)->count(),
            'checklists' => count($data['checklists']),
            'check_items' => collect($data['checklists'])->sum(fn ($c) => count($c['checkItems'] ?? [])),
            'comments' => collect($data['actions'])->filter(fn ($a) => $a['type'] === 'commentCard'
                && in_array($a['data']['card']['id'] ?? '', array_column($data['cards'], 'id'), true))->count(),
            'attachments' => collect($data['cards'])->sum(fn ($c) => count($c['attachments'] ?? [])),
            'labels' => count($data['labels']),
        ];

        return DB::transaction(function () use ($data, $user, $summary, $warnings) {
            // Serialize first imports too, before a source row exists.
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $import = TrelloImport::firstOrNew(['user_id' => $user->id, 'source_board_id' => $data['id']]);
            if ($import->result) {
                $this->authorizeResult($import, $user);

                return ['existing' => $import->result];
            }
            $import->fill([
                'preview_token' => (string) Str::uuid(),
                'payload' => ['board' => $data, 'summary' => $summary, 'warnings' => $warnings],
                'expires_at' => now()->addHour(),
            ])->save();
            $suggest = $this->memberSuggester();

            return [
                'preview_token' => $import->preview_token, 'expires_at' => $import->expires_at->toIso8601String(),
                'summary' => $summary, 'warnings' => $warnings,
                'members' => collect($data['members'])->map(function ($m) use ($suggest) {
                    $name = $m['fullName'] ?? $m['username'] ?? $m['id'];

                    return [
                        'id' => $m['id'], 'name' => $name, 'username' => $m['username'] ?? null,
                        'suggested_user' => $suggest($name, $m['username'] ?? null),
                    ];
                })->values(),
                'columns' => collect($data['lists'])->sortBy('pos')->map(fn ($l) => [
                    'name' => $l['name'], 'archived' => (bool) ($l['closed'] ?? false),
                    'cards' => collect($data['cards'])->where('idList', $l['id'])->count(),
                ])->values(),
            ];
        });
    }

    /**
     * Suggest the active employee for a Trello member: same username, or the same full name
     * ignoring accents, case and spacing ("Nguyen Nam Hung" = "Nguyễn Nam Hùng"). Ambiguous names
     * (two employees with the same name) get no suggestion. Done here in one query so the
     * browser does not need a search request per member.
     */
    private function memberSuggester(): \Closure
    {
        $plain = fn (?string $text) => trim(preg_replace('/\s+/', ' ', Str::lower(Str::ascii((string) $text))));
        $users = User::where('account_status', 'active')->get(['id', 'name', 'username']);
        $byName = $users->groupBy(fn ($u) => $plain($u->name))->filter(fn ($group) => $group->count() === 1)->map->first();
        $byUsername = $users->filter(fn ($u) => filled($u->username))->keyBy(fn ($u) => Str::lower($u->username));

        return function (string $name, ?string $username) use ($plain, $byName, $byUsername): ?array {
            $user = ($username !== null ? $byUsername->get(Str::lower($username)) : null)
                ?? ($plain($name) !== '' ? $byName->get($plain($name)) : null);

            return $user ? ['id' => $user->id, 'name' => $user->name, 'username' => $user->username] : null;
        };
    }

    public function confirm(User $user, string $token, array $memberMap, ?int $projectId): array
    {
        return DB::transaction(function () use ($user, $token, $memberMap, $projectId) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $import = TrelloImport::where('user_id', $user->id)->where('preview_token', $token)->lockForUpdate()->firstOrFail();
            if ($import->result) {
                $this->authorizeResult($import, $user);

                return $import->result;
            }
            if ($import->expires_at->isPast()) {
                throw ValidationException::withMessages(['preview_token' => 'Phiên xem trước đã hết hạn. Vui lòng lấy dữ liệu lại.']);
            }
            if ($projectId) {
                abort_unless(Project::findOrFail($projectId)->canView($user), 403, 'Bạn không có quyền nhập bảng vào dự án này.');
            }
            $payload = $import->payload;
            $data = $payload['board'];
            $knownMembers = array_column($data['members'], 'id');
            foreach ($memberMap as $sourceId => $userId) {
                if (! in_array($sourceId, $knownMembers, true)) {
                    throw ValidationException::withMessages(['member_map' => 'Thành viên nguồn không thuộc phiên nhập.']);
                }
                if ($userId && ! User::whereKey($userId)->where('account_status', 'active')->exists()) {
                    throw ValidationException::withMessages(['member_map' => 'Tài khoản được ghép không tồn tại hoặc đã bị khóa.']);
                }
            }

            $board = Board::create([
                'owner_id' => $user->id, 'name' => mb_substr($data['name'], 0, 255),
                'description' => $data['desc'] ?? '', 'project_id' => $projectId,
                'color' => 'bg-gradient-to-br from-blue-500 to-cyan-400',
            ]);
            $board->members()->attach($user->id, ['role' => 'admin']);
            foreach (array_unique(array_filter($memberMap)) as $userId) {
                if ((int) $userId !== $user->id) {
                    $board->members()->syncWithoutDetaching([(int) $userId => ['role' => 'member']]);
                }
            }
            $columns = [];
            foreach (collect($data['lists'])->sortBy('pos')->values() as $index => $list) {
                $columns[$list['id']] = KanbanColumn::create([
                    'board_id' => $board->id, 'title' => mb_substr($list['name'], 0, 255), 'order' => ($index + 1) * 1000,
                    'archived_at' => ($list['closed'] ?? false) ? now() : null,
                ]);
            }
            $labels = [];
            foreach ($data['labels'] as $label) {
                $labels[$label['id']] = Label::create([
                    'board_id' => $board->id, 'name' => mb_substr($label['name'] ?: ($label['color'] ?? 'Nhãn'), 0, 255),
                    'color' => $this->labelColor($label['color'] ?? null),
                ])->id;
            }
            $tasks = [];
            $members = collect($data['members'])->keyBy('id');
            foreach (collect($data['cards'])->sortBy('pos')->values() as $index => $card) {
                $task = Task::create([
                    'external_key' => 'trello:'.$card['id'], 'column_id' => $columns[$card['idList']]->id,
                    'created_by' => $user->id, 'title' => mb_substr($card['name'], 0, 255),
                    'description' => $card['desc'] ?? '', 'order' => ($index + 1) * 1000,
                    'start_date' => $this->date($card['start'] ?? null), 'due_date' => $this->date($card['due'] ?? null),
                    'completed_at' => ($card['dueComplete'] ?? false) ? $this->timestamp($card['dateLastActivity'] ?? null) : null,
                    'archived_at' => ($card['closed'] ?? false) ? now() : null,
                    'trello_source' => [
                        'id' => $card['id'], 'name' => $card['name'], 'list_name' => $columns[$card['idList']]->title,
                        'url' => 'https://trello.com/c/'.($card['shortLink'] ?? $card['id']),
                        'start' => $card['start'] ?? null, 'due' => $card['due'] ?? null,
                        'due_complete' => $card['dueComplete'] ?? false,
                        'members' => collect($card['idMembers'] ?? [])->map(fn ($id) => $members->get($id))->all(),
                        'attachments' => $card['attachments'] ?? [],
                        'custom_fields' => $this->customFields($data['customFields'] ?? [], $card['customFieldItems'] ?? []),
                    ],
                ]);
                $assigned = collect($card['idMembers'] ?? [])->map(fn ($id) => $memberMap[$id] ?? null)->filter()->unique()->values()->all();
                $task->syncAssigneesWithAutoSplit($assigned, $user->id);
                $task->labels()->sync(collect($card['idLabels'] ?? [])->map(fn ($id) => $labels[$id])->all());
                $tasks[$card['id']] = $task;
            }
            foreach (collect($data['checklists'])->sortBy('pos') as $checklist) {
                $task = $tasks[$checklist['idCard']];
                $group = TaskGroup::create([
                    'task_id' => $task->id, 'title' => mb_substr($checklist['name'], 0, 255),
                    'position' => $task->taskGroups()->count() + 1, 'created_by' => $user->id,
                ]);
                foreach (collect($checklist['checkItems'])->sortBy('pos')->values() as $index => $item) {
                    $subtask = Task::create([
                        'external_key' => 'trello:'.$item['id'], 'parent_task_id' => $task->id, 'task_group_id' => $group->id,
                        'column_id' => $task->column_id, 'title' => mb_substr($item['name'], 0, 255), 'sort_order' => $index + 1,
                        'created_by' => $user->id, 'due_date' => $this->date($item['due'] ?? null),
                        'completed_at' => $item['state'] === 'complete' ? now() : null,
                        'trello_source' => ['id' => $item['id'], 'name' => $item['name'], 'checklist_name' => $checklist['name']],
                    ]);
                    $assignee = $memberMap[$item['idMember'] ?? ''] ?? null;
                    if ($assignee) {
                        $subtask->syncAssigneesWithAutoSplit([(int) $assignee], $user->id);
                    }
                }
            }
            foreach ($data['actions'] as $action) {
                if ($action['type'] !== 'commentCard' || ! isset($tasks[$action['data']['card']['id'] ?? ''])) {
                    continue;
                }
                $author = $action['memberCreator']['fullName'] ?? $action['memberCreator']['username'] ?? $action['idMemberCreator'] ?? 'Trello';
                $comment = $tasks[$action['data']['card']['id']]->comments()->make([
                    'user_id' => $memberMap[$action['idMemberCreator'] ?? ''] ?? $user->id,
                    'content' => '[Trello · '.$author."]\n".($action['data']['text'] ?? ''),
                ]);
                $comment->created_at = $this->timestamp($action['date']);
                $comment->updated_at = $comment->created_at;
                $comment->save();
            }
            $result = [
                'board_id' => $board->id, 'public_id' => $board->public_id, 'name' => $board->name,
                'summary' => $payload['summary'], 'warnings' => $payload['warnings'],
                'snapshot_token' => $token,
            ];
            $import->update(['board_id' => $board->id, 'result' => $result]);

            return $result;
        });
    }

    public function snapshot(User $user, string $token): array
    {
        $import = TrelloImport::where('user_id', $user->id)->where('preview_token', $token)->firstOrFail();
        abort_unless($import->result, 404);
        $this->authorizeResult($import, $user);

        return $import->payload['board'];
    }

    private function authorizeResult(TrelloImport $import, User $user): void
    {
        $board = Board::find($import->board_id);
        abort_unless($board, 409, 'Bảng đã nhập đang ở thùng rác hoặc đã bị xóa. Khôi phục bảng trước khi tiếp tục.');
        Gate::forUser($user)->authorize('view', $board);
    }

    private function date(?string $value): ?string
    {
        return $value ? Carbon::parse($value)->timezone(config('app.timezone'))->toDateString() : null;
    }

    private function timestamp(?string $value): string
    {
        return $value ? Carbon::parse($value)->utc()->format('Y-m-d H:i:s') : now()->utc()->format('Y-m-d H:i:s');
    }

    private function labelColor(?string $color): string
    {
        return match (explode('_', $color ?? '')[0]) {
            'green' => '#22c55e', 'yellow' => '#eab308', 'orange' => '#f97316', 'red' => '#ef4444',
            'purple' => '#a855f7', 'blue' => '#3b82f6', 'sky' => '#06b6d4', 'lime' => '#84cc16',
            'pink' => '#ec4899', default => '#64748b',
        };
    }

    private function customFields(array $definitions, array $items): array
    {
        $fields = collect($definitions)->keyBy('id');

        return collect($items)->map(function ($item) use ($fields) {
            $field = $fields->get($item['idCustomField'], []);
            $option = collect($field['options'] ?? [])->firstWhere('id', $item['idValue'] ?? null);

            return [
                'name' => $field['name'] ?? $item['idCustomField'],
                'value' => $option['value']['text'] ?? implode(', ', array_values($item['value'] ?? [])),
            ];
        })->all();
    }

    private function validateSnapshot(array $data): void
    {
        $id = ['required', 'string', 'regex:/^[a-f0-9]{24}$/'];
        Validator::make($data, [
            'id' => $id, 'name' => 'required|string', 'desc' => 'nullable|string', 'closed' => 'sometimes|boolean',
            'lists' => 'present|array|max:2000', 'cards' => 'present|array|max:20000',
            'labels' => 'present|array', 'members' => 'present|array', 'actions' => 'present|array|max:100000',
            'checklists' => 'present|array', 'customFields' => 'sometimes|array',
            'lists.*.id' => [...$id, 'distinct:strict'], 'lists.*.name' => 'required|string',
            'lists.*.closed' => 'sometimes|boolean', 'lists.*.pos' => 'sometimes|numeric',
            'cards.*.id' => [...$id, 'distinct:strict'], 'cards.*.idList' => $id, 'cards.*.idBoard' => 'sometimes|string|regex:/^[a-f0-9]{24}$/',
            'cards.*.name' => 'required|string', 'cards.*.desc' => 'nullable|string',
            'cards.*.pos' => 'sometimes|numeric', 'cards.*.closed' => 'sometimes|boolean',
            'cards.*.dueComplete' => 'sometimes|boolean', 'cards.*.start' => 'nullable|date', 'cards.*.due' => 'nullable|date',
            'cards.*.dateLastActivity' => 'nullable|date', 'cards.*.shortLink' => 'sometimes|regex:/^[A-Za-z0-9]{8}$/',
            'cards.*.idMembers' => 'sometimes|array', 'cards.*.idMembers.*' => $id,
            'cards.*.idLabels' => 'sometimes|array', 'cards.*.idLabels.*' => $id,
            'cards.*.idChecklists' => 'sometimes|array', 'cards.*.idChecklists.*' => $id,
            'cards.*.attachments' => 'sometimes|array', 'cards.*.attachments.*.name' => 'required|string',
            'cards.*.attachments.*.url' => 'required|url:http,https',
            'cards.*.customFieldItems' => 'sometimes|array',
            'cards.*.customFieldItems.*.idCustomField' => $id,
            'cards.*.customFieldItems.*.value' => 'sometimes|array',
            'cards.*.customFieldItems.*.value.*' => 'nullable|string',
            'labels.*.id' => [...$id, 'distinct:strict'], 'labels.*.name' => 'present|nullable|string', 'labels.*.color' => 'nullable|string',
            'members.*.id' => [...$id, 'distinct:strict'], 'members.*.fullName' => 'sometimes|string', 'members.*.username' => 'sometimes|string',
            'checklists.*.id' => [...$id, 'distinct:strict'], 'checklists.*.idCard' => $id, 'checklists.*.name' => 'required|string',
            'checklists.*.checkItems' => 'present|array', 'checklists.*.pos' => 'sometimes|numeric',
            'checklists.*.checkItems.*.id' => $id, 'checklists.*.checkItems.*.name' => 'required|string',
            'checklists.*.checkItems.*.state' => 'required|in:complete,incomplete',
            'checklists.*.checkItems.*.pos' => 'sometimes|numeric', 'checklists.*.checkItems.*.due' => 'nullable|date',
            'checklists.*.checkItems.*.idMember' => 'nullable|string|regex:/^[a-f0-9]{24}$/',
            'actions.*.id' => [...$id, 'distinct:strict'], 'actions.*.type' => 'required|string', 'actions.*.date' => 'required|date',
            'actions.*.data' => 'required|array', 'actions.*.data.text' => 'sometimes|string',
            'actions.*.data.card.id' => 'sometimes|string|regex:/^[a-f0-9]{24}$/',
            'actions.*.idMemberCreator' => 'sometimes|string|regex:/^[a-f0-9]{24}$/',
            'actions.*.memberCreator' => 'sometimes|array', 'actions.*.memberCreator.fullName' => 'sometimes|string',
            'actions.*.memberCreator.id' => 'sometimes|string|regex:/^[a-f0-9]{24}$/',
            'actions.*.memberCreator.username' => 'sometimes|string',
            'customFields.*.id' => $id, 'customFields.*.name' => 'required|string',
            'customFields.*.options' => 'sometimes|array', 'customFields.*.options.*.id' => $id,
            'customFields.*.options.*.value.text' => 'sometimes|string',
        ])->validate();

        $listIds = array_column($data['lists'], 'id');
        $cardIds = array_column($data['cards'], 'id');
        $labelIds = array_column($data['labels'], 'id');
        $checklists = collect($data['checklists'])->keyBy('id');
        foreach ($data['cards'] as $card) {
            if (($card['idBoard'] ?? $data['id']) !== $data['id']
                || ! in_array($card['idList'], $listIds, true) || array_diff($card['idLabels'] ?? [], $labelIds)) {
                throw ValidationException::withMessages(['source' => 'Thiếu cột hoặc nhãn được tham chiếu. Hãy xuất lại bảng đầy đủ.']);
            }
            foreach ($card['idChecklists'] ?? [] as $checklistId) {
                if (($checklists->get($checklistId)['idCard'] ?? null) !== $card['id']) {
                    throw ValidationException::withMessages(['source' => 'Thiếu checklist của công việc. Hãy lấy lại dữ liệu đầy đủ.']);
                }
            }
        }
        foreach ($data['checklists'] as $checklist) {
            if (! in_array($checklist['idCard'], $cardIds, true)) {
                throw ValidationException::withMessages(['source' => 'Checklist tham chiếu công việc không có trong bản xuất.']);
            }
        }
    }
}
