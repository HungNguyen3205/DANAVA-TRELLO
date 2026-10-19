<?php

namespace App\Services;

use App\Models\Board;
use App\Models\PerformancePeriod;
use App\Models\PerformanceScore;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PerformanceCalculationService
{
    public const COMPLEXITY_POINTS = [
        'XS' => 1,
        'S'  => 2,
        'M'  => 3,
        'L'  => 5,
        'XL' => 8,
    ];

    public const WEIGHT_WORKLOAD = 40.0;
    public const WEIGHT_ON_TIME  = 25.0;
    public const WEIGHT_QUALITY  = 25.0;
    public const WEIGHT_PROGRESS = 10.0;

    /**
     * Resolve complexity string into numerical points.
     */
    public static function getComplexityPoints(?string $complexity): int
    {
        $key = strtoupper(trim((string) $complexity));
        return self::COMPLEXITY_POINTS[$key] ?? 3;
    }

    /**
     * Determine if a task is completed based on completed_at or done columns.
     */
    public static function isTaskDone($task, array $doneColumnNames = ['done', 'hoàn thành', 'completed']): bool
    {
        if (!empty($task->completed_at)) {
            return true;
        }
        $colTitle = mb_strtolower(trim((string) ($task->column_title ?? '')));
        return in_array($colTitle, $doneColumnNames, true);
    }

    /**
     * Check if a completed task was completed on time.
     */
    public static function isCompletedOnTime($task): bool
    {
        if (empty($task->due_date)) {
            return false;
        }

        $completedAt = !empty($task->completed_at)
            ? Carbon::parse($task->completed_at)
            : Carbon::parse($task->updated_at ?? now());

        $dueDateEnd = Carbon::parse($task->due_date)->endOfDay();
        return $completedAt->lte($dueDateEnd);
    }

    /**
     * Determine rank based on final_score and available_weight.
     */
    public static function determineRank(float $finalScore, float $availableWeight, bool &$isProvisional): string
    {
        if ($availableWeight < 50.0) {
            $isProvisional = true;
            return $availableWeight <= 0 ? 'Chưa đủ dữ liệu' : 'Tạm tính (< 50% dữ liệu)';
        }

        $isProvisional = false;
        if ($finalScore >= 90.0) {
            return 'Xuất sắc';
        }
        if ($finalScore >= 80.0) {
            return 'Tốt';
        }
        if ($finalScore >= 65.0) {
            return 'Đạt';
        }
        if ($finalScore >= 50.0) {
            return 'Cần cải thiện';
        }
        return 'Chưa đạt';
    }

    /**
     * Calculate performance scores for a board over a given period.
     * Can optionally persist results to the performance_scores table.
     *
     * @param Board $board
     * @param PerformancePeriod $period
     * @param bool $persist
     * @return array
     */
    public function calculatePeriodScores(Board $board, PerformancePeriod $period, bool $persist = false): array
    {
        $startDate = Carbon::parse($period->start_date)->startOfDay();
        $endDate   = Carbon::parse($period->end_date)->endOfDay();

        // 1. Identify parent tasks that have subtasks to strictly prevent double counting
        $parentTaskIdsWithChildren = DB::table('tasks')
            ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
            ->where('kanban_columns.board_id', $board->id)
            ->whereNotNull('tasks.parent_task_id')
            ->whereNull('tasks.deleted_at')
            ->distinct()
            ->pluck('tasks.parent_task_id')
            ->toArray();

        // 2. Fetch all candidate actionable tasks for this board
        // Rule: Subtasks OR Root tasks without subtasks
        $tasksQuery = DB::table('tasks')
            ->join('kanban_columns', 'tasks.column_id', '=', 'kanban_columns.id')
            ->where('kanban_columns.board_id', $board->id)
            ->whereNull('tasks.deleted_at');

        if (!empty($parentTaskIdsWithChildren)) {
            $tasksQuery->whereNotIn('tasks.id', $parentTaskIdsWithChildren);
        }

        // Filter tasks that fall within the evaluation period:
        // Task has due_date in period OR created_at in period OR completed_at in period
        $tasksQuery->where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('tasks.due_date', [$startDate->toDateString(), $endDate->toDateString()])
              ->orWhereBetween('tasks.created_at', [$startDate, $endDate])
              ->orWhereBetween('tasks.completed_at', [$startDate, $endDate]);
        });

        $actionableTasks = $tasksQuery
            ->select([
                'tasks.id',
                'tasks.parent_task_id',
                'tasks.title',
                'tasks.complexity',
                'tasks.priority',
                'tasks.due_date',
                'tasks.start_date',
                'tasks.completed_at',
                'tasks.created_at',
                'tasks.updated_at',
                'tasks.quality_rating',
                'tasks.quality_review_note',
                'tasks.quality_reviewed_by',
                'tasks.quality_reviewed_at',
                'kanban_columns.title as column_title',
            ])
            ->get();

        $actionableTaskIds = $actionableTasks->pluck('id')->toArray();

        // 3. Fetch assignees with contribution_percent for these tasks
        $allAssignees = DB::table('task_assignees')
            ->whereIn('task_id', $actionableTaskIds)
            ->get()
            ->groupBy('task_id');

        // 4. Fetch activity logs & comments in this period for progress update scoring
        $taskActivityByUser = DB::table('activity_logs')
            ->whereIn('task_id', $actionableTaskIds)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->whereNotNull('user_id')
            ->select(['task_id', 'user_id'])
            ->get()
            ->groupBy(fn ($item) => "{$item->task_id}_{$item->user_id}");

        $taskCommentsByUser = DB::table('task_comments')
            ->whereIn('task_id', $actionableTaskIds)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->select(['task_id', 'user_id'])
            ->get()
            ->groupBy(fn ($item) => "{$item->task_id}_{$item->user_id}");

        // 5. Fetch Board Members
        $boardMembers = DB::table('board_members')
            ->join('users', 'board_members.user_id', '=', 'users.id')
            ->leftJoin('departments', 'users.department_id', '=', 'departments.id')
            ->where('board_members.board_id', $board->id)
            ->select([
                'users.id',
                'users.name',
                'users.username',
                'users.email',
                'users.avatar',
                'users.account_status',
                'users.department_id',
                'departments.name as department_name',
                'departments.color as department_color',
                'board_members.role',
            ])
            ->get();

        // Include board owner if not in board_members table
        if ($board->owner_id && !$boardMembers->contains('id', $board->owner_id)) {
            $ownerUser = User::with('department')->find($board->owner_id);
            if ($ownerUser) {
                $boardMembers->push((object)[
                    'id' => $ownerUser->id,
                    'name' => $ownerUser->name,
                    'username' => $ownerUser->username,
                    'email' => $ownerUser->email,
                    'avatar' => $ownerUser->avatar,
                    'account_status' => $ownerUser->account_status ?? 'active',
                    'department_id' => $ownerUser->department_id,
                    'department_name' => $ownerUser->department?->name,
                    'department_color' => $ownerUser->department?->color,
                    'role' => 'owner',
                ]);
            }
        }

        // 6. Pre-calculate effective task points and assignee contributions
        // For each task, compute each assignee's contribution share
        $taskMemberAllocations = []; // [userId => [taskAllocations]]

        foreach ($actionableTasks as $task) {
            $assignees = $allAssignees->get($task->id, collect());
            $assigneeCount = $assignees->count();

            if ($assigneeCount === 0) {
                continue; // Unassigned task
            }

            $complexityPoints = self::getComplexityPoints($task->complexity);

            // Check if contribution_percent was manually provided and sums to 100%
            $hasManualPercents = true;
            $percentSum = 0.0;
            foreach ($assignees as $asg) {
                if ($asg->contribution_percent === null || $asg->contribution_percent === '') {
                    $hasManualPercents = false;
                    break;
                }
                $percentSum += (float) $asg->contribution_percent;
            }

            $useManual = $hasManualPercents && (abs($percentSum - 100.0) < 0.1);

            foreach ($assignees as $asg) {
                $userId = (int) $asg->user_id;
                $sharePercent = $useManual
                    ? ((float) $asg->contribution_percent)
                    : round(100.0 / $assigneeCount, 2);

                $shareFraction = $sharePercent / 100.0;
                $effectivePoints = round($complexityPoints * $shareFraction, 4);

                $isDone = self::isTaskDone($task);
                $isOnTime = $isDone ? self::isCompletedOnTime($task) : false;

                $taskMemberAllocations[$userId][] = [
                    'task_id' => $task->id,
                    'title' => $task->title,
                    'parent_task_id' => $task->parent_task_id,
                    'complexity' => $task->complexity ?: 'M',
                    'base_points' => $complexityPoints,
                    'contribution_percent' => $sharePercent,
                    'effective_points' => $effectivePoints,
                    'is_completed' => $isDone,
                    'completed_at' => $task->completed_at,
                    'due_date' => $task->due_date,
                    'has_due_date' => !empty($task->due_date),
                    'is_on_time' => $isOnTime,
                    'quality_rating' => $task->quality_rating ? (int) $task->quality_rating : null,
                    'quality_review_note' => $task->quality_review_note,
                ];
            }
        }

        // 7. Calculate scores for each member
        $results = [];

        foreach ($boardMembers as $member) {
            $userId = (int) $member->id;
            $tasksAllocated = $taskMemberAllocations[$userId] ?? [];

            // A. WORKLOAD (Khối lượng - Max 40)
            $plannedPoints = 0.0;
            $completedPoints = 0.0;

            foreach ($tasksAllocated as $t) {
                $plannedPoints += $t['effective_points'];
                if ($t['is_completed']) {
                    $completedPoints += $t['effective_points'];
                }
            }

            $hasWorkloadData = $plannedPoints > 0;
            $workloadScore = 0.0;
            if ($hasWorkloadData) {
                $completionRatio = min(1.0, $completedPoints / $plannedPoints);
                $workloadScore = round($completionRatio * self::WEIGHT_WORKLOAD, 2);
            }

            // B. ON-TIME (Đúng hạn - Max 25)
            // Look at completed tasks that had a due date
            $completedDuePoints = 0.0;
            $onTimeCompletedPoints = 0.0;

            foreach ($tasksAllocated as $t) {
                if ($t['is_completed'] && $t['has_due_date']) {
                    $completedDuePoints += $t['effective_points'];
                    if ($t['is_on_time']) {
                        $onTimeCompletedPoints += $t['effective_points'];
                    }
                }
            }

            $hasOnTimeData = $completedDuePoints > 0;
            $onTimeScore = 0.0;
            if ($hasOnTimeData) {
                $onTimeRatio = min(1.0, $onTimeCompletedPoints / $completedDuePoints);
                $onTimeScore = round($onTimeRatio * self::WEIGHT_ON_TIME, 2);
            }

            // C. QUALITY (Chất lượng - Max 25)
            // Weighted average of rated tasks: quality_rating (1-5) / 5.0
            $totalReviewedPoints = 0.0;
            $weightedQualitySum = 0.0;
            $reviewedTasksCount = 0;

            foreach ($tasksAllocated as $t) {
                if (!empty($t['quality_rating'])) {
                    $reviewedTasksCount++;
                    $starRatio = ((float) $t['quality_rating']) / 5.0;
                    $totalReviewedPoints += $t['effective_points'];
                    $weightedQualitySum += ($t['effective_points'] * $starRatio);
                }
            }

            $hasQualityData = $totalReviewedPoints > 0;
            $qualityScore = 0.0;
            if ($hasQualityData) {
                $weightedQualityRatio = $weightedQualitySum / $totalReviewedPoints;
                $qualityScore = round($weightedQualityRatio * self::WEIGHT_QUALITY, 2);
            }

            // D. PROGRESS UPDATES (Cập nhật tiến độ - Max 10)
            // For each assigned task, requires at least 1 update in period
            $assignedTasksCount = count($tasksAllocated);
            $requiredUpdates = $assignedTasksCount;
            $validUpdates = 0;
            $progressLogs = [];

            if ($assignedTasksCount > 0) {
                foreach ($tasksAllocated as $t) {
                    $key = "{$t['task_id']}_{$userId}";
                    $actCount = isset($taskActivityByUser[$key]) ? $taskActivityByUser[$key]->count() : 0;
                    $cmtCount = isset($taskCommentsByUser[$key]) ? $taskCommentsByUser[$key]->count() : 0;
                    $totalTaskUpdates = $actCount + $cmtCount;

                    // Cap at 1 valid update per assigned task to encourage consistent updates
                    $hasValidUpdate = $totalTaskUpdates > 0;
                    if ($hasValidUpdate) {
                        $validUpdates++;
                    }

                    $progressLogs[] = [
                        'task_id' => $t['task_id'],
                        'title' => $t['title'],
                        'activities_count' => $actCount,
                        'comments_count' => $cmtCount,
                        'has_valid_update' => $hasValidUpdate,
                    ];
                }
            }

            $hasProgressData = $requiredUpdates > 0;
            $progressScore = 0.0;
            if ($hasProgressData) {
                $progressRatio = min(1.0, $validUpdates / $requiredUpdates);
                $progressScore = round($progressRatio * self::WEIGHT_PROGRESS, 2);
            }

            // E. MISSING DATA NORMALIZATION & FINAL SCORE
            $availableWeight = 0.0;
            if ($hasWorkloadData)  $availableWeight += self::WEIGHT_WORKLOAD;
            if ($hasOnTimeData)    $availableWeight += self::WEIGHT_ON_TIME;
            if ($hasQualityData)   $availableWeight += self::WEIGHT_QUALITY;
            if ($hasProgressData)  $availableWeight += self::WEIGHT_PROGRESS;

            $totalPointsEarned = round($workloadScore + $onTimeScore + $qualityScore + $progressScore, 2);

            $finalScore = 0.0;
            if ($availableWeight > 0) {
                $finalScore = round(($totalPointsEarned / $availableWeight) * 100.0, 2);
            }

            $isProvisional = false;
            $rank = self::determineRank($finalScore, $availableWeight, $isProvisional);

            $metricsBreakdown = [
                'workload' => [
                    'weight' => self::WEIGHT_WORKLOAD,
                    'has_data' => $hasWorkloadData,
                    'score' => $workloadScore,
                    'planned_points' => round($plannedPoints, 2),
                    'completed_points' => round($completedPoints, 2),
                    'completion_rate' => $plannedPoints > 0 ? round(($completedPoints / $plannedPoints) * 100, 2) : 0,
                ],
                'on_time' => [
                    'weight' => self::WEIGHT_ON_TIME,
                    'has_data' => $hasOnTimeData,
                    'score' => $onTimeScore,
                    'completed_due_points' => round($completedDuePoints, 2),
                    'on_time_completed_points' => round($onTimeCompletedPoints, 2),
                    'on_time_rate' => $completedDuePoints > 0 ? round(($onTimeCompletedPoints / $completedDuePoints) * 100, 2) : 0,
                ],
                'quality' => [
                    'weight' => self::WEIGHT_QUALITY,
                    'has_data' => $hasQualityData,
                    'score' => $qualityScore,
                    'reviewed_tasks_count' => $reviewedTasksCount,
                    'reviewed_points' => round($totalReviewedPoints, 2),
                    'weighted_ratio' => $totalReviewedPoints > 0 ? round($weightedQualitySum / $totalReviewedPoints, 4) : 0,
                ],
                'progress' => [
                    'weight' => self::WEIGHT_PROGRESS,
                    'has_data' => $hasProgressData,
                    'score' => $progressScore,
                    'required_updates' => $requiredUpdates,
                    'valid_updates' => $validUpdates,
                    'progress_rate' => $requiredUpdates > 0 ? round(($validUpdates / $requiredUpdates) * 100, 2) : 0,
                    'task_logs' => $progressLogs,
                ],
                'overall' => [
                    'total_points_earned' => $totalPointsEarned,
                    'available_weight' => $availableWeight,
                    'final_score' => $finalScore,
                    'is_provisional' => $isProvisional,
                    'rank' => $rank,
                ],
            ];

            $resultItem = [
                'user_id' => $userId,
                'user_name' => $member->name,
                'user_username' => $member->username ?? '',
                'user_email' => $member->email ?? '',
                'user_avatar' => $member->avatar ?? null,
                'account_status' => $member->account_status ?? 'active',
                'department_id' => $member->department_id ?? null,
                'department_name' => $member->department_name ?? null,
                'department_color' => $member->department_color ?? null,
                'role' => $member->role ?? 'member',
                'workload_score' => $workloadScore,
                'on_time_score' => $onTimeScore,
                'quality_score' => $qualityScore,
                'progress_score' => $progressScore,
                'total_points_earned' => $totalPointsEarned,
                'available_weight' => $availableWeight,
                'final_score' => $finalScore,
                'is_provisional' => $isProvisional,
                'rank' => $rank,
                'metrics_breakdown' => $metricsBreakdown,
                'task_details' => $tasksAllocated,
            ];

            $results[] = $resultItem;

            // Persist to database if requested
            if ($persist) {
                PerformanceScore::updateOrCreate(
                    [
                        'period_id' => $period->id,
                        'user_id' => $userId,
                    ],
                    [
                        'board_id' => $board->id,
                        'workload_score' => $workloadScore,
                        'on_time_score' => $onTimeScore,
                        'quality_score' => $qualityScore,
                        'progress_score' => $progressScore,
                        'total_points_earned' => $totalPointsEarned,
                        'available_weight' => $availableWeight,
                        'final_score' => $finalScore,
                        'is_provisional' => $isProvisional,
                        'rank' => $rank,
                        'metrics_breakdown' => $metricsBreakdown,
                        'task_details' => $tasksAllocated,
                    ]
                );
            }
        }

        // Sort results by final_score descending
        usort($results, fn ($a, $b) => $b['final_score'] <=> $a['final_score']);

        return $results;
    }
}
