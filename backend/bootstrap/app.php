<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(\App\Http\Middleware\ServerTimingMiddleware::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Permission errors in Vietnamese instead of Laravel's default "This action is unauthorized."
        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException $e, \Illuminate\Http\Request $request) {
            if (!$request->expectsJson()) {
                return null;
            }
            $message = $e->getMessage();
            if ($message === '' || $message === 'This action is unauthorized.') {
                $message = 'Anh/chị không có quyền thực hiện thao tác này. Thêm, sửa, xóa cột và cài đặt bảng cần quyền chủ bảng, quản trị viên bảng hoặc quản lý dự án.';
            }

            return response()->json(['message' => $message], 403);
        });
    })->create();
