<?php

return [
    // Display name of the assistant (shown in the chat and used in the system prompt).
    'name' => env('ASSISTANT_NAME', 'Trợ lý công việc DANAVA'),

    // "live" calls Gemini (requires GEMINI_API_KEY); anything else uses the built-in
    // rule-based demo, which still extracts tasks from pasted messages.
    'mode' => env('ASSISTANT_AI_MODE', 'demo'),

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        // Set to a model your key can use (see https://ai.google.dev/gemini-api/docs/models).
        'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
        'timeout' => (int) env('GEMINI_TIMEOUT', 30),
    ],

    // Messages kept per user (older ones are pruned).
    'history_limit' => (int) env('ASSISTANT_HISTORY_LIMIT', 100),
    // Previous messages sent to the model as conversation context.
    'context_messages' => (int) env('ASSISTANT_CONTEXT_MESSAGES', 10),
];
