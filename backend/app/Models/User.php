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

    public function isBoardMember(int|string|null $boardId): bool
    {
        if (!$boardId) return false;
        $isOwner = Board::where('id', $boardId)->where('owner_id', $this->id)->exists();
        if ($isOwner) return true;
        return \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $boardId)
            ->where('user_id', $this->id)
            ->exists();
    }

    public function isBoardAdmin(int|string|null $boardId): bool
    {
        if (!$boardId) return false;
        $isOwner = Board::where('id', $boardId)->where('owner_id', $this->id)->exists();
        if ($isOwner) return true;
        return \Illuminate\Support\Facades\DB::table('board_members')
            ->where('board_id', $boardId)
            ->where('user_id', $this->id)
            ->whereIn('role', ['admin', 'owner'])
            ->exists();
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function managedDepartment()
    {
        return $this->hasOne(Department::class, 'manager_id');
    }
}

