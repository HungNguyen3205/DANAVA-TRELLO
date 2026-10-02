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
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('avatar')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('job_title')->nullable();
            $table->string('department')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->text('bio')->nullable();
            $table->string('timezone')->default('Asia/Ho_Chi_Minh');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        // Backfill profiles for existing users
        $users = DB::table('users')->get();
        foreach ($users as $user) {
            DB::table('user_profiles')->insertOrIgnore([
                'user_id' => $user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_profiles');
    }
};
