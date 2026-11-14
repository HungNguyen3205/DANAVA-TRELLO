<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Every action the assistant takes or refuses on someone's behalf (never deleted with chat history).
        Schema::create('assistant_action_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('tool', 60);
            $table->string('status', 30); // success | failed | denied | needs_confirmation
            $table->string('target_type', 30)->nullable(); // task | user | board
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('target_label')->nullable();
            $table->json('arguments')->nullable();
            $table->json('changes')->nullable();
            $table->text('message')->nullable();
            $table->text('request_text')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['target_type', 'target_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_action_logs');
    }
};
