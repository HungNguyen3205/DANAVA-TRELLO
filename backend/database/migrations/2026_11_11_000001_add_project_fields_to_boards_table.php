<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Board type: a board is either a simple task board ("task", default) or a
 * project ("project"). Project boards unlock project metadata (dates, status,
 * manager, budget) and advanced features (review, performance scoring).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->string('type', 20)->default('task')->after('name')->index();
            $table->string('project_status', 20)->nullable()->after('type');
            $table->date('start_date')->nullable()->after('project_status');
            $table->date('end_date')->nullable()->after('start_date');
            $table->foreignId('manager_id')->nullable()->after('end_date')->constrained('users')->nullOnDelete();
            $table->decimal('budget', 15, 2)->nullable()->after('manager_id');
        });

        // Existing boards that already use project-only features become projects,
        // so no one loses access to their review or performance data.
        $projectBoardIds = DB::table('board_reviews')->pluck('board_id')
            ->merge(DB::table('performance_periods')->pluck('board_id'))
            ->merge(DB::table('performance_policies')->pluck('board_id'))
            ->filter()
            ->unique()
            ->values();

        if ($projectBoardIds->isNotEmpty()) {
            DB::table('boards')
                ->whereIn('id', $projectBoardIds)
                ->update(['type' => 'project', 'project_status' => 'in_progress']);
        }
    }

    public function down(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->dropForeign(['manager_id']);
            $table->dropIndex(['type']);
            $table->dropColumn(['type', 'project_status', 'start_date', 'end_date', 'manager_id', 'budget']);
        });
    }
};
