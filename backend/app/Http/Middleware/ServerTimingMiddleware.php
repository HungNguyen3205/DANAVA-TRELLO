<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\DB;

class ServerTimingMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $start = microtime(true);
        
        DB::enableQueryLog();
        
        $response = $next($request);
        
        $duration = (microtime(true) - $start) * 1000;
        
        $queries = DB::getQueryLog();
        $dbTime = array_reduce($queries, function ($carry, $query) {
            return $carry + $query['time'];
        }, 0);
        
        $sqlCount = count($queries);
        $appTime = $duration - $dbTime;
        
        $timingHeader = sprintf(
            'app;desc="PHP Application";dur=%.2f, db;desc="MySQL (%d queries)";dur=%.2f, total;desc="Total Server Time";dur=%.2f',
            $appTime,
            $sqlCount,
            $dbTime,
            $duration
        );
        
        $response->headers->set('Server-Timing', $timingHeader);
        
        return $response;
    }
}
