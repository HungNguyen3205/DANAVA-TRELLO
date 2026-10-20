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

    /**
     * Retrieve the model for a bound value.
     * Supports both numeric id and alphanumeric public_id.
     *
     * @param  mixed  $value
     * @param  string|null  $field
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public function resolveRouteBinding($value, $field = null)
    {
        if (is_numeric($value)) {
            $board = $this->where('id', $value)->first();
            if ($board) {
                return $board;
            }
        }

        return $this->where('public_id', $value)->first();
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
        $user = User::find($userId);
        if (!$user) {
            return false;
        }
        return app(\App\Services\BoardAccessService::class)->canView($user, $this);
    }

    public function canManage(User $user): bool
    {
        return app(\App\Services\BoardAccessService::class)->canManage($user, $this);
    }

    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }
}
