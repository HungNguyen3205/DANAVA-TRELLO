<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'department_title')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('department_title', 150)
                    ->nullable()
                    ->after('department_id');
                $table->index('department_title');
            });
        }

        // Backfill existing users according to their current department and manager status
        if (Schema::hasTable('departments') && Schema::hasTable('users')) {
            $departments = DB::table('departments')->whereNull('deleted_at')->get();
            foreach ($departments as $dept) {
                if (!empty($dept->manager_id)) {
                    DB::table('users')
                        ->where('id', $dept->manager_id)
                        ->update(['department_title' => "Trưởng phòng {$dept->name}"]);
                }

                $memberQuery = DB::table('users')->where('department_id', $dept->id);
                if (!empty($dept->manager_id)) {
                    $memberQuery->where('id', '!=', $dept->manager_id);
                }
                $memberQuery->update(['department_title' => "Nhân viên {$dept->name}"]);
            }

            // Ensure unassigned users have null department_title
            DB::table('users')
                ->whereNull('department_id')
                ->update(['department_title' => null]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'department_title')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex(['department_title']);
                $table->dropColumn('department_title');
            });
        }
    }
};
