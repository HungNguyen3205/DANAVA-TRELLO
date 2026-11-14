<?php

namespace App\Http\Controllers;

use App\Models\AssistantActionLog;
use App\Services\Assistant\AssistantActions;
use Illuminate\Http\Request;

class AssistantActionLogController extends Controller
{
    /** GET /admin/assistant/action-logs — what the assistant did (or refused) for each person. */
    public function index(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'nullable|integer',
            'status' => 'nullable|in:success,failed,denied,needs_confirmation',
            'include_reads' => 'nullable|boolean',
            'q' => 'nullable|string|max:100',
        ]);

        $logs = AssistantActionLog::query()
            ->with('user:id,name,username')
            ->when($data['user_id'] ?? null, fn ($q, $id) => $q->where('user_id', $id))
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when(!$request->boolean('include_reads'), fn ($q) => $q->whereNotIn('tool', AssistantActions::READ_TOOLS))
            ->when($data['q'] ?? null, fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('target_label', 'like', "%{$term}%")
                ->orWhere('message', 'like', "%{$term}%")
                ->orWhere('request_text', 'like', "%{$term}%")))
            ->latest('id')
            ->paginate(30);

        return response()->json([
            'data' => $logs->getCollection()->map(fn (AssistantActionLog $l) => [
                'id' => $l->id,
                'user' => $l->user ? ['id' => $l->user->id, 'name' => $l->user->name, 'username' => $l->user->username] : null,
                'tool' => $l->tool,
                'status' => $l->status,
                'target_type' => $l->target_type,
                'target_id' => $l->target_id,
                'target_label' => $l->target_label,
                'arguments' => $l->arguments,
                'changes' => $l->changes,
                'message' => $l->message,
                'request_text' => $l->request_text,
                'created_at' => $l->created_at?->toIso8601String(),
            ]),
            'current_page' => $logs->currentPage(),
            'last_page' => $logs->lastPage(),
            'total' => $logs->total(),
        ]);
    }
}
