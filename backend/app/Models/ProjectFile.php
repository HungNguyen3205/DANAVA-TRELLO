<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A document shared with everyone in a project. Stored on the private disk. */
class ProjectFile extends Model
{
    protected $fillable = ['project_id', 'user_id', 'name', 'path', 'mime', 'size'];

    protected $casts = ['size' => 'integer'];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
