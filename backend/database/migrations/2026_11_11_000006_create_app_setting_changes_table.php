<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Who changed which company setting and when. Secrets are stored only as a "••••WXYZ" hint. */
    public function up(): void
    {
        Schema::create('app_setting_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('setting', 100);
            $table->string('action', 40); // added | replaced | removed | changed
            $table->string('old_value', 255)->nullable();
            $table->string('new_value', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['setting', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_setting_changes');
    }
};
