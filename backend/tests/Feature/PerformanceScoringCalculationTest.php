<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\PerformancePeriod;
use App\Models\PerformancePolicy;
use App\Models\PerformanceScore;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Services\PerformanceCalculationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PerformanceScoringCalculationTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $alice;
    protected User $bob;
    protected User $outsider;
    protected Board $board;
    protected KanbanColumn $todoCol;
    protected KanbanColumn $doneCol;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'name' => 'Owner User',
            'username' => 'owner_user',
            'system_role' => 'user',
            'account_status' => 'active',
            'must_change_password' => false,
        ]);

        $this->alice = User::factory()->create([
            'name' => 'Alice Member',
            'username' => 'alice_perf',
            'system_role' => 'user',
            'account_status' => 'active',
            'must_change_password' => false,
        ]);

        $this->bob = User::factory()->create([
            'name' => 'Bob Member',
            'username' => 'bob_perf',
            'system_role' => 'user',
            'account_status' => 'active',
            'must_change_password' => false,
        ]);

        $this->outsider = User::factory()->create([
            'name' => 'Outsider User',
            'username' => 'outsider_perf',
            'system_role' => 'user',
            'account_status' => 'active',
            'must_change_password' => false,
        ]);

        $this->board = Board::create([
            'name' => 'Performance Test Board',
            'public_id' => 'PERF1234',
            'owner_id' => $this->owner->id,
            'color' => '#3b82f6',
        ]);

        $this->board->members()->attach($this->owner->id, ['role' => 'admin']);
        $this->board->members()->attach($this->alice->id, ['role' => 'member']);
        $this->board->members()->attach($this->bob->id, ['role' => 'member']);

        $this->todoCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'To Do',
            'color' => '#64748b',
            'order' => 1000,
        ]);

        $this->doneCol = KanbanColumn::create([
            'board_id' => $this->board->id,
            'title' => 'Done',
            'color' => '#10b981',
            'order' => 2000,
        ]);
    }

    /**
     * 1. Test Complexity values (XS=1, S=2, M=3, L=5, XL=8) & no priority multiplication.
     */
    public function test_complexity_points_mapping(): void
    {
        $this->assertEquals(1, PerformanceCalculationService::getComplexityPoints('XS'));
        $this->assertEquals(2, PerformanceCalculationService::getComplexityPoints('S'));
        $this->assertEquals(3, PerformanceCalculationService::getComplexityPoints('M'));
        $this->assertEquals(5, PerformanceCalculationService::getComplexityPoints('L'));
        $this->assertEquals(8, PerformanceCalculationService::getComplexityPoints('XL'));
        // Defaults to M (3)
        $this->assertEquals(3, PerformanceCalculationService::getComplexityPoints(null));
        $this->assertEquals(3, PerformanceCalculationService::getComplexityPoints('UNKNOWN'));
    }

    /**
     * 2. Test Parent/Child Subtask rule:
     * - Parent task without subtasks: count parent.
     * - Parent task with subtasks: only count subtasks, do not count parent twice.
     */
    public function test_parent_and_child_subtask_double_counting_rule(): void
    {
        $startDate = Carbon::now()->startOfMonth();
        $endDate = Carbon::now()->endOfMonth();

        $period = PerformancePeriod::create([
            'board_id' => $this->board->id,
            'title' => 'T10 Evaluation',
            'period_type' => 'monthly',
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'status' => 'draft',
            'created_by' => $this->owner->id,
        ]);

        // Task A: Standalone root task (complexity L = 5 points) assigned to Alice
        $taskA = Task::create([
            'column_id' => $this->doneCol->id,
            'title' => 'Task A Alone',
            'complexity' => 'L',
            'priority' => 'Khẩn cấp', // Must NOT multiply
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);
        $taskA->assignees()->attach($this->alice->id, ['assigned_by' => $this->owner->id]);

        // Task B: Parent task (complexity XL = 8 points) with 2 subtasks (S=2, M=3)
        $taskB = Task::create([
            'column_id' => $this->doneCol->id,
            'title' => 'Task B Parent',
            'complexity' => 'XL',
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);
        $taskB->assignees()->attach($this->alice->id, ['assigned_by' => $this->owner->id]);

        // Subtask B1: S = 2 points, assigned to Alice, completed
        $subB1 = Task::create([
            'parent_task_id' => $taskB->id,
            'column_id' => $this->doneCol->id,
            'title' => 'Subtask B1',
            'complexity' => 'S',
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);
        $subB1->assignees()->attach($this->alice->id, ['assigned_by' => $this->owner->id]);

        // Subtask B2: M = 3 points, assigned to Alice, completed
        $subB2 = Task::create([
            'parent_task_id' => $taskB->id,
            'column_id' => $this->doneCol->id,
            'title' => 'Subtask B2',
            'complexity' => 'M',
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);
        $subB2->assignees()->attach($this->alice->id, ['assigned_by' => $this->owner->id]);

        $service = new PerformanceCalculationService();
        $scores = $service->calculatePeriodScores($this->board, $period, false);

        $aliceScore = collect($scores)->firstWhere('user_id', $this->alice->id);
        $this->assertNotNull($aliceScore);

        // Expected planned & completed points:
        // Task A (5) + SubB1 (2) + SubB2 (3) = 10 points.
        // Task B (8) must be EXCLUDED from calculation.
        $this->assertEquals(10.0, $aliceScore['metrics_breakdown']['workload']['planned_points']);
        $this->assertEquals(10.0, $aliceScore['metrics_breakdown']['workload']['completed_points']);
        $this->assertEquals(40.0, $aliceScore['workload_score']); // 10/10 * 40 = 40
    }

    /**
     * 3. Test Multi-Assignee contribution_percent:
     * - Blank contribution_percent splits equally (50%/50% for 2 people).
     * - Custom contribution_percent splits according to percent (e.g. 70% and 30%).
     * - Does NOT give full score to both assignees.
     */
    public function test_multi_assignee_contribution_percent(): void
    {
        $startDate = Carbon::now()->startOfMonth();
        $endDate = Carbon::now()->endOfMonth();

        $period = PerformancePeriod::create([
            'board_id' => $this->board->id,
            'title' => 'Multi Assignee Test',
            'period_type' => 'monthly',
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'status' => 'draft',
            'created_by' => $this->owner->id,
        ]);

        // Task 1: Complexity XL (8 points). Assigned to Alice & Bob with custom 70% / 30%
        $task1 = Task::create([
            'column_id' => $this->doneCol->id,
            'title' => 'Custom Split Task',
            'complexity' => 'XL', // 8 points
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);
        $task1->assignees()->attach($this->alice->id, [
            'assigned_by' => $this->owner->id,
            'contribution_percent' => 70.0,
        ]);
        $task1->assignees()->attach($this->bob->id, [
            'assigned_by' => $this->owner->id,
            'contribution_percent' => 30.0,
        ]);

        // Task 2: Complexity M (3 points). Assigned to Alice & Bob with blank contribution_percent (should be 50% each)
        $task2 = Task::create([
            'column_id' => $this->doneCol->id,
            'title' => 'Equal Split Task',
            'complexity' => 'M', // 3 points
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);
        $task2->assignees()->attach($this->alice->id, [
            'assigned_by' => $this->owner->id,
            'contribution_percent' => null,
        ]);
        $task2->assignees()->attach($this->bob->id, [
            'assigned_by' => $this->owner->id,
            'contribution_percent' => null,
        ]);

        $service = new PerformanceCalculationService();
        $scores = $service->calculatePeriodScores($this->board, $period, false);

        $aliceScore = collect($scores)->firstWhere('user_id', $this->alice->id);
        $bobScore = collect($scores)->firstWhere('user_id', $this->bob->id);

        // Alice planned: (8 * 0.7) + (3 * 0.5) = 5.6 + 1.5 = 7.1 points
        // Bob planned: (8 * 0.3) + (3 * 0.5) = 2.4 + 1.5 = 3.9 points
        $this->assertEquals(7.1, $aliceScore['metrics_breakdown']['workload']['planned_points']);
        $this->assertEquals(3.9, $bobScore['metrics_breakdown']['workload']['planned_points']);

        // Sum of both must equal 8 + 3 = 11 points!
        $this->assertEquals(11.0, round($aliceScore['metrics_breakdown']['workload']['planned_points'] + $bobScore['metrics_breakdown']['workload']['planned_points'], 2));
    }

    /**
     * 4. Test On-Time, Quality, and Progress update formulas.
     */
    public function test_on_time_quality_and_progress_formulas(): void
    {
        $startDate = Carbon::now()->startOfMonth();
        $endDate = Carbon::now()->endOfMonth();

        $period = PerformancePeriod::create([
            'board_id' => $this->board->id,
            'title' => 'Formulas Test',
            'period_type' => 'monthly',
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'status' => 'draft',
            'created_by' => $this->owner->id,
        ]);

        // Task 1: Complexity M (3 points). Completed ON TIME. Quality rated 5 stars.
        $task1 = Task::create([
            'column_id' => $this->doneCol->id,
            'title' => 'On Time 5-star Task',
            'complexity' => 'M', // 3 points
            'due_date' => Carbon::now()->addDays(2)->toDateString(),
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
            'quality_rating' => 5,
        ]);
        $task1->assignees()->attach($this->alice->id, ['assigned_by' => $this->owner->id]);

        // Task 2: Complexity M (3 points). Completed LATE. Quality rated 3 stars.
        $task2 = Task::create([
            'column_id' => $this->doneCol->id,
            'title' => 'Late 3-star Task',
            'complexity' => 'M', // 3 points
            'due_date' => Carbon::now()->subDays(2)->toDateString(),
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now()->subDays(5),
            'quality_rating' => 3,
        ]);
        $task2->assignees()->attach($this->alice->id, ['assigned_by' => $this->owner->id]);

        // Alice adds 1 comment on Task 1 and 0 on Task 2
        TaskComment::create([
            'task_id' => $task1->id,
            'user_id' => $this->alice->id,
            'content' => 'Đã cập nhật tiến độ công việc',
            'created_at' => Carbon::now(),
        ]);

        $service = new PerformanceCalculationService();
        $scores = $service->calculatePeriodScores($this->board, $period, false);

        $aliceScore = collect($scores)->firstWhere('user_id', $this->alice->id);

        // Workload: 6/6 completed = 40/40
        $this->assertEquals(40.0, $aliceScore['workload_score']);

        // On-Time: Task 1 on time (3 pts), Task 2 late (3 pts). Total due: 6 pts.
        // on_time_score = 3 / 6 * 25 = 12.5
        $this->assertEquals(12.5, $aliceScore['on_time_score']);

        // Quality:
        // Task 1: 3 pts * (5/5 = 1.0) = 3.0
        // Task 2: 3 pts * (3/5 = 0.6) = 1.8
        // Total weighted quality: (3.0 + 1.8) / 6 = 4.8 / 6 = 0.8
        // quality_score = 0.8 * 25 = 20.0
        $this->assertEquals(20.0, $aliceScore['quality_score']);

        // Progress updates:
        // Alice has 2 assigned tasks. Task 1 has 1 comment, Task 2 has 0 updates.
        // valid_updates = 1 / 2 = 50%.
        // progress_score = 1 / 2 * 10 = 5.0
        $this->assertEquals(5.0, $aliceScore['progress_score']);

        // Total points earned: 40 + 12.5 + 20 + 5 = 77.5
        // Available weight: 40 + 25 + 25 + 10 = 100
        // Final score: 77.5
        $this->assertEquals(77.5, $aliceScore['final_score']);
        $this->assertEquals('Đạt', $aliceScore['rank']); // 65-79.99 = Đạt
    }

    /**
     * 5. Test Missing Data Normalization & Provisional Status when available weight < 50%.
     */
    public function test_missing_data_normalization_and_provisional_status(): void
    {
        $startDate = Carbon::now()->startOfMonth();
        $endDate = Carbon::now()->endOfMonth();

        $period = PerformancePeriod::create([
            'board_id' => $this->board->id,
            'title' => 'Missing Data Test',
            'period_type' => 'monthly',
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'status' => 'draft',
            'created_by' => $this->owner->id,
        ]);

        // Task with NO due date, NO quality review, but completed.
        // Has workload (40) and progress (10) data. NO on_time (0) and NO quality (0).
        // Available weight = 40 + 10 = 50% (>= 50% => official ranking).
        $task = Task::create([
            'column_id' => $this->doneCol->id,
            'title' => 'Task Without Due Date Or Review',
            'complexity' => 'M', // 3 points
            'due_date' => null,
            'completed_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);
        $task->assignees()->attach($this->alice->id, ['assigned_by' => $this->owner->id]);

        TaskComment::create([
            'task_id' => $task->id,
            'user_id' => $this->alice->id,
            'content' => 'Update log',
            'created_at' => Carbon::now(),
        ]);

        $service = new PerformanceCalculationService();
        $scores = $service->calculatePeriodScores($this->board, $period, false);

        $aliceScore = collect($scores)->firstWhere('user_id', $this->alice->id);

        $this->assertEquals(40.0, $aliceScore['workload_score']);
        $this->assertEquals(0.0, $aliceScore['on_time_score']);
        $this->assertFalse($aliceScore['metrics_breakdown']['on_time']['has_data']);
        $this->assertFalse($aliceScore['metrics_breakdown']['quality']['has_data']);
        $this->assertEquals(10.0, $aliceScore['progress_score']);

        // Available weight: 40 + 10 = 50. Total points: 40 + 10 = 50.
        // Final score normalized: (50 / 50) * 100 = 100.0!
        $this->assertEquals(50.0, $aliceScore['available_weight']);
        $this->assertEquals(100.0, $aliceScore['final_score']);
        $this->assertFalse($aliceScore['is_provisional']);
        $this->assertEquals('Xuất sắc', $aliceScore['rank']);

        // Now test Bob who has 0 assigned tasks -> available weight = 0 (< 50% -> Provisional / Chưa đủ dữ liệu)
        $bobScore = collect($scores)->firstWhere('user_id', $this->bob->id);
        $this->assertEquals(0.0, $bobScore['available_weight']);
        $this->assertTrue($bobScore['is_provisional']);
        $this->assertEquals('Chưa đủ dữ liệu', $bobScore['rank']);
    }

    /**
     * 6. Test Period Lifecycle: Publish, Notification, Lock, and Unlock.
     */
    public function test_period_lifecycle_lock_and_notifications(): void
    {
        $startDate = Carbon::now()->startOfMonth()->toDateString();
        $endDate = Carbon::now()->endOfMonth()->toDateString();

        // 1. Owner creates period
        $res = $this->actingAs($this->owner, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/periods", [
            'title' => 'Tháng 10/2026',
            'period_type' => 'monthly',
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);
        $res->assertStatus(201);
        $periodId = $res->json('period.id');

        // 2. Member cannot view draft period
        $memberRes = $this->actingAs($this->alice, 'sanctum')->getJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}");
        $memberRes->assertStatus(403);

        // 3. Outsider is forbidden
        $outsiderRes = $this->actingAs($this->outsider, 'sanctum')->getJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}");
        $outsiderRes->assertStatus(403);

        // 4. Owner publishes period -> sends notification
        $pubRes = $this->actingAs($this->owner, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}/publish");
        $pubRes->assertStatus(200);

        // Check notifications received by Alice
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $this->alice->id,
            'type' => 'App\Notifications\TaskLifecycleNotification',
        ]);

        // 5. Member can now view published period
        $memberViewRes = $this->actingAs($this->alice, 'sanctum')->getJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}");
        $memberViewRes->assertStatus(200);

        // 6. Owner locks period
        $lockRes = $this->actingAs($this->owner, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}/lock");
        $lockRes->assertStatus(200);

        // 7. Cannot recalculate locked period
        $recalcRes = $this->actingAs($this->owner, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}/calculate");
        $recalcRes->assertStatus(422)
            ->assertJsonFragment(['error_code' => 'PERIOD_LOCKED']);

        // 8. Unlock period allows recalculation
        $unlockRes = $this->actingAs($this->owner, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}/unlock");
        $unlockRes->assertStatus(200);

        $recalcAfterUnlock = $this->actingAs($this->owner, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/periods/{$periodId}/calculate");
        $recalcAfterUnlock->assertStatus(200);
    }

    /**
     * 7. Test Policy Versioning & Member Acknowledgment.
     */
    public function test_policy_versioning_and_acknowledgement(): void
    {
        // 1. Get initial policy
        $res = $this->actingAs($this->alice, 'sanctum')->getJson("/api/boards/{$this->board->public_id}/performance/policy");
        $res->assertStatus(200)
            ->assertJsonFragment(['is_acknowledged' => false]);

        // 2. Member acknowledges policy
        $ackRes = $this->actingAs($this->alice, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/policy/acknowledge");
        $ackRes->assertStatus(200);

        $this->assertDatabaseHas('performance_policy_acknowledgements', [
            'board_id' => $this->board->id,
            'user_id' => $this->alice->id,
        ]);

        // 3. Policy now shows acknowledged for Alice
        $checkRes = $this->actingAs($this->alice, 'sanctum')->getJson("/api/boards/{$this->board->public_id}/performance/policy");
        $checkRes->assertStatus(200)
            ->assertJsonFragment(['is_acknowledged' => true]);

        // 4. Owner updates policy to v2.0
        $updatePolicy = $this->actingAs($this->owner, 'sanctum')->postJson("/api/boards/{$this->board->public_id}/performance/policy", [
            'version' => 'v2.0',
            'title' => 'Nội quy hiệu suất v2.0',
            'content' => 'Nội quy cập nhật',
        ]);
        $updatePolicy->assertStatus(200);

        // 5. After new version released, Alice's status is unacknowledged again for the new version
        $afterUpdateRes = $this->actingAs($this->alice, 'sanctum')->getJson("/api/boards/{$this->board->public_id}/performance/policy");
        $afterUpdateRes->assertStatus(200)
            ->assertJsonFragment(['is_acknowledged' => false]);
    }
}
