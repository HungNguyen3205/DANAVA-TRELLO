<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Assistant\AssistantUsage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AssistantUsageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $employee;

    protected function setUp(): void
    {
        parent::setUp();
        config(['assistant.mode' => 'live', 'assistant.gemini.api_key' => 'test-key']);
        $this->admin = User::factory()->create(['system_role' => 'system_admin', 'account_status' => 'active']);
        $this->employee = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        Http::fake(['generativelanguage.googleapis.com/*:generateContent' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => 'Câu trả lời từ AI']]]]],
            'usageMetadata' => ['totalTokenCount' => 120],
        ])]);
    }

    private function chat(User $user, string $message = 'Hôm nay tôi có việc gì?'): string
    {
        return $this->actingAs($user)->postJson('/api/assistant/chat', ['message' => $message])->assertOk()->json('reply.content');
    }

    public function test_each_ai_answer_is_counted_with_tokens(): void
    {
        $this->chat($this->employee);
        $this->chat($this->employee);

        $this->actingAs($this->employee)->getJson('/api/assistant')
            ->assertJsonPath('usage.me_today.requests', 2)
            ->assertJsonPath('usage.me_today.tokens', 240)
            ->assertJsonPath('usage.limits.per_user_daily', AssistantUsage::DEFAULT_PER_USER)
            ->assertJsonPath('usage.me_remaining', AssistantUsage::DEFAULT_PER_USER - 2);
    }

    public function test_per_user_limit_falls_back_to_answers_without_ai(): void
    {
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['limit_per_user_daily' => 1])
            ->assertOk()->assertJsonPath('limits.per_user_daily', 1);

        $this->assertSame('Câu trả lời từ AI', $this->chat($this->employee));
        $second = $this->chat($this->employee);

        $this->assertStringContainsString('dùng hết 1 lượt', $second);
        $this->assertStringNotContainsString('Câu trả lời từ AI', $second);
        Http::assertSentCount(1); // the second message did not call Gemini
        // Other people still have their own quota.
        $this->assertSame('Câu trả lời từ AI', $this->chat($this->admin));
    }

    public function test_company_limit_applies_to_everyone(): void
    {
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['limit_per_user_daily' => 0, 'limit_company_daily' => 1]);

        $this->chat($this->employee);
        $this->assertStringContainsString('công ty đã dùng hết 1 lượt', $this->chat($this->admin));
    }

    public function test_zero_means_unlimited(): void
    {
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['limit_per_user_daily' => 0]);
        for ($i = 0; $i < 3; $i++) {
            $this->assertSame('Câu trả lời từ AI', $this->chat($this->employee));
        }
        $this->actingAs($this->employee)->getJson('/api/assistant')->assertJsonPath('usage.me_remaining', null);
    }

    public function test_only_admin_sees_company_usage_and_changes_limits(): void
    {
        $this->chat($this->employee);

        $this->actingAs($this->employee)->getJson('/api/assistant/settings')
            ->assertJsonPath('company_today', null)
            ->assertJsonPath('me_today.requests', 1);
        $this->actingAs($this->employee)->putJson('/api/admin/assistant/settings', ['limit_per_user_daily' => 999])->assertForbidden();

        $this->actingAs($this->admin)->getJson('/api/assistant/settings')
            ->assertJsonPath('company_today.requests', 1)
            ->assertJsonCount(7, 'last_days');
    }

    public function test_key_check_is_not_counted(): void
    {
        $this->actingAs($this->admin)->putJson('/api/admin/assistant/settings', ['api_key' => 'AIzaSyTestKey_1234567890abcdefWXYZ', 'confirm_replace' => true])->assertOk();

        $this->actingAs($this->admin)->getJson('/api/assistant/settings')->assertJsonPath('me_today.requests', 0);
    }

    public function test_models_are_listed_from_google_and_filtered_to_text_models(): void
    {
        Http::fake(['generativelanguage.googleapis.com/v1beta/models*' => Http::response(['models' => [
            ['name' => 'models/gemini-2.5-flash', 'displayName' => 'Gemini 2.5 Flash', 'supportedGenerationMethods' => ['generateContent']],
            ['name' => 'models/gemini-2.5-flash-preview-tts', 'displayName' => 'TTS', 'supportedGenerationMethods' => ['generateContent']],
            ['name' => 'models/text-embedding-004', 'displayName' => 'Embedding', 'supportedGenerationMethods' => ['embedContent']],
            ['name' => 'models/gemini-2.5-pro', 'displayName' => 'Gemini 2.5 Pro', 'supportedGenerationMethods' => ['generateContent', 'countTokens']],
        ]])]);

        $this->actingAs($this->admin)->getJson('/api/admin/assistant/models')
            ->assertOk()
            ->assertJsonPath('source', 'google')
            ->assertJsonPath('models.0.id', 'gemini-2.5-flash')
            ->assertJsonPath('models.1.id', 'gemini-2.5-pro')
            ->assertJsonCount(2, 'models');
    }

    public function test_models_fall_back_to_builtin_list(): void
    {
        Http::fake(['*' => Http::response(['error' => ['message' => 'nope']], 403)]);

        $this->actingAs($this->admin)->getJson('/api/admin/assistant/models')
            ->assertOk()->assertJsonPath('source', 'builtin')->assertJsonPath('models.0.id', 'gemini-2.5-flash');
        $this->actingAs($this->employee)->getJson('/api/admin/assistant/models')->assertForbidden();
    }
}
