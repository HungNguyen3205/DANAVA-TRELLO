<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** Top level of the work structure: Project > Board > Column > Task. */
class Project extends Model
{
    public const STATUSES = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];

    protected $fillable = [
        'name', 'description', 'color', 'cover_image', 'status', 'start_date', 'end_date', 'manager_id', 'budget', 'owner_id',
    ];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
        'budget' => 'decimal:2',
    ];

    public function boards()
    {
        return $this->hasMany(Board::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public static function isSystemAdmin(User $user): bool
    {
        return in_array($user->system_role, ['system_admin', 'admin'], true);
    }

    /** Projects a user can see: system admins see all; others see projects they own/manage or have a board in. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (self::isSystemAdmin($user)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($user) {
            $q->where('owner_id', $user->id)
                ->orWhere('manager_id', $user->id)
                ->orWhereHas('boards', fn (Builder $b) => $b->accessibleBy($user));
        });
    }

    public function canView(User $user): bool
    {
        return static::query()->whereKey($this->id)->visibleTo($user)->exists();
    }

    /** Edit details, delete, and add/remove boards. */
    public function canManage(User $user): bool
    {
        return self::isSystemAdmin($user)
            || (int) $this->owner_id === (int) $user->id
            || (int) $this->manager_id === (int) $user->id;
    }
}
