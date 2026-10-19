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
        // 1. Thêm department_id & allow_department_notification vào bảng boards (an toàn cho dữ liệu cũ)
        if (Schema::hasTable('boards')) {
            Schema::table('boards', function (Blueprint $table) {
                if (!Schema::hasColumn('boards', 'department_id')) {
                    $table->foreignId('department_id')
                        ->nullable()
                        ->after('workspace_id')
                        ->constrained('departments')
                        ->nullOnDelete();
                    $table->index('department_id');
                }

                if (!Schema::hasColumn('boards', 'allow_department_notification')) {
                    $table->boolean('allow_department_notification')
                        ->default(true)
                        ->after('department_id');
                }
            });
        }

        // 2. Tạo bảng notification_integrations (hỗ trợ Polymorphic cho Department & Board)
        if (!Schema::hasTable('notification_integrations')) {
            Schema::create('notification_integrations', function (Blueprint $table) {
                $table->id();
                $table->string('integratable_type', 150);
                $table->unsignedBigInteger('integratable_id');
                $table->string('provider', 50)->default('telegram');
                $table->string('chat_id', 100)->nullable();
                $table->string('chat_title', 255)->nullable();
                $table->string('status', 30)->default('disconnected'); // disconnected, pending, connected, error, disabled
                $table->boolean('is_enabled')->default(false);
                $table->string('delivery_mode', 50)->nullable(); // inherit_department, board_only, department_only, both, disabled
                $table->json('event_settings')->nullable();
                $table->timestamp('verified_at')->nullable();
                $table->timestamp('last_tested_at')->nullable();
                $table->timestamp('last_sent_at')->nullable();
                $table->timestamp('last_error_at')->nullable();
                $table->text('last_error_message')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['integratable_type', 'integratable_id', 'provider'], 'notif_integrations_unique_provider');
                $table->index(['integratable_type', 'integratable_id'], 'notif_integrations_morph_idx');
                $table->index('chat_id');
                $table->index('status');
            });
        }

        // 3. Tạo bảng telegram_deliveries để chống gửi trùng (Idempotency) và truy vết kết quả gửi tin
        if (!Schema::hasTable('telegram_deliveries')) {
            Schema::create('telegram_deliveries', function (Blueprint $table) {
                $table->id();
                $table->foreignId('integration_id')->nullable()->constrained('notification_integrations')->nullOnDelete();
                $table->string('event_type', 100);
                $table->string('notifiable_type', 150)->nullable();
                $table->unsignedBigInteger('notifiable_id')->nullable();
                $table->string('idempotency_key', 191)->unique();
                $table->string('chat_id', 100);
                $table->string('status', 30)->default('pending'); // pending, sent, failed
                $table->unsignedTinyInteger('attempts')->default(1);
                $table->string('telegram_message_id', 100)->nullable();
                $table->unsignedSmallInteger('response_code')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamps();

                $table->index(['notifiable_type', 'notifiable_id']);
                $table->index('chat_id');
                $table->index('event_type');
                $table->index('created_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telegram_deliveries');
        Schema::dropIfExists('notification_integrations');

        if (Schema::hasTable('boards')) {
            Schema::table('boards', function (Blueprint $table) {
                if (Schema::hasColumn('boards', 'department_id')) {
                    $table->dropForeign(['department_id']);
                    $table->dropIndex(['department_id']);
                    $table->dropColumn('department_id');
                }
                if (Schema::hasColumn('boards', 'allow_department_notification')) {
                    $table->dropColumn('allow_department_notification');
                }
            });
        }
    }
};
