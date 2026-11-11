<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Daily count of Gemini calls and tokens per user (for limits and the usage panel). */
    public function up(): void
    {
        Schema::create('assistant_usage', function (Blueprint $table) {
            $table->id();
            $table->date('usage_date');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('requests')->default(0);
            $table->unsignedBigInteger('tokens')->default(0);
            $table->timestamps();
            $table->unique(['usage_date', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_usage');
    }
};
