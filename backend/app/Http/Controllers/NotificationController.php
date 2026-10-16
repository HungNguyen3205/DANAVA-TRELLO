<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Check due tasks for user in real-time
        try {
            \App\Services\DueTaskService::checkDueTasksForUser($user);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Error checking due tasks: ' . $e->getMessage());
        }

        $query = $user->notifications();

        // Optional filter by read status
        if ($request->has('unread')) {
            $query->whereNull('read_at');
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        return response()->json([
            'notifications' => $query->paginate($perPage),
            'unread_count' => $user->unreadNotifications()->count()
        ]);
    }

    public function markAsRead(Request $request, $id)
    {
        $notification = $request->user()->notifications()->where('id', $id)->first();
        if ($notification) {
            $notification->markAsRead();
        }
        return response()->json(['success' => true]);
    }

    public function markAllAsRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();
        return response()->json(['success' => true]);
    }
}
