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
            'username' => 'required|string|unique:users,username|regex:/^[a-zA-Z0-9._@-]+$/',
            'password' => 'required|string|min:6',
            'system_role' => 'nullable|in:admin,user',
            'workspace_id' => 'nullable|exists:workspaces,id',
            'workspace_role' => 'nullable|in:admin,member',
        ]);

        DB::beginTransaction();
        try {
            $baseName = strtolower($request->username);
            // If admin accidentally types the full email, strip it for the username
            $finalUsername = str_replace('@danava.vn', '', $baseName);
            $email = str_contains($baseName, '@') ? $baseName : $finalUsername . '@danava.vn';

            $user = User::create([
                'username' => $finalUsername,
                'email' => $email,
                'name' => $finalUsername, // Temporary name
                'password' => Hash::make($request->password),
                'must_change_password' => true,
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
            }

            DB::commit();
            return response()->json([
                'message' => 'Tạo tài khoản thành công',
                'user' => $user
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Có lỗi xảy ra khi tạo tài khoản'], 500);
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
            'password' => 'required|string|min:8',
        ]);

        $employee->password = Hash::make($request->password);
        $employee->must_change_password = true;
        $employee->save();

        $employee->tokens()->delete();

        return response()->json(['message' => 'Đã đặt lại mật khẩu tạm']);
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
