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
use App\Http\Controllers\SubtaskController;
use App\Http\Controllers\BoardDashboardController;

// ==========================================
// PUBLIC ROUTES
// ==========================================
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

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
        Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
        Route::patch('/employees/{employee}/status', [EmployeeController::class, 'updateStatus']);
        Route::post('/employees/{employee}/reset-password', [EmployeeController::class, 'resetPassword']);
        Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);
        Route::patch('/employees/{user}/department', [\App\Http\Controllers\Admin\DepartmentController::class, 'transferEmployee']);
        Route::post('/employees/bulk-department', [\App\Http\Controllers\Admin\DepartmentController::class, 'bulkTransferEmployees']);

        // Department Management
        Route::get('/departments', [\App\Http\Controllers\Admin\DepartmentController::class, 'index']);
        Route::post('/departments', [\App\Http\Controllers\Admin\DepartmentController::class, 'store']);
        Route::get('/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'show']);
        Route::put('/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'update']);
        Route::patch('/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'update']);
        Route::delete('/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'destroy']);
        Route::patch('/departments/{id}/restore', [\App\Http\Controllers\Admin\DepartmentController::class, 'restore']);
        Route::post('/departments/{department}/employees', [\App\Http\Controllers\Admin\DepartmentController::class, 'assignEmployees']);
        Route::delete('/departments/{department}/employees/{user}', [\App\Http\Controllers\Admin\DepartmentController::class, 'removeEmployee']);

        // Department Telegram Management
        Route::get('/departments/{department}/telegram', [\App\Http\Controllers\Admin\DepartmentTelegramController::class, 'show']);
        Route::put('/departments/{department}/telegram', [\App\Http\Controllers\Admin\DepartmentTelegramController::class, 'update']);
        Route::post('/departments/{department}/telegram/verify', [\App\Http\Controllers\Admin\DepartmentTelegramController::class, 'verify']);
        Route::post('/departments/{department}/telegram/test', [\App\Http\Controllers\Admin\DepartmentTelegramController::class, 'test']);
        Route::delete('/departments/{department}/telegram', [\App\Http\Controllers\Admin\DepartmentTelegramController::class, 'destroy']);
    });

    // Minimal options for dropdowns (any authenticated user)
    Route::get('/departments/options', [\App\Http\Controllers\Admin\DepartmentController::class, 'options']);

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
    Route::get('/analytics/overview', [WorkspaceController::class, 'globalDashboard']);

    // Direct Boards (Hoàn toàn Board-first, không phụ thuộc vào Không gian làm việc)
    Route::get('/boards', [BoardController::class, 'myBoards']);
    Route::post('/boards', [BoardController::class, 'storeDirect']);
    Route::get('/me/boards', [BoardController::class, 'myBoards']);
    Route::post('/me/boards', [BoardController::class, 'storeDirect']);

    // Search active users to add to board
    Route::get('/users/search', function(\Illuminate\Http\Request $request) {
        $q = trim($request->query('q', ''));
        $query = \App\Models\User::where('account_status', 'active');
        if (!empty($q)) {
            $query->where(function($sub) use ($q) {
                $sub->where('name', 'LIKE', "%{$q}%")
                    ->orWhere('username', 'LIKE', "%{$q}%")
                    ->orWhere('email', 'LIKE', "%{$q}%");
            });
        }
        return response()->json($query->select('id', 'name', 'username', 'email', 'avatar')->limit(20)->get());
    });

    // Workspace Boards
    Route::get('/workspaces/{workspace}/boards', [BoardController::class, 'index']);
    Route::post('/workspaces/{workspace}/boards', [BoardController::class, 'store']);
    Route::get('/boards/by-code/{publicId}', [BoardController::class, 'showByPublicId']);
    Route::get('/boards/{board}', [BoardController::class, 'show']);
    Route::put('/boards/{board}', [BoardController::class, 'update']);
    Route::delete('/boards/{board}', [BoardController::class, 'destroy']);
    Route::post('/boards/{board}/toggle-star', [BoardController::class, 'toggleStar']);
    Route::post('/boards/{board}/evaluation/publish', [BoardController::class, 'publishEvaluation']);

    // Board Telegram Management
    Route::get('/boards/{board}/telegram', [\App\Http\Controllers\BoardTelegramController::class, 'show']);
    Route::put('/boards/{board}/telegram', [\App\Http\Controllers\BoardTelegramController::class, 'update']);
    Route::post('/boards/{board}/telegram/verify', [\App\Http\Controllers\BoardTelegramController::class, 'verify']);
    Route::post('/boards/{board}/telegram/test', [\App\Http\Controllers\BoardTelegramController::class, 'test']);
    Route::delete('/boards/{board}/telegram', [\App\Http\Controllers\BoardTelegramController::class, 'destroy']);

    // Board Reviews (Tổng kết dự án)
    Route::get('/boards/{board}/review', [\App\Http\Controllers\BoardReviewController::class, 'show']);
    Route::post('/boards/{board}/review', [\App\Http\Controllers\BoardReviewController::class, 'storeOrUpdate']);
    Route::put('/boards/{board}/review', [\App\Http\Controllers\BoardReviewController::class, 'storeOrUpdate']);
    Route::post('/boards/{board}/review/publish', [\App\Http\Controllers\BoardReviewController::class, 'publish']);
    Route::post('/boards/{board}/review/lock', [\App\Http\Controllers\BoardReviewController::class, 'lock']);
    Route::post('/boards/{board}/review/unlock', [\App\Http\Controllers\BoardReviewController::class, 'unlock']);

    // Performance Evaluation (Điểm hiệu suất)
    Route::get('/boards/{board}/performance/policy', [\App\Http\Controllers\PerformanceController::class, 'getPolicy']);
    Route::post('/boards/{board}/performance/policy', [\App\Http\Controllers\PerformanceController::class, 'updatePolicy']);
    Route::post('/boards/{board}/performance/policy/acknowledge', [\App\Http\Controllers\PerformanceController::class, 'acknowledgePolicy']);

    Route::get('/boards/{board}/performance/periods', [\App\Http\Controllers\PerformanceController::class, 'listPeriods']);
    Route::post('/boards/{board}/performance/periods', [\App\Http\Controllers\PerformanceController::class, 'storePeriod']);
    Route::get('/boards/{board}/performance/periods/{period}', [\App\Http\Controllers\PerformanceController::class, 'showPeriod']);
    Route::post('/boards/{board}/performance/periods/{period}/calculate', [\App\Http\Controllers\PerformanceController::class, 'recalculatePeriod']);
    Route::post('/boards/{board}/performance/periods/{period}/publish', [\App\Http\Controllers\PerformanceController::class, 'publishPeriod']);
    Route::post('/boards/{board}/performance/periods/{period}/lock', [\App\Http\Controllers\PerformanceController::class, 'lockPeriod']);
    Route::post('/boards/{board}/performance/periods/{period}/unlock', [\App\Http\Controllers\PerformanceController::class, 'unlockPeriod']);
    Route::get('/boards/{board}/performance/periods/{period}/members/{memberUser}/lineage', [\App\Http\Controllers\PerformanceController::class, 'memberLineage']);

    // Excel Task Import
    Route::get('/boards/{board}/tasks/import/template', [\App\Http\Controllers\TaskExcelImportController::class, 'downloadTemplate']);
    Route::post('/boards/{board}/tasks/import/preview', [\App\Http\Controllers\TaskExcelImportController::class, 'preview']);
    Route::post('/boards/{board}/tasks/import/confirm', [\App\Http\Controllers\TaskExcelImportController::class, 'confirm']);
    Route::get('/boards/{board}/tasks/import/errors/{token}', [\App\Http\Controllers\TaskExcelImportController::class, 'downloadErrors']);

    // Trash (Thùng rác)
    Route::get('/trash', [\App\Http\Controllers\TrashController::class, 'index']);
    Route::post('/trash/{type}/{id}/restore', [\App\Http\Controllers\TrashController::class, 'restore']);
    Route::delete('/trash/{type}/{id}/force', [\App\Http\Controllers\TrashController::class, 'forceDelete']);

    // Board Members (Direct Board access & Legacy Workspace prefix support)
    Route::get('/boards/{board}/members', [BoardMemberController::class, 'index']);
    Route::post('/boards/{board}/members', [BoardMemberController::class, 'store']);
    Route::patch('/boards/{board}/members/{userId}', [BoardMemberController::class, 'update']);
    Route::delete('/boards/{board}/members/{userId}', [BoardMemberController::class, 'destroy']);

    Route::get('/workspaces/{workspace}/boards/{board}/members', [BoardMemberController::class, 'index']);
    Route::post('/workspaces/{workspace}/boards/{board}/members', [BoardMemberController::class, 'store']);
    Route::patch('/workspaces/{workspace}/boards/{board}/members/{userId}', [BoardMemberController::class, 'update']);
    Route::delete('/workspaces/{workspace}/boards/{board}/members/{userId}', [BoardMemberController::class, 'destroy']);

    // Kanban / List / Board Views
    Route::get('/boards/{board}/kanban', [KanbanController::class, 'index']);
    Route::get('/boards/{board}/columns/archived', [KanbanController::class, 'archivedColumns']);
    Route::post('/boards/{board}/columns', [KanbanController::class, 'storeColumn']);
    Route::put('/columns/{column}', [KanbanController::class, 'updateColumn']);
    Route::patch('/columns/{column}', [KanbanController::class, 'updateColumn']);
    Route::post('/columns/{column}/archive', [KanbanController::class, 'archiveColumn']);
    Route::post('/columns/{column}/restore', [KanbanController::class, 'restoreColumn']);
    Route::delete('/columns/{column}', [KanbanController::class, 'destroyColumn']);
    Route::post('/columns/{column}/tasks', [KanbanController::class, 'storeTask']);
    Route::put('/boards/{board}/columns/reorder', [KanbanController::class, 'reorderColumns']);
    Route::put('/boards/{board}/tasks/reorder', [KanbanController::class, 'reorderTasks']);
    Route::put('/tasks/{task}/move', [KanbanController::class, 'moveTask']);

    // Tasks (Global Access by ID)
    Route::get('/tasks/{task}', [TaskDetailController::class, 'show']);
    Route::put('/tasks/{task}', [TaskDetailController::class, 'update']);
    Route::delete('/tasks/{task}', [TaskDetailController::class, 'destroy']);
    Route::post('/tasks/{task}/comments', [TaskDetailController::class, 'addComment']);
    Route::post('/tasks/{task}/review', [TaskDetailController::class, 'reviewQuality']);
    Route::put('/comments/{comment}', [TaskDetailController::class, 'updateComment']);
    Route::delete('/comments/{comment}', [TaskDetailController::class, 'deleteComment']);

    // Task Multi-Assignees Management
    Route::put('/tasks/{task}/assignees', [\App\Http\Controllers\TaskAssigneeController::class, 'update']);
    Route::post('/tasks/{task}/assignees/{user}', [\App\Http\Controllers\TaskAssigneeController::class, 'addAssignee']);
    Route::delete('/tasks/{task}/assignees/{user}', [\App\Http\Controllers\TaskAssigneeController::class, 'removeAssignee']);
    Route::post('/tasks/{task}/copy-assignees-to-subtasks', [\App\Http\Controllers\TaskAssigneeController::class, 'copyAssigneesToSubtasks']);
    Route::put('/tasks/{task}/contribution-percents', [\App\Http\Controllers\TaskAssigneeController::class, 'updateContributionPercents']);

    // Subtasks
    Route::get('/tasks/{task}/subtasks', [SubtaskController::class, 'index']);
    Route::post('/tasks/{task}/subtasks', [SubtaskController::class, 'store']);
    Route::post('/tasks/{task}/groups/{group}/subtasks', [SubtaskController::class, 'store']);
    Route::get('/tasks/subtasks/{subtask}', [SubtaskController::class, 'show']);
    Route::get('/tasks/{task}/subtasks/{subtask}', [SubtaskController::class, 'show']);
    Route::patch('/tasks/subtasks/{subtask}', [SubtaskController::class, 'update']);
    Route::patch('/tasks/{task}/subtasks/{subtask}', [SubtaskController::class, 'update']);
    Route::delete('/tasks/subtasks/{subtask}', [SubtaskController::class, 'destroy']);
    Route::delete('/tasks/{task}/subtasks/{subtask}', [SubtaskController::class, 'destroy']);
    Route::patch('/tasks/{task}/subtasks/reorder', [SubtaskController::class, 'reorder']);

    // Board Workload Dashboard
    Route::get('/boards/{board}/dashboard/member-workload', [BoardDashboardController::class, 'memberWorkload']);

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
