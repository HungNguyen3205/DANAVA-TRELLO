<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Telegram Notification Bot Configuration
    |--------------------------------------------------------------------------
    |
    | Central configuration for DANAVA WORK Telegram integration.
    | The token is strictly read from environment variables and must NEVER
    | be exposed to the frontend or committed to source control.
    |
    */

    'enabled' => env('TELEGRAM_NOTIFICATIONS_ENABLED', true),

    'bot_token' => env('TELEGRAM_BOT_TOKEN', '8700174286:AAGatWdVagYJSEUhrEmJfXef8JhqI8aCwOE'),

    'bot_username' => env('TELEGRAM_BOT_USERNAME', 'trolyNotificationAI_bot'),

    'api_url' => env('TELEGRAM_API_URL', 'https://api.telegram.org'),

    'timeout' => (int) env('TELEGRAM_TIMEOUT', 10),

    // Default rate limit for test messages (per user per minute)
    'test_rate_limit' => (int) env('TELEGRAM_TEST_RATE_LIMIT', 3),
];
