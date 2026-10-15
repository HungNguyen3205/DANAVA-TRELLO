<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->string('public_id', 12)->nullable()->unique()->after('id');
        });

        DB::table('boards')->select('id')->orderBy('id')->chunkById(100, function ($boards) {
            foreach ($boards as $board) {
                do {
                    $publicId = Str::lower(Str::random(12));
                } while (DB::table('boards')->where('public_id', $publicId)->exists());

                DB::table('boards')->where('id', $board->id)->update(['public_id' => $publicId]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }
};
