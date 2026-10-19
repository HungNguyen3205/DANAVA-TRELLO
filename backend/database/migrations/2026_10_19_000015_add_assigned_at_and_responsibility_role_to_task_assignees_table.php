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
            if (!Schema::hasColumn('task_assignees', 'assigned_at')) {
                $table->timestamp('assigned_at')->nullable()->after('assigned_by');
            }
            if (!Schema::hasColumn('task_assignees', 'responsibility_role')) {
                $table->string('responsibility_role', 100)->nullable()->after('contribution_percent');
            }
        });

        // Backfill assigned_at with created_at for existing records
        DB::table('task_assignees')
            ->whereNull('assigned_at')
            ->update([
                'assigned_at' => DB::raw('created_at'),
            ]);

        // Migrate any remaining tasks with assignee_id not yet in task_assignees
        $legacyTasks = DB::table('tasks')
            ->whereNotNull('assignee_id')
            ->select('id', 'assignee_id', 'created_at', 'updated_at')
            ->get();

        foreach ($legacyTasks as $t) {
            $userExists = DB::table('users')->where('id', $t->assignee_id)->exists();
            if ($userExists) {
                DB::table('task_assignees')->insertOrIgnore([
                    'task_id' => $t->id,
                    'user_id' => $t->assignee_id,
                    'assigned_by' => null,
                    'assigned_at' => $t->created_at ?? now(),
                    'contribution_percent' => 100.0,
                    'responsibility_role' => null,
                    'created_at' => $t->created_at ?? now(),
                    'updated_at' => $t->updated_at ?? now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('task_assignees', function (Blueprint $table) {
            if (Schema::hasColumn('task_assignees', 'responsibility_role')) {
                $table->dropColumn('responsibility_role');
            }
            if (Schema::hasColumn('task_assignees', 'assigned_at')) {
                $table->dropColumn('assigned_at');
            }
        });
    }
};
