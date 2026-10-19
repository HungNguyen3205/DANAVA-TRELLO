<?php

namespace Tests\Feature;

use App\Jobs\SendTelegramNotificationJob;
use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\Department;
use App\Models\KanbanColumn;
use App\Models\NotificationIntegration;
use App\Models\Task;
use App\Models\TelegramDelivery;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\TelegramService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class TelegramIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $user;
    protected User $boardOwner;
    protected User $boardMember;
    protected Department $department;
    protected Board $board;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'telegram.enabled' => true,
            'telegram.bot_token' => 'fake_test_token_123',
            'telegram.bot_username' => 'trolyNotificationAI_bot',
        ]);

        $this->admin = User::factory()->create([
            'name' => 'System Admin',
            'username' => 'sysadmin',
            'system_role' => 'system_admin',
            'account_status' => 'active',
        ]);

        $this->user = User::factory()->create([
            'name' => 'Regular User',
            'username' => 'regularuser',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $this->boardOwner = User::factory()->create([
            'name' => 'Board Owner',
            'username' => 'boardowner',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $this->boardMember = User::factory()->create([
            'name' => 'Board Member',
            'username' => 'boardmember',
            'system_role' => 'user',
            'account_status' => 'active',
        ]);

        $this->department = Department::create([
            'name' => 'Phòng Kỹ Thuật',
            'code' => 'TECH',
            'status' => 'active',
            'color' => '#3b82f6',
            'created_by' => $this->admin->id,
        ]);

        $this->board = Board::create([
            'name' => 'Dự án DANAVA Web',
            'owner_id' => $this->boardOwner->id,
            'department_id' => $this->department->id,
            'allow_department_notification' => true,
        ]);

        $this->board->members()->attach($this->boardMember->id, ['role' => 'member']);
    }

    public function test_system_admin_can_view_and_configure_department_telegram()
    {
        $response = $this->actingAs($this->admin)->getJson("/api/admin/departments/{$this->department->id}/telegram");
        $response->assertStatus(200)
            ->assertJson([
                'enabled' => false,
                'status' => 'disconnected',
            ]);

        $updateRes = $this->actingAs($this->admin)->putJson("/api/admin/departments/{$this->department->id}/telegram", [
            'chat_id' => '-1004340949074',
            'enabled' => true,
            'event_settings' => [
                'employee_added' => true,
                'task_completed' => true,
            ],
        ]);

        $updateRes->assertStatus(200);

        $this->assertDatabaseHas('notification_integrations', [
            'integratable_type' => Department::class,
            'integratable_id' => $this->department->id,
            'chat_id' => '-1004340949074',
            'is_enabled' => true,
            'provider' => 'telegram',
        ]);

        // String chat_id check: must preserve exact string
        $integration = $this->department->fresh()->telegramIntegration;
        $this->assertIsString($integration->chat_id);
        $this->assertSame('-1004340949074', $integration->chat_id);
    }

    public function test_regular_user_cannot_configure_department_telegram()
    {
        $response = $this->actingAs($this->user)->putJson("/api/admin/departments/{$this->department->id}/telegram", [
            'chat_id' => '-1004340949074',
            'enabled' => true,
        ]);

        $response->assertStatus(403);
    }

    public function test_board_owner_can_configure_board_telegram()
    {
        $response = $this->actingAs($this->boardOwner)->getJson("/api/boards/{$this->board->id}/telegram");
        $response->assertStatus(200)
            ->assertJson([
                'can_manage' => true,
                'has_department' => true,
            ]);

        $updateRes = $this->actingAs($this->boardOwner)->putJson("/api/boards/{$this->board->id}/telegram", [
            'delivery_mode' => 'board_only',
            'chat_id' => '-1009876543210',
            'enabled' => true,
            'allow_department_notification' => false,
        ]);

        $updateRes->assertStatus(200);

        $this->assertDatabaseHas('notification_integrations', [
            'integratable_type' => Board::class,
            'integratable_id' => $this->board->id,
            'chat_id' => '-1009876543210',
            'delivery_mode' => 'board_only',
        ]);

        $this->assertDatabaseHas('boards', [
            'id' => $this->board->id,
            'allow_department_notification' => false,
        ]);
    }

    public function test_board_member_cannot_modify_board_telegram_settings()
    {
        $response = $this->actingAs($this->boardMember)->putJson("/api/boards/{$this->board->id}/telegram", [
            'delivery_mode' => 'board_only',
            'chat_id' => '-1009876543210',
            'enabled' => true,
        ]);

        $response->assertStatus(403);
    }

    public function test_board_member_can_view_masked_telegram_status_without_secret_chat_id()
    {
        $this->board->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => '-1009876543210',
            'chat_title' => 'Nhóm Dự Án Web',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $response = $this->actingAs($this->boardMember)->getJson("/api/boards/{$this->board->id}/telegram");
        $response->assertStatus(200)
            ->assertJson([
                'can_manage' => false,
                'chat_id' => null, // Secret full chat_id hidden from regular member
                'chat_id_masked' => '-100******3210',
                'chat_title' => 'Nhóm Dự Án Web',
            ]);
    }

    public function test_non_member_admin_cannot_access_private_board_telegram_settings()
    {
        // System admin who is NOT in board_members cannot configure board
        $response = $this->actingAs($this->admin)->putJson("/api/boards/{$this->board->id}/telegram", [
            'delivery_mode' => 'board_only',
            'chat_id' => '-1009876543210',
            'enabled' => true,
        ]);

        $response->assertStatus(403);
    }

    public function test_verify_telegram_chat_success()
    {
        Http::fake([
            'https://api.telegram.org/botfake_test_token_123/getChat*' => Http::response([
                'ok' => true,
                'result' => [
                    'id' => -1004340949074,
                    'title' => 'DANAVA Sales & Tech',
                    'type' => 'supergroup',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($this->admin)->postJson("/api/admin/departments/{$this->department->id}/telegram/verify", [
            'chat_id' => '-1004340949074',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'connected',
                'chat_title' => 'DANAVA Sales & Tech',
                'chat_id' => '-1004340949074',
            ]);

        $this->assertDatabaseHas('notification_integrations', [
            'integratable_type' => Department::class,
            'integratable_id' => $this->department->id,
            'chat_title' => 'DANAVA Sales & Tech',
            'status' => 'connected',
        ]);
    }

    public function test_verify_telegram_chat_failure_returns_422()
    {
        Http::fake([
            'https://api.telegram.org/botfake_test_token_123/getChat*' => Http::response([
                'ok' => false,
                'description' => 'Chat not found',
            ], 400),
        ]);

        $response = $this->actingAs($this->admin)->postJson("/api/admin/departments/{$this->department->id}/telegram/verify", [
            'chat_id' => '-9999999999',
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['message']);
    }

    public function test_send_test_message_success()
    {
        Http::fake([
            'https://api.telegram.org/botfake_test_token_123/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 999],
            ], 200),
        ]);

        $integration = $this->department->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => '-1004340949074',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $response = $this->actingAs($this->admin)->postJson("/api/admin/departments/{$this->department->id}/telegram/test");
        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'last_tested_at']);
    }

    public function test_send_test_message_rate_limiting()
    {
        Http::fake([
            'https://api.telegram.org/botfake_test_token_123/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 999],
            ], 200),
        ]);

        $this->department->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => '-1004340949074',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        // Hit 3 times
        $this->actingAs($this->admin)->postJson("/api/admin/departments/{$this->department->id}/telegram/test")->assertStatus(200);
        $this->actingAs($this->admin)->postJson("/api/admin/departments/{$this->department->id}/telegram/test")->assertStatus(200);
        $this->actingAs($this->admin)->postJson("/api/admin/departments/{$this->department->id}/telegram/test")->assertStatus(200);

        // 4th time must be blocked with 429
        $fourth = $this->actingAs($this->admin)->postJson("/api/admin/departments/{$this->department->id}/telegram/test");
        $fourth->assertStatus(429);
    }

    public function test_board_inherit_department_mode_resolution()
    {
        // Department has telegram
        $deptInteg = $this->department->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => '-1001111111111',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        // Board has delivery_mode = inherit_department
        $this->board->telegramIntegration()->create([
            'provider' => 'telegram',
            'delivery_mode' => 'inherit_department',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $telegramService = app(TelegramService::class);
        $destinations = $telegramService->resolveBoardDestinations($this->board, 'task_completed');

        $this->assertCount(1, $destinations);
        $this->assertArrayHasKey('-1001111111111', $destinations);
    }

    public function test_both_mode_with_identical_chat_id_deduplicates_and_sends_only_once()
    {
        $sameChatId = '-1005555555555';

        // Department has chat_id
        $this->department->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => $sameChatId,
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        // Board has both mode and SAME chat_id
        $this->board->telegramIntegration()->create([
            'provider' => 'telegram',
            'delivery_mode' => 'both',
            'chat_id' => $sameChatId,
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $telegramService = app(TelegramService::class);
        $destinations = $telegramService->resolveBoardDestinations($this->board, 'task_completed');

        // Must be deduplicated to exactly 1 destination
        $this->assertCount(1, $destinations);
        $this->assertArrayHasKey($sameChatId, $destinations);
    }

    public function test_board_blocking_department_notification_prevents_leak_to_department_chat()
    {
        $this->department->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => '-1001111111111',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        // Board disables allow_department_notification
        $this->board->update(['allow_department_notification' => false]);
        $this->board->telegramIntegration()->create([
            'provider' => 'telegram',
            'delivery_mode' => 'both',
            'chat_id' => '-1002222222222',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $telegramService = app(TelegramService::class);
        $destinations = $telegramService->resolveBoardDestinations($this->board, 'task_completed');

        // Should only have board chat, department chat must be blocked
        $this->assertCount(1, $destinations);
        $this->assertArrayHasKey('-1002222222222', $destinations);
        $this->assertArrayNotHasKey('-1001111111111', $destinations);
    }

    public function test_task_completion_triggers_telegram_job_without_breaking_task_flow()
    {
        Queue::fake();

        $this->board->telegramIntegration()->create([
            'provider' => 'telegram',
            'delivery_mode' => 'board_only',
            'chat_id' => '-1004340949074',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $column = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Hoàn thành',
            'position' => 1,
        ]);

        $task = Task::create([
            'column_id' => $column->id,
            'title' => 'Xây dựng API Telegram',
            'created_by' => $this->boardOwner->id,
        ]);

        NotificationService::notifyTaskCompleted($task, $this->boardOwner);

        Queue::assertPushed(SendTelegramNotificationJob::class, function ($job) {
            return $job->chatId === '-1004340949074'
                && $job->eventType === 'task_completed';
        });
    }

    public function test_idempotency_prevents_duplicate_message_delivery()
    {
        Http::fake([
            'https://api.telegram.org/botfake_test_token_123/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 101],
            ], 200),
        ]);

        $integration = $this->board->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => '-1004340949074',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $job = new SendTelegramNotificationJob(
            integrationId: $integration->id,
            chatId: '-1004340949074',
            message: 'Thông báo lần 1',
            eventType: 'test_event',
            idempotencyKey: 'idemp_key_9999'
        );

        $telegramService = app(TelegramService::class);

        // Run first time: should send
        $job->handle($telegramService);
        Http::assertSentCount(1);
        $this->assertDatabaseHas('telegram_deliveries', [
            'idempotency_key' => 'idemp_key_9999',
            'status' => 'sent',
        ]);

        // Run second time with same key: should skip sending
        $job->handle($telegramService);
        Http::assertSentCount(1); // Still 1, not 2
    }

    public function test_disconnect_telegram_clears_chat_id()
    {
        $this->board->telegramIntegration()->create([
            'provider' => 'telegram',
            'chat_id' => '-1004340949074',
            'chat_title' => 'Nhóm Cũ',
            'status' => 'connected',
            'is_enabled' => true,
        ]);

        $response = $this->actingAs($this->boardOwner)->deleteJson("/api/boards/{$this->board->id}/telegram");
        $response->assertStatus(200);

        $integration = $this->board->fresh()->telegramIntegration;
        $this->assertNull($integration->chat_id);
        $this->assertSame('disconnected', $integration->status);
        $this->assertFalse($integration->is_enabled);
    }
}
