<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TelegramDelivery extends Model
{
    use HasFactory;

    protected $table = 'telegram_deliveries';

    protected $fillable = [
        'integration_id',
        'event_type',
        'notifiable_type',
        'notifiable_id',
        'idempotency_key',
        'chat_id',
        'status',
        'attempts',
        'telegram_message_id',
        'response_code',
        'error_message',
        'sent_at',
    ];

    protected $casts = [
        'attempts' => 'integer',
        'response_code' => 'integer',
        'sent_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function integration()
    {
        return $this->belongsTo(NotificationIntegration::class, 'integration_id');
    }

    public function notifiable()
    {
        return $this->morphTo();
    }
}
