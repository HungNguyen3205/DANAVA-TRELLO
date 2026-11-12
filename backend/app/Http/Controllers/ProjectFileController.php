<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Project documents: everyone who can see the project can view, download and add files;
 * the uploader or a project manager can delete them.
 */
class ProjectFileController extends Controller
{
    private const DISK = 'local';
    public const MAX_KB = 20480; // 20MB per file
    public const MAX_FILES = 10;  // per upload

    /** Documents, images and archives. Never scripts or programs. */
    private const ALLOWED = [
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv', 'md',
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'svg', 'psd', 'ai', 'fig',
        'zip', 'rar', '7z', 'mp4', 'mov', 'mp3', 'wav',
    ];

    /** GET /projects/{project}/files */
    public function index(Request $request, Project $project)
    {
        abort_unless($project->canView($request->user()), 403, 'Bạn không có quyền xem dự án này.');

        return response()->json(
            $project->files()->with('user:id,name,avatar')->latest()->orderByDesc('id')->get()
                ->map(fn (ProjectFile $f) => $this->present($f, $request->user(), $project))
                ->values()
        );
    }

    /** POST /projects/{project}/files (files[]) */
    public function store(Request $request, Project $project)
    {
        $user = $request->user();
        abort_unless($project->canView($user), 403, 'Bạn không có quyền với dự án này.');
        $request->validate([
            'files' => 'required|array|min:1|max:' . self::MAX_FILES,
            'files.*' => 'file|max:' . self::MAX_KB,
        ], [
            'files.max' => 'Mỗi lần tải tối đa ' . self::MAX_FILES . ' tệp.',
            'files.*.max' => 'Mỗi tệp tối đa 20MB.',
            'files.*.file' => 'Tệp tải lên không hợp lệ.',
        ]);

        $saved = [];
        foreach ($request->file('files') as $i => $file) {
            $ext = strtolower($file->getClientOriginalExtension());
            if (!in_array($ext, self::ALLOWED, true)) {
                throw ValidationException::withMessages([
                    "files.$i" => 'Tệp "' . $file->getClientOriginalName() . '" không được hỗ trợ. Nhận tài liệu (PDF, Word, Excel, PowerPoint…), ảnh, video và tệp nén.',
                ]);
            }
            $path = $file->storeAs("project-files/{$project->id}", Str::uuid() . '.' . $ext, self::DISK);
            $saved[] = ProjectFile::create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'name' => mb_substr($file->getClientOriginalName() ?: "tai-lieu.{$ext}", 0, 255),
                'path' => $path,
                'mime' => $file->getClientMimeType(),
                'size' => (int) $file->getSize(),
            ])->load('user:id,name,avatar');
        }

        return response()->json([
            'message' => 'Đã tải lên ' . count($saved) . ' tệp.',
            'files' => array_map(fn ($f) => $this->present($f, $user, $project), $saved),
        ], 201);
    }

    /** DELETE /projects/{project}/files/{file} */
    public function destroy(Request $request, Project $project, ProjectFile $file)
    {
        abort_unless((int) $file->project_id === (int) $project->id, 404);
        abort_unless($this->canDelete($request->user(), $project, $file), 403, 'Chỉ người tải lên hoặc quản lý dự án mới xóa được tệp này.');

        Storage::disk(self::DISK)->delete($file->path);
        $file->delete();

        return response()->json(['message' => 'Đã xóa tệp.']);
    }

    /** GET /project-files/{file} (signed link) — open or download a file. */
    public function download(Request $request, ProjectFile $file)
    {
        abort_unless(Storage::disk(self::DISK)->exists($file->path), 404);
        $inline = $request->boolean('inline') && preg_match('#^(image/(jpeg|png|webp|gif)|application/pdf)$#', (string) $file->mime);

        return Storage::disk(self::DISK)->response($file->path, $file->name, [
            'Content-Type' => $inline ? $file->mime : 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }

    private function canDelete($user, Project $project, ProjectFile $file): bool
    {
        return (int) $file->user_id === (int) $user->id || $project->canManage($user);
    }

    private function present(ProjectFile $f, $user, Project $project): array
    {
        $url = fn (bool $inline) => URL::temporarySignedRoute('project-files.download', now()->addHours(12), array_filter(['file' => $f->id, 'inline' => $inline ? 1 : null]), absolute: false);

        return [
            'id' => $f->id,
            'name' => $f->name,
            'mime' => $f->mime,
            'size' => $f->size,
            'uploaded_by' => $f->user ? ['id' => $f->user->id, 'name' => $f->user->name, 'avatar' => $f->user->avatar] : null,
            'created_at' => $f->created_at?->toIso8601String(),
            'download_url' => $url(false),
            'view_url' => $url(true),
            'can_delete' => $this->canDelete($user, $project, $f),
        ];
    }

    /** Files of a deleted project are removed with it. */
    public static function deleteAllFor(Project $project): void
    {
        Storage::disk(self::DISK)->deleteDirectory("project-files/{$project->id}");
    }
}
