<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('kanban_columns', function (Blueprint $table) {
            $table->unsignedInteger('wip_limit')->nullable()->after('color');
            $table->string('wip_enforcement', 20)->default('warning')->after('wip_limit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kanban_columns', function (Blueprint $table) {
            $table->dropColumn(['wip_limit', 'wip_enforcement']);
        });
    }
};
