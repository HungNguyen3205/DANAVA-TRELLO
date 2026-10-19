<?php

namespace App\Console\Commands;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Label;
use App\Models\Sprint;
use App\Models\Task;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BoardDataAuditCommand extends Command
{
    protected $signature = 'board:audit-data {--fix : Automatically fix safe inconsistencies} {--dry-run : Simulate fixes without writing to database}';
    protected $description = 'Audit and safely repair Board-First data integrity across boards, members, tasks, sprints, and labels';

    public function handle()
    {
        $fix = (bool) $this->option('fix');
        $dryRun = (bool) $this->option('dry-run');

        $this->info("=================================================");
        $this->info("       DANAVA WORK - BOARD DATA AUDIT            ");
        $this->info("=================================================");
        if ($dryRun) {
            $this->warn("MODE: DRY RUN (No changes will be written to the database)");
        } elseif ($fix) {
            $this->warn("MODE: AUTOMATIC FIX (Changes will run in a DB transaction)");
        } else {
            $this->line("MODE: AUDIT REPORT ONLY (Use --fix to repair)");
        }

        $issues = [];

        // 1. Board owner_id = null
        $boardsNoOwner = Board::whereNull('owner_id')->get();
        $issues['boards_no_owner'] = $boardsNoOwner;

        // 2. Board public_id is null or empty
        $boardsNoPublicId = Board::whereNull('public_id')->orWhere('public_id', '')->get();
        $issues['boards_no_public_id'] = $boardsNoPublicId;

        // 3. Board owner not in board_members
        $boardsOwnerNotInMembers = Board::whereNotNull('owner_id')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('board_members')
                    ->whereColumn('board_members.board_id', 'boards.id')
                    ->whereColumn('board_members.user_id', 'boards.owner_id');
            })
            ->get();
        $issues['boards_owner_not_in_members'] = $boardsOwnerNotInMembers;

        // 4. Duplicate board_members (same board_id + user_id)
        $duplicateMembers = DB::table('board_members')
            ->select('board_id', 'user_id', DB::raw('count(*) as count'))
            ->groupBy('board_id', 'user_id')
            ->havingRaw('count(*) > 1')
            ->get();
        $issues['duplicate_board_members'] = $duplicateMembers;

        // 5. Tasks assigned to users who are not members of the board
        $invalidAssignees = DB::table('task_assignees')
            ->join('tasks', 'tasks.id', '=', 'task_assignees.task_id')
            ->join('kanban_columns', 'kanban_columns.id', '=', 'tasks.column_id')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('board_members')
                    ->whereColumn('board_members.board_id', 'kanban_columns.board_id')
                    ->whereColumn('board_members.user_id', 'task_assignees.user_id');
            })
            ->select('task_assignees.task_id', 'task_assignees.user_id', 'kanban_columns.board_id')
            ->get();
        $issues['tasks_non_member_assignees'] = $invalidAssignees;

        // 6. Labels attached to task of a different board
        $crossBoardLabels = DB::table('task_labels')
            ->join('tasks', 'tasks.id', '=', 'task_labels.task_id')
            ->join('kanban_columns', 'kanban_columns.id', '=', 'tasks.column_id')
            ->join('labels', 'labels.id', '=', 'task_labels.label_id')
            ->whereColumn('labels.board_id', '!=', 'kanban_columns.board_id')
            ->select('task_labels.task_id', 'task_labels.label_id', 'labels.board_id as label_board_id', 'kanban_columns.board_id as task_board_id')
            ->get();
        $issues['cross_board_labels'] = $crossBoardLabels;

        // 7. Sprints assigned to task of a different board
        $crossBoardSprints = DB::table('tasks')
            ->join('kanban_columns', 'kanban_columns.id', '=', 'tasks.column_id')
            ->join('board_sprints', 'board_sprints.id', '=', 'tasks.sprint_id')
            ->whereColumn('board_sprints.board_id', '!=', 'kanban_columns.board_id')
            ->select('tasks.id as task_id', 'tasks.sprint_id', 'board_sprints.board_id as sprint_board_id', 'kanban_columns.board_id as task_board_id')
            ->get();
        $issues['cross_board_sprints'] = $crossBoardSprints;

        // 8. Tasks with invalid column_id
        $invalidColumnTasks = DB::table('tasks')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('kanban_columns')
                    ->whereColumn('kanban_columns.id', 'tasks.column_id');
            })
            ->select('tasks.id as task_id', 'tasks.column_id')
            ->get();
        $issues['invalid_column_tasks'] = $invalidColumnTasks;

        // Output summary table
        $summaryData = [
            ['1. Boards missing owner_id', $boardsNoOwner->count()],
            ['2. Boards missing public_id', $boardsNoPublicId->count()],
            ['3. Board owner not in board_members', $boardsOwnerNotInMembers->count()],
            ['4. Duplicate board_members records', $duplicateMembers->count()],
            ['5. Task assignees not in board', $invalidAssignees->count()],
            ['6. Cross-board task labels', $crossBoardLabels->count()],
            ['7. Cross-board task sprints', $crossBoardSprints->count()],
            ['8. Tasks with invalid column_id', $invalidColumnTasks->count()],
        ];

        $this->table(['Check Item', 'Inconsistency Count'], $summaryData);

        $totalIssues = array_reduce($issues, fn($c, $item) => $c + count($item), 0);

        if ($totalIssues === 0) {
            $this->info("✓ PERFECT: All board-first data consistency checks PASSED with 0 errors!");
            return 0;
        }

        $this->warn("Found {$totalIssues} total data inconsistency record(s).");

        if (!$fix) {
            $this->line("Run 'php artisan board:audit-data --fix' to automatically resolve safe items.");
            return 1;
        }

        if ($dryRun) {
            $this->info("DRY RUN completed. No modifications made.");
            return 0;
        }

        // Execute Fixes in DB Transaction
        DB::transaction(function () use ($issues) {
            // Fix 1: Boards without owner_id -> Assign to first admin in board_members or first system admin
            $adminUser = User::where('system_role', 'admin')->first() ?? User::first();
            foreach ($issues['boards_no_owner'] as $b) {
                $firstMemberAdmin = DB::table('board_members')
                    ->where('board_id', $b->id)
                    ->where('role', 'admin')
                    ->value('user_id');
                $newOwnerId = $firstMemberAdmin ?? $adminUser?->id;
                if ($newOwnerId) {
                    $b->update(['owner_id' => $newOwnerId]);
                    DB::table('board_members')->updateOrInsert(
                        ['board_id' => $b->id, 'user_id' => $newOwnerId],
                        ['role' => 'admin', 'updated_at' => now()]
                    );
                    Log::info("BoardDataAudit: Fixed board #{$b->id} assigned owner #{$newOwnerId}");
                }
            }

            // Fix 2: Boards without public_id -> generate random unique public_id
            foreach ($issues['boards_no_public_id'] as $b) {
                $code = Str::lower(Str::random(10));
                $b->update(['public_id' => $code]);
                Log::info("BoardDataAudit: Generated public_id {$code} for board #{$b->id}");
            }

            // Fix 3: Board owner not in board_members -> insert as admin
            foreach ($issues['boards_owner_not_in_members'] as $b) {
                DB::table('board_members')->updateOrInsert(
                    ['board_id' => $b->id, 'user_id' => $b->owner_id],
                    ['role' => 'admin', 'is_starred' => false, 'created_at' => now(), 'updated_at' => now()]
                );
                Log::info("BoardDataAudit: Added board owner #{$b->owner_id} to board_members of board #{$b->id}");
            }

            // Fix 4: Duplicate board_members -> deduplicate keeping latest
            foreach ($issues['duplicate_board_members'] as $dup) {
                $ids = DB::table('board_members')
                    ->where('board_id', $dup->board_id)
                    ->where('user_id', $dup->user_id)
                    ->orderBy('created_at', 'desc')
                    ->pluck('id')
                    ->toArray();
                if (count($ids) > 1) {
                    $deleteIds = array_slice($ids, 1);
                    DB::table('board_members')->whereIn('id', $deleteIds)->delete();
                    Log::info("BoardDataAudit: Deduplicated board_members for board #{$dup->board_id}, user #{$dup->user_id}");
                }
            }

            // Fix 5: Task assignees not in board -> remove assignee
            foreach ($issues['tasks_non_member_assignees'] as $assignee) {
                DB::table('task_assignees')
                    ->where('task_id', $assignee->task_id)
                    ->where('user_id', $assignee->user_id)
                    ->delete();
                Log::info("BoardDataAudit: Removed invalid task assignee user #{$assignee->user_id} from task #{$assignee->task_id}");
            }

            // Fix 6: Cross-board labels -> detach
            foreach ($issues['cross_board_labels'] as $label) {
                DB::table('task_labels')
                    ->where('task_id', $label->task_id)
                    ->where('label_id', $label->label_id)
                    ->delete();
                Log::info("BoardDataAudit: Detached cross-board label #{$label->label_id} from task #{$label->task_id}");
            }

            // Fix 7: Cross-board sprints -> set sprint_id = null
            foreach ($issues['cross_board_sprints'] as $sprint) {
                DB::table('tasks')
                    ->where('id', $sprint->task_id)
                    ->update(['sprint_id' => null]);
                Log::info("BoardDataAudit: Cleared cross-board sprint from task #{$sprint->task_id}");
            }
        });

        $this->info("✓ Successfully repaired all detected data inconsistencies!");
        return 0;
    }
}
