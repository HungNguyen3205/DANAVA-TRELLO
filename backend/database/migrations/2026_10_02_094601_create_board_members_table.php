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
        Schema::create('board_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('board_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('role', 20)->default('member');
            $table->timestamps();
            
            $table->unique(['board_id', 'user_id']);
        });

        // Backfill board members based on workspace members
        $workspaceMembers = DB::table('workspace_members')->get();
        foreach ($workspaceMembers as $wm) {
            $boards = DB::table('boards')->where('workspace_id', $wm->workspace_id)->get();
            foreach ($boards as $board) {
                DB::table('board_members')->insertOrIgnore([
                    'board_id' => $board->id,
                    'user_id' => $wm->user_id,
                    'role' => $wm->role, // Admin becomes admin, member becomes member
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('board_members');
    }
};
