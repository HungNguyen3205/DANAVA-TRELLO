<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformancePolicyAcknowledgement extends Model
{
    protected $fillable = [
        'policy_id',
        'board_id',
        'user_id',
        'acknowledged_at',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'acknowledged_at' => 'datetime',
        ];
    }

    public function policy()
    {
        return $this->belongsTo(PerformancePolicy::class, 'policy_id');
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
