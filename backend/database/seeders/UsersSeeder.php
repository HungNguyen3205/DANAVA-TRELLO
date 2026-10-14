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

        // 2. Cập nhật hoặc tạo tài khoản Admin Danava - System Admin duy nhất
        $admin = User::updateOrCreate(
            ['email' => 'admin@danava.vn'],
            [
                'username' => 'admin',
                'name' => 'Admin Danava',
                'password' => Hash::make('123456'),
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
                'password' => Hash::make('123456'),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'phone' => '0971120038',
                'gender' => 'Nam',
                'dob' => '2005-02-03',
                'address' => '136 Phuong Sai',
                'join_date' => '2026-09-01',
                'contact_email' => 'namhung03022005@gmail.com',
                'avatar' => '/storage/avatars/6HY7qEsGfi6xjZFGozVRF5Covms1ICodfBiDq9Ra.jpg',
            ]
        );

        // 4. Cập nhật hoặc tạo tài khoản letanthanh - User
        $letanthanh = User::updateOrCreate(
            ['email' => 'letanthanh@danava.vn'],
            [
                'username' => 'letanthanh',
                'name' => 'letanthanh',
                'password' => Hash::make('123456'),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'created_by' => $admin->id,
            ]
        );

        // 5. Cập nhật hoặc tạo tài khoản test - User
        $test = User::updateOrCreate(
            ['email' => 'test@danava.vn'],
            [
                'username' => 'test',
                'name' => 'test',
                'password' => Hash::make('123456'),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
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

            // Dọn các member cũ không mong muốn khỏi workspace này (chỉ giữ đúng namhung và letanthanh như local)
            DB::table('workspace_members')->where('workspace_id', $workspace->id)
                ->whereNotIn('user_id', [$namhung->id, $letanthanh->id])
                ->delete();

            // Gán Nam Hùng là admin của Không gian làm việc
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $workspace->id, 'user_id' => $namhung->id],
                ['role' => 'admin', 'created_at' => now(), 'updated_at' => now()]
            );

            // Gán letanthanh là member của Không gian làm việc
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
