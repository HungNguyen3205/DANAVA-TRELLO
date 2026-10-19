<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with(['department:id,name,code,color'])->withCount(['workspaces', 'boards']);

        if ($request->search) {
            $search = '%' . $request->search . '%';
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('username', 'like', $search)
                  ->orWhere('email', 'like', $search)
                  ->orWhere('position', 'like', $search)
                  ->orWhere('department_title', 'like', $search);
            });
        }

        if ($request->status) {
            $query->where('account_status', $request->status);
        }

        if ($request->filled('department_id')) {
            if ($request->department_id === 'unassigned' || $request->department_id === 'null') {
                $query->whereNull('department_id');
            } else {
                $query->where('department_id', $request->department_id);
            }
        }

        return response()->json($query->orderBy('id', 'desc')->paginate(15));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'username' => 'required|string|min:3|max:50|unique:users,username',
            'password' => 'required|string|min:8',
            'email' => 'nullable|string|email|max:255|unique:users,email',
            'position' => 'nullable|string|max:100',
            'system_role' => 'nullable|in:system_admin,admin,user',
            'department_id' => 'nullable|exists:departments,id',
        ]);

        $cleanUsername = strtolower(trim($request->username));
        $cleanUsername = str_replace('@danava.vn', '', $cleanUsername);
        $finalUsername = preg_replace('/[^a-z0-9._-]/', '', $cleanUsername);
        if (empty($finalUsername)) {
            return response()->json(['message' => 'Tên đăng nhập không hợp lệ.'], 422);
        }

        // Check if cleaned username already exists
        if (User::where('username', $finalUsername)->exists()) {
            return response()->json([
                'message' => "Tài khoản '{$finalUsername}' đã tồn tại trong hệ thống."
            ], 422);
        }

        $email = $request->filled('email') ? trim($request->email) : null;
        if ($email && User::where('email', $email)->exists()) {
            return response()->json([
                'message' => "Email '{$email}' đã tồn tại trong hệ thống."
            ], 422);
        }

        $department = null;
        if ($request->filled('department_id')) {
            $department = \App\Models\Department::find($request->department_id);
            if ($department && $department->status !== 'active') {
                return response()->json(['message' => 'Không thể gán nhân viên vào phòng ban đang ngừng hoạt động.'], 422);
            }
        }

        $fullName = trim($request->name);
        $role = ($request->system_role === 'system_admin' || $request->system_role === 'admin') ? 'system_admin' : 'user';

        DB::beginTransaction();
        try {
            $departmentTitle = null;
            if ($department) {
                $membershipService = app(\App\Services\DepartmentMembershipService::class);
                $departmentTitle = $membershipService->getEmployeeTitle($department->name);
            }

            $user = User::create([
                'username' => $finalUsername,
                'email' => $email,
                'name' => $fullName,
                'position' => $request->position,
                'password' => Hash::make($request->password),
                'must_change_password' => true,
                'account_status' => 'active',
                'created_by' => $request->user()->id,
                'system_role' => $role,
                'department_id' => $department?->id,
                'department_title' => $departmentTitle,
            ]);

            DB::table('user_profiles')->insert([
                'user_id' => $user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($department) {
                $user->notify(new \App\Notifications\DepartmentTransferNotification(null, $department->name, $request->user()));
            }

            DB::commit();
            return response()->json([
                'message' => 'Tạo tài khoản thành công',
                'user' => $user->load('department:id,name,code,color')
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Có lỗi xảy ra khi tạo tài khoản: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, User $employee)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'username' => ['required', 'string', 'min:3', 'max:50', Rule::unique('users')->ignore($employee->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users')->ignore($employee->id)],
            'position' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:20',
            'gender' => 'nullable|string|max:50',
            'dob' => 'nullable|date',
            'address' => 'nullable|string|max:500',
            'join_date' => 'nullable|date',
            'system_role' => 'nullable|in:system_admin,admin,user',
            'account_status' => 'nullable|in:active,locked',
            'department_id' => 'nullable|exists:departments,id',
        ]);

        $cleanUsername = strtolower(trim($request->username));
        $cleanUsername = str_replace('@danava.vn', '', $cleanUsername);
        $finalUsername = preg_replace('/[^a-z0-9._-]/', '', $cleanUsername);
        if (empty($finalUsername)) {
            return response()->json(['message' => 'Tên đăng nhập không hợp lệ.'], 422);
        }

        // Prevent self-lock or self-demote
        if ($employee->id === $request->user()->id) {
            if ($request->has('account_status') && $request->account_status === 'locked') {
                return response()->json(['message' => 'Không thể tự khóa tài khoản của chính mình'], 400);
            }
            if ($request->has('system_role') && $request->system_role === 'user') {
                return response()->json(['message' => 'Không thể tự hạ quyền Quản trị viên của chính mình'], 400);
            }
        }

        $employee->name = trim($request->name);
        $employee->username = $finalUsername;
        $employee->email = $request->filled('email') ? trim($request->email) : null;
        if ($request->has('position')) $employee->position = $request->position;
        if ($request->has('phone')) $employee->phone = $request->phone;
        if ($request->has('gender')) $employee->gender = $request->gender;
        if ($request->has('dob')) $employee->dob = $request->dob;
        if ($request->has('address')) $employee->address = $request->address;
        if ($request->has('join_date')) $employee->join_date = $request->join_date;

        if ($request->has('system_role')) {
            $employee->system_role = ($request->system_role === 'system_admin' || $request->system_role === 'admin') ? 'system_admin' : 'user';
        }

        if ($request->has('account_status')) {
            $employee->account_status = $request->account_status;
            if ($employee->account_status === 'locked') {
                $employee->tokens()->delete();
            }
        }

        if ($request->has('department_id')) {
            $newDeptId = $request->department_id;
            if ((int)$employee->department_id !== (int)$newDeptId) {
                $targetDept = $newDeptId ? \App\Models\Department::find($newDeptId) : null;
                $membershipService = app(\App\Services\DepartmentMembershipService::class);
                $membershipService->transferEmployee($employee, $targetDept, null, $request->user());
            }
        }

        $employee->save();

        return response()->json([
            'message' => 'Cập nhật thông tin nhân viên thành công',
            'user' => $employee->load('department:id,name,code,color')
        ]);
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
        $employee->must_change_password = $request->boolean('must_change_password', true);
        $employee->save();

        $employee->tokens()->delete();

        return response()->json(['message' => 'Đã đặt lại mật khẩu thành công']);
    }

    public function destroy(Request $request, User $employee)
    {
        if ($employee->id === $request->user()->id) {
            return response()->json(['message' => 'Không thể tự xóa tài khoản của chính mình'], 400);
        }

        // Revoke tokens and soft delete user
        $employee->tokens()->delete();
        $employee->delete();

        return response()->json(['message' => 'Đã xóa mềm tài khoản nhân viên thành công']);
    }
}
