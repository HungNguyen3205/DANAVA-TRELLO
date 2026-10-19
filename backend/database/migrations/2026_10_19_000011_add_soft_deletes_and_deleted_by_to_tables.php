<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Boards: add soft deletes and deleted_by
        Schema::table('boards', function (Blueprint $table) {
            if (!Schema::hasColumn('boards', 'deleted_at')) {
                $table->softDeletes();
            }
            if (!Schema::hasColumn('boards', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->after('deleted_at')->constrained('users')->nullOnDelete();
            }
        });

        // 2. Kanban Columns: add deleted_by
        Schema::table('kanban_columns', function (Blueprint $table) {
            if (!Schema::hasColumn('kanban_columns', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->after('deleted_at')->constrained('users')->nullOnDelete();
            }
        });

        // 3. Tasks: add deleted_by
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->after('deleted_at')->constrained('users')->nullOnDelete();
            }
        });

        // 4. Task Attachments: add deleted_by
        if (Schema::hasTable('task_attachments')) {
            Schema::table('task_attachments', function (Blueprint $table) {
                if (!Schema::hasColumn('task_attachments', 'deleted_by')) {
                    $table->foreignId('deleted_by')->nullable()->after('deleted_at')->constrained('users')->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('task_attachments') && Schema::hasColumn('task_attachments', 'deleted_by')) {
            Schema::table('task_attachments', function (Blueprint $table) {
                $table->dropForeign(['deleted_by']);
                $table->dropColumn('deleted_by');
            });
        }

        if (Schema::hasColumn('tasks', 'deleted_by')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropForeign(['deleted_by']);
                $table->dropColumn('deleted_by');
            });
        }

        if (Schema::hasColumn('kanban_columns', 'deleted_by')) {
            Schema::table('kanban_columns', function (Blueprint $table) {
                $table->dropForeign(['deleted_by']);
                $table->dropColumn('deleted_by');
            });
        }

        if (Schema::hasColumn('boards', 'deleted_by')) {
            Schema::table('boards', function (Blueprint $table) {
                $table->dropForeign(['deleted_by']);
                $table->dropColumn(['deleted_by', 'deleted_at']);
            });
        }
    }
};
