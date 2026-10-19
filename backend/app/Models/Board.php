<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Board extends Model
{
    protected $fillable = ['workspace_id', 'public_id', 'name', 'description', 'color'];

    protected static function booted(): void
    {
        static::creating(function (Board $board) {
            if (!$board->public_id) {
                $board->public_id = static::generatePublicId();
            }
        });
    }

    public static function generatePublicId(): string
    {
        do {
            $publicId = Str::lower(Str::random(12));
        } while (static::where('public_id', $publicId)->exists());

        return $publicId;
    }

    public function workspace()
    {
        return $this->belongsTo(Workspace::class);
    }

    public function sprints()
    {
        return $this->hasMany(BoardSprint::class);
    }

    public function columns()
    {
        return $this->hasMany(KanbanColumn::class);
    }

    public function labels()
    {
        return $this->hasMany(Label::class);
    }

    public function members()
    {
        return $this->belongsToMany(User::class, 'board_members', 'board_id', 'user_id')
                    ->withPivot('role', 'is_starred')
                    ->withTimestamps();
    }

    public function tasks()
    {
        return $this->hasManyThrough(Task::class, KanbanColumn::class, 'board_id', 'column_id');
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class)->orderBy('created_at', 'desc');
    }
}
