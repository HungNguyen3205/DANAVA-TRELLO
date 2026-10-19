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
        // 1. Cập nhật bảng kanban_columns
        Schema::table('kanban_columns', function (Blueprint $table) {
            if (!Schema::hasColumn('kanban_columns', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('order');
            }
            if (!Schema::hasColumn('kanban_columns', 'archived_by')) {
                $table->foreignId('archived_by')->nullable()->after('archived_at')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('kanban_columns', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        // 2. Cập nhật bảng tasks
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('completed_by');
            }
            if (!Schema::hasColumn('tasks', 'archived_by')) {
                $table->foreignId('archived_by')->nullable()->after('archived_at')->constrained('users')->nullOnDelete();
            }
        });

        // 3. Cho phép task_id nullable trong activity_logs để log hoạt động cấp cột/bảng
        if (Schema::hasTable('activity_logs')) {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->foreignId('task_id')->nullable()->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kanban_columns', function (Blueprint $table) {
            if (Schema::hasColumn('kanban_columns', 'archived_by')) {
                $table->dropForeign(['archived_by']);
                $table->dropColumn('archived_by');
            }
            if (Schema::hasColumn('kanban_columns', 'archived_at')) {
                $table->dropColumn('archived_at');
            }
            if (Schema::hasColumn('kanban_columns', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });

        Schema::table('tasks', function (Blueprint $table) {
            if (Schema::hasColumn('tasks', 'archived_by')) {
                $table->dropForeign(['archived_by']);
                $table->dropColumn('archived_by');
            }
            if (Schema::hasColumn('tasks', 'archived_at')) {
                $table->dropColumn('archived_at');
            }
        });
    }
};
