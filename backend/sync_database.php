<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Artisan;

echo "========================================================\n";
echo "🔄 BẮT ĐẦU ĐỒNG BỘ CƠ SỞ DỮ LIỆU DANAVA WORK\n";
echo "========================================================\n\n";

try {
    DB::connection()->getPdo();
    $dbName = DB::connection()->getDatabaseName();
    echo "✅ [1/4] Kết nối MySQL thành công tới database: $dbName\n\n";
} catch (\Exception $e) {
    echo "❌ Lỗi kết nối MySQL: " . $e->getMessage() . "\n";
    exit(1);
}

// Kiểm tra xem đã có bảng users chưa
$hasUsersTable = Schema::hasTable('users');
$usersCount = $hasUsersTable ? DB::table('users')->count() : 0;

$backupFile = __DIR__ . '/database/database_backup.sql';
$shouldImportSql = (!$hasUsersTable || $usersCount === 0 || in_array('--force-import', $argv));

if ($shouldImportSql && file_exists($backupFile)) {
    echo "📥 [2/4] Đang import dữ liệu từ database_backup.sql (tắt FOREIGN_KEY_CHECKS)...\n";
    try {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        
        $sql = file_get_contents($backupFile);
        // Chạy toàn bộ file SQL nguyên vẹn
        DB::unprepared($sql);
        
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        echo "✅ Import database_backup.sql thành công!\n\n";
    } catch (\Exception $e) {
        echo "⚠️ Cảnh báo import SQL: " . $e->getMessage() . "\n";
        echo "Đang thử chạy migration bù...\n";
    }
} else {
    echo "ℹ️ [2/4] Database đã có sẵn $usersCount người dùng. Tiếp tục chạy migration schema...\n\n";
}

// Chạy migrations để đảm bảo schema mới nhất
echo "⚙️ [3/4] Kiểm tra và cập nhật cấu trúc bảng (migrate)...\n";
try {
    Artisan::call('migrate', ['--force' => true]);
    echo Artisan::output();
} catch (\Exception $e) {
    echo "⚠️ Migrate message: " . $e->getMessage() . "\n";
}

// Tự động kiểm tra và bảo đảm bảng board_members có dữ liệu
try {
    $boardsCount = Schema::hasTable('boards') ? DB::table('boards')->count() : 0;
    $boardMembersCount = Schema::hasTable('board_members') ? DB::table('board_members')->count() : 0;
    $tasksCount = Schema::hasTable('tasks') ? DB::table('tasks')->count() : 0;
    $finalUsersCount = Schema::hasTable('users') ? DB::table('users')->count() : 0;

    echo "\n📊 [4/4] KIỂM TRA DỮ LIỆU ĐỒNG BỘ:\n";
    echo " - Số người dùng (Users): $finalUsersCount\n";
    echo " - Số bảng công việc (Boards): $boardsCount\n";
    echo " - Số lượt phân quyền bảng (Board Members): $boardMembersCount\n";
    echo " - Số thẻ công việc (Tasks): $tasksCount\n";

    // Tự động dọn dẹp quan hệ phân quyền:
    // 1. Thành viên không phải owner không được nằm trong Không gian cá nhân của người khác ("Không gian của ...")
    if (Schema::hasTable('workspaces') && Schema::hasTable('workspace_members')) {
        $personalWorkspaces = DB::table('workspaces')->where('name', 'like', 'Không gian của %')->get();
        foreach ($personalWorkspaces as $pWs) {
            $deleted = DB::table('workspace_members')
                ->where('workspace_id', $pWs->id)
                ->where('user_id', '!=', $pWs->owner_id)
                ->delete();
            if ($deleted > 0) {
                echo " 🧹 Đã gỡ $deleted thành viên khỏi không gian cá nhân của người khác (ID: {$pWs->id})\n";
            }
        }

        // 2. Tự động cấp quyền thành viên bảng công việc cho tất cả nhân viên trong Không gian chung công ty
        if (Schema::hasTable('boards') && Schema::hasTable('board_members')) {
            $companyWorkspaces = DB::table('workspaces')->where('name', 'not like', 'Không gian của %')->get();
            foreach ($companyWorkspaces as $cWs) {
                $wsBoards = DB::table('boards')->where('workspace_id', $cWs->id)->get();
                $wsUsers = DB::table('workspace_members')->where('workspace_id', $cWs->id)->pluck('user_id');
                foreach ($wsUsers as $uId) {
                    foreach ($wsBoards as $b) {
                        DB::table('board_members')->updateOrInsert(
                            ['board_id' => $b->id, 'user_id' => $uId],
                            ['role' => 'member', 'is_starred' => false, 'updated_at' => now()]
                        );
                    }
                }
            }
        }
    }

    // Làm sạch cache Laravel
    Artisan::call('optimize:clear');
    echo "\n🧹 Đã làm sạch toàn bộ cache Laravel!\n";

    echo "\n========================================================\n";
    echo "🎉 ĐỒNG BỘ DATABASE VÀ CODE THÀNH CÔNG 100%!\n";
    echo "========================================================\n";
} catch (\Exception $e) {
    echo "❌ Lỗi kiểm tra dữ liệu: " . $e->getMessage() . "\n";
}
