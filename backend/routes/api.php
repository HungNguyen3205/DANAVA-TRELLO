<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\BoardMemberController;
use App\Http\Controllers\KanbanController;
use App\Http\Controllers\TaskDetailController;
use App\Http\Controllers\SprintController;
use App\Http\Controllers\ChecklistController;
use App\Http\Controllers\LabelController;
use App\Http\Controllers\TaskAttachmentController;
use App\Http\Controllers\MyTaskController;
use App\Http\Controllers\PersonalDashboardController;
use App\Http\Controllers\SearchController;

// ==========================================
// PUBLIC ROUTES
// ==========================================
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// ==========================================
// PROTECTED ROUTES (Requires Authentication)
// ==========================================
Route::middleware(['auth:sanctum', \App\Http\Middleware\ForceChangePassword::class])->group(function () {
    
    // ------------------------------------------
    // SYSTEM ADMIN ROUTES
    // ------------------------------------------
    Route::middleware(\App\Http\Middleware\SystemAdminMiddleware::class)->prefix('admin')->group(function() {
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::patch('/employees/{employee}/status', [EmployeeController::class, 'updateStatus']);
        Route::post('/employees/{employee}/reset-password', [EmployeeController::class, 'resetPassword']);
    });

    // ------------------------------------------
    // CLIENT ROUTES (Users)
    // ------------------------------------------
    
    // Auth & Profile
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me', [AuthController::class, 'updateProfile']); // POST used for file uploads instead of PUT
    Route::post('/auth/change-password', function(Request $request) {
        $request->validate(['password' => 'required|string|min:8']);
        $user = $request->user();
        $user->password = \Illuminate\Support\Facades\Hash::make($request->password);
        $user->must_change_password = false;
        $user->save();
        return response()->json(['message' => 'Đổi mật khẩu thành công']);
    });

    Route::post('/account/change-password', [AuthController::class, 'changePassword']);
    Route::post('/account/notification-preferences', [AuthController::class, 'updateNotificationPreferences']);
    Route::post('/account/logout-other-devices', [AuthController::class, 'logoutOtherDevices']);

    // Personal Area
    Route::get('/me/dashboard', [PersonalDashboardController::class, 'index']);
    Route::get('/me/tasks', [MyTaskController::class, 'index']);
    Route::get('/search', [SearchController::class, 'index']);
    
    // Notifications
    Route::get('/notifications', [\App\Http\Controllers\NotificationController::class, 'index']);
    Route::put('/notifications/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
    Route::put('/notifications/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
    // Workspaces
    Route::get('/workspaces', [WorkspaceController::class, 'index']);
    Route::post('/workspaces', [WorkspaceController::class, 'store']);
    Route::get('/workspaces/{workspace}', [WorkspaceController::class, 'show']);
    Route::get('/workspaces/{workspace}/dashboard', [WorkspaceController::class, 'dashboard']);
    Route::get('/workspaces/{workspace}/members', [WorkspaceController::class, 'members']);

    // Workspace Boards
    Route::get('/workspaces/{workspace}/boards', [BoardController::class, 'index']);
    Route::post('/workspaces/{workspace}/boards', [BoardController::class, 'store']);
    Route::get('/boards/{board}', [BoardController::class, 'show']);
    Route::put('/boards/{board}', [BoardController::class, 'update']);
    Route::delete('/boards/{board}', [BoardController::class, 'destroy']);
    Route::post('/boards/{board}/toggle-star', [BoardController::class, 'toggleStar']);

    // Board Members
    Route::get('/workspaces/{workspace}/boards/{board}/members', [BoardMemberController::class, 'index']);
    Route::post('/workspaces/{workspace}/boards/{board}/members', [BoardMemberController::class, 'store']);
    Route::patch('/workspaces/{workspace}/boards/{board}/members/{userId}', [BoardMemberController::class, 'update']);
    Route::delete('/workspaces/{workspace}/boards/{board}/members/{userId}', [BoardMemberController::class, 'destroy']);

    // Kanban / List / Board Views
    Route::get('/boards/{board}/kanban', [KanbanController::class, 'index']);
    Route::post('/boards/{board}/columns', [KanbanController::class, 'storeColumn']);
    Route::put('/columns/{column}', [KanbanController::class, 'updateColumn']);
    Route::post('/columns/{column}/tasks', [KanbanController::class, 'storeTask']);
    Route::put('/boards/{board}/columns/reorder', [KanbanController::class, 'reorderColumns']);
    Route::put('/boards/{board}/tasks/reorder', [KanbanController::class, 'reorderTasks']);
    Route::put('/tasks/{task}/move', [KanbanController::class, 'moveTask']);

    // Tasks (Global Access by ID)
    Route::put('/tasks/{task}', [TaskDetailController::class, 'update']);
    Route::delete('/tasks/{task}', [TaskDetailController::class, 'destroy']);
    Route::post('/tasks/{task}/comments', [TaskDetailController::class, 'addComment']);

    // Sprints
    Route::post('/boards/{board}/sprints', [SprintController::class, 'store']);
    Route::put('/sprints/{sprint}', [SprintController::class, 'update']);
    Route::delete('/sprints/{sprint}', [SprintController::class, 'destroy']);

    // Checklists
    Route::post('/tasks/{task}/checklists', [ChecklistController::class, 'storeChecklist']);
    Route::delete('/checklists/{checklist}', [ChecklistController::class, 'destroyChecklist']);
    Route::post('/checklists/{checklist}/items', [ChecklistController::class, 'storeItem']);
    Route::put('/checklist-items/{item}', [ChecklistController::class, 'updateItem']);
    Route::delete('/checklist-items/{item}', [ChecklistController::class, 'destroyItem']);

    // Labels
    Route::get('/boards/{board}/labels', [LabelController::class, 'index']);
    Route::post('/boards/{board}/labels', [LabelController::class, 'store']);
    Route::put('/labels/{label}', [LabelController::class, 'update']);
    Route::delete('/labels/{label}', [LabelController::class, 'destroy']);
    Route::post('/tasks/{task}/labels', [LabelController::class, 'syncTaskLabels']);

    // Attachments
    Route::post('/tasks/{task}/attachments', [TaskAttachmentController::class, 'store']);
    Route::delete('/attachments/{attachment}', [TaskAttachmentController::class, 'destroy']);
});
