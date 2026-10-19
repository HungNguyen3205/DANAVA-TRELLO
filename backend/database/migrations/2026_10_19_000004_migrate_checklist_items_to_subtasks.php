<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Safely migrate existing 24 checklist items into subtasks
        $checklists = DB::table('checklists')->get();

        foreach ($checklists as $checklist) {
            $parentTask = DB::table('tasks')->where('id', $checklist->task_id)->first();
            if (!$parentTask) {
                continue;
            }

            $items = DB::table('checklist_items')
                ->where('checklist_id', $checklist->id)
                ->orderBy('id', 'asc')
                ->get();

            $sortOrder = 1;
            foreach ($items as $item) {
                // Prevent duplicate subtask creation if already migrated
                $exists = DB::table('tasks')
                    ->where('parent_task_id', $parentTask->id)
                    ->where('title', $item->content)
                    ->exists();

                if (!$exists) {
                    DB::table('tasks')->insert([
                        'parent_task_id' => $parentTask->id,
                        'column_id' => $parentTask->column_id,
                        'sprint_id' => $parentTask->sprint_id,
                        'assignee_id' => null,
                        'title' => $item->content,
                        'description' => null,
                        'priority' => 'Bình thường',
                        'order' => $parentTask->order ?? 0,
                        'sort_order' => $sortOrder++,
                        'due_date' => null,
                        'completed_at' => $item->is_completed ? ($item->updated_at ?? now()) : null,
                        'completed_by' => null,
                        'created_by' => null,
                        'created_at' => $item->created_at ?? now(),
                        'updated_at' => $item->updated_at ?? now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // For rollback safety, we keep subtasks or delete only those migrated from checklists
        // Nothing destructive done to original checklist_items table
    }
};
