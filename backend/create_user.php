<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

$user = User::where('email', 'namhung@danava.vn')->orWhere('username', 'namhung')->first();

if (!$user) {
    $user = new User();
    $user->name = 'Nam Hùng';
    $user->email = 'namhung@danava.vn';
    $user->username = 'namhung';
    $user->password = Hash::make('123456');
    $user->system_role = 'user';
    $user->account_status = 'active';
    $user->must_change_password = false;
    $user->save();

    DB::table('user_profiles')->insert([
        'user_id' => $user->id,
        'created_at' => now(),
        'updated_at' => now()
    ]);
    
    echo "Đã tạo tài khoản thành công!\n";
} else {
    $user->password = Hash::make('123456');
    $user->system_role = 'user';
    $user->must_change_password = false;
    $user->save();
    
    echo "Tài khoản đã tồn tại. Đã đặt lại mật khẩu thành 123456 và role thành user.\n";
}
