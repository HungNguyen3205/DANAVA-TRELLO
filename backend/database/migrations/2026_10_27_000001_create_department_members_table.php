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
        if (!Schema::hasTable('department_members')) {
            Schema::create('department_members', function (Blueprint $table) {
                $table->id();
                $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('role', 50)->default('member'); // 'member' or 'manager'
                $table->string('title', 150)->nullable();
                $table->boolean('is_primary')->default(false);
                $table->timestamps();

                $table->unique(['department_id', 'user_id']);
                $table->index(['user_id', 'department_id']);
            });
        }

        // Migrate existing user-department associations into department_members
        if (Schema::hasTable('users') && Schema::hasTable('departments')) {
            $users = DB::table('users')->whereNotNull('department_id')->whereNull('deleted_at')->get();
            foreach ($users as $u) {
                $isManager = DB::table('departments')
                    ->where('id', $u->department_id)
                    ->where('manager_id', $u->id)
                    ->exists();

                DB::table('department_members')->updateOrInsert(
                    ['department_id' => $u->department_id, 'user_id' => $u->id],
                    [
                        'role' => $isManager ? 'manager' : 'member',
                        'title' => $u->department_title,
                        'is_primary' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            // Also ensure all designated managers are in department_members for their managed department
            $departments = DB::table('departments')->whereNotNull('manager_id')->whereNull('deleted_at')->get();
            foreach ($departments as $dept) {
                DB::table('department_members')->updateOrInsert(
                    ['department_id' => $dept->id, 'user_id' => $dept->manager_id],
                    [
                        'role' => 'manager',
                        'title' => 'Trưởng phòng ' . $dept->name,
                        'updated_at' => now(),
                    ]
                );
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('department_members');
    }
};
