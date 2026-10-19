<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KanbanColumn extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'board_id', 
        'title', 
        'color', 
        'wip_limit',
        'wip_enforcement',
        'order', 
        'archived_at', 
        'archived_by',
        'deleted_by'
    ];

    protected $appends = ['wip_count'];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'wip_limit' => 'integer',
        ];
    }

    /**
     * Active WIP count of the column.
     * Counts ONLY root/parent tasks (parent_task_id is NULL), excluding archived and soft-deleted tasks.
     */
    public function getWipCountAttribute(): int
    {
        if ($this->relationLoaded('tasks')) {
            return $this->tasks
                ->filter(fn($t) => is_null($t->parent_task_id) && is_null($t->archived_at) && is_null($t->deleted_at))
                ->count();
        }

        return Task::where('column_id', $this->id)
            ->whereNull('parent_task_id')
            ->whereNull('archived_at')
            ->count();
    }

    /**
     * Check if adding a task would exceed column's WIP limit.
     */
    public function isWipExceeded(int $additional = 1): bool
    {
        if (!$this->wip_limit || $this->wip_limit <= 0) {
            return false;
        }

        return ($this->wip_count + $additional) > $this->wip_limit;
    }

    public function board()
    {
        return $this->belongsTo(Board::class);
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by');
    }

    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class, 'column_id')->orderBy('order');
    }

    public function scopeActive($query)
    {
        return $query->whereNull('archived_at');
    }

    public function scopeArchived($query)
    {
        return $query->whereNotNull('archived_at');
    }
}
