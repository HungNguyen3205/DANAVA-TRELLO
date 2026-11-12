<?php

namespace App\Services\Assistant;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Minimal Gemini generateContent client (REST).
 *
 * Works with both kinds of Google keys:
 *  - "gemini": Gemini API keys from Google AI Studio (usually "AIza..."),
 *    endpoint generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *  - "vertex": Vertex AI express mode keys from Google Cloud (usually "AQ...."),
 *    endpoint aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent
 *
 * The key stays server-side and is sent in the x-goog-api-key header, never in URLs or logs.
 */
class GeminiClient
{
    private const VERTEX_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google';

    public function __construct(private AssistantSettings $settings, private AssistantUsage $usage)
    {
    }

    public function isConfigured(): bool
    {
        return $this->settings->isLive();
    }

    /**
     * Check a key/model pair with a tiny request before saving it. Tries the endpoint that
     * matches the key's format first, then the other one, and returns the one that works.
     *
     * @return string 'gemini' | 'vertex'
     */
    public function verify(string $apiKey, string $model): string
    {
        $first = AssistantSettings::guessEndpoint($apiKey);
        $order = [$first, $first === 'gemini' ? 'vertex' : 'gemini'];
        $firstError = null;

        foreach ($order as $endpoint) {
            try {
                // Any successful response proves the key and model work, even if the text is empty.
                $this->call('Trả lời đúng một từ: OK', [['role' => 'user', 'text' => 'Kiểm tra kết nối']], [
                    'temperature' => 0,
                    'maxOutputTokens' => 256,
                ], $apiKey, $model, $endpoint, allowEmpty: true);

                return $endpoint;
            } catch (GeminiAuthException $e) {
                // Wrong endpoint for this kind of key: try the other one.
                $firstError ??= $e;
            }
        }

        throw $firstError;
    }

    /**
     * @param array<int, array{role: string, text: string}> $messages role = user | model
     */
    public function generateText(string $systemPrompt, array $messages, float $temperature = 0.4): string
    {
        return $this->call($systemPrompt, $messages, [
            'temperature' => $temperature,
            'maxOutputTokens' => 2048,
        ]);
    }

    /**
     * Read files (voice recordings, screenshots, PDFs) and return their text, e.g. a transcript.
     *
     * @param array<int, array> $parts inline data parts
     */
    public function readFiles(string $instruction, array $parts): string
    {
        return $this->call($instruction, [['role' => 'user', 'text' => 'Thực hiện theo hướng dẫn với các tệp sau.', 'parts' => $parts]], [
            'temperature' => 0,
            'maxOutputTokens' => 4096,
        ]);
    }

    private function hasInline(array $messages): bool
    {
        foreach ($messages as $m) {
            if (!empty($m['parts'])) {
                return true;
            }
        }

        return false;
    }

    /** Ask for JSON matching $schema (JSON Schema) and return the decoded value. */
    public function generateJson(string $systemPrompt, string $userText, array $schema): array
    {
        $endpoint = $this->settings->endpoint();
        $config = [
            'temperature' => 0.1,
            'maxOutputTokens' => 8192,
            'responseMimeType' => 'application/json',
        ];
        // Gemini API takes JSON Schema directly; Vertex expects its OpenAPI-style schema.
        if ($endpoint === 'vertex') {
            $config['responseSchema'] = self::toOpenApiSchema($schema);
        } else {
            $config['responseJsonSchema'] = $schema;
        }

        $raw = $this->call($systemPrompt, [['role' => 'user', 'text' => $userText]], $config);

        // Tolerate a fenced block in case the model wraps the JSON.
        $raw = preg_replace('/^```(?:json)?\s*|\s*```$/', '', trim($raw));
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Gemini trả về dữ liệu không đúng định dạng JSON.');
        }

        return $decoded;
    }

    /**
     * Models the saved key can use for text generation, asked from Google.
     * Returns null when Google does not answer (the UI then shows a built-in list).
     *
     * @return array<int, array{id: string, name: string, description: ?string}>|null
     */
    public function listModels(): ?array
    {
        $key = $this->settings->apiKey();
        if (!$key) {
            return null;
        }

        $vertex = $this->settings->endpoint() === 'vertex';
        $url = $vertex
            ? 'https://aiplatform.googleapis.com/v1beta1/publishers/google/models'
            : rtrim(config('assistant.gemini.base_url'), '/') . '/models';

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $key])->acceptJson()->timeout(15)
                ->get($url, ['pageSize' => 200]);
        } catch (\Throwable) {
            return null;
        }
        if ($response->failed()) {
            return null;
        }

        $items = $vertex ? (array) $response->json('publisherModels') : (array) $response->json('models');
        $models = [];
        foreach ($items as $m) {
            $id = preg_replace('#^.*/models/|^models/#', '', (string) ($m['name'] ?? ''));
            $methods = $m['supportedGenerationMethods'] ?? ['generateContent'];
            if (!str_starts_with($id, 'gemini') || !in_array('generateContent', $methods, true)) {
                continue;
            }
            // Text chat only: skip speech, image, embedding and live/audio variants.
            if (preg_match('/tts|image|embedding|live|audio|native|computer-use|robotics/i', $id)) {
                continue;
            }
            $models[$id] = [
                'id' => $id,
                'name' => (string) ($m['displayName'] ?? $id),
                'description' => isset($m['description']) ? mb_substr((string) $m['description'], 0, 160) : null,
            ];
        }
        ksort($models);

        return array_values($models);
    }

    /** JSON Schema subset -> Vertex OpenAPI schema (uppercase types, nullable instead of type unions). */
    public static function toOpenApiSchema(array $schema): array
    {
        $out = [];
        foreach ($schema as $key => $value) {
            if ($key === 'type') {
                $types = (array) $value;
                $nullable = in_array('null', $types, true);
                $main = array_values(array_diff($types, ['null']))[0] ?? 'string';
                $out['type'] = strtoupper($main);
                if ($nullable) {
                    $out['nullable'] = true;
                }
            } elseif ($key === 'properties' && is_array($value)) {
                $out['properties'] = array_map(fn ($p) => self::toOpenApiSchema($p), $value);
            } elseif ($key === 'items' && is_array($value)) {
                $out['items'] = self::toOpenApiSchema($value);
            } else {
                $out[$key] = $value;
            }
        }

        return $out;
    }

    private function call(
        string $systemPrompt,
        array $messages,
        array $generationConfig,
        ?string $apiKey = null,
        ?string $model = null,
        ?string $endpoint = null,
        bool $allowEmpty = false,
    ): string {
        // Health of the company key is tracked only for real calls with the saved key (not key checks).
        $savedKey = $apiKey === null;
        $model ??= $this->settings->model();
        $apiKey ??= $this->settings->apiKey();
        $endpoint ??= $this->settings->endpoint();
        $url = $endpoint === 'vertex'
            ? self::VERTEX_BASE . '/models/' . rawurlencode($model) . ':generateContent'
            : rtrim(config('assistant.gemini.base_url'), '/') . '/models/' . rawurlencode($model) . ':generateContent';

        $payload = [
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'contents' => array_map(fn ($m) => [
                'role' => $m['role'] === 'model' ? 'model' : 'user',
                // Optional inline files (images, PDFs, audio) go after the text of that message.
                'parts' => [...($m['text'] !== '' ? [['text' => $m['text']]] : []), ...($m['parts'] ?? [])],
            ], $messages),
            'generationConfig' => $generationConfig,
        ];

        // Thinking models (Gemini 2.5 / 3.x) reason before answering, which can take longer than
        // the timeout. Office questions do not need deep reasoning, so keep it light.
        $thinking = self::lightThinking($model);
        if ($thinking && !isset($payload['generationConfig']['thinkingConfig'])) {
            $payload['generationConfig']['thinkingConfig'] = $thinking;
        }

        $started = microtime(true);
        // Files take longer to read.
        $timeout = (int) config('assistant.gemini.timeout', 45) * ($this->hasInline($messages) ? 3 : 1);
        $send = fn (array $body) => Http::withHeaders(['x-goog-api-key' => (string) $apiKey])
            ->acceptJson()
            ->timeout($timeout)
            // Google briefly overloaded (500/503) or the connection could not be opened: try once more.
            ->retry(2, 1500, fn (\Throwable $e) => $e instanceof RequestException
                ? in_array($e->response->status(), [500, 503], true)
                : $e instanceof ConnectionException && !self::isTimeout($e), throw: false)
            ->post($url, $body);
        try {
            $response = $send($payload);
            // A model that does not accept this thinking setting: ask again with Google's default.
            if ($response->status() === 400 && isset($payload['generationConfig']['thinkingConfig'])
                && str_contains(mb_strtolower((string) $response->json('error.message')), 'thinking')) {
                unset($payload['generationConfig']['thinkingConfig']);
                $response = $send($payload);
            }
        } catch (ConnectionException $e) {
            Log::info('assistant.gemini', [
                'endpoint' => $endpoint,
                'model' => $model,
                'status' => null,
                'ms' => (int) ((microtime(true) - $started) * 1000),
                'error' => ['message' => mb_substr($e->getMessage(), 0, 200)],
            ]);
            // Plain Vietnamese instead of the raw cURL text (which also carries the request URL).
            throw new RuntimeException(self::isTimeout($e)
                ? "Google không phản hồi sau {$timeout} giây: model \"{$model}\" đang chậm hoặc quá tải. Anh/chị thử lại sau ít phút, hoặc chọn model khác (vd: gemini-2.5-flash)."
                : 'Máy chủ không kết nối được tới Google (lỗi mạng). Vui lòng thử lại sau ít phút.');
        }

        // Log timing and token usage only, never prompts, answers or the key.
        Log::info('assistant.gemini', [
            'endpoint' => $endpoint,
            'model' => $model,
            'status' => $response->status(),
            'ms' => (int) ((microtime(true) - $started) * 1000),
            'tokens' => $response->json('usageMetadata.totalTokenCount'),
            // Google's error code/reason only (never the key or the prompt).
            'error' => $response->failed() ? array_filter([
                'status' => $response->json('error.status'),
                'reason' => self::errorReason($response),
                'message' => mb_substr((string) $response->json('error.message'), 0, 300),
            ]) : null,
        ]);

        if ($response->failed()) {
            if ($savedKey && ($problem = self::keyProblem($response))) {
                $this->settings->markKeyProblem(...$problem);
            }
            $this->fail($response, $model);
        }
        if ($savedKey) {
            $this->settings->markKeyWorking();
        }

        // Count real assistant usage (not the key check) for the daily limits.
        if (!$allowEmpty) {
            $this->usage->record(Auth::id(), (int) $response->json('usageMetadata.totalTokenCount', 0));
        }

        $parts = $response->json('candidates.0.content.parts') ?? [];
        $text = trim(implode('', array_map(fn ($p) => $p['text'] ?? '', $parts)));
        if ($text === '' && !$allowEmpty) {
            $reason = $response->json('candidates.0.finishReason') ?? $response->json('promptFeedback.blockReason') ?? 'không rõ';
            throw new RuntimeException('Gemini không trả lời (lý do: ' . $reason . ').');
        }

        return $text;
    }

    /**
     * Translate Google errors into plain Vietnamese, including Google's own reason and the
     * link to enable the API when it provides one. Key / permission problems raise
     * GeminiAuthException so verify() can also try the other endpoint.
     */
    private function fail(Response $response, string $model): never
    {
        $raw = (string) ($response->json('error.message') ?? '');
        $status = $response->status();
        $reason = self::errorReason($response);
        $activation = self::activationUrl($response);
        $lower = mb_strtolower($raw);

        if (str_contains($raw, 'API key not valid') || $reason === 'API_KEY_INVALID' || $status === 401
            || str_contains($raw, 'API keys are not supported')) {
            throw new GeminiAuthException('Khóa API không đúng hoặc không dùng được cho Gemini. Anh/chị kiểm tra lại đã sao chép đủ khóa chưa.');
        }

        if ($status === 403) {
            $message = match (true) {
                $reason === 'SERVICE_DISABLED' || str_contains($lower, 'has not been used') || str_contains($lower, 'is disabled') =>
                    'Dự án Google Cloud của khóa này chưa bật API cần thiết. Mở link sau, bấm "Enable" (Bật), đợi 1–2 phút rồi thử lại: '
                    . ($activation ?? 'https://console.cloud.google.com/apis/library/aiplatform.googleapis.com'),
                $reason === 'API_KEY_SERVICE_BLOCKED' || str_contains($lower, 'are blocked') =>
                    'Khóa API đang bị giới hạn không cho dùng Gemini. Vào Google Cloud → APIs & Services → Credentials → chọn khóa → mục "API restrictions", '
                    . 'thêm "Vertex AI API" (với khóa AQ.) hoặc "Generative Language API" (với khóa AIza), rồi lưu.',
                str_contains($lower, 'billing') =>
                    'Dự án Google Cloud chưa bật thanh toán (billing) nên chưa dùng được model này. Bật billing cho dự án hoặc dùng khóa từ Google AI Studio (gói miễn phí).',
                str_contains($lower, 'model') || str_contains($lower, 'publisher') =>
                    "Khóa này không có quyền dùng model \"{$model}\". Thử để trống phần Nâng cao (model mặc định) hoặc chọn model khác.",
                default => 'Google từ chối quyền truy cập' . ($raw !== '' ? ': ' . mb_substr($raw, 0, 220) : '.'),
            };
            throw new GeminiAuthException($message);
        }

        throw new RuntimeException(match (true) {
            $status === 404 => "Không tìm thấy model \"{$model}\" hoặc khóa này không dùng được model đó. Thử model khác trong phần Nâng cao.",
            $status === 429 && self::isDailyQuota($response) => 'Khóa Gemini đã hết lượt dùng trong ngày (quota). Cần thay khóa khác hoặc đợi Google cấp lại lượt vào ngày mai.',
            $status === 429 => 'Đã hết lượt dùng Gemini tạm thời (quota). Vui lòng thử lại sau ít phút.',
            $status === 503 => "Model \"{$model}\" của Google đang quá tải. Thử lại sau ít phút hoặc chọn model khác (vd: gemini-2.5-flash).",
            default => 'Gemini lỗi: ' . mb_substr($raw ?: 'HTTP ' . $status, 0, 200),
        });
    }

    /**
     * Whether a failure means the key itself can no longer be used (so admins may replace it).
     * Per-minute limits and overloads are temporary and do not count.
     *
     * @return array{0: 'exhausted'|'invalid', 1: string}|null
     */
    private static function keyProblem(Response $response): ?array
    {
        $raw = (string) ($response->json('error.message') ?? '');
        $reason = self::errorReason($response);
        $status = $response->status();

        if ($status === 429) {
            return self::isDailyQuota($response) ? ['exhausted', 'Khóa đã hết lượt dùng trong ngày (quota).'] : null;
        }
        if ($status === 401 || $reason === 'API_KEY_INVALID' || str_contains($raw, 'API key not valid') || str_contains(mb_strtolower($raw), 'expired')) {
            return ['invalid', 'Google báo khóa không còn hợp lệ (đã bị xóa, hết hạn hoặc sai).'];
        }
        if ($status === 403 && in_array($reason, ['SERVICE_DISABLED', 'API_KEY_SERVICE_BLOCKED', 'BILLING_DISABLED'], true)) {
            return ['invalid', 'Google từ chối khóa (API bị tắt, khóa bị giới hạn hoặc chưa bật thanh toán).'];
        }

        return null;
    }

    /** 429 caused by a per-day quota (free tier used up), not a per-minute burst. */
    private static function isDailyQuota(Response $response): bool
    {
        foreach ((array) $response->json('error.details') as $detail) {
            foreach ((array) ($detail['violations'] ?? []) as $v) {
                if (is_array($v) && preg_match('/PerDay/i', (string) ($v['quotaId'] ?? ''))) {
                    return true;
                }
            }
        }
        $lower = mb_strtolower((string) $response->json('error.message'));

        return str_contains($lower, 'per day') || str_contains($lower, 'daily') || str_contains($lower, 'limit: 0');
    }

    /** Least thinking each model family accepts: level "low" on Gemini 3.x, budget 0 on 2.5 Flash / Flash-Lite. */
    public static function lightThinking(string $model): ?array
    {
        return match (true) {
            (bool) preg_match('/^gemini-3/', $model) => ['thinkingLevel' => 'low'],
            (bool) preg_match('/^gemini-2\.5-flash/', $model) => ['thinkingBudget' => 0],
            default => null, // 2.5 Pro cannot turn thinking off; older models do not think.
        };
    }

    private static function isTimeout(ConnectionException $e): bool
    {
        return str_contains($e->getMessage(), 'Operation timed out');
    }

    private static function errorReason(Response $response): ?string
    {
        foreach ((array) $response->json('error.details') as $detail) {
            if (is_array($detail) && !empty($detail['reason'])) {
                return (string) $detail['reason'];
            }
        }

        return null;
    }

    /** Google includes a console link to enable a disabled API in the error details. */
    private static function activationUrl(Response $response): ?string
    {
        foreach ((array) $response->json('error.details') as $detail) {
            $url = is_array($detail) ? ($detail['metadata']['activationUrl'] ?? null) : null;
            if (is_string($url) && str_starts_with($url, 'https://console.developers.google.com/')
                || is_string($url) && str_starts_with($url, 'https://console.cloud.google.com/')) {
                return $url;
            }
        }

        return null;
    }
}
