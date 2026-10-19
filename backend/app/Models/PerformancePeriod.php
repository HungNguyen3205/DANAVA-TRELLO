<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformancePeriod extends Model
{
    protected $fillable = [
        'board_id',
        'title',
        'period_type',
        'start_date',
        'end_date',
        'status',
        'created_by',
        'published_by',
        'published_at',
        'locked_by',
        'locked_at',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'published_at' => 'datetime',
            'locked_at' => 'datetime',
        ];
    }

    public function board()
    {
        return $this->belongsTo(Board::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function publisher()
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function locker()
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    public function scores()
    {
        return $this->hasMany(PerformanceScore::class, 'period_id');
    }

    public function isLocked(): bool
    {
        return $this->status === 'locked';
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }
}
