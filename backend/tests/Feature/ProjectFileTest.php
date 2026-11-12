<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectFileTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $member;
    private User $outsider;
    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        foreach (['owner', 'member', 'outsider'] as $k) {
            $this->$k = User::factory()->create(['system_role' => 'user', 'account_status' => 'active']);
        }
        $this->project = Project::create(['name' => 'Ra mắt app', 'owner_id' => $this->owner->id]);
        $board = Board::create(['owner_id' => $this->owner->id, 'name' => 'Thiết kế', 'project_id' => $this->project->id]);
        DB::table('board_members')->insert(['board_id' => $board->id, 'user_id' => $this->member->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);
    }

    private function upload(User $as, array $files)
    {
        return $this->actingAs($as)->post("/api/projects/{$this->project->id}/files", ['files' => $files], ['Accept' => 'application/json']);
    }

    public function test_members_upload_list_and_download_project_documents(): void
    {
        $res = $this->upload($this->owner, [
            UploadedFile::fake()->create('Kế hoạch tổng thể.pdf', 120, 'application/pdf'),
            UploadedFile::fake()->create('Ngân sách.xlsx', 40),
        ])->assertCreated();
        $this->assertCount(2, $res->json('files'));

        // Everyone in the project sees the documents and can download them via the signed link.
        $list = $this->actingAs($this->member)->getJson("/api/projects/{$this->project->id}/files")->assertOk()->json();
        $this->assertSame(['Ngân sách.xlsx', 'Kế hoạch tổng thể.pdf'], array_column($list, 'name'));
        $this->assertFalse($list[0]['can_delete']); // uploaded by the owner
        $this->get($list[1]['download_url'])->assertOk()->assertHeader('Content-Disposition');
        $this->get(strtok($list[1]['download_url'], '?'))->assertForbidden(); // unsigned link

        $this->actingAs($this->owner)->getJson("/api/projects/{$this->project->id}")->assertJsonPath('files_count', 2);
        $this->actingAs($this->outsider)->getJson("/api/projects/{$this->project->id}/files")->assertForbidden();
        $this->upload($this->outsider, [UploadedFile::fake()->create('x.pdf', 1)])->assertForbidden();
    }

    public function test_only_uploader_or_project_manager_deletes_and_programs_are_rejected(): void
    {
        $mine = $this->upload($this->member, [UploadedFile::fake()->create('ghi-chu.docx', 10)])->json('files.0');
        $owners = $this->upload($this->owner, [UploadedFile::fake()->create('hop-dong.pdf', 10)])->json('files.0');

        $this->actingAs($this->member)->deleteJson("/api/projects/{$this->project->id}/files/{$owners['id']}")->assertForbidden();
        $this->actingAs($this->member)->deleteJson("/api/projects/{$this->project->id}/files/{$mine['id']}")->assertOk();
        $this->actingAs($this->owner)->deleteJson("/api/projects/{$this->project->id}/files/{$owners['id']}")->assertOk();
        $this->assertSame([], Storage::disk('local')->allFiles("project-files/{$this->project->id}"));

        $this->upload($this->owner, [UploadedFile::fake()->createWithContent('virus.php', '<?php echo 1;')])->assertStatus(422);
        $this->upload($this->owner, [UploadedFile::fake()->create('setup.exe', 5)])->assertStatus(422);
    }

    public function test_deleting_a_project_removes_its_documents(): void
    {
        $this->upload($this->owner, [UploadedFile::fake()->create('a.pdf', 5)])->assertCreated();
        $this->actingAs($this->owner)->deleteJson("/api/projects/{$this->project->id}")->assertOk();

        $this->assertSame([], Storage::disk('local')->allFiles("project-files/{$this->project->id}"));
        $this->assertDatabaseCount('project_files', 0);
    }
}
