<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationIntegration extends Model
{
    use HasFactory;

    protected $table = 'notification_integrations';

    protected $fillable = [
        'integratable_type',
        'integratable_id',
        'provider',
        'chat_id',
        'chat_title',
        'status',
        'is_enabled',
        'delivery_mode',
        'event_settings',
        'verified_at',
        'last_tested_at',
        'last_sent_at',
        'last_error_at',
        'last_error_message',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'event_settings' => 'array',
        'verified_at' => 'datetime',
        'last_tested_at' => 'datetime',
        'last_sent_at' => 'datetime',
        'last_error_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Polymorphic parent relation (Department or Board).
     */
    public function integratable()
    {
        return $this->morphTo();
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function deliveries()
    {
        return $this->hasMany(TelegramDelivery::class, 'integration_id');
    }

    /**
     * Mask chat ID for display (e.g. -100******9074).
     */
    public function getMaskedChatIdAttribute(): ?string
    {
        return static::maskChatId($this->chat_id);
    }

    public static function maskChatId(?string $chatId): ?string
    {
        if (!$chatId) return null;
        $len = strlen($chatId);
        if ($len <= 6) return '******';
        $prefix = substr($chatId, 0, 4);
        $suffix = substr($chatId, -4);
        return $prefix . '******' . $suffix;
    }

    /**
     * Check if a specific event type is enabled.
     */
    public function isEventEnabled(string $eventType, bool $default = true): bool
    {
        if (!$this->is_enabled || $this->status !== 'connected') {
            return false;
        }

        if (empty($this->event_settings) || !is_array($this->event_settings)) {
            return $default;
        }

        return (bool)($this->event_settings[$eventType] ?? $default);
    }
}
