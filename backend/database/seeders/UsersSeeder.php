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
            ['email' => 'namhung@danava.vn', 'name' => 'Nam Hùng (Admin)', 'role' => 'admin'],
            ['email' => 'dev@danava.vn', 'name' => 'Lập trình viên (Member)', 'role' => 'member'],
            ['email' => 'tester@danava.vn', 'name' => 'Kiểm thử (Member)', 'role' => 'member'],
            ['email' => 'guest@danava.vn', 'name' => 'Khách hàng (Viewer)', 'role' => 'viewer'],
        ];

        foreach ($users as $u) {
            $user = User::firstOrCreate(
                ['email' => $u['email']],
                ['name' => $u['name'], 'password' => Hash::make('123456')]
            );

            if ($workspace) {
                $workspace->members()->syncWithoutDetaching([
                    $user->id => ['role' => $u['role']]
                ]);
            }
        }
    }
}
