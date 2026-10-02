<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@danava.vn'],
            ['name' => 'Admin Danava', 'password' => Hash::make('123456')]
        );

        $workspace = Workspace::firstOrCreate(
            ['name' => 'Không gian làm việc của Nam Hùng'],
            ['owner_id' => $user->id]
        );

        // Add user to workspace
        $workspace->members()->syncWithoutDetaching([
            $user->id => ['role' => 'admin']
        ]);

        $board = Board::firstOrCreate(
            ['workspace_id' => $workspace->id, 'name' => 'Kế hoạch DANAVA'],
            ['color' => 'bg-gradient-to-br from-blue-500 to-cyan-400']
        );

        // Delete existing columns if any to avoid duplicates
        $board->columns()->delete();

        $col1 = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chưa bắt đầu', 'order' => 1000]);
        $col2 = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Đang thực hiện', 'order' => 2000]);
        $col3 = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Chờ duyệt', 'order' => 3000]);
        $col4 = KanbanColumn::create(['board_id' => $board->id, 'title' => 'Hoàn thành', 'order' => 4000]);

        Task::create(['column_id' => $col1->id, 'title' => 'Tổng hợp 100 địa điểm tại Đà Nẵng', 'priority' => 'Cao', 'order' => 1000, 'assignee_id' => $user->id]);
        Task::create(['column_id' => $col1->id, 'title' => 'Chuẩn bị nội dung DANAVA Studio', 'priority' => 'Bình thường', 'order' => 2000]);
        Task::create(['column_id' => $col2->id, 'title' => 'Thiết kế lại website danava.vn', 'priority' => 'Cao', 'order' => 1000]);
        Task::create(['column_id' => $col2->id, 'title' => 'Kiểm thử thanh toán online', 'priority' => 'Khẩn cấp', 'order' => 2000]);
        Task::create(['column_id' => $col3->id, 'title' => 'Hoàn thiện báo cáo công nợ', 'priority' => 'Bình thường', 'order' => 1000]);
        Task::create(['column_id' => $col4->id, 'title' => 'Thống nhất kế hoạch triển khai', 'priority' => 'Thấp', 'order' => 1000]);
    }
}
