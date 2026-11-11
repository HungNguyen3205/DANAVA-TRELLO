<?php

namespace App\Models;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/** Key/value settings managed from the UI. Use the *Secret helpers for credentials. */
class AppSetting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function getValue(string $key, ?string $default = null): ?string
    {
        return static::where('key', $key)->value('value') ?? $default;
    }

    public static function setValue(string $key, ?string $value, ?int $userId = null): void
    {
        if ($value === null) {
            static::where('key', $key)->delete();

            return;
        }
        static::updateOrCreate(['key' => $key], ['value' => $value, 'updated_by' => $userId]);
    }

    public static function getSecret(string $key): ?string
    {
        $stored = static::getValue($key);
        if ($stored === null) {
            return null;
        }
        try {
            return Crypt::decryptString($stored);
        } catch (DecryptException) {
            // APP_KEY changed: the stored secret is unusable and must be entered again.
            return null;
        }
    }

    public static function setSecret(string $key, ?string $value, ?int $userId = null): void
    {
        static::setValue($key, $value === null ? null : Crypt::encryptString($value), $userId);
    }
}
