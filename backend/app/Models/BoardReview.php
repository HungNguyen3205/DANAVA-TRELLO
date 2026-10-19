<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BoardReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'board_id',
        'status',
        'goals',
        'summary',
        'achievements',
        'unfinished_work',
        'issues',
        'lessons_learned',
        'revenue',
        'cost',
        'profit',
        'overall_rating',
        'member_reviews',
        'attachments',
        'created_by',
        'published_by',
        'published_at',
        'locked_by',
        'locked_at',
    ];

    protected function casts(): array
    {
        return [
            'member_reviews' => 'array',
            'attachments' => 'array',
            'revenue' => 'decimal:2',
            'cost' => 'decimal:2',
            'profit' => 'decimal:2',
            'overall_rating' => 'integer',
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
}
