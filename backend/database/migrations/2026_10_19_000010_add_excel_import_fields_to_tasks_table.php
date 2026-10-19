<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('external_key', 100)->nullable()->after('id')->index();
            $table->decimal('estimated_points', 8, 2)->nullable()->after('complexity');
            $table->unsignedTinyInteger('progress_percent')->default(0)->after('estimated_points');
            $table->text('notes')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['external_key']);
            $table->dropColumn(['external_key', 'estimated_points', 'progress_percent', 'notes']);
        });
    }
};
