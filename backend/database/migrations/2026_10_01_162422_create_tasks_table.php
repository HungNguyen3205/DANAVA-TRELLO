<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('column_id')->constrained('kanban_columns')->onDelete('cascade');
            $table->foreignId('sprint_id')->nullable()->constrained('board_sprints')->onDelete('set null');
            $table->foreignId('assignee_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('priority')->default('Bình thường'); // Thấp, Bình thường, Cao, Khẩn cấp
            $table->double('order')->default(0);
            $table->date('due_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
