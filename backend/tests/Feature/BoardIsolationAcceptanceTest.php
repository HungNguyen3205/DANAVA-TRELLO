<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\BoardSprint;
use App\Models\Checklist;
use App\Models\Department;
use App\Models\KanbanColumn;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BoardIsolationAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminA;
    protected User $hungB;
    protected User $namC;
    protected Department $department;
    protected Workspace $legacyWorkspace;

    protected Board $boardHung;
    protected KanbanColumn $col1Hung;
    protected KanbanColumn $col2Hung;
    protected Task $taskHung;
    protected Checklist $checklistHung;
    protected TaskAttachment $attachmentHung;
    protected BoardSprint $sprintHung;
    protected Label $labelHung;

    protected Board $boardNam;
    protected KanbanColumn $col1Nam;
    protected KanbanColumn $col2Nam;
    protected Task $taskNam;
    protected Checklist $checklistNam;
    protected TaskAttachment $attachmentNam;
    protected BoardSprint $sprintNam;
    protected Label $labelNam;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        // Create Department
        $this->department = Department::create([
            'name' => 'Phòng Kỹ thuật DANAVA',
            'code' => 'KT',
            'color' => '#6366f1',
        ]);

        // Account A: System Admin
        $this->adminA = User::create([
            'name' => 'System Admin A',
            'username' => 'sysadmin_a',
            'email' => 'admin_a@danava.vn',
            'password' => bcrypt('password123'),
            'system_role' => 'system_admin',
            'account_status' => 'active',
            'must_change_password' => false,
        ]);

        // Account B: Hùng
        $this->hungB = User::create([
            'name' => 'Hùng',
            'username' => 'hung_b',
            'email' => 'hung_b@danava.vn',
            'password' => bcrypt('password123'),
            'system_role' => 'user',
            'department_id' => $this->department->id,
            'department_title' => 'Trưởng phòng Kỹ thuật DANAVA',
            'account_status' => 'active',
            'must_change_password' => false,
        ]);
        $this->department->update(['manager_id' => $this->hungB->id]);

        // Account C: Nam
        $this->namC = User::create([
            'name' => 'Nam',
            'username' => 'nam_c',
            'email' => 'nam_c@danava.vn',
            'password' => bcrypt('password123'),
            'system_role' => 'user',
            'department_id' => $this->department->id,
            'department_title' => 'Nhân viên Kỹ thuật DANAVA',
            'account_status' => 'active',
            'must_change_password' => false,
        ]);

        // Legacy Workspace with B and C
        $this->legacyWorkspace = Workspace::create([
            'name' => 'Workspace Chung Cũ',
            'owner_id' => $this->hungB->id,
        ]);
        DB::table('workspace_members')->insert([
            ['workspace_id' => $this->legacyWorkspace->id, 'user_id' => $this->hungB->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['workspace_id' => $this->legacyWorkspace->id, 'user_id' => $this->namC->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // --------------------------------------------------
        // BOARD HÙNG (Owned by B, only B is member)
        // --------------------------------------------------
        $this->boardHung = Board::create([
            'name' => 'Board Hùng Đặc Biệt',
            'owner_id' => $this->hungB->id,
            'color' => '#6366f1',
            'workspace_id' => $this->legacyWorkspace->id,
            'public_id' => 'hung_pub_12345',
        ]);
        DB::table('board_members')->insert([
            'board_id' => $this->boardHung->id,
            'user_id' => $this->hungB->id,
            'role' => 'admin',
            'is_starred' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->col1Hung = KanbanColumn::create(['board_id' => $this->boardHung->id, 'title' => 'Cột 1 Hùng', 'order' => 1000]);
        $this->col2Hung = KanbanColumn::create(['board_id' => $this->boardHung->id, 'title' => 'Cột 2 Hùng', 'order' => 2000]);
        $this->taskHung = Task::create([
            'column_id' => $this->col1Hung->id,
            'title' => 'TASK RIÊNG CỦA HÙNG',
            'description' => 'Mô tả bí mật của Hùng',
            'priority' => 'Cao',
            'created_by' => $this->hungB->id,
            'assignee_id' => $this->hungB->id,
            'order' => 1000,
        ]);
        $this->checklistHung = Checklist::create(['task_id' => $this->taskHung->id, 'title' => 'Checklist Hùng']);
        $this->checklistHung->items()->create(['content' => 'Mục checklist của Hùng', 'is_completed' => false]);
        $this->attachmentHung = TaskAttachment::create([
            'task_id' => $this->taskHung->id,
            'user_id' => $this->hungB->id,
            'file_name' => 'hung_secret.pdf',
            'file_path' => 'attachments/hung_secret.pdf',
            'mime_type' => 'application/pdf',
            'size' => 1024,
        ]);
        $this->sprintHung = BoardSprint::create([
            'board_id' => $this->boardHung->id,
            'name' => 'Sprint Hùng 01',
            'status' => 'active',
        ]);
        $this->labelHung = Label::create([
            'board_id' => $this->boardHung->id,
            'name' => 'NHÃN HÙNG',
            'color' => '#10b981',
        ]);

        // --------------------------------------------------
        // BOARD NAM (Owned by C, only C is member)
        // --------------------------------------------------
        $this->boardNam = Board::create([
            'name' => 'Board Nam Bí Mật',
            'owner_id' => $this->namC->id,
            'color' => '#ec4899',
            'workspace_id' => $this->legacyWorkspace->id,
            'public_id' => 'nam_pub_67890',
        ]);
        DB::table('board_members')->insert([
            'board_id' => $this->boardNam->id,
            'user_id' => $this->namC->id,
            'role' => 'admin',
            'is_starred' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->col1Nam = KanbanColumn::create(['board_id' => $this->boardNam->id, 'title' => 'Cột 1 Nam', 'order' => 1000]);
        $this->col2Nam = KanbanColumn::create(['board_id' => $this->boardNam->id, 'title' => 'Cột 2 Nam', 'order' => 2000]);
        $this->taskNam = Task::create([
            'column_id' => $this->col1Nam->id,
            'title' => 'TASK RIÊNG CỦA NAM',
            'description' => 'Tài liệu độc quyền của Nam',
            'priority' => 'Khẩn cấp',
            'created_by' => $this->namC->id,
            'assignee_id' => $this->namC->id,
            'order' => 1000,
        ]);
        $this->checklistNam = Checklist::create(['task_id' => $this->taskNam->id, 'title' => 'Checklist Nam']);
        $this->checklistNam->items()->create(['content' => 'Mục checklist của Nam', 'is_completed' => false]);
        $this->attachmentNam = TaskAttachment::create([
            'task_id' => $this->taskNam->id,
            'user_id' => $this->namC->id,
            'file_name' => 'nam_secret.docx',
            'file_path' => 'attachments/nam_secret.docx',
            'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'size' => 2048,
        ]);
        $this->sprintNam = BoardSprint::create([
            'board_id' => $this->boardNam->id,
            'name' => 'Sprint Nam 01',
            'status' => 'active',
        ]);
        $this->labelNam = Label::create([
            'board_id' => $this->boardNam->id,
            'name' => 'NHÃN NAM',
            'color' => '#f59e0b',
        ]);
    }

    /**
     * TEST 01: B chỉ thấy Board Hùng.
     */
    public function test_01_user_b_only_sees_hung_board(): void
    {
        $response = $this->actingAs($this->hungB)->getJson('/api/me/boards');

        $response->assertStatus(200);
        $boardIds = collect($response->json())->pluck('id')->toArray();

        $this->assertContains($this->boardHung->id, $boardIds);
        $this->assertNotContains($this->boardNam->id, $boardIds);
    }

    /**
     * TEST 02: C chỉ thấy Board Nam.
     */
    public function test_02_user_c_only_sees_nam_board(): void
    {
        $response = $this->actingAs($this->namC)->getJson('/api/me/boards');

        $response->assertStatus(200);
        $boardIds = collect($response->json())->pluck('id')->toArray();

        $this->assertContains($this->boardNam->id, $boardIds);
        $this->assertNotContains($this->boardHung->id, $boardIds);
    }

    /**
     * TEST 03: A (System Admin) không thấy hai Board khi chưa được mời.
     */
    public function test_03_system_admin_a_sees_no_boards_when_uninvited(): void
    {
        $response = $this->actingAs($this->adminA)->getJson('/api/me/boards');

        $response->assertStatus(200);
        $boardIds = collect($response->json())->pluck('id')->toArray();

        $this->assertNotContains($this->boardHung->id, $boardIds);
        $this->assertNotContains($this->boardNam->id, $boardIds);
    }

    /**
     * TEST 04: B tìm kiếm không thấy Board hoặc Task của C.
     */
    public function test_04_user_b_search_does_not_reveal_c_board_or_tasks(): void
    {
        // Search by task title unique to Nam
        $responseTask = $this->actingAs($this->hungB)->getJson('/api/search?q=TASK+RIÊNG+CỦA+NAM');
        $responseTask->assertStatus(200);

        $taskResults = collect($responseTask->json('tasks') ?? [])->pluck('title')->toArray();
        $this->assertNotContains('TASK RIÊNG CỦA NAM', $taskResults);

        // Search by board name unique to Nam
        $responseBoard = $this->actingAs($this->hungB)->getJson('/api/search?q=Board+Nam+Bí+Mật');
        $responseBoard->assertStatus(200);

        $boardResults = collect($responseBoard->json('boards') ?? [])->pluck('name')->toArray();
        $this->assertNotContains('Board Nam Bí Mật', $boardResults);
    }

    /**
     * TEST 05: B gọi trực tiếp ID Board C phải nhận 403.
     */
    public function test_05_user_b_direct_call_to_c_board_endpoints_returns_403(): void
    {
        // 1. Direct ID
        $resShow = $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}");
        $resShow->assertStatus(403);

        // 2. Public ID
        $resPublic = $this->actingAs($this->hungB)->getJson("/api/boards/by-code/{$this->boardNam->public_id}");
        $resPublic->assertStatus(403);

        // 3. Kanban View
        $resKanban = $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/kanban");
        $resKanban->assertStatus(403);

        // 4. Workload Dashboard
        $resDashboard = $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/dashboard/member-workload");
        $resDashboard->assertStatus(403);

        // 5. Board Review
        $resReview = $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/review");
        $resReview->assertStatus(403);
    }

    /**
     * TEST 06: B không tạo được cột trong Board C.
     */
    public function test_06_user_b_cannot_create_column_in_c_board(): void
    {
        $initialColumnCount = KanbanColumn::where('board_id', $this->boardNam->id)->count();

        $response = $this->actingAs($this->hungB)->postJson("/api/boards/{$this->boardNam->id}/columns", [
            'title' => 'Cột Hùng Đột Nhập',
            'color' => 'blue',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseMissing('kanban_columns', [
            'board_id' => $this->boardNam->id,
            'title' => 'Cột Hùng Đột Nhập',
        ]);
        $this->assertEquals($initialColumnCount, KanbanColumn::where('board_id', $this->boardNam->id)->count());
    }

    /**
     * TEST 07: B không tạo được Task trong Board C.
     */
    public function test_07_user_b_cannot_create_task_in_c_board(): void
    {
        $initialTaskCount = Task::where('column_id', $this->col1Nam->id)->count();

        $response = $this->actingAs($this->hungB)->postJson("/api/columns/{$this->col1Nam->id}/tasks", [
            'title' => 'Task Hùng Cố Tạo',
            'priority' => 'Bình thường',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseMissing('tasks', [
            'column_id' => $this->col1Nam->id,
            'title' => 'Task Hùng Cố Tạo',
        ]);
        $this->assertEquals($initialTaskCount, Task::where('column_id', $this->col1Nam->id)->count());
    }

    /**
     * TEST 08: B không kéo được Task của C.
     */
    public function test_08_user_b_cannot_move_or_tamper_c_tasks(): void
    {
        // 1. B tries to move Task Nam to Column 2 Nam (Unauthorized on Task Nam)
        $resMove = $this->actingAs($this->hungB)->putJson("/api/tasks/{$this->taskNam->id}/move", [
            'column_id' => $this->col2Nam->id,
        ]);
        $resMove->assertStatus(403);

        // DB assertion: column_id is still col1Nam
        $this->assertDatabaseHas('tasks', [
            'id' => $this->taskNam->id,
            'column_id' => $this->col1Nam->id,
        ]);

        // 2. B tries to move Task Nam into Hùng's Column
        $resCross = $this->actingAs($this->hungB)->putJson("/api/tasks/{$this->taskNam->id}/move", [
            'column_id' => $this->col1Hung->id,
        ]);
        $this->assertTrue(in_array($resCross->status(), [403, 422]));

        // DB assertion: still in col1Nam
        $this->assertDatabaseHas('tasks', [
            'id' => $this->taskNam->id,
            'column_id' => $this->col1Nam->id,
        ]);

        // 3. B tries to move own Task Hung into Nam's Column
        $resOwnCross = $this->actingAs($this->hungB)->putJson("/api/tasks/{$this->taskHung->id}/move", [
            'column_id' => $this->col1Nam->id,
        ]);
        $resOwnCross->assertStatus(422);

        $this->assertDatabaseHas('tasks', [
            'id' => $this->taskHung->id,
            'column_id' => $this->col1Hung->id,
        ]);
    }

    /**
     * TEST 09: B không sửa/xóa Checklist của C.
     */
    public function test_09_user_b_cannot_modify_or_delete_c_checklists(): void
    {
        // 1. Add checklist to Task Nam
        $resAdd = $this->actingAs($this->hungB)->postJson("/api/tasks/{$this->taskNam->id}/checklists", [
            'title' => 'Checklist Trộm',
        ]);
        $resAdd->assertStatus(403);

        // 2. Add item to Checklist Nam
        $resAddItem = $this->actingAs($this->hungB)->postJson("/api/checklists/{$this->checklistNam->id}/items", [
            'content' => 'Mục checklist bất hợp pháp',
        ]);
        $resAddItem->assertStatus(403);

        // 3. Delete Checklist Nam
        $resDelete = $this->actingAs($this->hungB)->deleteJson("/api/checklists/{$this->checklistNam->id}");
        $resDelete->assertStatus(403);

        $this->assertDatabaseHas('checklists', ['id' => $this->checklistNam->id]);
    }

    /**
     * TEST 10: B không xem danh sách thành viên Board C.
     */
    public function test_10_user_b_cannot_view_c_board_members(): void
    {
        $response = $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/members");

        $response->assertStatus(403);
    }

    /**
     * TEST 11: B không thêm/gỡ người khỏi Board C.
     */
    public function test_11_user_b_cannot_add_or_remove_members_on_c_board(): void
    {
        // Try adding self to Board Nam
        $resAdd = $this->actingAs($this->hungB)->postJson("/api/boards/{$this->boardNam->id}/members", [
            'user_id' => $this->hungB->id,
            'role' => 'admin',
        ]);
        $resAdd->assertStatus(403);

        $this->assertDatabaseMissing('board_members', [
            'board_id' => $this->boardNam->id,
            'user_id' => $this->hungB->id,
        ]);

        // Try removing Nam from his own board
        $resRemove = $this->actingAs($this->hungB)->deleteJson("/api/boards/{$this->boardNam->id}/members/{$this->namC->id}");
        $resRemove->assertStatus(403);

        $this->assertDatabaseHas('board_members', [
            'board_id' => $this->boardNam->id,
            'user_id' => $this->namC->id,
        ]);
    }

    /**
     * TEST 12: B không upload/xóa file Task của C.
     */
    public function test_12_user_b_cannot_upload_or_delete_attachments_on_c_task(): void
    {
        // 1. Upload to Task Nam
        $file = UploadedFile::fake()->create('malicious.pdf', 100);
        $resUpload = $this->actingAs($this->hungB)->postJson("/api/tasks/{$this->taskNam->id}/attachments", [
            'file' => $file,
        ]);
        $resUpload->assertStatus(403);

        $this->assertDatabaseMissing('task_attachments', [
            'task_id' => $this->taskNam->id,
            'file_name' => 'malicious.pdf',
        ]);

        // 2. Delete attachment of Task Nam
        $resDelete = $this->actingAs($this->hungB)->deleteJson("/api/attachments/{$this->attachmentNam->id}");
        $resDelete->assertStatus(403);

        $this->assertDatabaseHas('task_attachments', [
            'id' => $this->attachmentNam->id,
            'deleted_at' => null,
        ]);
    }

    /**
     * TEST 13: B không sửa/xóa Sprint Board C.
     */
    public function test_13_user_b_cannot_modify_or_delete_c_sprints(): void
    {
        // 1. Create sprint on Board Nam
        $resCreate = $this->actingAs($this->hungB)->postJson("/api/boards/{$this->boardNam->id}/sprints", [
            'name' => 'Sprint Hùng Hack',
        ]);
        $resCreate->assertStatus(403);

        // 2. Update Sprint Nam
        $resUpdate = $this->actingAs($this->hungB)->putJson("/api/sprints/{$this->sprintNam->id}", [
            'name' => 'Sprint Nam Bị Đổi',
        ]);
        $resUpdate->assertStatus(403);

        $this->assertDatabaseHas('board_sprints', [
            'id' => $this->sprintNam->id,
            'name' => 'Sprint Nam 01',
        ]);

        // 3. Delete Sprint Nam
        $resDelete = $this->actingAs($this->hungB)->deleteJson("/api/sprints/{$this->sprintNam->id}");
        $resDelete->assertStatus(403);

        $this->assertDatabaseHas('board_sprints', [
            'id' => $this->sprintNam->id,
            'name' => 'Sprint Nam 01',
        ]);
    }

    /**
     * TEST 14: B không gắn Label Board C vào Task của B.
     */
    public function test_14_user_b_cannot_attach_c_labels_to_hung_task(): void
    {
        $response = $this->actingAs($this->hungB)->postJson("/api/tasks/{$this->taskHung->id}/labels", [
            'label_ids' => [$this->labelNam->id],
        ]);

        $this->assertTrue(in_array($response->status(), [403, 422]));

        $this->assertDatabaseMissing('task_labels', [
            'task_id' => $this->taskHung->id,
            'label_id' => $this->labelNam->id,
        ]);
    }

    /**
     * TEST 15: Mời B vào Board Nam thì B mới thấy Board Nam.
     */
    public function test_15_inviting_user_b_to_board_nam_grants_access(): void
    {
        // Owner C invites B to Board Nam
        $resInvite = $this->actingAs($this->namC)->postJson("/api/boards/{$this->boardNam->id}/members", [
            'user_id' => $this->hungB->id,
            'role' => 'member',
        ]);
        $resInvite->assertStatus(201);

        $this->assertDatabaseHas('board_members', [
            'board_id' => $this->boardNam->id,
            'user_id' => $this->hungB->id,
            'role' => 'member',
        ]);

        // B now checks myBoards
        $resMyBoards = $this->actingAs($this->hungB)->getJson('/api/me/boards');
        $resMyBoards->assertStatus(200);
        $boardIds = collect($resMyBoards->json())->pluck('id')->toArray();
        $this->assertContains($this->boardNam->id, $boardIds);

        // B now calls Board Nam endpoints directly
        $resShow = $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}");
        $resShow->assertStatus(200);

        $resKanban = $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/kanban");
        $resKanban->assertStatus(200);
    }

    /**
     * TEST 16: Gỡ B khỏi Board Nam thì quyền mất ngay.
     */
    public function test_16_removing_user_b_from_board_nam_immediately_revokes_access(): void
    {
        // Add B first
        DB::table('board_members')->insert([
            'board_id' => $this->boardNam->id,
            'user_id' => $this->hungB->id,
            'role' => 'member',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Owner C removes B
        $resRemove = $this->actingAs($this->namC)->deleteJson("/api/boards/{$this->boardNam->id}/members/{$this->hungB->id}");
        $resRemove->assertStatus(200);

        $this->assertDatabaseMissing('board_members', [
            'board_id' => $this->boardNam->id,
            'user_id' => $this->hungB->id,
        ]);

        // Access checks immediately without delay
        $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}")->assertStatus(403);
        $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/kanban")->assertStatus(403);
        $this->actingAs($this->hungB)->getJson("/api/tasks/{$this->taskNam->id}")->assertStatus(403);
        $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/dashboard/member-workload")->assertStatus(403);
        $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/members")->assertStatus(403);

        // Board Nam removed from myBoards
        $resMyBoards = $this->actingAs($this->hungB)->getJson('/api/me/boards');
        $boardIds = collect($resMyBoards->json())->pluck('id')->toArray();
        $this->assertNotContains($this->boardNam->id, $boardIds);

        // Search no longer returns Task Nam
        $resSearch = $this->actingAs($this->hungB)->getJson('/api/search?q=TASK+RIÊNG+CỦA+NAM');
        $taskTitles = collect($resSearch->json('tasks') ?? [])->pluck('title')->toArray();
        $this->assertNotContains('TASK RIÊNG CỦA NAM', $taskTitles);
    }

    /**
     * TEST 17: System Admin không được bypass.
     */
    public function test_17_system_admin_a_has_no_bypass_unless_explicitly_invited(): void
    {
        // A tries viewing board Hùng
        $this->actingAs($this->adminA)->getJson("/api/boards/{$this->boardHung->id}")->assertStatus(403);
        $this->actingAs($this->adminA)->getJson("/api/boards/{$this->boardHung->id}/kanban")->assertStatus(403);
        $this->actingAs($this->adminA)->getJson("/api/tasks/{$this->taskHung->id}")->assertStatus(403);
        $this->actingAs($this->adminA)->getJson("/api/boards/{$this->boardHung->id}/members")->assertStatus(403);
        $this->actingAs($this->adminA)->postJson("/api/boards/{$this->boardHung->id}/columns", ['title' => 'Cột Admin'])->assertStatus(403);
        $this->actingAs($this->adminA)->postJson("/api/columns/{$this->col1Hung->id}/tasks", ['title' => 'Task Admin'])->assertStatus(403);
        $this->actingAs($this->adminA)->putJson("/api/boards/{$this->boardHung->id}", ['name' => 'Board Bị Sửa'])->assertStatus(403);
        $this->actingAs($this->adminA)->deleteJson("/api/boards/{$this->boardHung->id}")->assertStatus(403);
        $this->actingAs($this->adminA)->getJson("/api/boards/{$this->boardHung->id}/dashboard/member-workload")->assertStatus(403);

        // B invites A as regular member
        $this->actingAs($this->hungB)->postJson("/api/boards/{$this->boardHung->id}/members", [
            'user_id' => $this->adminA->id,
            'role' => 'member',
        ])->assertStatus(201);

        // A can now view
        $this->actingAs($this->adminA)->getJson("/api/boards/{$this->boardHung->id}")->assertStatus(200);

        // But A cannot perform Board Admin actions (like deleting board or editing settings)
        $this->actingAs($this->adminA)->deleteJson("/api/boards/{$this->boardHung->id}")->assertStatus(403);
        $this->actingAs($this->adminA)->putJson("/api/boards/{$this->boardHung->id}", ['name' => 'Board Bị Sửa'])->assertStatus(403);
    }

    /**
     * TEST 18: Cùng phòng ban không tự động thấy Board.
     */
    public function test_18_same_department_does_not_grant_cross_board_access(): void
    {
        $this->assertEquals($this->hungB->department_id, $this->namC->department_id);
        $this->assertEquals($this->department->id, $this->hungB->department_id);

        // Hùng is department manager, but cannot see Nam's board
        $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}")->assertStatus(403);
        $this->actingAs($this->hungB)->getJson("/api/tasks/{$this->taskNam->id}")->assertStatus(403);

        // Nam is employee in same department, cannot see Hùng's board
        $this->actingAs($this->namC)->getJson("/api/boards/{$this->boardHung->id}")->assertStatus(403);
        $this->actingAs($this->namC)->getJson("/api/tasks/{$this->taskHung->id}")->assertStatus(403);
    }

    /**
     * TEST 19: Cùng Workspace cũ không tự động thấy Board.
     */
    public function test_19_same_workspace_does_not_grant_cross_board_access(): void
    {
        $this->assertEquals($this->boardHung->workspace_id, $this->boardNam->workspace_id);

        // Hùng is workspace owner/admin, but cannot access Board Nam
        $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}")->assertStatus(403);
        $this->actingAs($this->hungB)->getJson("/api/boards/{$this->boardNam->id}/kanban")->assertStatus(403);

        // Nam is workspace member, cannot access Board Hùng
        $this->actingAs($this->namC)->getJson("/api/boards/{$this->boardHung->id}")->assertStatus(403);
    }

    /**
     * TEST 20: URL public ID không làm lộ ID tuần tự.
     */
    public function test_20_public_id_is_opaque_and_unauthorized_access_returns_403(): void
    {
        // Public ID is not predictable integer
        $this->assertFalse(is_numeric($this->boardNam->public_id));
        $this->assertEquals('nam_pub_67890', $this->boardNam->public_id);

        // Calling by-code with valid public_id by non-member B returns 403
        $response = $this->actingAs($this->hungB)->getJson("/api/boards/by-code/{$this->boardNam->public_id}");
        $response->assertStatus(403);

        // Calling by-code with non-existent public_id returns 404
        $this->actingAs($this->hungB)->getJson("/api/boards/by-code/non_existent_code_999")->assertStatus(404);

        // Calling by-code by authorized member C returns 200 with public_id and relations
        $resC = $this->actingAs($this->namC)->getJson("/api/boards/by-code/{$this->boardNam->public_id}");
        $resC->assertStatus(200);
        $this->assertEquals('nam_pub_67890', $resC->json('public_id'));
    }
}
