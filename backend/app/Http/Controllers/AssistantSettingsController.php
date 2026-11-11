<?php

namespace App\Http\Controllers;

use App\Services\Assistant\AssistantSettings;
use App\Services\Assistant\AssistantUsage;
use App\Services\Assistant\GeminiClient;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class AssistantSettingsController extends Controller
{
    /** Shown when Google cannot be asked for the key's model list. */
    private const COMMON_MODELS = [
        ['id' => 'gemini-2.5-flash', 'name' => 'Gemini 2.5 Flash', 'description' => 'Nhanh, cân bằng giữa chất lượng và số lượt. Khuyên dùng.'],
        ['id' => 'gemini-2.5-flash-lite', 'name' => 'Gemini 2.5 Flash-Lite', 'description' => 'Nhẹ và rẻ nhất, thường được nhiều lượt miễn phí hơn.'],
        ['id' => 'gemini-2.5-pro', 'name' => 'Gemini 2.5 Pro', 'description' => 'Thông minh nhất, nhưng ít lượt miễn phí và chậm hơn.'],
        ['id' => 'gemini-3.5-flash', 'name' => 'Gemini 3.5 Flash', 'description' => 'Thế hệ mới (nếu khóa của anh/chị được dùng).'],
        ['id' => 'gemini-3.5-flash-lite', 'name' => 'Gemini 3.5 Flash-Lite', 'description' => 'Thế hệ mới, bản nhẹ (nếu khóa của anh/chị được dùng).'],
    ];

    public function __construct(private AssistantSettings $settings, private AssistantUsage $usage)
    {
    }

    /** GET /assistant/settings — status only (never the key). */
    public function show(Request $request)
    {
        return response()->json($this->payload($request));
    }

    /** GET /admin/assistant/models — models the saved key can use (live from Google, or a built-in list). */
    public function models(GeminiClient $gemini)
    {
        $live = $gemini->listModels();

        return response()->json([
            'source' => $live ? 'google' : 'builtin',
            'models' => $live ?: self::COMMON_MODELS,
        ]);
    }

    private function payload(Request $request, array $extra = []): array
    {
        $admin = $this->isAdmin($request);

        return [
            ...$this->settings->publicStatus(),
            ...$this->usage->statusFor($request->user()),
            'company_today' => $admin ? $this->usage->companyToday() : null,
            'last_days' => $admin ? $this->usage->lastDays(7) : null,
            'limits_updated' => $this->usage->limitsUpdated(),
            'history' => $admin ? AssistantSettings::history() : null,
            'can_manage' => $admin,
            ...$extra,
        ];
    }

    /** PUT /admin/assistant/settings — save (after verifying) the company Gemini key and/or model. */
    public function update(Request $request, GeminiClient $gemini)
    {
        $data = $request->validate([
            'api_key' => ['nullable', 'string', 'min:20', 'max:300', 'regex:/^[A-Za-z0-9_.\-]+$/'],
            'model' => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9][a-z0-9.\-]*$/'],
            'limit_per_user_daily' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'limit_company_daily' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'confirm_replace' => ['nullable', 'boolean'],
        ], [
            'api_key.min' => 'Khóa API quá ngắn, có thể anh/chị chưa sao chép đủ.',
            'api_key.regex' => 'Khóa API chỉ gồm chữ, số, dấu chấm và dấu gạch. Kiểm tra lại có lỡ sao chép thêm khoảng trắng hoặc ký tự lạ không.',
            'model.regex' => 'Tên model không hợp lệ (ví dụ: gemini-2.5-flash).',
        ]);

        $key = isset($data['api_key']) ? trim($data['api_key']) : null;
        $model = isset($data['model']) ? trim($data['model']) : null;

        $limitsOnly = $key === null && $model === null
            && ($request->has('limit_per_user_daily') || $request->has('limit_company_daily'));
        if ($limitsOnly) {
            $this->usage->saveLimits($data['limit_per_user_daily'] ?? null, $data['limit_company_daily'] ?? null, $request->user()->id);

            return response()->json($this->payload($request, ['message' => 'Đã lưu giới hạn lượt nhắn.']));
        }

        if ($key === null && $model === null) {
            throw ValidationException::withMessages(['api_key' => ['Vui lòng nhập khóa API.']]);
        }

        // Replacing a key that is already working must be confirmed explicitly, so two admins
        // cannot silently overwrite each other's key.
        $currentKey = $this->settings->apiKey();
        if ($key !== null && $currentKey !== null && $currentKey !== $key && !$request->boolean('confirm_replace')) {
            $updated = AssistantSettings::lastUpdate(AssistantSettings::KEY_SETTING);

            return response()->json([
                'code' => 'confirm_replace',
                'message' => 'Đang có một khóa Gemini hoạt động. Xác nhận nếu muốn thay bằng khóa mới.',
                'current' => [
                    'key_hint' => AssistantSettings::hint($currentKey),
                    'source' => $this->settings->keySource(),
                    'updated_by' => $updated['by']['name'] ?? null,
                    'updated_at' => $updated['at'] ?? null,
                ],
            ], 409);
        }

        // Verify the combination that will actually be used before saving it.
        $keyToTest = $key ?? $this->settings->apiKey();
        $endpoint = null;
        if ($keyToTest !== null) {
            try {
                $endpoint = $gemini->verify($keyToTest, $model ?? $this->settings->model());
            } catch (RuntimeException $e) {
                throw ValidationException::withMessages([$key !== null ? 'api_key' : 'model' => [$e->getMessage()]]);
            }
        }

        $this->settings->save($key, $model, $request->user()->id, $endpoint);
        $this->usage->saveLimits($data['limit_per_user_daily'] ?? null, $data['limit_company_daily'] ?? null, $request->user()->id);

        return response()->json($this->payload($request, ['message' => 'Đã lưu và kết nối Gemini thành công.']));
    }

    /** DELETE /admin/assistant/settings/key */
    public function destroyKey(Request $request)
    {
        $this->settings->removeKey($request->user()->id);

        return response()->json($this->payload($request, ['message' => 'Đã xóa khóa API. Trợ lý chuyển về chế độ thử nghiệm.']));
    }

    private function isAdmin(Request $request): bool
    {
        return in_array($request->user()->system_role, ['system_admin', 'admin'], true);
    }
}
