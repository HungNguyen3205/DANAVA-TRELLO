<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Cập nhật bảng tasks
        Schema::table('tasks', function (Blueprint $table) {
            $table->date('start_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();
        });

        // 2. Tạo bảng task_attachments
        Schema::create('task_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('file_name');
            $table->string('file_path');
            $table->string('mime_type');
            $table->unsignedBigInteger('size'); // bytes
            $table->timestamps();
            $table->softDeletes(); // Optional: allow restoring files
        });

        // 3. Tạo bảng activity_logs
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action'); // e.g. "updated_status", "assigned", "uploaded_file"
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('task_attachments');
        
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['completed_by']);
            $table->dropColumn(['start_date', 'completed_at', 'completed_by']);
            $table->dropSoftDeletes();
        });
    }
};
