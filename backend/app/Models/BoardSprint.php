<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BoardSprint extends Model
{
    protected $fillable = ['board_id', 'name', 'start_date', 'end_date', 'status'];

    public function board()
    {
        return $this->belongsTo(Board::class);
    }

    public function tasks()
    {
        return $this->hasMany(Task::class, 'sprint_id');
    }
}
