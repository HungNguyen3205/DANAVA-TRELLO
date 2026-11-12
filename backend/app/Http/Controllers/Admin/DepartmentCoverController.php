<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** Department cover photo (admin routes only). */
class DepartmentCoverController extends Controller
{
    /** POST /admin/departments/{department}/cover */
    public function store(Request $request, Department $department)
    {
        $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp|mimetypes:image/jpeg,image/png,image/webp|max:5120',
        ], [
            'image.mimes' => 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
            'image.mimetypes' => 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
            'image.max' => 'Ảnh tối đa 5MB.',
        ]);

        $old = $department->cover_image;
        $path = $request->file('image')->store('department-covers', 'public');
        $department->update(['cover_image' => '/storage/' . $path]);
        $this->deleteFile($old);

        return response()->json(['message' => 'Đã cập nhật ảnh phòng ban.', 'cover_image' => $department->cover_image]);
    }

    /** DELETE /admin/departments/{department}/cover */
    public function destroy(Department $department)
    {
        $old = $department->cover_image;
        $department->update(['cover_image' => null]);
        $this->deleteFile($old);

        return response()->json(['message' => 'Đã xóa ảnh phòng ban.', 'cover_image' => null]);
    }

    private function deleteFile(?string $publicPath): void
    {
        if ($publicPath && str_starts_with($publicPath, '/storage/department-covers/')) {
            Storage::disk('public')->delete(substr($publicPath, strlen('/storage/')));
        }
    }
}
