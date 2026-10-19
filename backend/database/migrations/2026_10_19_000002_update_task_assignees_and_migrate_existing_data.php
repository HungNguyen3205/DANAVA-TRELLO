<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_assignees', function (Blueprint $table) {
            $table->foreignId('assigned_by')
                ->nullable()
                ->after('user_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->index('task_id');
            $table->index('user_id');
        });

        // Migrate existing assignees from tasks table without duplicate entries
        $assignedTasks = DB::table('tasks')
            ->whereNotNull('assignee_id')
            ->select('id', 'assignee_id', 'created_at', 'updated_at')
            ->get();

        foreach ($assignedTasks as $t) {
            // Check if user still exists to preserve referential integrity
            $userExists = DB::table('users')->where('id', $t->assignee_id)->exists();
            if ($userExists) {
                DB::table('task_assignees')->insertOrIgnore([
                    'task_id' => $t->id,
                    'user_id' => $t->assignee_id,
                    'assigned_by' => null,
                    'created_at' => $t->created_at ?? now(),
                    'updated_at' => $t->updated_at ?? now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('task_assignees', function (Blueprint $table) {
            $table->dropForeign(['assigned_by']);
            $table->dropIndex(['task_id']);
            $table->dropIndex(['user_id']);
            $table->dropColumn('assigned_by');
        });
    }
};
