<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

class AssistantAttachmentsTest extends TestCase
{
    use RefreshDatabase;

    private User $me;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->me = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
    }

    private function live(string $answer = 'Câu trả lời từ AI'): void
    {
        config(['assistant.mode' => 'live', 'assistant.gemini.api_key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*:generateContent' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => $answer]]]]],
            'usageMetadata' => ['totalTokenCount' => 50],
        ])]);
    }

    private function png(): UploadedFile
    {
        // 1x1 transparent PNG
        return UploadedFile::fake()->createWithContent('anh.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        ));
    }

    private function wav(): UploadedFile
    {
        $pcm = str_repeat("\0\0", 1600);
        $header = 'RIFF' . pack('V', 36 + strlen($pcm)) . 'WAVEfmt ' . pack('VvvVVvv', 16, 1, 1, 16000, 32000, 2, 16) . 'data' . pack('V', strlen($pcm));

        return UploadedFile::fake()->createWithContent('ghi-am.wav', $header . $pcm);
    }

    private function docx(string $text): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'docx');
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::OVERWRITE);
        $paragraphs = implode('', array_map(fn ($l) => '<w:p><w:r><w:t>' . htmlspecialchars($l) . '</w:t></w:r></w:p>', explode("\n", $text)));
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
        $zip->addFromString('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' . $paragraphs . '</w:body></w:document>');
        $zip->close();

        return UploadedFile::fake()->createWithContent('giao-viec.docx', file_get_contents($path));
    }

    private function send(array $data)
    {
        return $this->actingAs($this->me)->post('/api/assistant/chat', $data, ['Accept' => 'application/json']);
    }

    public function test_image_is_stored_and_sent_to_gemini(): void
    {
        $this->live('Ảnh có một biểu đồ.');

        $res = $this->send(['message' => 'Ảnh này là gì?', 'attachments' => [$this->png()]])->assertOk();

        $res->assertJsonPath('reply.content', 'Ảnh có một biểu đồ.')
            ->assertJsonPath('user_message.attachments.0.name', 'anh.png')
            ->assertJsonPath('user_message.attachments.0.kind', 'image');
        $this->assertArrayNotHasKey('path', $res->json('user_message.attachments.0'));
        Http::assertSent(fn (HttpRequest $r) => ($r['contents'][0]['parts'][1]['inlineData']['mimeType'] ?? null) === 'image/png');

        // The signed link works without the auth header; a tampered or unsigned link does not.
        $url = $res->json('user_message.attachments.0.url');
        $this->assertStringStartsWith('/api/assistant/files/', $url);
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->get(preg_replace('/signature=\w+/', 'signature=abc', $url))->assertForbidden();
        $this->get(strtok($url, '?'))->assertForbidden();
    }

    public function test_voice_is_transcribed_into_the_message(): void
    {
        $this->live('Tôi có việc gì hôm nay?');

        $res = $this->send(['attachments' => [$this->wav()]])->assertOk();

        $res->assertJsonPath('user_message.content', 'Tôi có việc gì hôm nay?')
            ->assertJsonPath('user_message.attachments.0.kind', 'audio');
        Http::assertSent(fn (HttpRequest $r) => ($r['contents'][0]['parts'][1]['inlineData']['mimeType'] ?? null) === 'audio/wav');
    }

    public function test_word_file_with_an_assignment_list_becomes_a_task_preview_without_ai(): void
    {
        $res = $this->send([
            'message' => 'Tạo việc từ file này',
            'attachments' => [$this->docx("1. Làm báo cáo tháng\n2. Gửi hợp đồng cho khách")],
        ])->assertOk();

        $res->assertJsonPath('reply.meta.type', 'task_preview');
        $titles = array_column($res->json('reply.meta.preview.tasks'), 'title');
        $this->assertContains('Làm báo cáo tháng', $titles);
    }

    public function test_images_without_a_key_explain_that_gemini_is_needed(): void
    {
        $res = $this->send(['attachments' => [$this->png()]])->assertOk();

        $this->assertStringContainsString('cần khóa Gemini', $res->json('reply.content'));
    }

    public function test_unsupported_and_too_many_files_are_rejected(): void
    {
        $this->send(['attachments' => [UploadedFile::fake()->createWithContent('virus.php', '<?php echo 1;')]])
            ->assertStatus(422);
        $this->send(['attachments' => [UploadedFile::fake()->createWithContent('anh.png', '<?php echo 1;')]])
            ->assertStatus(422);
        $this->send(['attachments' => array_map(fn () => $this->png(), range(1, 6))])
            ->assertStatus(422);
        $this->send([])->assertStatus(422);
        Storage::disk('local')->assertDirectoryEmpty('assistant');
    }

    public function test_clearing_history_deletes_the_files(): void
    {
        $this->live();
        $this->send(['message' => 'Xem ảnh', 'attachments' => [$this->png()]])->assertOk();
        $this->assertNotEmpty(Storage::disk('local')->allFiles("assistant/{$this->me->id}"));

        $this->actingAs($this->me)->deleteJson('/api/assistant/history')->assertOk();

        $this->assertEmpty(Storage::disk('local')->allFiles("assistant/{$this->me->id}"));
    }
}
