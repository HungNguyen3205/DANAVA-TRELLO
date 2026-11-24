<?php

namespace App\Http\Controllers;

use App\Services\TrelloClient;
use App\Services\TrelloImportService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use JsonException;

class TrelloImportController extends Controller
{
    public function preview(Request $request, TrelloClient $client, TrelloImportService $imports)
    {
        $request->validate([
            'source' => 'required|in:api,json',
            'file' => 'required_if:source,json|file|max:20480',
            'board_url' => 'required_if:source,api|string|max:500',
            'api_key' => 'required_if:source,api|string|max:512|regex:/^[A-Za-z0-9_-]+$/',
            'api_token' => 'required_if:source,api|string|max:512|regex:/^[A-Za-z0-9_-]+$/',
        ]);
        $fromApi = $request->input('source') === 'api';
        if ($fromApi) {
            $data = $client->readBoard($request->string('board_url')->toString(), $request->input('api_key'), $request->input('api_token'));
        } else {
            try {
                $data = json_decode($request->file('file')->getContent(), true, 128, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw ValidationException::withMessages(['file' => 'Tệp JSON không hợp lệ. Hãy chọn bản xuất bảng từ Trello.']);
            }
        }
        if (! is_array($data)) {
            throw ValidationException::withMessages(['file' => 'Tệp phải chứa một bảng Trello.']);
        }

        return response()->json($imports->preview($data, $request->user(), $fromApi));
    }

    public function confirm(Request $request, TrelloImportService $imports)
    {
        $input = $request->validate([
            'preview_token' => 'required|uuid', 'member_map' => 'present|array',
            'member_map.*' => 'nullable|integer', 'project_id' => 'nullable|integer|exists:projects,id',
        ]);

        return response()->json($imports->confirm(
            $request->user(), $input['preview_token'], $input['member_map'], $input['project_id'] ?? null,
        ));
    }

    public function snapshot(Request $request, string $token, TrelloImportService $imports)
    {
        $snapshot = $imports->snapshot($request->user(), $token);

        return response()->streamDownload(function () use ($snapshot) {
            echo json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
        }, 'trello-source.json', ['Content-Type' => 'application/json']);
    }
}
