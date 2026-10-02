<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::first();
if(!$user) {
    echo "No user\n";
    exit;
}

$req = Illuminate\Http\Request::create('/api/me/dashboard', 'GET');
$req->setUserResolver(function() use ($user) { return $user; });
$res = app()->handle($req);
echo "DASHBOARD JSON:\n";
echo $res->getContent();

echo "\n\nTASKS JSON:\n";
$req2 = Illuminate\Http\Request::create('/api/me/tasks', 'GET');
$req2->setUserResolver(function() use ($user) { return $user; });
$res2 = app()->handle($req2);
echo $res2->getContent();
