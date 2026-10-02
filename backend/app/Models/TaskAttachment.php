<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskAttachment extends Model
{
    protected $fillable = ['task_id', 'user_id', 'file_name', 'file_path', 'mime_type', 'size'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
