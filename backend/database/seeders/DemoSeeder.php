<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\Label;
use App\Models\Checklist;
use App\Models\ChecklistItem;
use App\Models\TaskComment;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $tz = 'Asia/Ho_Chi_Minh';
        $now = Carbon::now($tz);
        $todayStr = $now->format('Y-m-d');
        $twoDaysAgoStr = $now->copy()->subDays(2)->format('Y-m-d');
        $oneDayAgoStr = $now->copy()->subDay()->format('Y-m-d');
        $threeDaysLaterStr = $now->copy()->addDays(3)->format('Y-m-d');
        $fourDaysLaterStr = $now->copy()->addDays(4)->format('Y-m-d');
        $sixDaysLaterStr = $now->copy()->addDays(6)->format('Y-m-d');

        $adminPassword = env('DEFAULT_ADMIN_PASSWORD', 'Danava@Admin2026!');
        $userPassword = env('DEFAULT_USER_PASSWORD', 'Danava@User2026!');

        // 1. TẠO / CẬP NHẬT TÀI KHOẢN NGƯỜI DÙNG DEMO & TEAM
        // Tài khoản DEMO chính (System Admin toàn quyền)
        $demoUser = User::updateOrCreate(
            ['email' => 'demo@danava.vn'],
            [
                'username' => 'demo',
                'name' => 'Demo Manager (Giám đốc Dự án)',
                'password' => Hash::make($adminPassword),
                'system_role' => 'system_admin',
                'account_status' => 'active',
                'must_change_password' => false,
                'phone' => '0900000001',
                'gender' => 'Nam',
                'position' => 'Giám đốc Dự án',
                'dob' => '1990-01-01',
                'address' => 'Hải Châu, Đà Nẵng',
                'join_date' => '2025-01-01',
                'contact_email' => 'demo@danava.vn',
            ]
        );

        // Admin Danava
        $admin = User::updateOrCreate(
            ['email' => 'admin@danava.vn'],
            [
                'username' => 'admin',
                'name' => 'Admin Danava',
                'password' => Hash::make($adminPassword),
                'system_role' => 'system_admin',
                'account_status' => 'active',
                'must_change_password' => false,
                'position' => 'Quản trị hệ thống',
            ]
        );

        // Nam Hùng
        $namhung = User::updateOrCreate(
            ['email' => 'namhung@danava.vn'],
            [
                'username' => 'namhung',
                'name' => 'Hùng Nguyễn Nam',
                'password' => Hash::make($userPassword),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'phone' => '0900000002',
                'gender' => 'Nam',
                'position' => 'Trưởng nhóm kỹ thuật',
            ]
        );

        // Lê Tấn Thành (Lead Kỹ thuật)
        $thanh = User::updateOrCreate(
            ['email' => 'letanthanh@danava.vn'],
            [
                'username' => 'letanthanh',
                'name' => 'Lê Tấn Thành (Lead Kỹ thuật)',
                'password' => Hash::make($userPassword),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'position' => 'Kỹ sư phần mềm',
                'phone' => '0900000003',
                'address' => 'Sơn Trà, Đà Nẵng',
            ]
        );

        // Trần Hoàng Nam (Marketing Specialist)
        $hoangnam = User::updateOrCreate(
            ['email' => 'hoangnam@danava.vn'],
            [
                'username' => 'hoangnam',
                'name' => 'Trần Hoàng Nam (Marketing Specialist)',
                'password' => Hash::make($userPassword),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'position' => 'Chuyên viên Marketing',
                'phone' => '0900000004',
            ]
        );

        // Nguyễn Mai Chi (UI/UX Designer)
        $maichi = User::updateOrCreate(
            ['email' => 'maichi@danava.vn'],
            [
                'username' => 'maichi',
                'name' => 'Nguyễn Mai Chi (UI/UX Designer)',
                'password' => Hash::make($userPassword),
                'system_role' => 'user',
                'account_status' => 'active',
                'must_change_password' => false,
                'position' => 'Thiết kế UI/UX',
                'phone' => '0900000005',
            ]
        );

        $targetUsers = [$demoUser, $namhung];

        // 2. TẠO KHÔNG GIAN LÀM VIỆC (WORKSPACES)
        $ws1 = Workspace::firstOrCreate(
            ['name' => 'DANAVA Digital & Media'],
            ['owner_id' => $demoUser->id]
        );
        $ws1->update(['owner_id' => $demoUser->id]);

        $ws2 = Workspace::firstOrCreate(
            ['name' => 'Phát triển Sản phẩm & Công nghệ'],
            ['owner_id' => $demoUser->id]
        );
        $ws2->update(['owner_id' => $demoUser->id]);

        // Gán thành viên cho Workspaces
        foreach ([$ws1, $ws2] as $ws) {
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $ws->id, 'user_id' => $demoUser->id],
                ['role' => 'admin', 'updated_at' => now()]
            );
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $ws->id, 'user_id' => $namhung->id],
                ['role' => 'admin', 'updated_at' => now()]
            );
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $ws->id, 'user_id' => $admin->id],
                ['role' => 'admin', 'updated_at' => now()]
            );
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $ws->id, 'user_id' => $thanh->id],
                ['role' => 'admin', 'updated_at' => now()]
            );
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $ws->id, 'user_id' => $hoangnam->id],
                ['role' => 'member', 'updated_at' => now()]
            );
            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $ws->id, 'user_id' => $maichi->id],
                ['role' => 'member', 'updated_at' => now()]
            );
        }

        // 3. TẠO CÁC BẢNG (BOARDS) CHUYÊN NGHIỆP
        // Bảng 1: Marketing Ra Mắt Sản Phẩm Quý 4
        $board1 = Board::updateOrCreate(
            ['workspace_id' => $ws1->id, 'name' => 'Chiến dịch Marketing Ra Mắt Sản Phẩm Quý 4'],
            [
                'public_id' => 'mkt-q4-2026',
                'color' => 'bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700',
                'description' => 'Kế hoạch tổng thể chiến dịch quảng bá sản phẩm mới, phủ sóng trên các kênh mạng xã hội, báo chí và sự kiện ra mắt.'
            ]
        );

        // Bảng 2: Phát triển Hệ thống DANAVA Trello v2.0
        $board2 = Board::updateOrCreate(
            ['workspace_id' => $ws2->id, 'name' => 'Phát triển Hệ thống DANAVA Trello v2.0'],
            [
                'public_id' => 'trello-v2',
                'color' => 'bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-700',
                'description' => 'Sprint phát triển và kiểm thử phiên bản 2.0: Tối ưu Kanban board, chế độ xem lịch trình, thông báo realtime và phân quyền.'
            ]
        );

        // Bảng 3: Kế hoạch Tuyển Dụng & Đào Tạo 2026
        $board3 = Board::updateOrCreate(
            ['workspace_id' => $ws1->id, 'name' => 'Kế hoạch Tuyển Dụng & Đào Tạo 2026'],
            [
                'public_id' => 'hr-talent',
                'color' => 'bg-gradient-to-br from-rose-500 via-pink-600 to-red-600',
                'description' => 'Tuyển dụng các vị trí chủ chốt: Senior Frontend React, UI/UX Designer và thực hiện chương trình đào tạo nội bộ.'
            ]
        );

        $allBoards = [$board1, $board2, $board3];

        // Gán thành viên và đánh dấu yêu thích (Starred) cho boards
        foreach ($allBoards as $b) {
            foreach ([$demoUser, $namhung] as $u) {
                DB::table('board_members')->updateOrInsert(
                    ['board_id' => $b->id, 'user_id' => $u->id],
                    [
                        'role' => 'admin',
                        'is_starred' => in_array($b->id, [$board1->id, $board2->id]),
                        'updated_at' => now()
                    ]
                );
            }
            foreach ([$admin, $thanh, $hoangnam, $maichi] as $other) {
                DB::table('board_members')->updateOrInsert(
                    ['board_id' => $b->id, 'user_id' => $other->id],
                    [
                        'role' => 'member',
                        'is_starred' => false,
                        'updated_at' => now()
                    ]
                );
            }
        }

        // 4. TẠO CỘT KANBAN CHO TỪNG BẢNG
        foreach ($allBoards as $b) {
            // Đảm bảo không trùng lặp cột cũ
            $b->columns()->delete();

            $colTodo = KanbanColumn::create(['board_id' => $b->id, 'title' => 'Chưa bắt đầu', 'color' => 'violet', 'order' => 1000]);
            $colDoing = KanbanColumn::create(['board_id' => $b->id, 'title' => 'Đang thực hiện', 'color' => 'blue', 'order' => 2000]);
            $colReview = KanbanColumn::create(['board_id' => $b->id, 'title' => 'Chờ duyệt', 'color' => 'orange', 'order' => 3000]);
            $colDone = KanbanColumn::create(['board_id' => $b->id, 'title' => 'Hoàn thành', 'color' => 'green', 'order' => 4000]);

            // 5. TẠO NHÃN (LABELS) CHO BẢNG
            $lblUrgent = Label::create(['board_id' => $b->id, 'name' => 'Khẩn cấp', 'color' => '#EF4444']);
            $lblFeature = Label::create(['board_id' => $b->id, 'name' => 'Tính năng mới', 'color' => '#8B5CF6']);
            $lblUI = Label::create(['board_id' => $b->id, 'name' => 'Thiết kế UI/UX', 'color' => '#10B981']);
            $lblMkt = Label::create(['board_id' => $b->id, 'name' => 'Marketing & PR', 'color' => '#F59E0B']);
            $lblSec = Label::create(['board_id' => $b->id, 'name' => 'Bảo mật & Tối ưu', 'color' => '#3B82F6']);

            // 6. TẠO CÁC CÔNG VIỆC MẪU (TASKS) ĐẦY ĐỦ TRẠNG THÁI CHO TỪNG BẢNG
            foreach ([$demoUser, $namhung] as $targetUser) {
                if ($b->id === $board1->id) {
                    // TASK 1: QUÁ HẠN (Overdue) - Khẩn cấp
                    $t1 = Task::create([
                        'column_id' => $colDoing->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Hoàn thiện hồ sơ đề xuất ngân sách Marketing Quý 4',
                        'description' => 'Tổng hợp chi phí các hạng mục quảng cáo Facebook, Google Ads và chi phí sản xuất video teaser để trình ban giám đốc phê duyệt.',
                        'priority' => 'Khẩn cấp',
                        'order' => 1000,
                        'start_date' => $twoDaysAgoStr,
                        'due_date' => $twoDaysAgoStr,
                    ]);
                    $t1->labels()->attach([$lblUrgent->id, $lblMkt->id]);
                    $ck1 = Checklist::create(['task_id' => $t1->id, 'title' => 'Tiến độ hoàn thiện']);
                    ChecklistItem::create(['checklist_id' => $ck1->id, 'content' => 'Dự toán chi phí truyền thông online', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck1->id, 'content' => 'Lấy báo giá từ 3 đối tác agency', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck1->id, 'content' => 'Trình ký phê duyệt của Tổng giám đốc', 'is_completed' => false]);
                    TaskComment::create(['task_id' => $t1->id, 'user_id' => $hoangnam->id, 'content' => 'Em đã cập nhật bảng phụ lục báo giá từ Agency A và Agency B rồi anh Hùng nhé.']);

                    // TASK 2: ĐẾN HẠN HÔM NAY (Due Today) - 09:30
                    $t2 = Task::create([
                        'column_id' => $colTodo->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Họp giao ban đầu ngày & Phân bổ công việc Sprint mới',
                        'description' => 'Họp giao ban với toàn thể các bộ phận để đánh giá tiến độ tuần và triển khai mục tiêu quý 4.',
                        'priority' => 'Cao',
                        'order' => 1000,
                        'start_date' => $todayStr,
                        'due_date' => $todayStr,
                    ]);
                    $t2->labels()->attach([$lblMkt->id]);
                    $ck2 = Checklist::create(['task_id' => $t2->id, 'title' => 'Nội dung cuộc họp']);
                    ChecklistItem::create(['checklist_id' => $ck2->id, 'content' => 'Chuẩn bị bảng số liệu KPI tuần trước', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck2->id, 'content' => 'Lên danh sách các đầu việc ưu tiên hôm nay', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck2->id, 'content' => 'Phân công người phụ trách từng module', 'is_completed' => false]);

                    // TASK 3: ĐẾN HẠN HÔM NAY (Due Today) - Đang thực hiện
                    $t3 = Task::create([
                        'column_id' => $colDoing->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Chốt kịch bản video giới thiệu tính năng Trello v2.0',
                        'description' => 'Kịch bản video 90 giây nêu bật các tính năng Kanban kéo thả, quản lý nhân viên và thông báo tức thời.',
                        'priority' => 'Bình thường',
                        'order' => 2000,
                        'start_date' => $todayStr,
                        'due_date' => $todayStr,
                    ]);
                    $t3->labels()->attach([$lblMkt->id, $lblFeature->id]);

                    // TASK 4: SẮP ĐẾN HẠN (Due Soon)
                    $t4 = Task::create([
                        'column_id' => $colTodo->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Gặp gỡ đại diện đối tác chiến lược tại văn phòng Đà Nẵng',
                        'description' => 'Trao đổi cơ hội hợp tác tích hợp giải pháp thanh toán điện tử vào nền tảng.',
                        'priority' => 'Cao',
                        'order' => 2000,
                        'start_date' => $todayStr,
                        'due_date' => $fourDaysLaterStr,
                    ]);
                    $t4->labels()->attach([$lblMkt->id]);

                    // TASK 5: ĐÃ HOÀN THÀNH (Completed)
                    $t5 = Task::create([
                        'column_id' => $colDone->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Xây dựng khung phân quyền RBAC và quản lý nhân viên',
                        'description' => 'Hoàn tất module quản trị nhân viên, cho phép phân quyền System Admin và User một cách an toàn.',
                        'priority' => 'Cao',
                        'order' => 1000,
                        'start_date' => $twoDaysAgoStr,
                        'due_date' => $todayStr,
                        'completed_at' => $now->copy()->subHours(2),
                        'completed_by' => $targetUser->id,
                    ]);
                    $t5->labels()->attach([$lblFeature->id, $lblSec->id]);
                    $ck5 = Checklist::create(['task_id' => $t5->id, 'title' => 'Hạng mục hoàn tất']);
                    ChecklistItem::create(['checklist_id' => $ck5->id, 'content' => 'Tạo trang quản lý nhân viên /admin/employees', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck5->id, 'content' => 'Kiểm tra phân quyền truy cập', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck5->id, 'content' => 'Bảo mật API đổi mật khẩu', 'is_completed' => true]);
                }

                if ($b->id === $board2->id) {
                    // TASK 6: QUÁ HẠN 2 - Khẩn cấp
                    $t6 = Task::create([
                        'column_id' => $colDoing->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Kiểm tra bảo mật và kiểm thử tải hệ thống thanh toán',
                        'description' => 'Chạy stress-test 5.000 concurrent requests và rà soát các lỗ hổng bảo mật SQL injection, XSS trên cổng thanh toán.',
                        'priority' => 'Khẩn cấp',
                        'order' => 1000,
                        'start_date' => $twoDaysAgoStr,
                        'due_date' => $oneDayAgoStr,
                    ]);
                    $t6->labels()->attach([$lblUrgent->id, $lblSec->id]);
                    TaskComment::create(['task_id' => $t6->id, 'user_id' => $thanh->id, 'content' => 'Báo cáo anh, hệ thống chịu tải tốt 5.000 user truy cập cùng lúc, không phát sinh lỗi tràn bộ nhớ.']);

                    // TASK 7: ĐẾN HẠN HÔM NAY - Khẩn cấp
                    $t7 = Task::create([
                        'column_id' => $colDoing->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Duyệt bản thiết kế UI Dashboard cá nhân và Bộ icon mới',
                        'description' => 'Kiểm tra độ tương thích chế độ Dark Mode / Light Mode và tính thẩm mỹ chuẩn nhận diện thương hiệu DANAVA.',
                        'priority' => 'Khẩn cấp',
                        'order' => 2000,
                        'start_date' => $oneDayAgoStr,
                        'due_date' => $todayStr,
                    ]);
                    $t7->labels()->attach([$lblUI->id, $lblFeature->id]);
                    $ck7 = Checklist::create(['task_id' => $t7->id, 'title' => 'Hạng mục kiểm tra']);
                    ChecklistItem::create(['checklist_id' => $ck7->id, 'content' => 'Review layout màn hình máy tính (Desktop 1440px)', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck7->id, 'content' => 'Review giao diện điện thoại (Mobile Responsive)', 'is_completed' => true]);
                    ChecklistItem::create(['checklist_id' => $ck7->id, 'content' => 'Phê duyệt xuất bản bộ Design System cho lập trình viên', 'is_completed' => false]);
                    TaskComment::create(['task_id' => $t7->id, 'user_id' => $maichi->id, 'content' => 'Em đã cập nhật bản thiết kế theo đúng tone màu tím DANAVA, anh xem qua giúp em nhé!']);
                    TaskComment::create(['task_id' => $t7->id, 'user_id' => $targetUser->id, 'content' => 'Giao diện rất đẹp và hiện đại, anh duyệt triển khai ngay hôm nay.']);

                    // TASK 8: ĐANG XỬ LÝ - ĐẾN HẠN HÔM NAY
                    $t8 = Task::create([
                        'column_id' => $colReview->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Kiểm tra tính năng Đồng bộ thông báo Real-time',
                        'description' => 'Kiểm thử chuông thông báo khi có task mới, task quá hạn và task đến hạn hoàn thành trong ngày.',
                        'priority' => 'Cao',
                        'order' => 1000,
                        'start_date' => $todayStr,
                        'due_date' => $todayStr,
                    ]);
                    $t8->labels()->attach([$lblFeature->id, $lblSec->id]);

                    // TASK 9: SẮP ĐẾN HẠN (Due Soon)
                    $t9 = Task::create([
                        'column_id' => $colTodo->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Triển khai Progressive Web App (PWA) cho thiết bị di động',
                        'description' => 'Hỗ trợ người dùng cài đặt ứng dụng DANAVA Trello về điện thoại và nhận thông báo đẩy.',
                        'priority' => 'Bình thường',
                        'order' => 1000,
                        'start_date' => $todayStr,
                        'due_date' => $threeDaysLaterStr,
                    ]);
                    $t9->labels()->attach([$lblFeature->id]);

                    // TASK 10: ĐANG THỰC HIỆN (In Progress)
                    $t10 = Task::create([
                        'column_id' => $colDoing->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Tối ưu hóa tốc độ tải trang Kanban và phản hồi Drag & Drop',
                        'description' => 'Tối ưu render component Kanban, caching trạng thái và batch update để kéo thả đạt tốc độ 60fps mượt mà.',
                        'priority' => 'Cao',
                        'order' => 3000,
                        'start_date' => $oneDayAgoStr,
                        'due_date' => $sixDaysLaterStr,
                    ]);
                    $t10->labels()->attach([$lblSec->id]);

                    // TASK 11: ĐÃ HOÀN THÀNH
                    $t11 = Task::create([
                        'column_id' => $colDone->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Cập nhật giao diện Dropdown & Bộ lọc theo phong cách tím DANAVA',
                        'description' => 'Tùy biến toàn bộ các dropdown select, popover bộ lọc với màu tím #7C5CFC và hiệu ứng bo góc mượt mà.',
                        'priority' => 'Bình thường',
                        'order' => 1000,
                        'start_date' => $twoDaysAgoStr,
                        'due_date' => $todayStr,
                        'completed_at' => $now->copy()->subHours(4),
                        'completed_by' => $targetUser->id,
                    ]);
                    $t11->labels()->attach([$lblUI->id]);
                }

                if ($b->id === $board3->id) {
                    Task::create([
                        'column_id' => $colDoing->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Sàng lọc hồ sơ ứng viên vị trí Senior React Native',
                        'description' => 'Đánh giá kinh nghiệm thực chiến với Redux/Zustand, TailwindCSS và hiệu năng mobile.',
                        'priority' => 'Cao',
                        'order' => 1000,
                        'start_date' => $todayStr,
                        'due_date' => $threeDaysLaterStr,
                    ]);
                    Task::create([
                        'column_id' => $colTodo->id,
                        'assignee_id' => $targetUser->id,
                        'title' => 'Lên giáo án đào tạo quy trình Scrum & Agile cho nhân viên mới',
                        'priority' => 'Bình thường',
                        'order' => 1000,
                        'start_date' => $todayStr,
                        'due_date' => $sixDaysLaterStr,
                    ]);
                }
            }
        }

        // 7. TẠO ACTIVITY LOGS CHO USER DEMO & NAMHUNG
        DB::table('activity_logs')->whereIn('user_id', [$demoUser->id, $namhung->id])->delete();
        foreach ([$demoUser, $namhung] as $targetUser) {
            $tasksForLogs = Task::where('assignee_id', $targetUser->id)->limit(5)->get();
            if ($tasksForLogs->count() > 0) {
                ActivityLog::create([
                    'task_id' => $tasksForLogs[0]->id,
                    'user_id' => $targetUser->id,
                    'action' => 'đã hoàn thành danh mục kiểm thử công việc',
                    'created_at' => $now->copy()->subMinutes(15),
                ]);
                ActivityLog::create([
                    'task_id' => $tasksForLogs[1]->id,
                    'user_id' => $targetUser->id,
                    'action' => 'đã chuyển trạng thái sang Đang thực hiện',
                    'created_at' => $now->copy()->subMinutes(45),
                ]);
                ActivityLog::create([
                    'task_id' => $tasksForLogs[2]->id,
                    'user_id' => $targetUser->id,
                    'action' => 'đã cập nhật hạn chót hoàn thành hôm nay',
                    'created_at' => $now->copy()->subHours(2),
                ]);
                ActivityLog::create([
                    'task_id' => $tasksForLogs[3]->id,
                    'user_id' => $targetUser->id,
                    'action' => 'đã tạo công việc mới trong Sprint Quý 4',
                    'created_at' => $now->copy()->subHours(4),
                ]);
            }
        }

        // 8. TẠO THÔNG BÁO (NOTIFICATIONS) PHONG PHÚ CHO DEMO USER
        foreach ([$demoUser, $namhung] as $u) {
            DB::table('notifications')->where('notifiable_id', $u->id)->delete();

            // Thông báo 1: Đến hạn hôm nay (Chưa đọc)
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => 'App\Notifications\TaskDueTodayNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $u->id,
                'data' => json_encode([
                    'type' => 'due_today',
                    'board_id' => $board1->id,
                    'board_name' => $board1->name,
                    'board_title' => $board1->name,
                    'message' => 'Nhiệm vụ đến hạn hôm nay: Họp giao ban đầu ngày & Phân bổ công việc Sprint mới',
                    'due_date' => $todayStr,
                ]),
                'read_at' => null,
                'created_at' => $now->copy()->subHours(1),
                'updated_at' => $now->copy()->subHours(1),
            ]);

            // Thông báo 2: Quá hạn (Chưa đọc)
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => 'App\Notifications\TaskOverdueNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $u->id,
                'data' => json_encode([
                    'type' => 'overdue',
                    'board_id' => $board1->id,
                    'board_name' => $board1->name,
                    'board_title' => $board1->name,
                    'message' => 'Cảnh báo quá hạn: Hoàn thiện hồ sơ đề xuất ngân sách Marketing Quý 4 đã quá hạn',
                    'due_date' => $twoDaysAgoStr,
                ]),
                'read_at' => null,
                'created_at' => $now->copy()->subHours(2),
                'updated_at' => $now->copy()->subHours(2),
            ]);

            // Thông báo 3: Được giao việc (Chưa đọc)
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => 'App\Notifications\TaskAssignedNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $u->id,
                'data' => json_encode([
                    'type' => 'assigned',
                    'board_id' => $board2->id,
                    'board_name' => $board2->name,
                    'board_title' => $board2->name,
                    'actor_name' => 'Lê Tấn Thành',
                    'message' => 'Lê Tấn Thành đã giao cho bạn công việc: Kiểm tra tính năng Đồng bộ thông báo Real-time',
                ]),
                'read_at' => null,
                'created_at' => $now->copy()->subHours(3),
                'updated_at' => $now->copy()->subHours(3),
            ]);

            // Thông báo 4: Đến hạn hôm nay (Chưa đọc)
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => 'App\Notifications\TaskDueTodayNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $u->id,
                'data' => json_encode([
                    'type' => 'due_today',
                    'board_id' => $board2->id,
                    'board_name' => $board2->name,
                    'board_title' => $board2->name,
                    'message' => 'Nhiệm vụ đến hạn hôm nay: Duyệt bản thiết kế UI Dashboard cá nhân và Bộ icon mới',
                    'due_date' => $todayStr,
                ]),
                'read_at' => null,
                'created_at' => $now->copy()->subHours(4),
                'updated_at' => $now->copy()->subHours(4),
            ]);

            // Thông báo 5: Mời vào Không gian làm việc (Chưa đọc)
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => 'App\Notifications\BoardInvitedNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $u->id,
                'data' => json_encode([
                    'type' => 'board_invited',
                    'board_id' => $board1->id,
                    'board_name' => $board1->name,
                    'board_title' => $board1->name,
                    'inviter_name' => 'Admin Danava',
                    'message' => 'Bạn đã được thêm vào Không gian làm việc DANAVA Digital & Media với quyền Quản trị viên',
                ]),
                'read_at' => null,
                'created_at' => $now->copy()->subHours(5),
                'updated_at' => $now->copy()->subHours(5),
            ]);

            // Thông báo 6: Sắp đến hạn (Đã đọc)
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => 'App\Notifications\TaskApproachingDueNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $u->id,
                'data' => json_encode([
                    'type' => 'approaching_due',
                    'board_id' => $board2->id,
                    'board_name' => $board2->name,
                    'board_title' => $board2->name,
                    'message' => 'Nhiệm vụ sắp đến hạn: Triển khai Progressive Web App (PWA) cho thiết bị di động',
                    'due_date' => $threeDaysLaterStr,
                ]),
                'read_at' => $now->copy()->subHours(6),
                'created_at' => $now->copy()->subDay(),
                'updated_at' => $now->copy()->subHours(6),
            ]);

            // Thông báo 7: Được giao việc (Đã đọc)
            DB::table('notifications')->insert([
                'id' => Str::uuid()->toString(),
                'type' => 'App\Notifications\TaskAssignedNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $u->id,
                'data' => json_encode([
                    'type' => 'assigned',
                    'board_id' => $board1->id,
                    'board_name' => $board1->name,
                    'board_title' => $board1->name,
                    'actor_name' => 'Admin Danava',
                    'message' => 'Admin Danava đã giao cho bạn công việc: Xây dựng khung phân quyền RBAC và quản lý nhân viên',
                ]),
                'read_at' => $now->copy()->subHours(8),
                'created_at' => $now->copy()->subDays(2),
                'updated_at' => $now->copy()->subHours(8),
            ]);
        }

        // 9. XÓA CACHE DASHBOARD
        \Illuminate\Support\Facades\Cache::flush();

        echo "Demo data seeded successfully for demo@danava.vn and namhung@danava.vn!" . PHP_EOL;
    }
}
