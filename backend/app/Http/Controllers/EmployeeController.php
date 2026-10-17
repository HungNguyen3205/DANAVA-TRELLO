<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $query = User::withCount(['workspaces', 'boards']);

        if ($request->search) {
            $search = '%' . $request->search . '%';
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('username', 'like', $search);
            });
        }

        if ($request->status) {
            $query->where('account_status', $request->status);
        }

        return response()->json($query->paginate(15));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'nullable|string|max:100',
            'username' => 'required|string',
            'password' => 'required|string|min:6',
            'system_role' => 'nullable|in:admin,user',
            'workspace_id' => 'nullable|exists:workspaces,id',
            'workspace_role' => 'nullable|in:admin,member',
        ]);

        $cleanRaw = str_replace('@danava.vn', '', strtolower(trim($request->username)));
        $finalUsername = Str::slug($cleanRaw, '');
        if (empty($finalUsername)) {
            $finalUsername = preg_replace('/[^a-zA-Z0-9._-]/', '', $cleanRaw);
        }
        $email = $finalUsername . '@danava.vn';
        $fullName = trim($request->name) ? trim($request->name) : $finalUsername;

        // Check if user already exists
        $existing = User::where('username', $finalUsername)->orWhere('email', $email)->first();
        if ($existing) {
            return response()->json([
                'message' => "Tài khoản '{$finalUsername}' hoặc email '{$email}' đã tồn tại trong hệ thống. Nếu muốn đổi mật khẩu, vui lòng dùng nút Đặt lại mật khẩu."
            ], 422);
        }

        DB::beginTransaction();
        try {
            $user = User::create([
                'username' => $finalUsername,
                'email' => $email,
                'name' => $fullName,
                'password' => Hash::make($request->password),
                'must_change_password' => $request->boolean('must_change_password', false),
                'created_by' => $request->user()->id,
                'system_role' => $request->system_role === 'admin' ? 'system_admin' : 'user',
            ]);

            DB::table('user_profiles')->insert([
                'user_id' => $user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($request->workspace_id) {
                DB::table('workspace_members')->insert([
                    'workspace_id' => $request->workspace_id,
                    'user_id' => $user->id,
                    'role' => $request->workspace_role ?? 'member',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                // Auto-join all existing company workspaces as member so the employee can collaborate immediately
                $allWs = DB::table('workspaces')->pluck('id');
                foreach ($allWs as $wsId) {
                    DB::table('workspace_members')->insert([
                        'workspace_id' => $wsId,
                        'user_id' => $user->id,
                        'role' => 'member',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            DB::commit();
            return response()->json([
                'message' => 'Tạo tài khoản thành công',
                'user' => $user
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Có lỗi xảy ra khi tạo tài khoản: ' . $e->getMessage()], 500);
        }
    }

    public function updateStatus(Request $request, User $employee)
    {
        $request->validate([
            'status' => 'required|in:active,locked',
        ]);

        // Don't lock yourself
        if ($employee->id === $request->user()->id) {
            return response()->json(['message' => 'Không thể tự khóa tài khoản của mình'], 400);
        }

        $employee->account_status = $request->status;
        $employee->save();

        if ($request->status === 'locked') {
            $employee->tokens()->delete();
        }

        return response()->json(['message' => 'Đã cập nhật trạng thái', 'user' => $employee]);
    }

    public function resetPassword(Request $request, User $employee)
    {
        $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $employee->password = Hash::make($request->password);
        $employee->must_change_password = $request->boolean('must_change_password', false);
        $employee->save();

        $employee->tokens()->delete();

        return response()->json(['message' => 'Đã đặt lại mật khẩu thành công']);
    }

    public function destroy(Request $request, User $employee)
    {
        if ($employee->id === $request->user()->id) {
            return response()->json(['message' => 'Không thể tự xóa tài khoản của chính mình'], 400);
        }

        // Delete tokens and user
        $employee->tokens()->delete();
        $employee->delete();

        return response()->json(['message' => 'Đã xóa tài khoản nhân viên thành công']);
    }
}
