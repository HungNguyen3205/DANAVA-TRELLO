<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'username',
        'system_role',
        'account_status',
        'must_change_password',
        'created_by',
        'phone',
        'gender',
        'position',
        'avatar',
        'dob',
        'address',
        'join_date',
        'contact_email',
        'notification_preferences',
        'department_id',
        'department_title',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'notification_preferences' => 'array',
        ];
    }

    public function workspaces()
    {
        return $this->belongsToMany(Workspace::class, 'workspace_members')->withPivot('role')->withTimestamps();
    }

    public function boards()
    {
        return $this->belongsToMany(Board::class, 'board_members')->withPivot('role', 'is_starred')->withTimestamps();
    }

    public function assignedTasks()
    {
        return $this->belongsToMany(Task::class, 'task_assignees')
                    ->withPivot([
                        'assigned_by',
                        'assigned_at',
                        'contribution_percent',
                        'responsibility_role',
                    ])
                    ->withTimestamps();
    }

    public function isBoardMember(int|string|null $boardId): bool
    {
        if (!$boardId) return false;
        $board = Board::find($boardId);
        if (!$board) return false;
        return app(\App\Services\BoardAccessService::class)->canView($this, $board);
    }

    public function isBoardAdmin(int|string|null $boardId): bool
    {
        if (!$boardId) return false;
        $board = Board::find($boardId);
        if (!$board) return false;
        return app(\App\Services\BoardAccessService::class)->canManage($this, $board);
    }

    protected static function booted()
    {
        static::saved(function ($user) {
            if ($user->department_id && !empty($user->id)) {
                \Illuminate\Support\Facades\DB::table('department_members')->updateOrInsert(
                    ['department_id' => $user->department_id, 'user_id' => $user->id],
                    [
                        'role' => 'member',
                        'title' => $user->department_title,
                        'is_primary' => true,
                        'updated_at' => now(),
                    ]
                );
            }
        });
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function departments()
    {
        return $this->belongsToMany(Department::class, 'department_members')
            ->withPivot(['role', 'title', 'is_primary'])
            ->withTimestamps();
    }

    public function managedDepartment()
    {
        return $this->hasOne(Department::class, 'manager_id');
    }

    public function managedDepartments()
    {
        return $this->hasMany(Department::class, 'manager_id');
    }
}

