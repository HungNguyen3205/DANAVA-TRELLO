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

    // Boards
    Route::get('/workspaces/{workspace}/boards', [\App\Http\Controllers\BoardController::class, 'index']);
    Route::post('/workspaces/{workspace}/boards', [\App\Http\Controllers\BoardController::class, 'store']);
    Route::get('/boards/{board}', [\App\Http\Controllers\BoardController::class, 'show']);
    Route::delete('/boards/{board}', [\App\Http\Controllers\BoardController::class, 'destroy']);

    // Kanban
    Route::get('/boards/{board}/kanban', [\App\Http\Controllers\KanbanController::class, 'index']);
    Route::post('/boards/{board}/columns', [\App\Http\Controllers\KanbanController::class, 'storeColumn']);
    Route::post('/columns/{column}/tasks', [\App\Http\Controllers\KanbanController::class, 'storeTask']);
    Route::put('/boards/{board}/columns/reorder', [\App\Http\Controllers\KanbanController::class, 'reorderColumns']);
    Route::put('/boards/{board}/tasks/reorder', [\App\Http\Controllers\KanbanController::class, 'reorderTasks']);

    // Task Details
    Route::put('/tasks/{task}', [\App\Http\Controllers\TaskDetailController::class, 'update']);
    Route::delete('/tasks/{task}', [\App\Http\Controllers\TaskDetailController::class, 'destroy']);
    Route::post('/tasks/{task}/comments', [\App\Http\Controllers\TaskDetailController::class, 'addComment']);
});
