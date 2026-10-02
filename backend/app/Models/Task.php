<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $fillable = [
        'column_id', 
        'sprint_id', 
        'assignee_id', 
        'title', 
        'description', 
        'priority', 
        'order', 
        'due_date'
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
        return $this->hasMany(TaskComment::class);
    }
}
