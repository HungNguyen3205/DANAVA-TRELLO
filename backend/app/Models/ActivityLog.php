<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = ['task_id', 'user_id', 'action', 'old_value', 'new_value'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
