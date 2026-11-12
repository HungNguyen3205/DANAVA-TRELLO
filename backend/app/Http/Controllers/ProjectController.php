<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\Project;
use App\Models\Task;
use App\Services\BoardAccessService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Projects group boards: Project > Board > Column > Task. */
class ProjectController extends Controller
{
    private const DONE_TITLES = ['done', 'hoàn thành', 'completed'];

    public function __construct(private BoardAccessService $access)
    {
    }

    /** GET /projects */
    public function index(Request $request)
    {
        $user = $request->user();
        $projects = Project::visibleTo($user)
            ->with(['manager:id,name,avatar'])
            ->withCount('boards')
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 1 WHEN 'planning' THEN 2 WHEN 'on_hold' THEN 3 WHEN 'completed' THEN 4 ELSE 5 END")
            ->orderBy('name')
            ->get();

        $boardsByProject = Board::whereIn('project_id', $projects->pluck('id'))->get(['id', 'project_id'])->groupBy('project_id');
        $stats = $this->taskStats(Board::whereIn('project_id', $projects->pluck('id'))->pluck('id'));
        $members = $this->membersByBoard(Board::whereIn('project_id', $projects->pluck('id'))->pluck('id'));

        return response()->json($projects->map(function (Project $p) use ($boardsByProject, $stats, $members, $user) {
            $boardIds = ($boardsByProject[$p->id] ?? collect())->pluck('id');

            return [
                ...$this->present($p, $user),
                'stats' => $this->sumStats($stats, $boardIds),
                'members' => $this->unionMembers($members, $boardIds)->take(5)->values(),
                'members_count' => $this->unionMembers($members, $boardIds)->count(),
            ];
        })->values());
    }

    /** POST /projects */
    public function store(Request $request)
    {
        $data = $request->validate($this->rules(true));
        $project = Project::create([...$data, 'owner_id' => $request->user()->id, 'status' => $data['status'] ?? 'planning']);

        return response()->json($this->present($project->load('manager:id,name,avatar'), $request->user()), 201);
    }

    /** GET /projects/{project} — details and the boards this user can open. */
    public function show(Request $request, Project $project)
    {
        $user = $request->user();
        abort_unless($project->canView($user), 403, 'Bạn không có quyền xem dự án này.');

        $allBoardIds = $project->boards()->pluck('id');
        $boards = $project->boards()->accessibleBy($user)
            ->orderBy('name')
            ->get(['id', 'public_id', 'name', 'description', 'color', 'background_image', 'owner_id', 'updated_at']);
        $stats = $this->taskStats($allBoardIds);
        $members = $this->membersByBoard($allBoardIds);

        return response()->json([
            ...$this->present($project->load(['manager:id,name,avatar', 'owner:id,name']), $user),
            'stats' => $this->sumStats($stats, $allBoardIds),
            'members' => $this->unionMembers($members, $allBoardIds)->values(),
            'hidden_boards_count' => $allBoardIds->count() - $boards->count(),
            'files_count' => $project->files()->count(),
            'boards' => $boards->map(fn (Board $b) => [
                'id' => $b->id,
                'public_id' => $b->public_id,
                'name' => $b->name,
                'description' => $b->description,
                'color' => $b->color,
                'background_image' => $b->background_image,
                'updated_at' => $b->updated_at?->toIso8601String(),
                'stats' => $this->sumStats($stats, collect([$b->id])),
                'members' => ($members[$b->id] ?? collect())->take(5)->values(),
                'can_manage' => $this->access->canManage($user, $b),
            ])->values(),
        ]);
    }

    /** PUT /projects/{project} */
    public function update(Request $request, Project $project)
    {
        $this->authorizeManage($request, $project);
        $project->update($request->validate($this->rules(false)));

        return response()->json($this->present($project->fresh(['manager:id,name,avatar']), $request->user()));
    }

    /** DELETE /projects/{project} — boards are kept and become "not in a project". */
    public function destroy(Request $request, Project $project)
    {
        $this->authorizeManage($request, $project);
        DB::transaction(function () use ($project) {
            Board::withTrashed()->where('project_id', $project->id)->update(['project_id' => null]);
            $project->delete();
        });
        $this->deleteCoverFile($project->cover_image);
        ProjectFileController::deleteAllFor($project);

        return response()->json(['message' => 'Đã xóa dự án. Các bảng vẫn được giữ nguyên.']);
    }

    /** POST /projects/{project}/boards {board_id} — move an existing board into this project. */
    public function attachBoard(Request $request, Project $project)
    {
        $user = $request->user();
        abort_unless($project->canView($user), 403, 'Bạn không có quyền với dự án này.');
        $data = $request->validate(['board_id' => 'required']);
        $board = (new Board())->resolveRouteBinding($data['board_id']);
        abort_unless($board, 404, 'Không tìm thấy bảng.');
        // Moving a board changes where its data shows up, so the board's own admins decide.
        abort_unless($this->access->canManage($user, $board), 403, 'Chỉ quản trị viên của bảng mới chuyển được bảng.');

        $board->update(['project_id' => $project->id]);

        return response()->json(['message' => "Đã chuyển bảng \"{$board->name}\" vào dự án \"{$project->name}\".", 'board_id' => $board->id]);
    }

    /** DELETE /projects/{project}/boards/{board} — take a board out of the project. */
    public function detachBoard(Request $request, Project $project, Board $board)
    {
        $user = $request->user();
        abort_unless((int) $board->project_id === (int) $project->id, 404);
        abort_unless($project->canManage($user) || $this->access->canManage($user, $board), 403, 'Bạn không có quyền.');
        $board->update(['project_id' => null]);

        return response()->json(['message' => "Đã đưa bảng \"{$board->name}\" ra khỏi dự án."]);
    }

    /** POST /projects/{project}/cover — upload a cover photo (JPG/PNG/WebP, max 5MB). */
    public function uploadCover(Request $request, Project $project)
    {
        $this->authorizeManage($request, $project);
        $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp|mimetypes:image/jpeg,image/png,image/webp|max:5120',
        ], [
            'image.mimes' => 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
            'image.mimetypes' => 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
            'image.max' => 'Ảnh tối đa 5MB.',
        ]);

        $old = $project->cover_image;
        $path = $request->file('image')->store('project-covers', 'public');
        $project->update(['cover_image' => '/storage/' . $path]);
        $this->deleteCoverFile($old);

        return response()->json($this->present($project->fresh('manager:id,name,avatar'), $request->user()));
    }

    /** DELETE /projects/{project}/cover */
    public function removeCover(Request $request, Project $project)
    {
        $this->authorizeManage($request, $project);
        $old = $project->cover_image;
        $project->update(['cover_image' => null]);
        $this->deleteCoverFile($old);

        return response()->json($this->present($project->fresh('manager:id,name,avatar'), $request->user()));
    }

    private function deleteCoverFile(?string $publicPath): void
    {
        if ($publicPath && str_starts_with($publicPath, '/storage/project-covers/')) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete(substr($publicPath, strlen('/storage/')));
        }
    }

    private function authorizeManage(Request $request, Project $project): void
    {
        abort_unless($project->canManage($request->user()), 403, 'Chỉ chủ dự án, quản lý dự án hoặc quản trị hệ thống được chỉnh sửa dự án.');
    }

    private function rules(bool $creating): array
    {
        return [
            'name' => ($creating ? 'required' : 'sometimes') . '|string|max:255',
            'description' => 'nullable|string|max:5000',
            'color' => 'nullable|string|max:20',
            'status' => 'nullable|in:' . implode(',', Project::STATUSES),
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'manager_id' => 'nullable|integer|exists:users,id',
            'budget' => 'nullable|numeric|min:0|max:9999999999999',
        ];
    }

    private function present(Project $p, $user): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'description' => $p->description,
            'color' => $p->color,
            'cover_image' => $p->cover_image,
            'status' => $p->status,
            'start_date' => $p->start_date?->toDateString(),
            'end_date' => $p->end_date?->toDateString(),
            'budget' => $p->budget,
            'manager' => $p->manager ? ['id' => $p->manager->id, 'name' => $p->manager->name, 'avatar' => $p->manager->avatar] : null,
            'owner_id' => $p->owner_id,
            'boards_count' => $p->boards_count ?? $p->boards()->count(),
            'can_manage' => $p->canManage($user),
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }

    /** Main-task totals per board: total, done, overdue. */
    private function taskStats(Collection $boardIds): Collection
    {
        if ($boardIds->isEmpty()) {
            return collect();
        }
        $done = "(tasks.completed_at IS NOT NULL OR LOWER(c.title) IN ('" . implode("','", self::DONE_TITLES) . "'))";
        $today = Carbon::now(config('attendance.timezone', 'Asia/Ho_Chi_Minh'))->toDateString();

        return Task::query()
            ->join('kanban_columns as c', 'c.id', '=', 'tasks.column_id')
            ->whereNull('c.deleted_at')
            ->whereNull('tasks.parent_task_id')
            ->whereIn('c.board_id', $boardIds)
            ->groupBy('c.board_id')
            ->selectRaw("c.board_id, COUNT(*) AS total, SUM(CASE WHEN $done THEN 1 ELSE 0 END) AS done,
                SUM(CASE WHEN NOT $done AND tasks.due_date IS NOT NULL AND DATE(tasks.due_date) < ? THEN 1 ELSE 0 END) AS overdue", [$today])
            ->get()
            ->keyBy('board_id');
    }

    private function sumStats(Collection $stats, Collection $boardIds): array
    {
        $total = $done = $overdue = 0;
        foreach ($boardIds as $id) {
            $row = $stats[$id] ?? null;
            $total += (int) ($row->total ?? 0);
            $done += (int) ($row->done ?? 0);
            $overdue += (int) ($row->overdue ?? 0);
        }

        return ['tasks' => $total, 'done' => $done, 'overdue' => $overdue, 'progress' => $total ? (int) round($done * 100 / $total) : 0];
    }

    /** board_id => collection of {id, name, avatar} (owner + members). */
    private function membersByBoard(Collection $boardIds): Collection
    {
        if ($boardIds->isEmpty()) {
            return collect();
        }
        $rows = DB::table('board_members')->join('users', 'users.id', '=', 'board_members.user_id')
            ->whereIn('board_members.board_id', $boardIds)
            ->select('board_members.board_id', 'users.id', 'users.name', 'users.avatar')
            ->union(
                DB::table('boards')->join('users', 'users.id', '=', 'boards.owner_id')
                    ->whereIn('boards.id', $boardIds)
                    ->select('boards.id as board_id', 'users.id', 'users.name', 'users.avatar')
            )
            ->get();

        return $rows->groupBy('board_id')->map(fn ($g) => $g->unique('id')->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'avatar' => $u->avatar])->values());
    }

    private function unionMembers(Collection $members, Collection $boardIds): Collection
    {
        return $boardIds->flatMap(fn ($id) => $members[$id] ?? [])->unique('id')->values();
    }
}
