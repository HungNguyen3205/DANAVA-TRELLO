<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BoardData;
use App\Services\WorkspaceAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BoardController extends Controller
{
    public function __construct(private WorkspaceAccess $access, private BoardData $data) {}

    private function board(string $id): object
    {
        return DB::table('boards')->where('id', $id)->firstOrFail();
    }

    public function store(Request $request, string $workspace)
    {
        $this->access->edit($workspace, $request->user()->id);
        $values = $request->validate(['name' => 'required|string|max:100', 'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/']]);
        $id = (string) Str::uuid();
        DB::transaction(function () use ($id, $workspace, $values) {
            DB::table('boards')->insert([...$values, 'workspace_id' => $workspace, 'id' => $id, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
            foreach (['Chưa bắt đầu', 'Đang thực hiện', 'Chờ duyệt', 'Hoàn thành'] as $position => $title) {
                DB::table('board_columns')->insert(['id' => (string) Str::uuid(), 'board_id' => $id, 'title' => $title, 'position' => $position, 'completed' => $position === 3]);
            }
        });

        return response()->json(['id' => $id], 201);
    }

    public function show(Request $request, string $board)
    {
        return DB::transaction(function () use ($request, $board) {
            // Read version and all related rows under the same board lock.
            $row = DB::table('boards')->where('id', $board)->sharedLock()->firstOrFail();
            $role = $this->access->role($row->workspace_id, $request->user()->id);

            return ['id' => $row->id, 'workspace_id' => $row->workspace_id, 'version' => (int) $row->version, 'role' => $role, 'data' => $this->data->read($row)];
        });
    }

    public function favorite(Request $request, string $board)
    {
        $row = $this->board($board);
        $this->access->role($row->workspace_id, $request->user()->id);
        $values = $request->validate(['favorite' => 'required|boolean']);
        DB::table('board_preferences')->updateOrInsert(['board_id' => $board, 'user_id' => $request->user()->id], $values);

        return response()->noContent();
    }

    public function visit(Request $request, string $board)
    {
        $row = $this->board($board);
        $this->access->role($row->workspace_id, $request->user()->id);
        DB::table('board_preferences')->updateOrInsert(['board_id' => $board, 'user_id' => $request->user()->id], ['visited_at' => now()]);

        return response()->noContent();
    }

    public function save(Request $request, string $board)
    {
        $row = $this->board($board);
        $this->access->edit($row->workspace_id, $request->user()->id);
        $members = DB::table('workspace_members')->where('workspace_id', $row->workspace_id)->pluck('user_id')->map(fn ($id) => (string) $id)->all();
        $input = $request->validate([
            'version' => 'required|integer|min:1', 'data' => 'required|array', 'data.title' => 'required|string|max:100',
            'data.columns' => 'required|array|min:1|max:100', 'data.columns.*.id' => 'required|uuid|distinct', 'data.columns.*.title' => 'required|string|max:80', 'data.columns.*.completed' => 'sometimes|boolean',
            'data.tasks' => 'present|array|max:2000', 'data.tasks.*.id' => 'required|uuid|distinct', 'data.tasks.*.columnId' => 'required|uuid', 'data.tasks.*.title' => 'required|string|max:180', 'data.tasks.*.description' => 'nullable|string|max:5000',
            'data.tasks.*.priority' => ['required', Rule::in(['Thấp', 'Bình thường', 'Cao', 'Khẩn cấp'])], 'data.tasks.*.labels' => 'present|array|max:20', 'data.tasks.*.labels.*' => 'string|max:80',
            'data.tasks.*.assigneeId' => ['nullable', Rule::in($members)], 'data.tasks.*.collaborators' => 'present|array|max:100', 'data.tasks.*.collaborators.*' => [Rule::in($members)], 'data.tasks.*.dueDate' => 'nullable|date_format:Y-m-d',
            'data.tasks.*.checklist' => 'present|array|max:200', 'data.tasks.*.checklist.*.id' => 'required|uuid', 'data.tasks.*.checklist.*.text' => 'required|string|max:500', 'data.tasks.*.checklist.*.done' => 'required|boolean',
            'data.tasks.*.comments' => 'present|array|max:500', 'data.tasks.*.comments.*.id' => 'required|uuid', 'data.tasks.*.comments.*.body' => 'required|string|max:2000',
            'activity' => 'nullable|string|max:300',
        ]);
        $payload = $input['data'];
        $columnIds = array_column($payload['columns'], 'id');
        $taskIds = array_column($payload['tasks'], 'id');
        foreach ($payload['tasks'] as $task) {
            abort_unless(in_array($task['columnId'], $columnIds, true), 422, 'Công việc phải thuộc cột trong bảng.');
        }
        DB::transaction(function () use ($board, $request, $input, $payload, $columnIds, $taskIds) {
            $locked = DB::table('boards')->where('id', $board)->lockForUpdate()->first();
            $this->access->edit($locked->workspace_id, $request->user()->id);
            abort_unless((int) $locked->version === (int) $input['version'], 409, 'Bảng đã thay đổi. Tải lại trước khi lưu lại.');
            foreach (['board_columns' => $columnIds, 'tasks' => $taskIds] as $table => $ids) {
                abort_if(DB::table($table)->whereIn('id', $ids)->where('board_id', '!=', $board)->exists(), 422, 'ID thuộc một bảng khác.');
            }
            DB::table('tasks')->where('board_id', $board)->whereNotIn('id', $taskIds)->delete();
            foreach ($payload['columns'] as $position => $c) {
                DB::table('board_columns')->updateOrInsert(['id' => $c['id'], 'board_id' => $board], ['title' => $c['title'], 'position' => $position, 'completed' => $c['completed'] ?? false]);
            }
            foreach ($payload['tasks'] as $position => $t) {
                $values = ['board_id' => $board, 'column_id' => $t['columnId'], 'title' => $t['title'], 'description' => $t['description'] ?? '', 'priority' => $t['priority'], 'labels' => json_encode($t['labels']), 'assignee_id' => ($t['assigneeId'] ?? null) ?: null, 'due_date' => ($t['dueDate'] ?? null) ?: null, 'position' => $position, 'updated_at' => now()];
                if (DB::table('tasks')->where('id', $t['id'])->exists()) {
                    DB::table('tasks')->where('id', $t['id'])->update($values);
                } else {
                    DB::table('tasks')->insert([...$values, 'id' => $t['id'], 'created_at' => now()]);
                }
                DB::table('task_collaborators')->where('task_id', $t['id'])->delete();
                foreach (array_unique($t['collaborators']) as $userId) {
                    DB::table('task_collaborators')->insert(['task_id' => $t['id'], 'user_id' => $userId]);
                }
                $checks = array_column($t['checklist'], 'id');
                abort_unless(count($checks) === count(array_unique($checks)), 422, 'Checklist bị trùng ID.');
                abort_if(DB::table('checklist_items')->whereIn('id', $checks)->where('task_id', '!=', $t['id'])->exists(), 422, 'Checklist không thuộc công việc.');
                DB::table('checklist_items')->where('task_id', $t['id'])->whereNotIn('id', $checks)->delete();
                foreach ($t['checklist'] as $i => $c) {
                    DB::table('checklist_items')->updateOrInsert(['id' => $c['id'], 'task_id' => $t['id']], ['text' => $c['text'], 'done' => $c['done'], 'position' => $i]);
                }
                foreach ($t['comments'] as $comment) {
                    $existing = DB::table('task_comments')->where('id', $comment['id'])->first();
                    abort_if($existing && $existing->task_id !== $t['id'], 422, 'Bình luận không thuộc công việc.');
                    if (! $existing) {
                        DB::table('task_comments')->insert(['id' => $comment['id'], 'task_id' => $t['id'], 'author_id' => $request->user()->id, 'body' => $comment['body'], 'created_at' => now()]);
                    }
                }
            }
            DB::table('board_columns')->where('board_id', $board)->whereNotIn('id', $columnIds)->delete();
            DB::table('boards')->where('id', $board)->update(['name' => $payload['title'], 'version' => $locked->version + 1, 'updated_at' => now()]);
            DB::table('activity_logs')->insert(['board_id' => $board, 'actor_id' => $request->user()->id, 'description' => $input['activity'] ?? 'Cập nhật bảng', 'created_at' => now()]);
        });

        return $this->show($request, $board);
    }
}
