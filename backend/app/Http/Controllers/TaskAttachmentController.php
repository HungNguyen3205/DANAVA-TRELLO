<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TaskAttachmentController extends Controller
{
    public function store(Request $request, Task $task)
    {
        // Kiểm tra quyền sở hữu task (Chống BOLA)
        abort_unless(
            $task->column && 
            $task->column->board && 
            $task->column->board->workspace && 
            $task->column->board->workspace->members()->where('user_id', $request->user()->id)->exists(),
            403,
            'Bạn không có quyền tải tệp lên công việc này.'
        );

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

    public function destroy(TaskAttachment $attachment)
    {
        Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();
        return response()->json(['message' => 'Attachment deleted']);
    }
}
