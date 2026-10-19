<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\BoardReview;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BoardReviewLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $member;
    protected User $outsider;
    protected Board $board;
    protected KanbanColumn $todoCol;
    protected KanbanColumn $doneCol;
    protected Task $completedTask;
    protected Task $overdueTask;
    protected Task $inProgressTask;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'name' => 'Owner Alice',
            'username' => 'alice',
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->member = User::factory()->create([
            'name' => 'Member Bob',
            'username' => 'bob',
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->outsider = User::factory()->create([
            'name' => 'Outsider Charlie',
            'username' => 'charlie',
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->board = Board::create([
            'name' => 'Project Danava Web App',
            'owner_id' => $this->owner->id,
            'visibility' => 'private',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->member->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->todoCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Chờ thực hiện',
            'order' => 1000,
        ]);

        $this->doneCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Hoàn thành',
            'order' => 2000,
        ]);

        // Task 1: Completed by Bob
        $this->completedTask = Task::create([
            'column_id' => $this->doneCol->id,
            'created_by' => $this->owner->id,
            'assignee_id' => $this->member->id,
            'title' => 'Thiết kế giao diện người dùng',
            'completed_at' => now(),
            'due_date' => Carbon::now('Asia/Ho_Chi_Minh')->subDays(2)->toDateString(),
        ]);
        $this->completedTask->assignees()->attach($this->member->id, ['assigned_by' => $this->owner->id]);

        // Task 2: Overdue assigned to Bob
        $this->overdueTask = Task::create([
            'column_id' => $this->todoCol->id,
            'created_by' => $this->owner->id,
            'assignee_id' => $this->member->id,
            'title' => 'Viết tài liệu kỹ thuật',
            'due_date' => Carbon::now('Asia/Ho_Chi_Minh')->subDays(3)->toDateString(),
        ]);
        $this->overdueTask->assignees()->attach($this->member->id, ['assigned_by' => $this->owner->id]);

        // Task 3: In progress assigned to Alice
        $this->inProgressTask = Task::create([
            'column_id' => $this->todoCol->id,
            'created_by' => $this->owner->id,
            'assignee_id' => $this->owner->id,
            'title' => 'Kiểm thử bảo mật',
            'due_date' => Carbon::now('Asia/Ho_Chi_Minh')->addDays(5)->toDateString(),
        ]);
        $this->inProgressTask->assignees()->attach($this->owner->id, ['assigned_by' => $this->owner->id]);
    }

    /**
     * Test 1: Outsider cannot view review
     */
    public function test_outsider_cannot_view_review(): void
    {
        $res = $this->actingAs($this->outsider)->getJson("/api/boards/{$this->board->id}/review");
        $res->assertStatus(403);
    }

    /**
     * Test 2: Auto-calculated stats are completely accurate
     */
    public function test_auto_calculated_stats_are_accurate(): void
    {
        $res = $this->actingAs($this->owner)->getJson("/api/boards/{$this->board->id}/review");
        $res->assertStatus(200);

        $stats = $res->json('stats');
        $this->assertEquals(3, $stats['total_tasks']);
        $this->assertEquals(1, $stats['completed_tasks']);
        $this->assertEquals(2, $stats['incomplete_tasks']);
        $this->assertEquals(1, $stats['overdue_tasks']);
        $this->assertEquals(33.3, $stats['completion_rate']);

        // Check member breakdown
        $members = collect($stats['members_stats']);
        $bobStats = $members->firstWhere('user_id', $this->member->id);
        $this->assertNotNull($bobStats);
        $this->assertEquals(2, $bobStats['total_tasks']);
        $this->assertEquals(1, $bobStats['completed_tasks']);
        $this->assertEquals(1, $bobStats['incomplete_tasks']);
        $this->assertEquals(1, $bobStats['overdue_tasks']);
        $this->assertEquals(50.0, $bobStats['completion_rate']);

        $aliceStats = $members->firstWhere('user_id', $this->owner->id);
        $this->assertNotNull($aliceStats);
        $this->assertEquals(1, $aliceStats['total_tasks']);
        $this->assertEquals(0, $aliceStats['completed_tasks']);
        $this->assertEquals(0, $aliceStats['overdue_tasks']);
    }

    /**
     * Test 3: Regular member cannot create or edit review
     */
    public function test_regular_member_cannot_create_or_edit_review(): void
    {
        $res = $this->actingAs($this->member)->postJson("/api/boards/{$this->board->id}/review", [
            'summary' => 'Member tries to create review',
        ]);
        $res->assertStatus(403);
    }

    /**
     * Test 4: Member cannot view review when it is draft
     */
    public function test_member_cannot_view_draft_review(): void
    {
        // Owner creates draft review
        $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review", [
            'summary' => 'Bản nháp dự án chưa công bố',
            'status' => 'draft',
        ])->assertStatus(200);

        // Member attempts to view -> 403 Forbidden
        $res = $this->actingAs($this->member)->getJson("/api/boards/{$this->board->id}/review");
        $res->assertStatus(403);
        $this->assertStringContainsString('chưa được công bố', $res->json('message'));
    }

    /**
     * Test 5: Owner can create, update, and publish review with financials, member ratings, and notifications
     */
    public function test_owner_can_create_update_and_publish_review(): void
    {
        $createRes = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review", [
            'goals' => 'Xây dựng ứng dụng quản lý công việc DANAVA',
            'summary' => 'Dự án hoàn thành đúng tiến độ và vượt chỉ tiêu',
            'achievements' => 'Phát hành PWA và tính năng báo cáo',
            'unfinished_work' => 'Tối ưu hiệu năng thêm 10%',
            'issues' => 'Thay đổi yêu cầu ở giai đoạn giữa',
            'lessons_learned' => 'Cần chốt rõ spec từ đầu',
            'revenue' => 150000000,
            'cost' => 90000000,
            'overall_rating' => 5,
            'member_reviews' => [
                [
                    'user_id' => $this->member->id,
                    'note' => 'Đóng góp xuất sắc trong việc phát triển frontend',
                    'rating' => 5,
                ],
            ],
            'status' => 'draft',
        ]);
        $createRes->assertStatus(200);

        // Auto-computed profit = 150M - 90M = 60M
        $review = BoardReview::where('board_id', $this->board->id)->first();
        $this->assertNotNull($review);
        $this->assertEquals(60000000, $review->profit);
        $this->assertEquals('draft', $review->status);

        // Activity log created
        $this->assertDatabaseHas('activity_logs', [
            'board_id' => $this->board->id,
            'user_id' => $this->owner->id,
            'action' => 'create_project_review',
        ]);

        // Publish review
        $publishRes = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review/publish");
        $publishRes->assertStatus(200);
        $this->assertEquals('published', $publishRes->json('review.status'));

        // Member Bob receives notification with action URL
        $bobNotif = $this->member->notifications()->where('data', 'LIKE', '%"type":"evaluation_published"%')->first();
        $this->assertNotNull($bobNotif);
        $this->assertEquals("/{$this->board->public_id}/review", $bobNotif->data['action_url']);

        // Member Bob can now view review successfully
        $memberViewRes = $this->actingAs($this->member)->getJson("/api/boards/{$this->board->id}/review");
        $memberViewRes->assertStatus(200);
        $this->assertEquals('published', $memberViewRes->json('review.status'));
        $this->assertEquals('Dự án hoàn thành đúng tiến độ và vượt chỉ tiêu', $memberViewRes->json('review.summary'));
    }

    /**
     * Test 6: Locked review cannot be modified until unlocked
     */
    public function test_locked_review_cannot_be_modified_until_unlocked(): void
    {
        // Create and publish review
        $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review", [
            'summary' => 'Bản tổng kết sẵn sàng khóa',
            'status' => 'published',
        ]);

        // Lock review
        $lockRes = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review/lock");
        $lockRes->assertStatus(200);
        $this->assertEquals('locked', $lockRes->json('review.status'));

        // Attempt to edit while locked -> 422
        $editRes = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review", [
            'summary' => 'Cố gắng sửa khi bị khóa',
        ]);
        $editRes->assertStatus(422);
        $this->assertEquals('REVIEW_LOCKED', $editRes->json('error_code'));

        // Unlock review
        $unlockRes = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review/unlock");
        $unlockRes->assertStatus(200);
        $this->assertEquals('published', $unlockRes->json('review.status'));

        // Now editing is allowed
        $editSuccessRes = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/review", [
            'summary' => 'Nội dung sau khi mở khóa thành công',
        ]);
        $editSuccessRes->assertStatus(200);
        $this->assertEquals('Nội dung sau khi mở khóa thành công', $editSuccessRes->json('review.summary'));
    }
}
