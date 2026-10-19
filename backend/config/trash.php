<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Trash Retention Period
    |--------------------------------------------------------------------------
    |
    | Number of days soft-deleted items (boards, columns, tasks, attachments)
    | are retained before being permanently purged by the scheduler.
    |
    */
    'retention_days' => env('TRASH_RETENTION_DAYS', 30),
];
