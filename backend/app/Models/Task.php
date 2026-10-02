<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'column_id', 
        'sprint_id', 
        'assignee_id', 
        'title', 
        'description', 
        'priority', 
        'order', 
        'start_date',
        'due_date',
        'completed_at',
        'completed_by'
    ];

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
        return $query->whereHas('column.board.workspace.members', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        });
    }
}
