<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Gate::policy(\App\Models\Board::class, \App\Policies\BoardPolicy::class);
        \Illuminate\Support\Facades\Gate::policy(\App\Models\Task::class, \App\Policies\TaskPolicy::class);
    }
}
