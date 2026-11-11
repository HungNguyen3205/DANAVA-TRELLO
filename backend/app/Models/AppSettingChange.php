<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Audit trail of company settings changes (never contains secrets). */
class AppSettingChange extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'setting', 'action', 'old_value', 'new_value'];

    protected $casts = ['created_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function log(?int $userId, string $setting, string $action, ?string $old = null, ?string $new = null): void
    {
        static::create([
            'user_id' => $userId,
            'setting' => $setting,
            'action' => $action,
            'old_value' => $old === null ? null : mb_substr($old, 0, 255),
            'new_value' => $new === null ? null : mb_substr($new, 0, 255),
        ]);
    }
}
