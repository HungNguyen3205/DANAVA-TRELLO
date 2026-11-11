<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Per-user chat history with the assistant.
        Schema::create('assistant_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 16); // user | assistant
            $table->text('content');
            $table->json('meta')->nullable(); // e.g. task preview payload
            $table->timestamps();
            $table->index(['user_id', 'id']);
        });

        // Nicknames people use in chat messages ("Hùng IT", "Chú Nam Con Ông Thành")
        // learned when someone confirms who a mention refers to.
        Schema::create('user_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('alias', 120);
            $table->string('alias_key', 120)->unique(); // normalized (lowercase, no accents)
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_aliases');
        Schema::dropIfExists('assistant_messages');
    }
};
