<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class WorkspaceFlowTest extends TestCase
{
    use RefreshDatabase;

    private function space(User $user): string
    {
        return $this->actingAs($user)->postJson('/api/workspaces', ['name' => 'Sản phẩm', 'color' => '#567cc2'])->assertCreated()->json('id');
    }

    private function board(string $space): array
    {
        $id = $this->postJson("/api/workspaces/$space/boards", ['name' => 'Website', 'color' => '#567cc2'])->assertCreated()->json('id');

        return $this->getJson("/api/boards/$id")->assertOk()->json();
    }

    private function task(array $b, User $u): array
    {
        return ['id' => (string) Str::uuid(), 'columnId' => $b['data']['columns'][0]['id'], 'title' => 'Thiết kế trang chủ', 'description' => 'Tiếng Việt', 'priority' => 'Cao', 'labels' => ['UI', 'QA'], 'assigneeId' => (string) $u->id, 'collaborators' => [], 'dueDate' => '2026-10-20', 'checklist' => [['id' => (string) Str::uuid(), 'text' => 'Mobile', 'done' => true]], 'comments' => [['id' => (string) Str::uuid(), 'body' => 'Đã xem', 'author' => 'Forged', 'createdAt' => '2000-01-01T00:00:00Z']]];
    }

    public function test_guest_is_rejected(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/workspaces')->assertUnauthorized();
        $this->postJson('/api/workspaces', ['name' => 'Denied'])->assertUnauthorized();
    }

    public function test_registration_login_logout(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Nam Hùng', 'email' => 'HUNG@example.com', 'password' => 'secret1234', 'password_confirmation' => 'secret1234'])->assertCreated()->assertJsonPath('user.email', 'hung@example.com')->assertJsonMissingPath('user.password');
        $this->assertAuthenticated();
        $this->assertTrue(Hash::check('secret1234', User::first()->password));
        $this->postJson('/api/auth/logout')->assertNoContent();
        $this->assertGuest('web');
        Auth::forgetGuards();
        $this->postJson('/api/auth/login', ['email' => 'hung@example.com', 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => 'HUNG@example.com', 'password' => 'secret1234'])->assertOk();
        $this->assertAuthenticated();
    }

    public function test_multiple_boards_and_personal_preferences(): void
    {
        $owner = User::factory()->create();
        $space = $this->space($owner);
        $a = $this->board($space);
        $this->board($space);
        $id = $a['id'];
        $this->putJson("/api/boards/$id/favorite", ['favorite' => true])->assertNoContent();
        $this->postJson("/api/boards/$id/visit")->assertNoContent();
        $spaces = $this->getJson('/api/workspaces')->assertOk()->json('workspaces');
        $this->assertCount(1, $spaces);
        $this->assertCount(2, $spaces[0]['boards']);
        $p = collect($spaces[0]['boards'])->firstWhere('id', $id);
        $this->assertTrue($p['favorite']);
        $this->assertNotNull($p['visited_at']);
        $other = User::factory()->create();
        $this->putJson("/api/workspaces/$space/members", ['email' => $other->email, 'role' => 'viewer'])->assertNoContent();
        $this->actingAs($other)->getJson('/api/workspaces')->assertOk()->assertJsonPath('workspaces.0.boards.0.favorite', false);
    }

    public function test_outsider_and_viewer_permissions(): void
    {
        $owner = User::factory()->create();
        $space = $this->space($owner);
        $b = $this->board($space);
        $id = $b['id'];
        $other = User::factory()->create();
        $this->actingAs($other)->getJson('/api/workspaces')->assertJsonCount(0, 'workspaces');
        $this->getJson("/api/boards/$id")->assertNotFound();
        $this->putJson("/api/boards/$id", ['version' => 1, 'data' => $b['data']])->assertNotFound();
        $this->getJson("/api/workspaces/$space/members")->assertNotFound();
        $this->actingAs($owner)->putJson("/api/workspaces/$space/members", ['email' => $other->email, 'role' => 'viewer'])->assertNoContent();
        $this->actingAs($other)->getJson("/api/boards/$id")->assertOk();
        $this->putJson("/api/boards/$id", ['version' => 2, 'data' => $b['data']])->assertForbidden();
        $this->postJson("/api/workspaces/$space/boards", ['name' => 'Denied', 'color' => '#567cc2'])->assertForbidden();
        $this->putJson("/api/workspaces/$space/members", ['email' => $other->email, 'role' => 'admin'])->assertForbidden();
    }

    public function test_task_relations_conflicts_moves_and_cascade_delete(): void
    {
        $owner = User::factory()->create();
        $b = $this->board($this->space($owner));
        $id = $b['id'];
        $t = $this->task($b, $owner);
        $b['data']['tasks'] = [$t];
        $saved = $this->putJson("/api/boards/$id", ['version' => 1, 'data' => $b['data'], 'activity' => 'Tạo công việc'])->assertOk()->assertJsonPath('version', 2)->json();
        $this->assertDatabaseHas('tasks', ['id' => $t['id'], 'assignee_id' => $owner->id]);
        $this->assertDatabaseHas('checklist_items', ['task_id' => $t['id'], 'done' => true]);
        $this->assertDatabaseHas('task_comments', ['task_id' => $t['id'], 'author_id' => $owner->id]);
        $this->assertSame($owner->name, $saved['data']['tasks'][0]['comments'][0]['author']);
        $this->assertSame($owner->name, $saved['data']['activity'][0]['author']);
        $this->putJson("/api/boards/$id", ['version' => 1, 'data' => $b['data']])->assertConflict();
        $saved['data']['tasks'][0]['columnId'] = $saved['data']['columns'][3]['id'];
        $this->putJson("/api/boards/$id", ['version' => 2, 'data' => $saved['data']])->assertOk()->assertJsonPath('data.tasks.0.columnId', $saved['data']['columns'][3]['id']);
        $saved['data']['tasks'] = [];
        $this->putJson("/api/boards/$id", ['version' => 3, 'data' => $saved['data']])->assertOk();
        $this->assertDatabaseCount('tasks', 0);
        $this->assertDatabaseCount('checklist_items', 0);
        $this->assertDatabaseCount('task_comments', 0);
    }

    public function test_foreign_ids_and_nonmember_assignments_rollback(): void
    {
        $u = User::factory()->create();
        $space = $this->space($u);
        $a = $this->board($space);
        $b = $this->board($space);
        $id = $b['id'];
        $b['data']['columns'][0]['id'] = $a['data']['columns'][0]['id'];
        $this->putJson("/api/boards/$id", ['version' => 1, 'data' => $b['data']])->assertUnprocessable();
        $b = $this->getJson("/api/boards/$id")->json();
        $b['data']['tasks'] = [$this->task($b, User::factory()->create())];
        $this->putJson("/api/boards/$id", ['version' => 1, 'data' => $b['data']])->assertUnprocessable();
        $this->assertDatabaseCount('tasks', 0);
        $this->assertDatabaseHas('boards', ['id' => $id, 'version' => 1]);
    }

    public function test_remove_member_clears_assignments_and_invalidates_drafts(): void
    {
        $owner = User::factory()->create();
        $m = User::factory()->create();
        $space = $this->space($owner);
        $this->putJson("/api/workspaces/$space/members", ['email' => $m->email, 'role' => 'editor'])->assertNoContent();
        $b = $this->board($space);
        $id = $b['id'];
        $b['data']['tasks'] = [$this->task($b, $m)];
        $this->actingAs($m)->putJson("/api/boards/$id", ['version' => 1, 'data' => $b['data']])->assertOk();
        $this->actingAs($owner)->putJson("/api/workspaces/$space/members", ['email' => $m->email, 'role' => 'remove'])->assertNoContent();
        $this->getJson("/api/boards/$id")->assertOk()->assertJsonPath('version', 3)->assertJsonPath('data.tasks.0.assigneeId', '');
        $this->putJson("/api/workspaces/$space/members", ['email' => $owner->email, 'role' => 'remove'])->assertUnprocessable();
        $this->actingAs($m)->getJson("/api/boards/$id")->assertNotFound();
    }
}
