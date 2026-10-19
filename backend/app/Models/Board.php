<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Board extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'owner_id',
        'workspace_id',
        'department_id',
        'allow_department_notification',
        'public_id',
        'name',
        'description',
        'color',
        'deleted_by',
    ];

    protected $casts = [
        'allow_department_notification' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

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

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function workspace()
    {
        return $this->belongsTo(Workspace::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function telegramIntegration()
    {
        return $this->morphOne(NotificationIntegration::class, 'integratable')
            ->where('provider', 'telegram');
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

    public function review()
    {
        return $this->hasOne(BoardReview::class);
    }

    public function performancePeriods()
    {
        return $this->hasMany(PerformancePeriod::class)->orderBy('start_date', 'desc');
    }

    public function performancePolicies()
    {
        return $this->hasMany(PerformancePolicy::class)->orderBy('created_at', 'desc');
    }

    public function hasMember(int $userId): bool
    {
        if ((int)$this->owner_id === $userId) {
            return true;
        }
        return $this->members()->where('users.id', $userId)->exists();
    }

    public function canManage(User $user): bool
    {
        if ($user->system_role === 'admin' || (int)$this->owner_id === (int)$user->id) {
            return true;
        }
        return $this->members()
            ->where('users.id', $user->id)
            ->whereIn('board_members.role', ['admin', 'owner'])
            ->exists();
    }

    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }
}
