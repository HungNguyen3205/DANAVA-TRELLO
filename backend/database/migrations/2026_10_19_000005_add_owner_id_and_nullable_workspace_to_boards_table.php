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
        Schema::table('boards', function (Blueprint $table) {
            if (!Schema::hasColumn('boards', 'owner_id')) {
                $table->foreignId('owner_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
            }
        });

        // Make workspace_id nullable for backwards compatibility
        Schema::table('boards', function (Blueprint $table) {
            if (Schema::hasColumn('boards', 'workspace_id')) {
                $table->unsignedBigInteger('workspace_id')->nullable()->change();
            }
        });

        // Backfill owner_id for existing boards
        $boards = DB::table('boards')->get();
        foreach ($boards as $board) {
            $ownerId = null;

            // 1. If board has workspace_id, check workspace owner_id
            if (!empty($board->workspace_id)) {
                $ws = DB::table('workspaces')->where('id', $board->workspace_id)->first();
                if ($ws && !empty($ws->owner_id)) {
                    $ownerId = $ws->owner_id;
                }
            }

            // 2. If no owner found yet, check board_members with admin/owner role
            if (!$ownerId) {
                $adminMember = DB::table('board_members')
                    ->where('board_id', $board->id)
                    ->whereIn('role', ['owner', 'admin'])
                    ->orderBy('id', 'asc')
                    ->first();
                if ($adminMember) {
                    $ownerId = $adminMember->user_id;
                }
            }

            // 3. Fallback to any board member or first active user
            if (!$ownerId) {
                $anyMember = DB::table('board_members')->where('board_id', $board->id)->orderBy('id', 'asc')->first();
                $ownerId = $anyMember?->user_id ?? DB::table('users')->value('id');
            }

            if ($ownerId) {
                DB::table('boards')->where('id', $board->id)->update(['owner_id' => $ownerId]);

                // Ensure owner is also in board_members with admin role
                DB::table('board_members')->updateOrInsert(
                    ['board_id' => $board->id, 'user_id' => $ownerId],
                    ['role' => 'admin', 'updated_at' => now()]
                );
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            if (Schema::hasColumn('boards', 'owner_id')) {
                $table->dropForeign(['owner_id']);
                $table->dropColumn('owner_id');
            }
        });
    }
};
