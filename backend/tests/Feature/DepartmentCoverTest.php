<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DepartmentCoverTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_uploads_and_removes_a_department_cover_others_cannot(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['system_role' => 'system_admin', 'account_status' => 'active']);
        $staff = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        $dept = Department::create(['name' => 'Kỹ thuật', 'code' => 'TECH', 'status' => 'active']);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        $file = fn () => UploadedFile::fake()->createWithContent('anh.png', $png);

        $this->actingAs($staff)->post("/api/admin/departments/{$dept->id}/cover", ['image' => $file()], ['Accept' => 'application/json'])->assertForbidden();

        $cover = $this->actingAs($admin)->post("/api/admin/departments/{$dept->id}/cover", ['image' => $file()], ['Accept' => 'application/json'])
            ->assertOk()->json('cover_image');
        $this->assertStringStartsWith('/storage/department-covers/', $cover);
        $this->assertSame($cover, $dept->fresh()->cover_image);
        Storage::disk('public')->assertExists(substr($cover, strlen('/storage/')));

        $this->actingAs($admin)->deleteJson("/api/admin/departments/{$dept->id}/cover")->assertOk();
        $this->assertNull($dept->fresh()->cover_image);
        Storage::disk('public')->assertMissing(substr($cover, strlen('/storage/')));
    }
}
