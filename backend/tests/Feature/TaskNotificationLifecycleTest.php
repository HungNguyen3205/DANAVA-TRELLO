<?php

namespace Tests\Feature;

use App\Console\Commands\CheckDueTasks;
use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\User;
use App\Services\DueTaskService;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskNotificationLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $assignee;
    protected User $collaborator;
    protected User $outsider;
    protected Board $board;
    protected KanbanColumn $todoCol;
    protected KanbanColumn $inProgressCol;
    protected KanbanColumn $doneCol;
    protected Task $rootTask;

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

        $this->assignee = User::factory()->create([
            'name' => 'Assignee Bob',
            'username' => 'bob',
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->collaborator = User::factory()->create([
            'name' => 'Collaborator Charlie',
            'username' => 'charlie',
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->outsider = User::factory()->create([
            'name' => 'Outsider Dave',
            'username' => 'dave',
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $this->board = Board::create([
            'name' => 'DANAVA Agile Board',
            'owner_id' => $this->owner->id,
            'visibility' => 'private',
        ]);

        DB::table('board_members')->insert([
            ['board_id' => $this->board->id, 'user_id' => $this->owner->id, 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->assignee->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
            ['board_id' => $this->board->id, 'user_id' => $this->collaborator->id, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->todoCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Cần làm',
            'order' => 1000,
        ]);

        $this->inProgressCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Đang làm',
            'order' => 2000,
        ]);

        $this->doneCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Hoàn thành',
            'order' => 3000,
        ]);

        $this->rootTask = Task::create([
            'column_id' => $this->todoCol->id,
            'created_by' => $this->owner->id,
            'assignee_id' => $this->assignee->id,
            'title' => 'Phát triển tính năng thông báo',
            'description' => 'Mô tả chi tiết công việc',
            'priority' => 'Cao',
            'order' => 1000,
            'due_date' => Carbon::now('Asia/Ho_Chi_Minh')->addDays(3)->toDateString(),
        ]);

        $this->rootTask->assignees()->attach($this->assignee->id, ['assigned_by' => $this->owner->id]);
    }

    /**
     * 1. Board invited notification: Action URL points to canonical board, actor doesn't get notified
     */
    public function test_board_invited_notification_creates_action_url_and_actor_does_not_receive_it(): void
    {
        $newMember = User::factory()->create([
            'name' => 'Eve Member',
            'username' => 'eve',
            'must_change_password' => false,
            'account_status' => 'active',
            'system_role' => 'user',
        ]);

        $res = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/members", [
            'user_id' => $newMember->id,
            'role' => 'member',
        ]);
        $res->assertStatus(201);

        // Eve should have received notification
        $eveNotifs = $newMember->notifications()->get();
        $this->assertCount(1, $eveNotifs);
        $data = $eveNotifs->first()->data;
        $this->assertEquals('board_invited', $data['type']);
        $this->assertEquals("/{$this->board->public_id}/kanban", $data['action_url']);

        // Owner (actor) must NOT receive notification
        $ownerNotifs = $this->owner->notifications()->where('data', 'LIKE', '%board_invited%')->get();
        $this->assertCount(0, $ownerNotifs);
    }

    /**
     * 2. Assigned & 3. Unassigned: Giao việc & gỡ khỏi task
     */
    public function test_assigned_and_unassigned_notifications_with_action_urls(): void
    {
        // 2. Assign collaborator to rootTask
        $res = $this->actingAs($this->owner)->putJson("/api/tasks/{$this->rootTask->id}", [
            'assignee_ids' => [$this->assignee->id, $this->collaborator->id],
        ]);
        $res->assertStatus(200);

        // Charlie should receive 'assigned' notification
        $charlieNotifs = $this->collaborator->notifications()->where('data', 'LIKE', '%"type":"assigned"%')->get();
        $this->assertCount(1, $charlieNotifs);
        $data = $charlieNotifs->first()->data;
        $this->assertEquals("/{$this->board->public_id}/kanban?task={$this->rootTask->id}", $data['action_url']);

        // 3. Unassign Bob from rootTask
        $res2 = $this->actingAs($this->owner)->putJson("/api/tasks/{$this->rootTask->id}", [
            'assignee_ids' => [$this->collaborator->id],
        ]);
        $res2->assertStatus(200);

        // Bob should receive 'unassigned' notification
        $bobNotifs = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"unassigned"%')->get();
        $this->assertCount(1, $bobNotifs);
        $bobData = $bobNotifs->first()->data;
        $this->assertStringContainsString('gỡ bạn khỏi công việc', $bobData['message']);
        $this->assertEquals("/{$this->board->public_id}/kanban?task={$this->rootTask->id}", $bobData['action_url']);

        // Actor (Alice) must NOT receive any notification
        $aliceNotifs = $this->owner->notifications()->count();
        $this->assertEquals(0, $aliceNotifs);
    }

    /**
     * Subtask assignment and unassignment with canonical action URL pointing to parent task
     */
    public function test_subtask_assignment_and_unassignment_points_action_url_to_parent_task(): void
    {
        // Create subtask assigned to Bob
        $subtask = Task::create([
            'parent_task_id' => $this->rootTask->id,
            'column_id' => $this->todoCol->id,
            'created_by' => $this->owner->id,
            'title' => 'Viết Unit Test cho notifications',
            'order' => 1000,
        ]);
        $subtask->assignees()->attach($this->assignee->id, ['assigned_by' => $this->owner->id]);

        // Unassign Bob via SubtaskController
        $res = $this->actingAs($this->owner)->patchJson("/api/tasks/subtasks/{$subtask->id}", [
            'assignee_ids' => [$this->collaborator->id],
        ]);
        $res->assertStatus(200);

        // Bob should receive unassigned notification pointing to parent task modal
        $bobNotif = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"unassigned"%')->first();
        $this->assertNotNull($bobNotif);
        $this->assertEquals("/{$this->board->public_id}/kanban?task={$this->rootTask->id}", $bobNotif->data['action_url']);
    }

    /**
     * 4. Deadline thay đổi: Chỉ gửi cho người liên quan (assignees + creator), không gửi outsider hay actor
     */
    public function test_due_date_changed_notification_only_sent_to_stakeholders(): void
    {
        $newDueDate = Carbon::now('Asia/Ho_Chi_Minh')->addDays(7)->toDateString();

        $res = $this->actingAs($this->owner)->putJson("/api/tasks/{$this->rootTask->id}", [
            'due_date' => $newDueDate,
        ]);
        $res->assertStatus(200);

        // Assignee Bob receives due_date_changed
        $bobNotif = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"due_date_changed"%')->first();
        $this->assertNotNull($bobNotif);
        $this->assertStringContainsString('thay đổi hạn chót', $bobNotif->data['message']);

        // Actor (Alice) does NOT receive it
        $aliceNotif = $this->owner->notifications()->where('data', 'LIKE', '%"type":"due_date_changed"%')->first();
        $this->assertNull($aliceNotif);

        // Outsider (Dave) does NOT receive it
        $daveNotif = $this->outsider->notifications()->count();
        $this->assertEquals(0, $daveNotif);
    }

    /**
     * 5. Task sắp đến hạn & 6. Task quá hạn (Scheduler check & duplicate prevention)
     */
    public function test_due_soon_and_overdue_reminders_sent_once_and_no_duplicates(): void
    {
        // Set task due today (approaching due)
        $this->rootTask->update([
            'due_date' => Carbon::now('Asia/Ho_Chi_Minh')->toDateString(),
        ]);

        // Run scheduler command
        Artisan::call('notifications:check-due-tasks');

        // Bob should receive due_soon notification
        $bobDueSoon = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"due_soon"%')->get();
        $this->assertCount(1, $bobDueSoon);

        // Run scheduler command AGAIN - must NOT create duplicate notification
        Artisan::call('notifications:check-due-tasks');
        $bobDueSoonAfter = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"due_soon"%')->get();
        $this->assertCount(1, $bobDueSoonAfter);

        // Now test overdue
        $this->rootTask->update([
            'due_date' => Carbon::now('Asia/Ho_Chi_Minh')->subDays(2)->toDateString(),
        ]);

        Artisan::call('notifications:check-due-tasks');
        $bobOverdue = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"overdue"%')->get();
        $this->assertCount(1, $bobOverdue);

        // Run command AGAIN - must remain exactly 1
        Artisan::call('notifications:check-due-tasks');
        $bobOverdueAfter = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"overdue"%')->get();
        $this->assertCount(1, $bobOverdueAfter);
    }

    /**
     * 7. Task chuyển cột, 8. Task hoàn thành, 9. Task được mở lại
     */
    public function test_column_moved_and_completed_and_reopened_notifications(): void
    {
        // 7. Move task from "Cần làm" to "Đang làm" via /api/tasks/{task}/move
        $res = $this->actingAs($this->owner)->putJson("/api/tasks/{$this->rootTask->id}/move", [
            'column_id' => $this->inProgressCol->id,
        ]);
        $res->assertStatus(200);

        // Bob should receive column_moved notification
        $moveNotif = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"column_moved"%')->first();
        $this->assertNotNull($moveNotif);
        $this->assertStringContainsString('Đang làm', $moveNotif->data['message']);

        // 8. Move task to "Hoàn thành" -> triggers task_completed
        $res2 = $this->actingAs($this->owner)->putJson("/api/tasks/{$this->rootTask->id}/move", [
            'column_id' => $this->doneCol->id,
        ]);
        $res2->assertStatus(200);

        $completedNotif = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"task_completed"%')->first();
        $this->assertNotNull($completedNotif);
        $this->assertStringContainsString('đã hoàn thành', $completedNotif->data['message']);

        // 9. Move back from "Hoàn thành" to "Đang làm" -> triggers task_reopened
        $res3 = $this->actingAs($this->owner)->putJson("/api/tasks/{$this->rootTask->id}/move", [
            'column_id' => $this->inProgressCol->id,
        ]);
        $res3->assertStatus(200);

        $reopenedNotif = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"task_reopened"%')->first();
        $this->assertNotNull($reopenedNotif);
        $this->assertStringContainsString('đã mở lại', $reopenedNotif->data['message']);
    }

    /**
     * 10. Có bình luận mới & 11. Có người nhắc @username
     */
    public function test_comment_added_and_mention_notifications_with_mention_security(): void
    {
        // Bob comments and mentions Charlie (@charlie) and outsider Dave (@dave)
        $res = $this->actingAs($this->assignee)->postJson("/api/tasks/{$this->rootTask->id}/comments", [
            'content' => 'Chào @charlie, hãy kiểm tra lại code nhé. Cả @dave nữa.',
        ]);
        $res->assertStatus(201);

        // Charlie is on the board: Charlie receives 'mention' notification (not standard comment_added)
        $charlieMention = $this->collaborator->notifications()->where('data', 'LIKE', '%"type":"mention"%')->first();
        $this->assertNotNull($charlieMention);
        $this->assertStringContainsString('đã nhắc đến bạn trong bình luận', $charlieMention->data['message']);

        // Owner Alice is a stakeholder: Alice receives 'comment_added' notification
        $aliceComment = $this->owner->notifications()->where('data', 'LIKE', '%"type":"comment_added"%')->first();
        $this->assertNotNull($aliceComment);
        $this->assertStringContainsString('đã bình luận trên công việc', $aliceComment->data['message']);

        // Bob is the actor: Bob does NOT receive any notification
        $bobNotifs = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"comment_added"%')->count();
        $this->assertEquals(0, $bobNotifs);

        // Outsider Dave is NOT a board member: Dave must NOT receive any notification despite @dave
        $daveNotifs = $this->outsider->notifications()->count();
        $this->assertEquals(0, $daveNotifs);
    }

    /**
     * 12. Có đánh giá chất lượng
     */
    public function test_quality_review_notification(): void
    {
        $res = $this->actingAs($this->owner)->postJson("/api/tasks/{$this->rootTask->id}/review", [
            'rating' => 5,
            'summary' => 'Chất lượng code xuất sắc!',
        ]);
        $res->assertStatus(200);

        $bobReview = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"quality_review"%')->first();
        $this->assertNotNull($bobReview);
        $this->assertStringContainsString('5/5 sao - Chất lượng code xuất sắc!', $bobReview->data['message']);

        // Owner (actor) does not get notified
        $ownerReview = $this->owner->notifications()->where('data', 'LIKE', '%"type":"quality_review"%')->first();
        $this->assertNull($ownerReview);
    }

    /**
     * 13. Kỳ đánh giá được công bố
     */
    public function test_evaluation_published_notification_to_all_board_members(): void
    {
        $res = $this->actingAs($this->owner)->postJson("/api/boards/{$this->board->id}/evaluation/publish", [
            'period_title' => 'Kỳ đánh giá Q4/2026',
        ]);
        $res->assertStatus(200);

        // Both Bob and Charlie receive evaluation_published
        $bobEval = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"evaluation_published"%')->first();
        $this->assertNotNull($bobEval);
        $this->assertStringContainsString('Kỳ đánh giá hiệu suất "Kỳ đánh giá Q4/2026" đã được công bố', $bobEval->data['message']);
        $this->assertEquals("/{$this->board->public_id}/dashboard", $bobEval->data['action_url']);

        $charlieEval = $this->collaborator->notifications()->where('data', 'LIKE', '%"type":"evaluation_published"%')->first();
        $this->assertNotNull($charlieEval);

        // Owner (actor) does not receive it
        $ownerEval = $this->owner->notifications()->where('data', 'LIKE', '%"type":"evaluation_published"%')->first();
        $this->assertNull($ownerEval);

        // Outsider does not receive it
        $this->assertEquals(0, $this->outsider->notifications()->count());
    }

    /**
     * Tôn trọng notification preferences:
     * User tắt category 'comments' hoặc 'deadlines' -> không nhận notification tương ứng
     */
    public function test_notification_preferences_suppress_disabled_categories(): void
    {
        // Bob disables comment notifications
        $this->assignee->update([
            'notification_preferences' => [
                'comments' => false,
            ],
        ]);

        // Alice comments
        $this->actingAs($this->owner)->postJson("/api/tasks/{$this->rootTask->id}/comments", [
            'content' => 'Bình luận thử nghiệm preferences',
        ]);

        // Bob should NOT receive comment notification
        $bobNotif = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"comment_added"%')->first();
        $this->assertNull($bobNotif);

        // Bob re-enables comments but disables deadlines
        $this->assignee->update([
            'notification_preferences' => [
                'deadlines' => false,
            ],
        ]);

        // Alice changes deadline
        $this->actingAs($this->owner)->putJson("/api/tasks/{$this->rootTask->id}", [
            'due_date' => Carbon::now('Asia/Ho_Chi_Minh')->addDays(10)->toDateString(),
        ]);

        // Bob should NOT receive due_date_changed
        $bobDeadline = $this->assignee->notifications()->where('data', 'LIKE', '%"type":"due_date_changed"%')->first();
        $this->assertNull($bobDeadline);
    }

    /**
     * Ghi thời điểm đọc (read_at) và hỗ trợ đánh dấu một thông báo hoặc tất cả đã đọc
     */
    public function test_notification_read_tracking_and_bulk_read(): void
    {
        // Create 2 notifications for Bob
        NotificationService::send($this->assignee, 'due_soon', 'Task sắp đến hạn 1', $this->rootTask);
        // Advance time to bypass transient debounce
        $this->travel(3)->minutes();
        NotificationService::send($this->assignee, 'column_moved', 'Task đã chuyển cột', $this->rootTask);

        $notifs = $this->assignee->notifications()->get();
        $this->assertCount(2, $notifs);
        $this->assertNull($notifs[0]->read_at);
        $this->assertNull($notifs[1]->read_at);

        // Mark single as read
        $res = $this->actingAs($this->assignee)->putJson("/api/notifications/{$notifs[0]->id}/read");
        $res->assertStatus(200);

        $notifs[0]->refresh();
        $this->assertNotNull($notifs[0]->read_at);

        // Mark all as read
        $resAll = $this->actingAs($this->assignee)->putJson('/api/notifications/read-all');
        $resAll->assertStatus(200);

        $this->assertEquals(0, $this->assignee->unreadNotifications()->count());
    }

    /**
     * Notification API category filtering
     */
    public function test_notification_api_supports_category_filtering(): void
    {
        NotificationService::send($this->assignee, 'assigned', 'Bạn được giao task', $this->rootTask);
        $this->travel(3)->minutes();
        NotificationService::send($this->assignee, 'comment_added', 'Bình luận mới', $this->rootTask);
        $this->travel(3)->minutes();
        NotificationService::send($this->assignee, 'task_completed', 'Task hoàn thành', $this->rootTask);

        // Filter assigned
        $resAssigned = $this->actingAs($this->assignee)->getJson('/api/notifications?filter=assigned');
        $resAssigned->assertStatus(200);
        $this->assertCount(1, $resAssigned->json('notifications.data'));
        $this->assertEquals('assigned', $resAssigned->json('notifications.data.0.data.type'));

        // Filter comments
        $resComments = $this->actingAs($this->assignee)->getJson('/api/notifications?filter=comments');
        $resComments->assertStatus(200);
        $this->assertCount(1, $resComments->json('notifications.data'));
        $this->assertEquals('comment_added', $resComments->json('notifications.data.0.data.type'));

        // Filter completed
        $resCompleted = $this->actingAs($this->assignee)->getJson('/api/notifications?filter=completed');
        $resCompleted->assertStatus(200);
        $this->assertCount(1, $resCompleted->json('notifications.data'));
        $this->assertEquals('task_completed', $resCompleted->json('notifications.data.0.data.type'));
    }
}
