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
        if ($request->has('unread') && filter_var($request->query('unread'), FILTER_VALIDATE_BOOLEAN)) {
            $query->whereNull('read_at');
        }

        // Optional filter by category
        if ($filter = $request->query('filter')) {
            if ($filter === 'assigned') {
                $query->where(function ($q) {
                    $q->where('data', 'LIKE', '%"type":"assigned"%')
                      ->orWhere('data', 'LIKE', '%"type":"unassigned"%')
                      ->orWhere('type', 'LIKE', '%TaskMemberAssignedNotification%');
                });
            } elseif ($filter === 'comments') {
                $query->where(function ($q) {
                    $q->where('data', 'LIKE', '%"type":"comment_added"%')
                      ->orWhere('data', 'LIKE', '%"type":"mention"%');
                });
            } elseif ($filter === 'deadlines' || $filter === 'due') {
                $query->where(function ($q) {
                    $q->where('data', 'LIKE', '%"type":"due_date_changed"%')
                      ->orWhere('data', 'LIKE', '%"type":"due_soon"%')
                      ->orWhere('data', 'LIKE', '%"type":"due_today"%')
                      ->orWhere('data', 'LIKE', '%"type":"overdue"%');
                });
            } elseif ($filter === 'completed') {
                $query->where(function ($q) {
                    $q->where('data', 'LIKE', '%"type":"task_completed"%')
                      ->orWhere('data', 'LIKE', '%"type":"task_reopened"%');
                });
            }
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
