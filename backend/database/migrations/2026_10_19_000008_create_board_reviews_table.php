<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('board_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('board_id')->constrained('boards')->cascadeOnDelete();
            $table->string('status', 20)->default('draft'); // draft, published, locked
            $table->text('goals')->nullable();
            $table->text('summary')->nullable();
            $table->text('achievements')->nullable();
            $table->text('unfinished_work')->nullable();
            $table->text('issues')->nullable();
            $table->text('lessons_learned')->nullable();
            $table->decimal('revenue', 15, 2)->nullable();
            $table->decimal('cost', 15, 2)->nullable();
            $table->decimal('profit', 15, 2)->nullable();
            $table->unsignedTinyInteger('overall_rating')->nullable(); // 1 to 5
            $table->json('member_reviews')->nullable();
            $table->json('attachments')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('published_by')->nullable()->constrained('users');
            $table->timestamp('published_at')->nullable();
            $table->foreignId('locked_by')->nullable()->constrained('users');
            $table->timestamp('locked_at')->nullable();
            $table->timestamps();

            // Mỗi Board chỉ có 1 bản tổng kết chính
            $table->unique('board_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('board_reviews');
    }
};
