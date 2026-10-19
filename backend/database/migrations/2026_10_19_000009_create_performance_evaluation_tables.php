<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add complexity and quality review fields to tasks table
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'complexity')) {
                $table->string('complexity', 10)->default('M')->after('priority');
                $table->index('complexity');
            }
            if (!Schema::hasColumn('tasks', 'quality_rating')) {
                $table->unsignedTinyInteger('quality_rating')->nullable()->after('completed_by');
            }
            if (!Schema::hasColumn('tasks', 'quality_review_note')) {
                $table->text('quality_review_note')->nullable()->after('quality_rating');
            }
            if (!Schema::hasColumn('tasks', 'quality_reviewed_by')) {
                $table->foreignId('quality_reviewed_by')->nullable()->constrained('users')->nullOnDelete()->after('quality_review_note');
            }
            if (!Schema::hasColumn('tasks', 'quality_reviewed_at')) {
                $table->timestamp('quality_reviewed_at')->nullable()->after('quality_reviewed_by');
            }
        });

        // 2. Add contribution_percent to task_assignees table
        Schema::table('task_assignees', function (Blueprint $table) {
            if (!Schema::hasColumn('task_assignees', 'contribution_percent')) {
                $table->decimal('contribution_percent', 5, 2)->nullable()->after('assigned_by');
            }
        });

        // 3. Performance Policies table
        Schema::create('performance_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('board_id')->nullable()->constrained('boards')->cascadeOnDelete();
            $table->string('version', 20)->default('v1.0');
            $table->string('title');
            $table->text('content');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['board_id', 'version']);
        });

        // 4. Policy Acknowledgements table
        Schema::create('performance_policy_acknowledgements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('policy_id')->constrained('performance_policies')->cascadeOnDelete();
            $table->foreignId('board_id')->constrained('boards')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('acknowledged_at');
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->unique(['policy_id', 'board_id', 'user_id'], 'perf_policy_ack_unique');
        });

        // 5. Performance Periods table
        Schema::create('performance_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('board_id')->constrained('boards')->cascadeOnDelete();
            $table->string('title');
            $table->enum('period_type', ['weekly', 'monthly', 'quarterly', 'custom'])->default('monthly');
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['draft', 'published', 'locked'])->default('draft');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at')->nullable();
            $table->timestamps();

            $table->index(['board_id', 'status']);
            $table->index(['board_id', 'start_date', 'end_date']);
        });

        // 6. Performance Scores & Snapshot table
        Schema::create('performance_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('period_id')->constrained('performance_periods')->cascadeOnDelete();
            $table->foreignId('board_id')->constrained('boards')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            
            // Criteria scores
            $table->decimal('workload_score', 6, 2)->default(0);     // Max 40
            $table->decimal('on_time_score', 6, 2)->default(0);      // Max 25
            $table->decimal('quality_score', 6, 2)->default(0);      // Max 25
            $table->decimal('progress_score', 6, 2)->default(0);     // Max 10

            // Overall evaluation
            $table->decimal('total_points_earned', 6, 2)->default(0);
            $table->decimal('available_weight', 6, 2)->default(0);   // Sum of weights with available data
            $table->decimal('final_score', 6, 2)->default(0);        // Normalized final score (0 - 100)
            $table->boolean('is_provisional')->default(false);        // True if available_weight < 50%
            $table->string('rank', 50)->default('Chưa đạt');        // Ranking title
            
            // Detailed snapshots
            $table->json('metrics_breakdown')->nullable();
            $table->json('task_details')->nullable();
            
            $table->timestamps();

            $table->unique(['period_id', 'user_id'], 'perf_scores_period_user_unique');
            $table->index(['board_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('performance_scores');
        Schema::dropIfExists('performance_periods');
        Schema::dropIfExists('performance_policy_acknowledgements');
        Schema::dropIfExists('performance_policies');

        Schema::table('task_assignees', function (Blueprint $table) {
            if (Schema::hasColumn('task_assignees', 'contribution_percent')) {
                $table->dropColumn('contribution_percent');
            }
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn([
                'complexity',
                'quality_rating',
                'quality_review_note',
                'quality_reviewed_by',
                'quality_reviewed_at',
            ]);
        });
    }
};
