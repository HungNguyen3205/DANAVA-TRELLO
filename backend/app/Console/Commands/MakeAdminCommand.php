<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class MakeAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'make:admin {identifier : The email or username of the user}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Promote a user to system admin';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $identifier = $this->argument('identifier');
        $user = \App\Models\User::where('email', $identifier)->orWhere('username', $identifier)->first();

        if (!$user) {
            $this->error("User with email or username '{$identifier}' not found.");
            return 1;
        }

        $user->system_role = 'system_admin';
        $user->save();

        $this->info("User '{$user->name}' ({$user->username}) has been promoted to system_admin.");
        return 0;
    }
}
