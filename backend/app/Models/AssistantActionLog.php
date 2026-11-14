<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssistantActionLog extends Model
{
    protected $fillable = [
        'user_id', 'tool', 'status', 'target_type', 'target_id', 'target_label',
        'arguments', 'changes', 'message', 'request_text',
    ];

    protected $casts = [
        'arguments' => 'array',
        'changes' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
