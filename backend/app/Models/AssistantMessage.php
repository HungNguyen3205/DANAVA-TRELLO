<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssistantMessage extends Model
{
    protected $fillable = ['user_id', 'role', 'content', 'meta'];

    protected $casts = [
        'meta' => 'array',
    ];
}
