<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('parent_task_id')
                ->nullable()
                ->after('id')
                ->constrained('tasks')
                ->onDelete('cascade');

            $table->integer('sort_order')->default(0)->after('order');
            $table->foreignId('created_by')->nullable()->after('assignee_id')->constrained('users')->nullOnDelete();

            $table->index('parent_task_id');
            $table->index('sort_order');
            $table->index('completed_at');
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['parent_task_id']);
            $table->dropForeign(['created_by']);
            $table->dropIndex(['parent_task_id']);
            $table->dropIndex(['sort_order']);
            $table->dropIndex(['completed_at']);
            $table->dropIndex(['due_date']);
            $table->dropColumn(['parent_task_id', 'sort_order', 'created_by']);
        });
    }
};
