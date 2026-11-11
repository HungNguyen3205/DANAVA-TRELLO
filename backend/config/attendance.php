<?php

return [
    // Attendance days and times are evaluated in this timezone (the app itself runs in UTC).
    'timezone' => env('ATTENDANCE_TIMEZONE', 'Asia/Ho_Chi_Minh'),

    // Official working hours (HH:MM, 24h).
    'work_start' => env('ATTENDANCE_WORK_START', '08:00'),
    'work_end' => env('ATTENDANCE_WORK_END', '17:00'),

    // Check-ins up to this many minutes after work_start are not counted as late.
    'late_grace_minutes' => (int) env('ATTENDANCE_LATE_GRACE_MINUTES', 5),

    // Go-live date (YYYY-MM-DD). Empty = demo mode: everything works, pages show a
    // "trial" badge. Once set, records before this date (demo data) are ignored in
    // history and statistics, and absences are counted from this date.
    'live_since' => env('ATTENDANCE_LIVE_SINCE') ?: null,

    // ISO weekdays that are working days (1 = Monday ... 7 = Sunday).
    'work_days' => array_map('intval', explode(',', env('ATTENDANCE_WORK_DAYS', '1,2,3,4,5'))),
];
