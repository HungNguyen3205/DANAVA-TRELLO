<?php

namespace App\Models;

use App\Support\VietnameseText;
use Illuminate\Database\Eloquent\Model;

class UserAlias extends Model
{
    protected $fillable = ['user_id', 'alias', 'alias_key', 'created_by'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Remember that $alias refers to $userId (latest confirmation wins). */
    public static function remember(string $alias, int $userId, ?int $createdBy): void
    {
        $alias = trim(preg_replace('/\s+/u', ' ', $alias));
        $key = VietnameseText::key($alias);
        if ($key === '' || mb_strlen($alias) > 120) {
            return;
        }

        static::updateOrCreate(['alias_key' => $key], [
            'alias' => $alias,
            'user_id' => $userId,
            'created_by' => $createdBy,
        ]);
    }
}
