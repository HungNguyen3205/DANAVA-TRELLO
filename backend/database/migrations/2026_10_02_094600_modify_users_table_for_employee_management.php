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
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('username')->nullable()->unique();
            $table->string('system_role', 20)->default('user');
            $table->string('account_status', 20)->default('active');
            $table->boolean('must_change_password')->default(false);
            $table->timestamp('last_login_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
        });

        // Backfill usernames
        $users = DB::table('users')->whereNull('username')->get();
        foreach ($users as $user) {
            if ($user->email) {
                $baseUsername = explode('@', $user->email)[0];
            } else {
                $baseUsername = 'user' . $user->id;
            }
            $baseUsername = strtolower(preg_replace('/[^a-z0-9._]/', '', $baseUsername));
            if (empty($baseUsername)) $baseUsername = 'user' . $user->id;
            
            $username = $baseUsername;
            $count = 1;
            while (DB::table('users')->where('username', $username)->exists()) {
                $username = $baseUsername . $count;
                $count++;
            }
            DB::table('users')->where('id', $user->id)->update(['username' => $username]);
        }

        // Change username to NOT NULL
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn([
                'username',
                'system_role',
                'account_status',
                'must_change_password',
                'last_login_at',
                'created_by'
            ]);
            $table->string('email')->nullable(false)->change();
        });
    }
};
