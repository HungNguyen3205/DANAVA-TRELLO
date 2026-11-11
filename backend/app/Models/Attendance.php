<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    protected $fillable = [
        'user_id',
        'work_date',
        'check_in_at',
        'check_out_at',
        'check_in_ip',
        'check_out_ip',
        'note',
    ];

    protected $casts = [
        'work_date' => 'date:Y-m-d',
        'check_in_at' => 'datetime',
        'check_out_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
