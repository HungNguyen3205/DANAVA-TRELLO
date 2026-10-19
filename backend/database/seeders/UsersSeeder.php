<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Dọn sạch các tài khoản demo cũ thừa (dev, tester) nếu có
        User::whereIn('email', ['dev@danava.vn', 'tester@danava.vn'])->delete();

        $adminPassword = env('DEFAULT_ADMIN_PASSWORD', 'Danava@Admin2026!');
        $userPassword = env('DEFAULT_USER_PASSWORD', 'Danava@User2026!');

        // 2. Cập nhật hoặc tạo tài khoản Admin Danava - System Admin duy nhất
        $admin = User::updateOrCreate(
            ['email' => 'admin@danava.vn'],
            [
                'username' => 'admin',
                'name' => 'Admin Danava',
                'password' => Hash::make($adminPassword),
                'system_role' => 'system_admin',
                'account_status' => 'active',
                'must_change_password' => false,
            ]
        );

        // 3. Cập nhật hoặc tạo tài khoản Hùng Nguyễn Nam - User
        $namhung = User::updateOrCreate(
            ['email' => 'namhung@danava.vn'],
            [
                'username' => 'namhung',
                'name' => 'Hùng Nguyễn Nam',
                'password' => Hash::make($userPassword),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'phone' => '0901234567',
                'gender' => 'Nam',
                'position' => 'Trưởng nhóm kỹ thuật',
                'dob' => '1995-01-01',
                'address' => 'Hải Châu, Đà Nẵng',
                'join_date' => '2026-01-01',
                'contact_email' => 'namhung@danava.vn',
            ]
        );

        // 4. Cập nhật hoặc tạo tài khoản letanthanh - User
        $letanthanh = User::updateOrCreate(
            ['email' => 'letanthanh@danava.vn'],
            [
                'username' => 'letanthanh',
                'name' => 'Lê Tấn Thành',
                'password' => Hash::make($userPassword),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'position' => 'Chuyên viên vận hành',
                'created_by' => $admin->id,
            ]
        );

        // 5. Cập nhật hoặc tạo tài khoản test - User
        $test = User::updateOrCreate(
            ['email' => 'test@danava.vn'],
            [
                'username' => 'test',
                'name' => 'Nhân viên Test',
                'password' => Hash::make($userPassword),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'position' => 'Kiểm thử viên',
                'created_by' => $admin->id,
            ]
        );

        // 6. Cập nhật và gán workspace chính xác như local
        $workspace = Workspace::first();
        if ($workspace) {
            // Đảm bảo tên Không gian làm việc chuẩn
            $workspace->update([
                'name' => 'Không gian làm việc DANAVA',
                'owner_id' => $namhung->id
            ]);

            // Đảm bảo các thành viên chính xác: Admin, Nam Hùng, letanthanh
            // 1. Admin Danava (Admin workspace)
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $workspace->id, 'user_id' => $admin->id],
                ['role' => 'admin', 'created_at' => now(), 'updated_at' => now()]
            );

            // 2. Gán Nam Hùng là admin của Không gian làm việc
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $workspace->id, 'user_id' => $namhung->id],
                ['role' => 'admin', 'created_at' => now(), 'updated_at' => now()]
            );

            // 3. Gán letanthanh là member của Không gian làm việc
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $workspace->id, 'user_id' => $letanthanh->id],
                ['role' => 'member', 'created_at' => now(), 'updated_at' => now()]
            );

            // 7. Gán thành viên bảng (Board Members) giống hệt dữ liệu local
            $boards = \App\Models\Board::where('workspace_id', $workspace->id)->get();
            foreach ($boards as $board) {
                // Nam Hùng là admin bảng
                DB::table('board_members')->updateOrInsert(
                    ['board_id' => $board->id, 'user_id' => $namhung->id],
                    ['role' => 'admin', 'is_starred' => true, 'created_at' => now(), 'updated_at' => now()]
                );

                // Nếu là bảng "Kế hoạch DANAVA" (hoặc bảng đầu tiên), letanthanh là member
                if ($board->id == 1 || str_contains($board->name, 'DANAVA')) {
                    DB::table('board_members')->updateOrInsert(
                        ['board_id' => $board->id, 'user_id' => $letanthanh->id],
                        ['role' => 'member', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()]
                    );
                }
            }
        }
    }
}
