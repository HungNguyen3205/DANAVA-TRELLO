<?php

namespace App\Console\Commands;

use App\Models\Board;
use App\Models\KanbanColumn;
use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PurgeTrashCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'trash:purge {--days= : Override trash retention days}';

    /**
     * The console command description.
     */
    protected $description = 'Permanently purge soft-deleted trash items older than retention period (default 30 days)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) ($this->option('days') ?: config('trash.retention_days', 30));
        $cutoff = now()->subDays($days);

        $this->info("Purging soft-deleted items older than {$days} days (before {$cutoff->toDateTimeString()})...");

        // 1. Purge Attachments (and remove files from storage)
        $attachments = TaskAttachment::onlyTrashed()->where('deleted_at', '<=', $cutoff)->get();
        $attachmentCount = 0;
        foreach ($attachments as $att) {
            if ($att->file_path && Storage::disk('public')->exists($att->file_path)) {
                Storage::disk('public')->delete($att->file_path);
            }
            $att->forceDelete();
            $attachmentCount++;
        }
        $this->line(" - Purged {$attachmentCount} task attachments.");

        // 2. Purge Tasks (Subtasks & Parent tasks)
        $taskCount = Task::onlyTrashed()->where('deleted_at', '<=', $cutoff)->forceDelete();
        $this->line(" - Purged {$taskCount} tasks/subtasks.");

        // 3. Purge Columns
        $columnCount = KanbanColumn::onlyTrashed()->where('deleted_at', '<=', $cutoff)->forceDelete();
        $this->line(" - Purged {$columnCount} kanban columns.");

        // 4. Purge Boards
        $boardCount = Board::onlyTrashed()->where('deleted_at', '<=', $cutoff)->forceDelete();
        $this->line(" - Purged {$boardCount} boards.");

        $this->info("Trash purge completed successfully.");

        return Command::SUCCESS;
    }
}
