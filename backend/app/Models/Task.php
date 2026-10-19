<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'parent_task_id',
        'column_id', 
        'sprint_id', 
        'assignee_id', 
        'created_by',
        'title', 
        'description', 
        'priority', 
        'order', 
        'sort_order',
        'start_date',
        'due_date',
        'completed_at',
        'completed_by'
    ];

    public function parent()
    {
        return $this->belongsTo(Task::class, 'parent_task_id');
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
                    ->withPivot('assigned_by')
                    ->withTimestamps();
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

    // Scope to filter tasks in workspaces the user is a member of
    public function scopeInUserWorkspaces($query, $userId)
    {
        return $query->whereHas('column.board', function ($q) use ($userId) {
            $q->whereIn('workspace_id', function ($sub) use ($userId) {
                $sub->select('workspace_id')
                    ->from('workspace_members')
                    ->where('user_id', $userId);
            });
        });
    }
}
