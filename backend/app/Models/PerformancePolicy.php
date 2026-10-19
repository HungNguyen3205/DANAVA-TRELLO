<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformancePolicy extends Model
{
    protected $fillable = [
        'board_id',
        'version',
        'title',
        'content',
        'created_by',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
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

    public function acknowledgements()
    {
        return $this->hasMany(PerformancePolicyAcknowledgement::class, 'policy_id');
    }
}
