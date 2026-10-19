<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create task_groups table
        if (!Schema::hasTable('task_groups')) {
            Schema::create('task_groups', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
                $table->string('title');
                $table->unsignedInteger('position')->default(0);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['task_id', 'position']);
            });
        }

        // 2. Add task_group_id to tasks table
        if (!Schema::hasColumn('tasks', 'task_group_id')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->foreignId('task_group_id')->nullable()->after('parent_task_id')->constrained('task_groups')->nullOnDelete();
                $table->index(['parent_task_id', 'task_group_id']);
            });
        }

        // 3. Migrate existing checklists into task_groups
        if (Schema::hasTable('checklists')) {
            $checklists = DB::table('checklists')->orderBy('id', 'asc')->get();

            foreach ($checklists as $checklist) {
                $parentTask = DB::table('tasks')->where('id', $checklist->task_id)->first();
                if (!$parentTask) {
                    continue;
                }

                // Check if group already exists for this task with this title
                $groupId = DB::table('task_groups')
                    ->where('task_id', $checklist->task_id)
                    ->where('title', $checklist->title)
                    ->value('id');

                if (!$groupId) {
                    $groupId = DB::table('task_groups')->insertGetId([
                        'task_id' => $checklist->task_id,
                        'title' => $checklist->title,
                        'position' => 0,
                        'created_by' => $parentTask->created_by ?? null,
                        'created_at' => $checklist->created_at ?? now(),
                        'updated_at' => $checklist->updated_at ?? now(),
                    ]);
                }

                // Migrate checklist items to subtasks if not already created
                if (Schema::hasTable('checklist_items')) {
                    $items = DB::table('checklist_items')
                        ->where('checklist_id', $checklist->id)
                        ->orderBy('id', 'asc')
                        ->get();

                    $sortOrder = 1;
                    foreach ($items as $item) {
                        // Check if a subtask with same title exists under parent
                        $existingSubtask = DB::table('tasks')
                            ->where('parent_task_id', $parentTask->id)
                            ->where('title', $item->content)
                            ->first();

                        if ($existingSubtask) {
                            // Link existing subtask to this group
                            DB::table('tasks')->where('id', $existingSubtask->id)->update([
                                'task_group_id' => $groupId,
                            ]);
                        } else {
                            // Create new subtask
                            DB::table('tasks')->insert([
                                'parent_task_id' => $parentTask->id,
                                'task_group_id' => $groupId,
                                'column_id' => $parentTask->column_id,
                                'sprint_id' => $parentTask->sprint_id,
                                'assignee_id' => null,
                                'created_by' => $parentTask->created_by ?? null,
                                'title' => $item->content,
                                'description' => null,
                                'priority' => 'Bình thường',
                                'order' => $parentTask->order ?? 0,
                                'sort_order' => $sortOrder++,
                                'due_date' => null,
                                'completed_at' => $item->is_completed ? ($item->updated_at ?? now()) : null,
                                'completed_by' => null,
                                'created_at' => $item->created_at ?? now(),
                                'updated_at' => $item->updated_at ?? now(),
                            ]);
                        }
                    }
                }
            }
        }

        // 4. Ensure any remaining subtasks with null task_group_id are linked to a default group
        $ungroupedParentIds = DB::table('tasks')
            ->whereNotNull('parent_task_id')
            ->whereNull('task_group_id')
            ->distinct()
            ->pluck('parent_task_id');

        foreach ($ungroupedParentIds as $parentId) {
            $parent = DB::table('tasks')->where('id', $parentId)->first();
            if (!$parent) {
                continue;
            }

            // Find or create default group
            $defaultGroupId = DB::table('task_groups')
                ->where('task_id', $parentId)
                ->orderBy('position', 'asc')
                ->value('id');

            if (!$defaultGroupId) {
                $defaultGroupId = DB::table('task_groups')->insertGetId([
                    'task_id' => $parentId,
                    'title' => 'Việc cần làm',
                    'position' => 0,
                    'created_by' => $parent->created_by ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Link all ungrouped subtasks of this parent to default group
            DB::table('tasks')
                ->where('parent_task_id', $parentId)
                ->whereNull('task_group_id')
                ->update(['task_group_id' => $defaultGroupId]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('tasks', 'task_group_id')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropForeign(['task_group_id']);
                $table->dropIndex(['parent_task_id', 'task_group_id']);
                $table->dropColumn('task_group_id');
            });
        }

        Schema::dropIfExists('task_groups');
    }
};
