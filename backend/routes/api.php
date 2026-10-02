<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\WorkspaceController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    
    // Workspaces
    Route::get('/workspaces', [WorkspaceController::class, 'index']);
    Route::post('/workspaces', [WorkspaceController::class, 'store']);
    Route::get('/workspaces/{workspace}', [WorkspaceController::class, 'show']);
    Route::get('/workspaces/{workspace}/dashboard', [WorkspaceController::class, 'dashboard']);

    // Boards
    Route::get('/workspaces/{workspace}/boards', [\App\Http\Controllers\BoardController::class, 'index']);
    Route::post('/workspaces/{workspace}/boards', [\App\Http\Controllers\BoardController::class, 'store']);
    Route::get('/boards/{board}', [\App\Http\Controllers\BoardController::class, 'show']);
    Route::delete('/boards/{board}', [\App\Http\Controllers\BoardController::class, 'destroy']);

    // Kanban
    Route::get('/boards/{board}/kanban', [\App\Http\Controllers\KanbanController::class, 'index']);
    Route::post('/boards/{board}/columns', [\App\Http\Controllers\KanbanController::class, 'storeColumn']);
    Route::put('/columns/{column}', [\App\Http\Controllers\KanbanController::class, 'updateColumn']);
    Route::post('/columns/{column}/tasks', [\App\Http\Controllers\KanbanController::class, 'storeTask']);
    Route::put('/boards/{board}/columns/reorder', [\App\Http\Controllers\KanbanController::class, 'reorderColumns']);
    Route::put('/boards/{board}/tasks/reorder', [\App\Http\Controllers\KanbanController::class, 'reorderTasks']);

    // Task Details
    Route::put('/tasks/{task}', [\App\Http\Controllers\TaskDetailController::class, 'update']);
    Route::delete('/tasks/{task}', [\App\Http\Controllers\TaskDetailController::class, 'destroy']);
    Route::post('/tasks/{task}/comments', [\App\Http\Controllers\TaskDetailController::class, 'addComment']);

    // Sprints
    Route::post('/boards/{board}/sprints', [\App\Http\Controllers\SprintController::class, 'store']);
    Route::put('/sprints/{sprint}', [\App\Http\Controllers\SprintController::class, 'update']);
    Route::delete('/sprints/{sprint}', [\App\Http\Controllers\SprintController::class, 'destroy']);

    // Checklists
    Route::post('/tasks/{task}/checklists', [\App\Http\Controllers\ChecklistController::class, 'storeChecklist']);
    Route::delete('/checklists/{checklist}', [\App\Http\Controllers\ChecklistController::class, 'destroyChecklist']);
    Route::post('/checklists/{checklist}/items', [\App\Http\Controllers\ChecklistController::class, 'storeItem']);
    Route::put('/checklist-items/{item}', [\App\Http\Controllers\ChecklistController::class, 'updateItem']);
    Route::delete('/checklist-items/{item}', [\App\Http\Controllers\ChecklistController::class, 'destroyItem']);

    // Labels
    Route::get('/boards/{board}/labels', [\App\Http\Controllers\LabelController::class, 'index']);
    Route::post('/boards/{board}/labels', [\App\Http\Controllers\LabelController::class, 'store']);
    Route::put('/labels/{label}', [\App\Http\Controllers\LabelController::class, 'update']);
    Route::delete('/labels/{label}', [\App\Http\Controllers\LabelController::class, 'destroy']);
    Route::post('/tasks/{task}/labels', [\App\Http\Controllers\LabelController::class, 'syncTaskLabels']);

    // Attachments
    Route::post('/tasks/{task}/attachments', [\App\Http\Controllers\TaskAttachmentController::class, 'store']);
    Route::delete('/attachments/{attachment}', [\App\Http\Controllers\TaskAttachmentController::class, 'destroy']);
});
