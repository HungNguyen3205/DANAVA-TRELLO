<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrelloImport extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['payload', 'preview_token'];

    protected function casts(): array
    {
        return ['payload' => 'encrypted:array', 'result' => 'array', 'expires_at' => 'datetime'];
    }
}
