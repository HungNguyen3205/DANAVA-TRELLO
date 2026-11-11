<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Board;
use App\Models\User;
use App\Services\Assistant\AssistantSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AssistantSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'AIzaSyTestKey_1234567890abcdefWXYZ';

    private User $admin;
    private User $employee;

    protected function setUp(): void
    {
        parent::setUp();
        config(['assistant.mode' => 'demo', 'assistant.gemini.api_key' => null]);
        $this->admin = User::factory()->create(['system_role' => 'system_admin', 'account_status' => 'active']);
        $this->employee = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
    }

    private function fakeGemini(int $status = 200, string $error = ''): void
    {
        $response = $status === 200
            ? Http::response(['candidates' => [['content' => ['parts' => [['text' => 'OK']]]]]])
            : Http::response(['error' => ['message' => $error]], $status);
        Http::fake(['generativelanguage.googleapis.com/*' => $response, 'aiplatform.googleapis.com/*' => $response]);
    }

    public function test_status_never_exposes_the_key(): void
    {
        $this->actingAs($this->employee)->getJson('/api/assistant/settings')
            ->assertOk()
            ->assertJson(['has_key' => false, 'mode' => 'demo', 'can_manage' => false]);

        $this->fakeGemini();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])->assertOk();

        $res = $this->actingAs($this->employee)->getJson('/api/assistant/settings')
            ->assertJson(['has_key' => true, 'mode' => 'live', 'key_hint' => '••••WXYZ', 'source' => 'app']);
        $this->assertStringNotContainsString(self::KEY, $res->getContent());
    }

    public function test_key_is_verified_then_stored_encrypted(): void
    {
        $this->fakeGemini();

        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY, 'model' => 'gemini-2.5-flash'])
            ->assertOk()->assertJsonPath('has_key', true);

        $stored = AppSetting::where('key', AssistantSettings::KEY_SETTING)->value('value');
        $this->assertNotSame(self::KEY, $stored);
        $this->assertSame(self::KEY, app(AssistantSettings::class)->apiKey());
        Http::assertSent(fn ($r) => $r->hasHeader('x-goog-api-key', self::KEY) && str_contains($r->url(), 'gemini-2.5-flash'));
    }

    public function test_invalid_key_is_rejected_with_a_readable_message(): void
    {
        $this->fakeGemini(400, 'API key not valid. Please pass a valid API key.');

        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])
            ->assertStatus(422)
            ->assertJsonPath('errors.api_key.0', 'Khóa API không đúng hoặc không dùng được cho Gemini. Anh/chị kiểm tra lại đã sao chép đủ khóa chưa.');

        $this->assertNull(app(AssistantSettings::class)->apiKey());
    }

    public function test_vertex_express_key_with_dots_is_accepted_and_used(): void
    {
        $vertexKey = 'AQ.FakeVertexExpressKey_for_tests_only-0000';
        $this->fakeGemini();

        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => $vertexKey])
            ->assertOk()
            ->assertJsonPath('endpoint', 'vertex');

        Http::assertSent(fn ($r) => str_contains($r->url(), 'aiplatform.googleapis.com/v1/publishers/google/models/')
            && $r->hasHeader('x-goog-api-key', $vertexKey)
            && !str_contains($r->url(), $vertexKey));
        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'generativelanguage'));

        // Chat now goes to Vertex too.
        $this->actingAs($this->employee)->postJson('/api/assistant/chat', ['message' => 'Xin chào'])->assertOk();
        Http::assertSentCount(2);
    }

    public function test_key_rejected_by_one_endpoint_is_tried_on_the_other(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'API key not valid.']], 400),
            'aiplatform.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => 'OK']]]]]]),
        ]);

        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])
            ->assertOk()->assertJsonPath('endpoint', 'vertex');
    }

    public function test_disabled_api_403_shows_the_enable_link_from_google(): void
    {
        $vertexKey = 'AQ.FakeVertexExpressKey_for_tests_only-0000';
        $error = Http::response(['error' => [
            'code' => 403,
            'status' => 'PERMISSION_DENIED',
            'message' => 'Vertex AI API has not been used in project 123 before or it is disabled.',
            'details' => [[
                '@type' => 'type.googleapis.com/google.rpc.ErrorInfo',
                'reason' => 'SERVICE_DISABLED',
                'metadata' => ['activationUrl' => 'https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=123'],
            ]],
        ]], 403);
        Http::fake(['aiplatform.googleapis.com/*' => $error, 'generativelanguage.googleapis.com/*' => $error]);

        $message = $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => $vertexKey])
            ->assertStatus(422)->json('errors.api_key.0');

        $this->assertStringContainsString('chưa bật API', $message);
        $this->assertStringContainsString('https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=123', $message);
        Http::assertSentCount(2); // the other endpoint was tried too
    }

    public function test_403_on_vertex_falls_back_to_gemini_endpoint(): void
    {
        Http::fake([
            'aiplatform.googleapis.com/*' => Http::response(['error' => ['code' => 403, 'message' => 'Permission denied']], 403),
            'generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => 'OK']]]]]]),
        ]);

        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => 'AQ.FakeVertexExpressKey_for_tests_only-0000'])
            ->assertOk()->assertJsonPath('endpoint', 'gemini');
    }

    public function test_quota_error_is_not_retried_on_the_other_endpoint(): void
    {
        $this->fakeGemini(429, 'Resource exhausted');

        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])
            ->assertStatus(422)
            ->assertJsonPath('errors.api_key.0', 'Đã hết lượt dùng Gemini tạm thời (quota). Vui lòng thử lại sau ít phút.');
        Http::assertSentCount(1);
    }

    public function test_schema_is_converted_for_vertex(): void
    {
        $out = \App\Services\Assistant\GeminiClient::toOpenApiSchema([
            'type' => 'object',
            'properties' => ['board_id' => ['type' => ['integer', 'null']], 'tags' => ['type' => 'array', 'items' => ['type' => 'string']]],
        ]);

        $this->assertSame('OBJECT', $out['type']);
        $this->assertSame(['type' => 'INTEGER', 'nullable' => true], $out['properties']['board_id']);
        $this->assertSame('STRING', $out['properties']['tags']['items']['type']);
    }

    public function test_replacing_a_working_key_needs_confirmation(): void
    {
        $this->fakeGemini();
        $other = User::factory()->create(['name' => 'Admin Hai', 'system_role' => 'system_admin', 'account_status' => 'active']);
        $this->actingAs($other)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])->assertOk();

        $newKey = 'AIzaSyAnotherKey_0987654321zyxwvuABCD';
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => $newKey])
            ->assertStatus(409)
            ->assertJsonPath('code', 'confirm_replace')
            ->assertJsonPath('current.key_hint', '••••WXYZ')
            ->assertJsonPath('current.updated_by', 'Admin Hai');
        $this->assertSame(self::KEY, app(AssistantSettings::class)->apiKey()); // unchanged

        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => $newKey, 'confirm_replace' => true])->assertOk();
        $this->assertSame($newKey, app(AssistantSettings::class)->apiKey());
    }

    public function test_saving_the_same_key_or_only_limits_needs_no_confirmation(): void
    {
        $this->fakeGemini();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])->assertOk();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])->assertOk();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['limit_per_user_daily' => 20])->assertOk();
    }

    public function test_last_update_and_history_are_shown_without_secrets(): void
    {
        $this->fakeGemini();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY, 'model' => 'gemini-2.5-flash-lite'])->assertOk();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['limit_per_user_daily' => 30])->assertOk();
        $this->actingAs($this->admin)->deleteJson('/api/admin/assistant/settings/key')->assertOk();

        $res = $this->actingAs($this->admin)->getJson('/api/assistant/settings')->assertOk();
        $res->assertJsonPath('limits_updated.by.name', $this->admin->name)
            ->assertJsonPath('model_updated.by.name', $this->admin->name);

        $texts = array_column($res->json('history'), 'text');
        $this->assertSame([
            'Xóa khóa Gemini ••••WXYZ',
            'Đổi giới hạn mỗi người/ngày: 50 lượt → 30 lượt',
            'Đổi model AI: gemini-2.5-flash → gemini-2.5-flash-lite',
            'Thêm khóa Gemini ••••WXYZ',
        ], $texts);
        $this->assertSame($this->admin->name, $res->json('history.0.by'));
        $this->assertStringNotContainsString(self::KEY, $res->getContent());
        $this->assertDatabaseMissing('app_setting_changes', ['new_value' => self::KEY]);

        // Employees do not see the history.
        $this->actingAs($this->employee)->getJson('/api/assistant/settings')->assertJsonPath('history', null);
    }

    public function test_malformed_key_is_rejected_before_calling_gemini(): void
    {
        Http::fake();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => 'AIza abc def ghi jkl mno pqr'])
            ->assertStatus(422)->assertJsonValidationErrors('api_key');
        Http::assertNothingSent();
    }

    public function test_only_admins_can_change_the_key(): void
    {
        $this->actingAs($this->employee)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY])->assertForbidden();
        $this->actingAs($this->employee)->deleteJson('/api/admin/assistant/settings/key')->assertForbidden();
    }

    public function test_saved_key_switches_the_assistant_to_live_and_can_be_removed(): void
    {
        $this->fakeGemini();
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => self::KEY]);
        $this->actingAs($this->employee)->getJson('/api/assistant')->assertJsonPath('mode', 'live');

        $this->actingAs($this->admin)->deleteJson('/api/admin/assistant/settings/key')->assertOk()->assertJsonPath('has_key', false);
        $this->actingAs($this->employee)->getJson('/api/assistant')->assertJsonPath('mode', 'demo');
    }

    public function test_board_admin_uploads_and_removes_background_image(): void
    {
        Storage::fake('public');
        $board = Board::create(['name' => 'Ảnh nền', 'owner_id' => $this->admin->id, 'workspace_id' => null]);
        DB::table('board_members')->insert(['board_id' => $board->id, 'user_id' => $this->admin->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()]);

        $path = $this->actingAs($this->admin)
            ->post("/api/boards/{$board->id}/background", ['image' => UploadedFile::fake()->image('bien.jpg', 1600, 900)], ['Accept' => 'application/json'])
            ->assertOk()->json('background_image');

        $this->assertStringStartsWith('/storage/board-backgrounds/', $path);
        Storage::disk('public')->assertExists(substr($path, strlen('/storage/')));

        $this->actingAs($this->admin)->deleteJson("/api/boards/{$board->id}/background")->assertOk()->assertJsonPath('background_image', null);
        Storage::disk('public')->assertMissing(substr($path, strlen('/storage/')));
    }

    public function test_background_rejects_non_images_and_non_admins(): void
    {
        Storage::fake('public');
        $board = Board::create(['name' => 'Ảnh nền', 'owner_id' => $this->admin->id, 'workspace_id' => null]);
        DB::table('board_members')->insert([
            ['board_id' => $board->id, 'user_id' => $this->admin->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $board->id, 'user_id' => $this->employee->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $svg = UploadedFile::fake()->createWithContent('x.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $this->actingAs($this->admin)->post("/api/boards/{$board->id}/background", ['image' => $svg], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $this->actingAs($this->employee)->post("/api/boards/{$board->id}/background", ['image' => UploadedFile::fake()->image('a.png')], ['Accept' => 'application/json'])
            ->assertForbidden();
    }
}
