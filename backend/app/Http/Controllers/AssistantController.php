<?php

namespace App\Http\Controllers;

use App\Models\AssistantMessage;
use App\Services\Assistant\AssistantAttachments;
use App\Services\Assistant\AssistantService;
use App\Services\Assistant\TaskApplyService;
use App\Services\Assistant\TaskExtractionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AssistantController extends Controller
{
    public function __construct(private AssistantService $assistant)
    {
    }

    /** GET /assistant — name, mode (demo|live) and recent conversation. */
    public function index(Request $request)
    {
        return response()->json([
            ...$this->assistant->statusFor($request->user()),
            'messages' => $this->assistant->history($request->user()),
        ]);
    }

    /** POST /assistant/chat */
    public function chat(Request $request)
    {
        $data = $request->validate([
            'message' => 'nullable|string|max:8000|required_without:attachments',
            'attachments' => 'nullable|array|max:' . AssistantAttachments::MAX_FILES,
            'attachments.*' => 'file|max:' . AssistantAttachments::MAX_KB,
        ], [
            'message.required_without' => 'Anh/chị nhập tin nhắn hoặc đính kèm tệp nhé.',
            'attachments.max' => 'Mỗi lần gửi tối đa ' . AssistantAttachments::MAX_FILES . ' tệp.',
            'attachments.*.max' => 'Mỗi tệp tối đa 10MB.',
            'attachments.*.file' => 'Tệp tải lên không hợp lệ.',
        ]);

        return response()->json([
            ...$this->assistant->chat($request->user(), trim((string) ($data['message'] ?? '')), $request->file('attachments', [])),
            'usage' => $this->assistant->statusFor($request->user())['usage'],
        ]);
    }

    /** GET /assistant/files/{message}/{file} (signed link) — an attachment of a chat message. */
    public function file(AssistantMessage $message, string $file, AssistantAttachments $attachments)
    {
        $a = $attachments->find($message, $file);
        abort_unless($a && Storage::disk(AssistantAttachments::disk())->exists($a['path']), 404);
        $inline = in_array($a['kind'], ['image', 'audio', 'pdf'], true);

        return Storage::disk(AssistantAttachments::disk())->response($a['path'], $a['name'], [
            'Content-Type' => $a['mime'],
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ], $inline ? 'inline' : 'attachment');
    }

    /** DELETE /assistant/history */
    public function clear(Request $request)
    {
        $this->assistant->clearHistory($request->user());

        return response()->json(['message' => 'Đã xóa lịch sử trò chuyện.']);
    }

    /** POST /assistant/tasks/preview — extract task drafts without creating anything. */
    public function preview(Request $request, TaskExtractionService $extractor)
    {
        $data = $request->validate(['text' => 'required|string|max:8000']);

        return response()->json($extractor->extract($request->user(), $data['text']));
    }

    /** POST /assistant/tasks/apply — create the tasks confirmed in the preview. */
    public function apply(Request $request, TaskApplyService $applier)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1|max:50',
            'items.*.title' => 'required|string|max:255',
            'items.*.description' => 'nullable|string|max:5000',
            'items.*.board_id' => 'required|integer',
            'items.*.assignee_ids' => 'array|max:20',
            'items.*.assignee_ids.*' => 'integer',
            'items.*.priority' => 'nullable|in:' . implode(',', TaskExtractionService::PRIORITIES),
            'items.*.done' => 'boolean',
            'items.*.due_date' => 'nullable|date_format:Y-m-d',
            'items.*.add_to_board' => 'boolean',
            'items.*.aliases' => 'array|max:20',
            'items.*.aliases.*.alias' => 'required|string|max:120',
            'items.*.aliases.*.user_id' => 'required|integer',
        ]);

        $results = $applier->apply($request->user(), $data['items']);
        $created = count(array_filter($results, fn ($r) => $r['ok']));

        return response()->json([
            'message' => "Đã tạo {$created}/" . count($results) . ' công việc.',
            'results' => $results,
        ]);
    }
}
