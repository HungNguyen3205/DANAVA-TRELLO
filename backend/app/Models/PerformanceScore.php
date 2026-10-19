<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformanceScore extends Model
{
    protected $fillable = [
        'period_id',
        'board_id',
        'user_id',
        'workload_score',
        'on_time_score',
        'quality_score',
        'progress_score',
        'total_points_earned',
        'available_weight',
        'final_score',
        'is_provisional',
        'rank',
        'metrics_breakdown',
        'task_details',
    ];

    protected function casts(): array
    {
        return [
            'workload_score' => 'float',
            'on_time_score' => 'float',
            'quality_score' => 'float',
            'progress_score' => 'float',
            'total_points_earned' => 'float',
            'available_weight' => 'float',
            'final_score' => 'float',
            'is_provisional' => 'boolean',
            'metrics_breakdown' => 'array',
            'task_details' => 'array',
        ];
    }

    public function period()
    {
        return $this->belongsTo(PerformancePeriod::class, 'period_id');
    }

    public function board()
    {
        return $this->belongsTo(Board::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
