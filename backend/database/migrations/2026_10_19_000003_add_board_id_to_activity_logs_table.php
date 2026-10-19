<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->foreignId('board_id')
                ->nullable()
                ->after('id')
                ->constrained('boards')
                ->onDelete('cascade');

            $table->index('board_id');
        });

        // Backfill board_id from tasks -> kanban_columns -> boards
        $logs = DB::table('activity_logs')
            ->join('tasks', 'activity_logs.task_id', '=', 'tasks.id')
            ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
            ->select('activity_logs.id', 'kanban_columns.board_id')
            ->get();

        foreach ($logs as $log) {
            DB::table('activity_logs')
                ->where('id', $log->id)
                ->update(['board_id' => $log->board_id]);
        }
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropForeign(['board_id']);
            $table->dropIndex(['board_id']);
            $table->dropColumn('board_id');
        });
    }
};
