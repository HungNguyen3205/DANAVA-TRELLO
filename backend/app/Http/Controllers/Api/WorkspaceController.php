<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\WorkspaceAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WorkspaceController extends Controller
{
    public function __construct(private WorkspaceAccess $access) {}

    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $spaces = DB::table('workspaces as w')->join('workspace_members as m', 'm.workspace_id', '=', 'w.id')->where('m.user_id', $userId)->select('w.*', 'm.role')->orderBy('w.created_at')->get();
        $boards = DB::table('boards as b')->leftJoin('board_preferences as p', function ($join) use ($userId) {
            $join->on('p.board_id', '=', 'b.id')->where('p.user_id', $userId);
        })->whereIn('b.workspace_id', $spaces->pluck('id'))->select('b.*', 'p.favorite', 'p.visited_at')->orderBy('b.created_at')->get();

        return ['workspaces' => $spaces->map(function ($w) use ($boards) {
            $w->boards = $boards->where('workspace_id', $w->id)->values()->map(function ($b) {
                $b->favorite = (bool) $b->favorite;

                return $b;
            });

            return $w;
        })];
    }

    public function store(Request $request)
    {
        $values = $request->validate(['name' => 'required|string|max:100', 'description' => 'nullable|string|max:2000', 'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/']]);
        $id = (string) Str::uuid();
        DB::transaction(function () use ($id, $values, $request) {
            DB::table('workspaces')->insert([...$values, 'id' => $id, 'owner_id' => $request->user()->id, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('workspace_members')->insert(['workspace_id' => $id, 'user_id' => $request->user()->id, 'role' => 'owner', 'created_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['id' => $id], 201);
    }

    public function update(Request $request, string $workspace)
    {
        $this->access->admin($workspace, $request->user()->id);
        $values = $request->validate(['name' => 'required|string|max:100', 'description' => 'nullable|string|max:2000', 'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/']]);
        DB::table('workspaces')->where('id', $workspace)->update([...$values, 'updated_at' => now()]);

        return response()->noContent();
    }

    public function members(Request $request, string $workspace)
    {
        $this->access->role($workspace, $request->user()->id);

        return ['members' => DB::table('workspace_members as m')->join('users as u', 'u.id', '=', 'm.user_id')->where('m.workspace_id', $workspace)->select('u.id', 'u.name', 'u.email', 'm.role')->get()];
    }

    public function setMember(Request $request, string $workspace)
    {
        $this->access->admin($workspace, $request->user()->id);
        $values = $request->validate(['email' => 'required|email', 'role' => 'required|in:admin,editor,viewer,remove']);
        $user = User::where('email', strtolower(trim($values['email'])))->first();
        if (! $user) {
            throw ValidationException::withMessages(['email' => 'Người này cần đăng ký tài khoản trước khi được thêm vào không gian.']);
        }
        $owner = DB::table('workspaces')->where('id', $workspace)->value('owner_id');
        abort_if((int) $owner === $user->id, 422, 'Không thể đổi quyền hoặc xóa chủ không gian.');
        DB::transaction(function () use ($workspace, $user, $values) {
            if ($values['role'] === 'remove') {
                DB::table('workspace_members')->where('workspace_id', $workspace)->where('user_id', $user->id)->delete();
                $taskIds = DB::table('tasks')->whereIn('board_id', DB::table('boards')->where('workspace_id', $workspace)->select('id'))->pluck('id');
                DB::table('tasks')->whereIn('id', $taskIds)->where('assignee_id', $user->id)->update(['assignee_id' => null]);
                DB::table('task_collaborators')->whereIn('task_id', $taskIds)->where('user_id', $user->id)->delete();
            } else {
                DB::table('workspace_members')->updateOrInsert(['workspace_id' => $workspace, 'user_id' => $user->id], ['role' => $values['role'], 'updated_at' => now(), 'created_at' => now()]);
            }
            // Roster changes also invalidate any open board edit version.
            DB::table('boards')->where('workspace_id',$workspace)->increment('version');
        });

        return response()->noContent();
    }
}
