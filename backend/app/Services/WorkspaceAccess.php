<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class WorkspaceAccess
{
    public function role(string $workspaceId, int $userId): string
    {
        $role = DB::table('workspace_members')->where('workspace_id', $workspaceId)->where('user_id', $userId)->value('role');
        abort_unless($role, 404, 'Không tìm thấy không gian làm việc.');

        return $role;
    }

    public function edit(string $workspaceId, int $userId): string
    {
        $role = $this->role($workspaceId, $userId);
        abort_if($role === 'viewer', 403, 'Bạn chỉ có quyền xem.');

        return $role;
    }

    public function admin(string $workspaceId, int $userId): void
    {
        abort_unless(in_array($this->role($workspaceId, $userId), ['owner', 'admin']), 403, 'Cần quyền quản trị không gian.');
    }
}
