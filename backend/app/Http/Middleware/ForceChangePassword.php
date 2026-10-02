<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceChangePassword
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            // Allow paths for auth (logout, me, change password)
            $allowedPaths = [
                'api/auth/logout',
                'api/auth/me',
                'api/auth/change-password',
            ];

            $isAllowed = false;
            foreach ($allowedPaths as $path) {
                if ($request->is($path)) {
                    $isAllowed = true;
                    break;
                }
            }

            if (!$isAllowed) {
                return response()->json([
                    'message' => 'Bạn phải đổi mật khẩu trước khi tiếp tục.',
                    'code' => 'MUST_CHANGE_PASSWORD'
                ], 403);
            }
        }

        return $next($request);
    }
}
