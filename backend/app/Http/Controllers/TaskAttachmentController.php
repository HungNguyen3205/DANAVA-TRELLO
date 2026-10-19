<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

class TaskAttachmentController extends Controller
{
    public function store(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        $request->validate([
            'file' => 'required|file|mimes:jpeg,png,jpg,gif,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,zip,rar,7z|max:10240' // max 10MB
        ]);

        $file = $request->file('file');
        $path = $file->store('attachments', 'public');

        $attachment = $task->attachments()->create([
            'user_id' => $request->user()->id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize()
        ]);

        return response()->json($attachment->load('user'), 201);
    }

    public function destroy(Request $request, TaskAttachment $attachment): JsonResponse
    {
        $task = $attachment->task;
        Gate::authorize('view', $task);

        $taskBoardId = $task->column?->board_id ?: DB::table('kanban_columns')->where('id', $task->column_id)->value('board_id');
        $isAuthor = ((int)$attachment->user_id === (int)$request->user()->id);
        $isBoardAdmin = $request->user()->isBoardAdmin($taskBoardId);

        abort_unless(
            $isAuthor || $isBoardAdmin,
            403,
            'Bạn chỉ có thể xóa tệp do chính mình tải lên hoặc bạn phải là Quản trị viên bảng.'
        );

        $attachment->update(['deleted_by' => $request->user()->id]);
        $attachment->delete();

        return response()->json(['message' => 'Attachment moved to trash']);
    }
}
