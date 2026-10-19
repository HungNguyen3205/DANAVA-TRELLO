<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TaskGroup extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'task_id',
        'title',
        'position',
        'created_by',
    ];

    public function task()
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function subtasks()
    {
        return $this->hasMany(Task::class, 'task_group_id')
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
