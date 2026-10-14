<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Hash;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $workspace = Workspace::first();

        $users = [
            ['email' => 'namhung@danava.vn', 'username' => 'namhung', 'name' => 'Nam Hùng', 'role' => 'admin', 'system_role' => 'system_admin'],
            ['email' => 'letanthanh@danava.vn', 'username' => 'letanthanh', 'name' => 'Lê Tấn Thành', 'role' => 'admin', 'system_role' => 'user'],
            ['email' => 'dev@danava.vn', 'username' => 'dev', 'name' => 'Lập trình viên', 'role' => 'member', 'system_role' => 'user'],
            ['email' => 'tester@danava.vn', 'username' => 'tester', 'name' => 'Kiểm thử viên', 'role' => 'member', 'system_role' => 'user'],
        ];

        foreach ($users as $u) {
            $user = User::firstOrCreate(
                ['email' => $u['email']],
                [
                    'username' => $u['username'],
                    'name' => $u['name'],
                    'password' => Hash::make('123456'),
                    'system_role' => $u['system_role'] ?? 'user',
                    'must_change_password' => false,
                ]
            );

            if ($workspace) {
                $workspace->members()->syncWithoutDetaching([
                    $user->id => ['role' => $u['role']]
                ]);
            }
        }
    }
}
