<?php

use App\Http\Controllers\Api\BoardController;
use App\Http\Controllers\Api\WorkspaceController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', fn (Request $request) => ['user' => $request->user()]);
    Route::get('/workspaces', [WorkspaceController::class, 'index']);
    Route::post('/workspaces', [WorkspaceController::class, 'store']);
    Route::patch('/workspaces/{workspace}', [WorkspaceController::class, 'update']);
    Route::get('/workspaces/{workspace}/members', [WorkspaceController::class, 'members']);
    Route::put('/workspaces/{workspace}/members', [WorkspaceController::class, 'setMember']);
    Route::post('/workspaces/{workspace}/boards', [BoardController::class, 'store']);
    Route::get('/boards/{board}', [BoardController::class, 'show']);
    Route::put('/boards/{board}', [BoardController::class, 'save']);
    Route::put('/boards/{board}/favorite', [BoardController::class, 'favorite']);
    Route::post('/boards/{board}/visit', [BoardController::class, 'visit']);
});
