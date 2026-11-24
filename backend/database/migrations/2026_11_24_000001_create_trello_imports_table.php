<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trello_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('source_board_id', 24);
            $table->uuid('preview_token')->unique();
            $table->longText('payload');
            $table->foreignId('board_id')->nullable()->constrained()->nullOnDelete();
            $table->json('result')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->unique(['user_id', 'source_board_id']);
        });
        Schema::table('tasks', function (Blueprint $table) {
            $table->json('trello_source')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tasks', fn (Blueprint $table) => $table->dropColumn('trello_source'));
        Schema::dropIfExists('trello_imports');
    }
};
