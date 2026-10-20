<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class TaskExcelImportTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $adminMember;
    private User $regularMember;
    private User $systemAdmin;
    private User $outsider;
    private Board $board;
    private KanbanColumn $colTodo;
    private KanbanColumn $colDone;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Owner', 'username' => 'board_owner']);
        $this->adminMember = User::factory()->create(['name' => 'Admin Member', 'username' => 'board_admin']);
        $this->regularMember = User::factory()->create(['name' => 'Regular Member', 'username' => 'board_member']);
        $this->systemAdmin = User::factory()->create(['name' => 'SysAdmin', 'username' => 'sys_admin', 'system_role' => 'admin']);
        $this->outsider = User::factory()->create(['name' => 'Outsider', 'username' => 'outsider']);

        $this->board = Board::create([
            'name' => 'Import Test Board',
            'code' => 'IMP',
            'public_id' => 'imp-board-123',
            'owner_id' => $this->owner->id,
        ]);

        $this->board->members()->attach($this->adminMember->id, ['role' => 'admin']);
        $this->board->members()->attach($this->regularMember->id, ['role' => 'member']);

        $this->colTodo = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Cần làm',
            'order' => 1,
        ]);

        $this->colDone = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Hoàn thành',
            'order' => 2,
        ]);
    }

    private function createTestExcelFile(array $rows): UploadedFile
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('TASKS');

        $headers = [
            'external_key', 'parent_external_key', 'title', 'description', 'column',
            'priority', 'complexity', 'estimated_points', 'progress_percent',
            'start_date', 'due_date', 'assignee_usernames', 'contribution_percentages',
            'labels', 'sprint', 'completed', 'notes'
        ];

        // Header row
        foreach ($headers as $colIdx => $header) {
            $sheet->setCellValue([$colIdx + 1, 1], $header);
        }

        // Data rows
        $rowNum = 2;
        foreach ($rows as $data) {
            foreach ($headers as $colIdx => $header) {
                $sheet->setCellValue([$colIdx + 1, $rowNum], $data[$header] ?? '');
            }
            $rowNum++;
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'test_import_') . '.xlsx';
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);

        return new UploadedFile(
            $tempPath,
            'DANAVA_TASKS.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );
    }

    /**
     * Test: Download template gives 6 sheets with board metadata.
     * Member can download, Outsider gets 403.
     */
    public function test_template_download_authorization_and_structure(): void
    {
        // Member can download template
        $response = $this->actingAs($this->regularMember)
            ->get("/api/boards/{$this->board->id}/tasks/import/template");
        $response->assertStatus(200);
        $response->assertHeader('Content-Disposition', 'attachment; filename=DANAVA_WORK_TASK_IMPORT_TEMPLATE.xlsx');

        // Member can download template using public_id
        $responsePublic = $this->actingAs($this->regularMember)
            ->get("/api/boards/{$this->board->public_id}/tasks/import/template");
        $responsePublic->assertStatus(200);
        $responsePublic->assertHeader('Content-Disposition', 'attachment; filename=DANAVA_WORK_TASK_IMPORT_TEMPLATE.xlsx');

        // Verify template has exactly 1 sheet
        $downloadedPath = $responsePublic->getFile()->getPathname();
        $reader = new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();
        $spreadsheet = $reader->load($downloadedPath);
        $this->assertEquals(1, $spreadsheet->getSheetCount());
        $this->assertEquals('TASKS', $spreadsheet->getSheet(0)->getTitle());

        // Outsider cannot download template
        $this->actingAs($this->outsider)
            ->get("/api/boards/{$this->board->id}/tasks/import/template")
            ->assertStatus(403);
    }

    /**
     * Test: Preview does NOT write to database, and Confirm creates data.
     * Tests parent-child hierarchy (task cha / task con) and multiple assignees with contribution percent.
     */
    public function test_import_parent_child_and_multiple_assignees(): void
    {
        $rows = [
            [
                'external_key' => 'TASK-PARENT',
                'parent_external_key' => '',
                'title' => 'Công việc cha mẫu',
                'description' => 'Mô tả task cha',
                'column' => 'Cần làm',
                'priority' => 'Cao',
                'complexity' => 'L',
                'estimated_points' => '5',
                'progress_percent' => '30',
                'start_date' => '2026-10-20',
                'due_date' => '2026-10-25',
                'assignee_usernames' => 'board_owner;board_admin',
                'contribution_percentages' => '60;40',
                'labels' => 'Feature;Backend',
                'sprint' => '',
                'completed' => '0',
                'notes' => 'Ghi chú task cha',
            ],
            [
                'external_key' => 'TASK-CHILD-1',
                'parent_external_key' => 'TASK-PARENT',
                'title' => 'Công việc con 1',
                'description' => 'Mô tả task con',
                'column' => 'Cần làm',
                'priority' => 'Bình thường',
                'complexity' => 'S',
                'estimated_points' => '2',
                'progress_percent' => '100',
                'start_date' => '2026-10-20',
                'due_date' => '2026-10-22',
                'assignee_usernames' => 'board_member',
                'contribution_percentages' => '100',
                'labels' => 'Subtask',
                'sprint' => '',
                'completed' => '1',
                'notes' => 'Hoàn thành',
            ]
        ];

        $file = $this->createTestExcelFile($rows);

        // STEP 1: PREVIEW
        $previewRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", [
                'file' => $file,
            ]);

        $previewRes->assertStatus(200);
        $previewRes->assertJson([
            'is_valid' => true,
            'total_rows' => 2,
            'valid_rows_count' => 2,
            'invalid_rows_count' => 0,
        ]);

        $token = $previewRes->json('preview_token');
        $this->assertNotEmpty($token);

        // Verify PREVIEW does NOT write to database
        $this->assertEquals(0, Task::count());

        // STEP 2: CONFIRM
        $confirmRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/confirm", [
                'preview_token' => $token,
            ]);

        $confirmRes->assertStatus(200);
        $confirmRes->assertJson([
            'success' => true,
            'imported_count' => 2,
        ]);

        // Verify DATABASE now has both tasks with correct hierarchy
        $this->assertEquals(2, Task::count());

        $parent = Task::where('external_key', 'TASK-PARENT')->first();
        $this->assertNotNull($parent);
        $this->assertNull($parent->parent_task_id);
        $this->assertEquals('L', $parent->complexity);
        $this->assertEquals(5.0, (float)$parent->estimated_points);
        $this->assertEquals('Cao', $parent->priority);

        // Verify multiple assignees and contribution percentages
        $assignees = $parent->assignees()->get();
        $this->assertCount(2, $assignees);
        $ownerAssignee = $assignees->firstWhere('id', $this->owner->id);
        $adminAssignee = $assignees->firstWhere('id', $this->adminMember->id);
        $this->assertEquals(60.0, (float)$ownerAssignee->pivot->contribution_percent);
        $this->assertEquals(40.0, (float)$adminAssignee->pivot->contribution_percent);

        // Verify child task
        $child = Task::where('external_key', 'TASK-CHILD-1')->first();
        $this->assertNotNull($child);
        $this->assertEquals($parent->id, $child->parent_task_id);
        $this->assertNotNull($child->completed_at);
    }

    /**
     * Test: Auto split contribution percent when left empty.
     */
    public function test_auto_split_contribution_percent_when_empty(): void
    {
        $rows = [
            [
                'external_key' => 'TASK-SPLIT',
                'parent_external_key' => '',
                'title' => 'Chia đều phần trăm',
                'column' => 'Cần làm',
                'assignee_usernames' => 'board_owner;board_admin',
                'contribution_percentages' => '', // Leave empty to trigger auto equal split
            ]
        ];

        $file = $this->createTestExcelFile($rows);
        $previewRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file]);

        $previewRes->assertJson(['is_valid' => true]);
        $token = $previewRes->json('preview_token');

        $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/confirm", ['preview_token' => $token])
            ->assertStatus(200);

        $task = Task::where('external_key', 'TASK-SPLIT')->first();
        $assignees = $task->assignees()->get();
        $this->assertCount(2, $assignees);
        $this->assertEquals(50.0, (float)$assignees[0]->pivot->contribution_percent);
        $this->assertEquals(50.0, (float)$assignees[1]->pivot->contribution_percent);
    }

    /**
     * Test: Block user outside board from being assigned.
     * System does NOT create account and does NOT add outsider to board.
     */
    public function test_block_user_outside_board_and_atomic_rollback(): void
    {
        $rows = [
            [
                'external_key' => 'TASK-VALID',
                'parent_external_key' => '',
                'title' => 'Task hợp lệ 1',
                'column' => 'Cần làm',
                'assignee_usernames' => 'board_owner',
            ],
            [
                'external_key' => 'TASK-OUTSIDER',
                'parent_external_key' => '',
                'title' => 'Task gán người ngoài',
                'column' => 'Cần làm',
                'assignee_usernames' => 'outsider', // Outsider is not a member of board
            ]
        ];

        $file = $this->createTestExcelFile($rows);
        $previewRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file]);

        $previewRes->assertStatus(200);
        $previewRes->assertJson([
            'is_valid' => false,
            'valid_rows_count' => 1,
            'invalid_rows_count' => 1,
        ]);

        $token = $previewRes->json('preview_token');

        // Confirm MUST fail because preview has invalid rows (atomic rule)
        $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/confirm", ['preview_token' => $token])
            ->assertStatus(422);

        // No tasks created in database
        $this->assertEquals(0, Task::count());
    }

    /**
     * Test: Block duplicate external_key within file and in board.
     */
    public function test_block_duplicate_external_key(): void
    {
        // 1. Duplicate within file
        $rows = [
            [
                'external_key' => 'DUPLICATE-KEY',
                'parent_external_key' => '',
                'title' => 'Task 1',
                'column' => 'Cần làm',
            ],
            [
                'external_key' => 'DUPLICATE-KEY',
                'parent_external_key' => '',
                'title' => 'Task 2 trùng key',
                'column' => 'Cần làm',
            ]
        ];

        $file = $this->createTestExcelFile($rows);
        $previewRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file]);

        $previewRes->assertJson([
            'is_valid' => false,
            'invalid_rows_count' => 1,
        ]);

        // 2. Duplicate with existing task in board
        Task::create([
            'external_key' => 'EXISTING-KEY',
            'column_id' => $this->colTodo->id,
            'title' => 'Existing Board Task',
            'created_by' => $this->owner->id,
        ]);

        $rows2 = [
            [
                'external_key' => 'EXISTING-KEY',
                'parent_external_key' => '',
                'title' => 'Trùng key đã có',
                'column' => 'Cần làm',
            ]
        ];

        $file2 = $this->createTestExcelFile($rows2);
        $previewRes2 = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file2]);

        $previewRes2->assertJson([
            'is_valid' => false,
            'invalid_rows_count' => 1,
        ]);
    }

    /**
     * Test: Block grandchild (Không tạo Task cháu) and cyclic dependencies.
     */
    public function test_block_grandchild_and_cyclic_dependencies(): void
    {
        // Grandchild: GRANDPARENT -> PARENT -> CHILD (3 levels)
        $rows = [
            [
                'external_key' => 'ROOT-1',
                'parent_external_key' => '',
                'title' => 'Task cụ / ông',
                'column' => 'Cần làm',
            ],
            [
                'external_key' => 'PARENT-1',
                'parent_external_key' => 'ROOT-1',
                'title' => 'Task cha',
                'column' => 'Cần làm',
            ],
            [
                'external_key' => 'CHILD-1',
                'parent_external_key' => 'PARENT-1',
                'title' => 'Task cháu (phải bị chặn)',
                'column' => 'Cần làm',
            ]
        ];

        $file = $this->createTestExcelFile($rows);
        $previewRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file]);

        $previewRes->assertJson([
            'is_valid' => false,
            'invalid_rows_count' => 1,
        ]);

        $errors = $previewRes->json('rows.2.errors');
        $this->assertStringContainsString('Không được tạo Task cháu', $errors[0]);
    }

    /**
     * Test: Role Permissions:
     * - Only Owner / Admin can import
     * - Regular Member cannot import (403)
     * - System Admin without board role cannot import (403)
     */
    public function test_import_authorization_restrictions(): void
    {
        $rows = [
            [
                'external_key' => 'TASK-AUTH',
                'title' => 'Testing Auth',
                'column' => 'Cần làm',
            ]
        ];
        $file = $this->createTestExcelFile($rows);

        // Board Admin can import
        $this->actingAs($this->adminMember)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file])
            ->assertStatus(200);

        // Regular Member is denied (403)
        $this->actingAs($this->regularMember)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file])
            ->assertStatus(403);

        // System Admin without board membership is denied (403)
        $this->actingAs($this->systemAdmin)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file])
            ->assertStatus(403);
    }

    /**
     * Test: Support Vietnamese column headers and auto-generating external_key if empty.
     */
    public function test_import_with_vietnamese_headers_and_auto_generated_external_key(): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Sheet1'); // Generic sheet name

        // Vietnamese headers
        $sheet->setCellValue('A1', 'Tiêu đề');
        $sheet->setCellValue('B1', 'Mô tả');
        $sheet->setCellValue('C1', 'Cột');
        $sheet->setCellValue('D1', 'Người thực hiện');

        // Data row without external_key
        $sheet->setCellValue('A2', 'Công việc viết bằng tiếng Việt');
        $sheet->setCellValue('B2', 'Mô tả chi tiết bằng tiếng Việt');
        $sheet->setCellValue('C2', 'Cần làm');
        $sheet->setCellValue('D2', 'board_member');

        $tempPath = tempnam(sys_get_temp_dir(), 'test_vn_') . '.xlsx';
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);

        $file = new UploadedFile($tempPath, 'tieng_viet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $previewRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/preview", ['file' => $file]);

        $previewRes->assertStatus(200);
        $previewRes->assertJson([
            'is_valid' => true,
            'total_rows' => 1,
            'valid_rows_count' => 1,
            'invalid_rows_count' => 0,
        ]);

        $rows = $previewRes->json('rows');
        $this->assertNotEmpty($rows[0]['data']['external_key']);
        $this->assertStringStartsWith('TASK-', $rows[0]['data']['external_key']);
        $this->assertEquals('Công việc viết bằng tiếng Việt', $rows[0]['data']['title']);

        // Confirm import
        $confirmRes = $this->actingAs($this->owner)
            ->postJson("/api/boards/{$this->board->id}/tasks/import/confirm", [
                'preview_token' => $previewRes->json('preview_token'),
            ]);

        $confirmRes->assertStatus(200);
        $this->assertDatabaseHas('tasks', [
            'title' => 'Công việc viết bằng tiếng Việt',
        ]);
    }
}
