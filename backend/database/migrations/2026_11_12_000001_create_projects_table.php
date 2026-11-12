<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Projects sit above boards: Project > Board > Column > Task.
 *
 * Existing data is kept: every board of type "project" becomes its own project (taking over its
 * project details), and the remaining boards are grouped into a project called "Chung".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 20)->nullable();
            $table->string('status', 20)->default('planning')->index();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('budget', 15, 2)->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('boards', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('workspace_id')->constrained('projects')->nullOnDelete();
        });

        $now = now();
        $projectBoards = DB::table('boards')->where('type', 'project')->orderBy('id')->get();
        foreach ($projectBoards as $board) {
            $projectId = DB::table('projects')->insertGetId([
                'name' => $board->name,
                'description' => $board->description,
                'status' => $board->project_status ?: 'in_progress',
                'start_date' => $board->start_date,
                'end_date' => $board->end_date,
                'manager_id' => $board->manager_id,
                'budget' => $board->budget,
                'owner_id' => $board->owner_id,
                'created_at' => $board->created_at ?? $now,
                'updated_at' => $now,
            ]);
            DB::table('boards')->where('id', $board->id)->update(['project_id' => $projectId]);
        }

        if (DB::table('boards')->whereNull('project_id')->exists()) {
            $adminId = DB::table('users')->whereIn('system_role', ['system_admin', 'admin'])->orderBy('id')->value('id');
            $generalId = DB::table('projects')->insertGetId([
                'name' => 'Chung',
                'description' => 'Các bảng công việc chung chưa thuộc dự án cụ thể.',
                'status' => 'in_progress',
                'owner_id' => $adminId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('boards')->whereNull('project_id')->update(['project_id' => $generalId]);
        }
    }

    public function down(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_id');
        });
        Schema::dropIfExists('projects');
    }
};
