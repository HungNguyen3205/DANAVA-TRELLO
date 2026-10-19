<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Tạo bảng departments
        if (!Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table) {
                $table->id();
                $table->string('name', 150);
                $table->string('code', 50)->unique();
                $table->text('description')->nullable();
                $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 20)->default('active')->index();
                $table->string('color', 50)->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // 2. Thêm department_id vào bảng users (an toàn cho dữ liệu cũ, nullable)
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'department_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('department_id')
                    ->nullable()
                    ->after('created_by')
                    ->constrained('departments')
                    ->nullOnDelete();
                $table->index('department_id');
            });
        }

        // 3. Thêm department_id vào bảng activity_logs để ghi nhận lịch sử phòng ban
        if (Schema::hasTable('activity_logs') && !Schema::hasColumn('activity_logs', 'department_id')) {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->foreignId('department_id')
                    ->nullable()
                    ->after('board_id')
                    ->constrained('departments')
                    ->nullOnDelete();
                $table->index('department_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('activity_logs') && Schema::hasColumn('activity_logs', 'department_id')) {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->dropForeign(['department_id']);
                $table->dropIndex(['department_id']);
                $table->dropColumn('department_id');
            });
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'department_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['department_id']);
                $table->dropIndex(['department_id']);
                $table->dropColumn('department_id');
            });
        }

        Schema::dropIfExists('departments');
    }
};
