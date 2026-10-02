<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class BoardData
{
    public function read(object $board): array
    {
        $members = DB::table('workspace_members as m')->join('users as u', 'u.id', '=', 'm.user_id')->where('m.workspace_id', $board->workspace_id)->select('u.id', 'u.name')->get();
        $tasks = DB::table('tasks')->where('board_id', $board->id)->orderBy('position')->get();
        $taskIds = $tasks->pluck('id');
        $checks = DB::table('checklist_items')->whereIn('task_id', $taskIds)->orderBy('position')->get()->groupBy('task_id');
        $comments = DB::table('task_comments as c')->join('users as u', 'u.id', '=', 'c.author_id')->whereIn('c.task_id', $taskIds)->select('c.*', 'u.name as author')->orderBy('c.created_at')->get()->groupBy('task_id');
        $collaborators = DB::table('task_collaborators')->whereIn('task_id', $taskIds)->get()->groupBy('task_id');

        return [
            'title' => $board->name,
            'columns' => DB::table('board_columns')->where('board_id', $board->id)->orderBy('position')->get()->map(fn ($c) => ['id' => $c->id, 'title' => $c->title, 'completed' => (bool) $c->completed])->values()->all(),
            'users' => $members->map(fn ($u) => ['id' => (string) $u->id, 'name' => $u->name, 'initials' => collect(preg_split('/\s+/u', trim($u->name)))->take(-2)->map(fn ($s) => mb_strtoupper(mb_substr($s, 0, 1)))->implode('')])->all(),
            'tasks' => $tasks->map(fn ($t) => [
                'id' => $t->id, 'columnId' => $t->column_id, 'title' => $t->title, 'description' => $t->description ?? '', 'priority' => $t->priority, 'labels' => json_decode($t->labels, true),
                'assigneeId' => $t->assignee_id ? (string) $t->assignee_id : '', 'collaborators' => ($collaborators[$t->id] ?? collect())->pluck('user_id')->map(fn ($id) => (string) $id)->all(), 'dueDate' => $t->due_date ?? '',
                'checklist' => ($checks[$t->id] ?? collect())->map(fn ($c) => ['id' => $c->id, 'text' => $c->text, 'done' => (bool) $c->done])->all(),
                'comments' => ($comments[$t->id] ?? collect())->map(fn ($c) => ['id' => $c->id, 'author' => $c->author, 'body' => $c->body, 'createdAt' => $c->created_at.'Z'])->all(),
            ])->all(),
            'activity' => DB::table('activity_logs as a')->join('users as u', 'u.id', '=', 'a.actor_id')->where('a.board_id', $board->id)->select('a.*', 'u.name as author')->orderByDesc('a.id')->limit(150)->get()->map(fn ($a) => ['id' => (string) $a->id, 'text' => $a->description, 'author' => $a->author, 'createdAt' => $a->created_at.'Z'])->all(),
        ];
    }
}
