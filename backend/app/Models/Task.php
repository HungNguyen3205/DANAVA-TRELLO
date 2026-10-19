<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use SoftDeletes;

    public const COMPLEXITY_POINTS = [
        'XS' => 1,
        'S'  => 2,
        'M'  => 3,
        'L'  => 5,
        'XL' => 8,
    ];

    protected $fillable = [
        'external_key',
        'parent_task_id',
        'task_group_id',
        'column_id', 
        'sprint_id', 
        'assignee_id', 
        'created_by',
        'title', 
        'description', 
        'notes',
        'priority', 
        'complexity',
        'estimated_points',
        'progress_percent',
        'order', 
        'sort_order',
        'start_date',
        'due_date',
        'completed_at',
        'completed_by',
        'archived_at',
        'archived_by',
        'quality_rating',
        'quality_review_note',
        'quality_reviewed_by',
        'quality_reviewed_at',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'completed_at' => 'datetime',
            'quality_reviewed_at' => 'datetime',
            'quality_rating' => 'integer',
        ];
    }

    public function parent()
    {
        return $this->belongsTo(Task::class, 'parent_task_id');
    }

    public function taskGroup()
    {
        return $this->belongsTo(TaskGroup::class, 'task_group_id');
    }

    public function taskGroups()
    {
        return $this->hasMany(TaskGroup::class, 'task_id')
                    ->orderBy('position', 'asc')
                    ->orderBy('id', 'asc');
    }

    public function subtasks()
    {
        return $this->hasMany(Task::class, 'parent_task_id')
                    ->orderBy('sort_order', 'asc')
                    ->orderBy('id', 'asc');
    }

    public function assignees()
    {
        return $this->belongsToMany(User::class, 'task_assignees', 'task_id', 'user_id')
                    ->withPivot(['assigned_by', 'assigned_at', 'contribution_percent', 'responsibility_role'])
                    ->withTimestamps();
    }

    /**
     * Calculate balanced contribution percentages summing to exactly 100%.
     */
    public static function calculateEqualContributionPercents(array $userIds): array
    {
        $count = count($userIds);
        if ($count === 0) {
            return [];
        }

        if ($count === 1) {
            return [$userIds[0] => 100.0];
        }

        $basePercent = round(100.0 / $count, 2);
        $result = [];
        $accumulated = 0.0;

        foreach ($userIds as $idx => $uid) {
            if ($idx === $count - 1) {
                // Ensure exact 100% total
                $result[$uid] = round(100.0 - $accumulated, 2);
            } else {
                $result[$uid] = $basePercent;
                $accumulated += $basePercent;
            }
        }

        return $result;
    }

    /**
     * Sync task assignees with auto-split or custom contribution percent.
     */
    public function syncAssigneesWithAutoSplit(array $userIds, ?int $assignedBy = null, ?array $customPercents = null): void
    {
        $uniqueUserIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        $count = count($uniqueUserIds);

        if ($count === 0) {
            $this->assignees()->sync([]);
            $this->update(['assignee_id' => null]);
            return;
        }

        $percents = [];
        if (!empty($customPercents)) {
            $sum = 0.0;
            foreach ($uniqueUserIds as $uid) {
                $p = isset($customPercents[$uid]) ? (float) $customPercents[$uid] : 0.0;
                $percents[$uid] = $p;
                $sum += $p;
            }
            // If custom percents provided don't sum to 100%, rebalance
            if (abs($sum - 100.0) >= 0.1) {
                $percents = self::calculateEqualContributionPercents($uniqueUserIds);
            }
        } else {
            $percents = self::calculateEqualContributionPercents($uniqueUserIds);
        }

        $syncData = [];
        $existingAssignees = $this->assignees()->get()->keyBy('id');

        foreach ($uniqueUserIds as $uid) {
            $existing = $existingAssignees->get($uid);
            $syncData[$uid] = [
                'assigned_by' => $existing?->pivot->assigned_by ?: $assignedBy,
                'assigned_at' => $existing?->pivot->assigned_at ?: now(),
                'contribution_percent' => $percents[$uid] ?? round(100.0 / $count, 2),
                'responsibility_role' => $existing?->pivot->responsibility_role ?: null,
            ];
        }

        $this->assignees()->sync($syncData);

        // Keep legacy assignee_id in sync with first assignee
        $this->update(['assignee_id' => $uniqueUserIds[0] ?? null]);
    }

    public function qualityReviewer()
    {
        return $this->belongsTo(User::class, 'quality_reviewed_by');
    }

    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    public function getComplexityPointsAttribute(): int
    {
        return self::COMPLEXITY_POINTS[strtoupper($this->complexity ?? 'M')] ?? 3;
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function board()
    {
        return $this->hasOneThrough(Board::class, KanbanColumn::class, 'id', 'id', 'column_id', 'board_id');
    }

    public function column()
    {
        return $this->belongsTo(KanbanColumn::class, 'column_id');
    }

    public function sprint()
    {
        return $this->belongsTo(BoardSprint::class, 'sprint_id');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function comments()
    {
        return $this->hasMany(TaskComment::class)->orderBy('created_at', 'desc');
    }

    public function checklists()
    {
        return $this->hasMany(Checklist::class);
    }

    public function checklistItems()
    {
        return $this->hasManyThrough(ChecklistItem::class, Checklist::class);
    }

    public function labels()
    {
        return $this->belongsToMany(Label::class, 'task_labels');
    }

    public function attachments()
    {
        return $this->hasMany(TaskAttachment::class)->orderBy('created_at', 'desc');
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class)->orderBy('created_at', 'desc');
    }

    public function scopeRootTasks($query)
    {
        return $query->whereNull('tasks.parent_task_id');
    }

    public function scopeSubtasks($query)
    {
        return $query->whereNotNull('tasks.parent_task_id');
    }

    // Scopes for Task completion status
    public function scopeCompleted($query)
    {
        return $query->where(function ($q) {
            $q->whereNotNull('tasks.completed_at')
              ->orWhereHas('column', function ($sub) {
                  $sub->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), ['done', 'hoàn thành', 'completed']);
              });
        });
    }

    public function scopePending($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('tasks.completed_at')
              ->whereDoesntHave('column', function ($sub) {
                  $sub->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(title)'), ['done', 'hoàn thành', 'completed']);
              });
        });
    }

    // Scope to filter tasks in boards the user is an owner or member of
    public function scopeInUserBoards($query, $userId)
    {
        return $query->whereHas('column.board', function ($q) use ($userId) {
            $q->where(function ($sub) use ($userId) {
                $sub->where('boards.owner_id', $userId)
                    ->orWhereIn('boards.id', function ($mQuery) use ($userId) {
                        $mQuery->select('board_id')
                               ->from('board_members')
                               ->where('user_id', $userId);
                    });
            });
        });
    }

    // Deprecated scope kept for backwards compatibility
    public function scopeInUserWorkspaces($query, $userId)
    {
        return $this->scopeInUserBoards($query, $userId);
    }
}
