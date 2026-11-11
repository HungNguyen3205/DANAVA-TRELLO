<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Company-wide settings editable from the UI (secrets are stored encrypted).
        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Custom uploaded background image for a board ("/storage/board-backgrounds/...").
        Schema::table('boards', function (Blueprint $table) {
            $table->string('background_image')->nullable()->after('color');
        });
    }

    public function down(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->dropColumn('background_image');
        });
        Schema::dropIfExists('app_settings');
    }
};
