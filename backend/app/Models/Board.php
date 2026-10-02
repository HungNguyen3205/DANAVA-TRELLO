<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Board extends Model
{
    protected $fillable = ['workspace_id', 'name', 'description', 'color'];

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
}
