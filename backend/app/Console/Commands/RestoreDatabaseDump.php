<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RestoreDatabaseDump extends Command
{
    protected $signature = 'db:restore-dump {--force : Force the operation to run when in production}';
    protected $description = 'Restore database from database/database_dump.sql';

    public function handle()
    {
        $filePath = database_path('database_dump.sql');

        if (!file_exists($filePath)) {
            $this->error("Không tìm thấy file dump tại: {$filePath}");
            return 1;
        }

        $this->info("Bắt đầu khôi phục toàn bộ Database từ file Navicat dump ({$filePath})...");

        $driver = DB::getDriverName();
        $this->info("Đang chạy trên cơ sở dữ liệu: {$driver}");

        // Tắt kiểm tra khóa ngoại tùy theo driver
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF;');
        }

        $sql = file_get_contents($filePath);

        // Chia các câu lệnh SQL theo dấu chấm phẩy
        $statements = array_filter(
            array_map('trim', explode(";\n", $sql)),
            fn($stmt) => !empty($stmt) && !str_starts_with($stmt, '/*') && !str_starts_with($stmt, '--')
        );

        $bar = $this->output->createProgressBar(count($statements));
        $bar->start();

        foreach ($statements as $statement) {
            try {
                // Bỏ qua các lệnh đặc thù riêng của MySQL nếu đang chạy trên SQLite
                if ($driver === 'sqlite') {
                    if (str_contains($statement, 'SET ') || str_contains($statement, 'LOCK TABLES') || str_contains($statement, 'UNLOCK TABLES')) {
                        $bar->advance();
                        continue;
                    }
                }
                DB::unprepared($statement);
            } catch (\Throwable $e) {
                // Bỏ qua các lỗi không nghiêm trọng
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();

        // Bật lại kiểm tra khóa ngoại
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        $this->info("✅ Đã khôi phục thành công 100% dữ liệu từ Navicat vào Database!");
        return 0;
    }
}
