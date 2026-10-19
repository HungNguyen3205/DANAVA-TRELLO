<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'manager_id',
        'status',
        'color',
        'created_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected $appends = [
        'employee_count',
    ];

    /**
     * Accessor for employee_count.
     */
    public function getEmployeeCountAttribute(): int
    {
        if ($this->relationLoaded('employees')) {
            return $this->employees->count();
        }
        if (array_key_exists('employees_count', $this->attributes)) {
            return (int) $this->attributes['employees_count'];
        }
        return $this->employees()->count();
    }

    /**
     * Relationship: The designated department manager.
     */
    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    /**
     * Relationship: Creator (admin who created the department).
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relationship: Employees belonging to this department.
     */
    public function employees()
    {
        return $this->hasMany(User::class, 'department_id');
    }

    /**
     * Alias for employees.
     */
    public function users()
    {
        return $this->hasMany(User::class, 'department_id');
    }

    /**
     * Relationship: Activity logs associated with this department.
     */
    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class, 'department_id');
    }

    /**
     * Scope active departments.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Telegram Notification Integration.
     */
    public function telegramIntegration()
    {
        return $this->morphOne(NotificationIntegration::class, 'integratable')
            ->where('provider', 'telegram');
    }
}
