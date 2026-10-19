<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        return response()->json([
            'message' => 'Đăng ký tài khoản tự do đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên hệ thống (System Admin) để được cấp tài khoản.'
        ], 403);
    }

    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required',
        ]);

        $loginInput = trim($request->login);
        $cleanUsername = str_replace('@danava.vn', '', strtolower($loginInput));
        $fullEmail = str_contains($loginInput, '@') ? $loginInput : $loginInput . '@danava.vn';

        $user = User::where('email', $loginInput)
                    ->orWhere('email', $fullEmail)
                    ->orWhere('username', $loginInput)
                    ->orWhere('username', $cleanUsername)
                    ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Thông tin đăng nhập không chính xác.'],
            ]);
        }

        if ($user->account_status === 'locked') {
            throw ValidationException::withMessages([
                'login' => ['Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.'],
            ]);
        }

        $user->last_login_at = now();
        $user->save();

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Đăng xuất thành công']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->load('department:id,name,code,color'));
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'gender' => 'nullable|string|max:50',
            'position' => 'nullable|string|max:100',
            'avatar' => 'nullable|image|max:5120', // 5MB max
            'dob' => 'nullable|date',
            'address' => 'nullable|string|max:500',
            'join_date' => 'nullable|date',
            'contact_email' => 'nullable|email|max:255'
        ]);

        // Explicitly update only allowed fields - prevent changing system_role, account_status, created_by
        if ($request->has('name')) $user->name = $request->name;
        if ($request->has('phone')) $user->phone = $request->phone;
        if ($request->has('gender')) $user->gender = $request->gender;
        if ($request->has('position')) $user->position = $request->position;
        if ($request->has('dob')) $user->dob = $request->dob;
        if ($request->has('address')) $user->address = $request->address;
        if ($request->has('join_date')) $user->join_date = $request->join_date;
        if ($request->has('contact_email')) $user->contact_email = $request->contact_email;

        if ($request->has('remove_avatar') && $request->remove_avatar == 'true') {
            if ($user->avatar) {
                $oldPath = str_replace('/storage/', '', $user->avatar);
                \Illuminate\Support\Facades\Storage::disk('public')->delete($oldPath);
            }
            $user->avatar = null;
        } elseif ($request->hasFile('avatar')) {
            if ($user->avatar) {
                $oldPath = str_replace('/storage/', '', $user->avatar);
                \Illuminate\Support\Facades\Storage::disk('public')->delete($oldPath);
            }
            $path = $request->file('avatar')->store('avatars', 'public');
            $user->avatar = '/storage/' . $path;
        }

        $user->save();

        return response()->json($user);
    }

    public function initialChangePassword(Request $request)
    {
        $user = $request->user();

        if (!$user->must_change_password) {
            return response()->json([
                'message' => 'Chức năng này chỉ dành cho tài khoản cần đổi mật khẩu lần đầu. Vui lòng sử dụng chức năng đổi mật khẩu thông thường.',
            ], 403);
        }

        $validated = $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user->password = Hash::make($validated['password']);
        $user->must_change_password = false;
        $user->save();

        \Illuminate\Support\Facades\Log::info("Security Event: User #{$user->id} ({$user->username}) changed forced initial password.");

        return response()->json(['message' => 'Đổi mật khẩu thành công']);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Mật khẩu hiện tại không đúng.'],
            ]);
        }

        $user->password = Hash::make($request->new_password);
        $user->must_change_password = false;
        $user->save();

        \Illuminate\Support\Facades\Log::info("Security Event: User #{$user->id} ({$user->username}) changed account password.");

        return response()->json(['message' => 'Đổi mật khẩu thành công']);
    }

    public function updateNotificationPreferences(Request $request)
    {
        $request->validate([
            'preferences' => 'required|array',
        ]);

        $user = $request->user();
        $user->notification_preferences = $request->preferences;
        $user->save();

        return response()->json([
            'message' => 'Đã lưu tùy chọn thông báo',
            'preferences' => $user->notification_preferences
        ]);
    }

    public function logoutOtherDevices(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => 'Đã đăng xuất khỏi các thiết bị khác']);
    }
}
