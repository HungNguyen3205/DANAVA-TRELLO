<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('owner_id')->constrained('users');
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('color', 7)->default('#f47624');
            $table->timestamps();
        });
        Schema::create('workspace_members', function (Blueprint $table) {
            $table->uuid('workspace_id');
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 16)->default('editor');
            $table->timestamps();
            $table->primary(['workspace_id', 'user_id']);
        });
        Schema::create('boards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workspace_id');
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('color', 7)->default('#167d9a');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });
        Schema::create('board_preferences', function (Blueprint $table) {
            $table->uuid('board_id');
            $table->foreign('board_id')->references('id')->on('boards')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('favorite')->default(false);
            $table->timestamp('visited_at')->nullable();
            $table->primary(['board_id', 'user_id']);
        });
        Schema::create('board_columns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('board_id');
            $table->foreign('board_id')->references('id')->on('boards')->cascadeOnDelete();
            $table->string('title', 80);
            $table->boolean('completed')->default(false);
            $table->unsignedInteger('position');
        });
        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('board_id');
            $table->foreign('board_id')->references('id')->on('boards')->cascadeOnDelete();
            $table->uuid('column_id');
            $table->foreign('column_id')->references('id')->on('board_columns');
            $table->string('title', 180);
            $table->text('description')->nullable();
            $table->string('priority', 30)->default('Bình thường');
            $table->json('labels');
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->unsignedInteger('position');
            $table->timestamps();
        });
        Schema::create('task_collaborators', function (Blueprint $table) {
            $table->uuid('task_id');
            $table->foreign('task_id')->references('id')->on('tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['task_id', 'user_id']);
        });
        Schema::create('checklist_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->foreign('task_id')->references('id')->on('tasks')->cascadeOnDelete();
            $table->string('text', 500);
            $table->boolean('done')->default(false);
            $table->unsignedInteger('position');
        });
        Schema::create('task_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->foreign('task_id')->references('id')->on('tasks')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users');
            $table->text('body');
            $table->timestamp('created_at');
        });
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('board_id');
            $table->foreign('board_id')->references('id')->on('boards')->cascadeOnDelete();
            $table->foreignId('actor_id')->constrained('users');
            $table->string('description', 300);
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['activity_logs', 'task_comments', 'checklist_items', 'task_collaborators', 'tasks', 'board_columns', 'board_preferences', 'boards', 'workspace_members', 'workspaces'] as $name) {
            Schema::dropIfExists($name);
        }
    }
};
