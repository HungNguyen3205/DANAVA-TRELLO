<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Board;
use App\Models\BoardSprint;
use App\Models\KanbanColumn;
use App\Models\Label;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use ZipArchive;

class TaskExcelImportService
{
    public const MAX_ROWS = 2000;
    public const MAX_FILE_SIZE_BYTES = 10485760; // 10MB

    public const COLUMNS = [
        'external_key',
        'parent_external_key',
        'title',
        'description',
        'column',
        'priority',
        'complexity',
        'estimated_points',
        'progress_percent',
        'start_date',
        'due_date',
        'assignee_usernames',
        'contribution_percentages',
        'labels',
        'sprint',
        'completed',
        'notes',
    ];

    /**
     * Generate Excel template with 6 sheets populated with board-specific metadata.
     */
    public function generateTemplate(Board $board): string
    {
        $spreadsheet = new Spreadsheet();

        // 1. SHEET HUONG_DAN
        $guideSheet = $spreadsheet->getActiveSheet();
        $guideSheet->setTitle('HUONG_DAN');
        $this->buildGuideSheet($guideSheet, $board);

        // 2. SHEET TASKS (Primary data sheet)
        $tasksSheet = $spreadsheet->createSheet();
        $tasksSheet->setTitle('TASKS');
        $this->buildTasksSheet($tasksSheet);

        // 3. SHEET THANH_VIEN (Board members reference)
        $membersSheet = $spreadsheet->createSheet();
        $membersSheet->setTitle('THANH_VIEN');
        $this->buildMembersSheet($membersSheet, $board);

        // 4. SHEET COT_KANBAN (Board columns reference)
        $columnsSheet = $spreadsheet->createSheet();
        $columnsSheet->setTitle('COT_KANBAN');
        $this->buildColumnsSheet($columnsSheet, $board);

        // 5. SHEET NHAN (Board labels reference)
        $labelsSheet = $spreadsheet->createSheet();
        $labelsSheet->setTitle('NHAN');
        $this->buildLabelsSheet($labelsSheet, $board);

        // 6. SHEET VI_DU (Examples with parent/child and multiple assignees)
        $examplesSheet = $spreadsheet->createSheet();
        $examplesSheet->setTitle('VI_DU');
        $this->buildExamplesSheet($examplesSheet, $board);

        // Focus on TASKS sheet for immediate input
        $spreadsheet->setActiveSheetIndex(1);

        $tempPath = tempnam(sys_get_temp_dir(), 'danava_task_tpl_') . '.xlsx';
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);

        return $tempPath;
    }

    /**
     * Validate an uploaded .xlsx file and prepare preview data without altering the database.
     */
    public function validateAndPreview(Board $board, UploadedFile $file): array
    {
        // 1. Security & File Validation
        if ($file->getSize() > self::MAX_FILE_SIZE_BYTES) {
            abort(422, 'Dung lượng tệp vượt quá giới hạn tối đa 10MB.');
        }

        $extension = strtolower($file->getClientOriginalExtension());
        if ($extension !== 'xlsx') {
            abort(422, 'Chỉ chấp nhận tệp định dạng Excel .xlsx.');
        }

        // Verify real mime / zip archive
        $filePath = $file->getRealPath();
        $this->assertSafeXlsxFile($filePath);

        // 2. Load Spreadsheet safely (Read Data Only, No Scripts)
        try {
            $reader = IOFactory::createReader('Xlsx');
            $reader->setReadDataOnly(true);
            $reader->setReadEmptyCells(false);
            $spreadsheet = $reader->load($filePath);
        } catch (\Throwable $e) {
            @unlink($filePath);
            abort(422, 'Không thể đọc tệp Excel. Vui lòng kiểm tra lại định dạng tệp .xlsx.');
        }

        $tasksSheet = $spreadsheet->getSheetByName('TASKS');
        if (!$tasksSheet) {
            @unlink($filePath);
            abort(422, "Không tìm thấy sheet có tên 'TASKS' trong tệp Excel.");
        }

        // 3. Pre-load Board metadata for validation
        $boardMembers = $this->getBoardMembersLookup($board);
        $boardColumns = KanbanColumn::where('board_id', $board->id)
            ->whereNull('archived_at')
            ->orderBy('order')
            ->get();
        $defaultColumn = $boardColumns->first();

        $columnsByName = [];
        $columnsById = [];
        foreach ($boardColumns as $col) {
            $columnsByName[mb_strtolower(trim($col->title))] = $col;
            $columnsById[(string)$col->id] = $col;
        }

        $sprintsByName = BoardSprint::where('board_id', $board->id)
            ->get()
            ->keyBy(fn($s) => mb_strtolower(trim($s->title)));

        // Existing external keys already present in the board
        $existingExternalKeysInBoard = Task::whereHas('column', fn($q) => $q->where('board_id', $board->id))
            ->whereNotNull('external_key')
            ->pluck('external_key')
            ->map(fn($k) => mb_strtolower(trim($k)))
            ->flip()
            ->toArray();

        // 4. Parse Header Row (Row 1)
        $highestColumn = $tasksSheet->getHighestColumn();
        $highestColumnIndex = Coordinate::columnIndexFromString($highestColumn);
        $highestRow = $tasksSheet->getHighestRow();

        if ($highestRow > (self::MAX_ROWS + 1)) {
            @unlink($filePath);
            abort(422, 'Tệp vượt quá số lượng tối đa 2.000 dòng công việc.');
        }

        $headerMap = [];
        for ($col = 1; $col <= $highestColumnIndex; $col++) {
            $val = trim((string)$tasksSheet->getCell([$col, 1])->getValue());
            if ($val !== '') {
                $cleanCol = strtolower(str_replace([' ', '-'], '_', $val));
                $headerMap[$cleanCol] = $col;
            }
        }

        if (!isset($headerMap['external_key']) || !isset($headerMap['title'])) {
            @unlink($filePath);
            abort(422, "Sheet 'TASKS' thiếu các cột bắt buộc: 'external_key' hoặc 'title'.");
        }

        // 5. Parse Data Rows
        $parsedRows = [];
        $encounteredFileKeys = [];
        $fileTasksByExternalKey = [];

        for ($row = 2; $row <= $highestRow; $row++) {
            $rowData = [];
            $hasAnyValue = false;

            foreach (self::COLUMNS as $colName) {
                $colIndex = $headerMap[$colName] ?? null;
                $val = null;
                if ($colIndex !== null) {
                    $cell = $tasksSheet->getCell([$colIndex, $row]);
                    $val = $cell->getValue();
                    if ($val !== null && trim((string)$val) !== '') {
                        $hasAnyValue = true;
                    }
                }
                $rowData[$colName] = $val !== null ? trim((string)$val) : '';
            }

            // Skip blank row
            if (!$hasAnyValue) {
                continue;
            }

            $rowData['_row_index'] = $row;
            $parsedRows[] = $rowData;

            $extKey = mb_strtolower(trim($rowData['external_key']));
            if ($extKey !== '') {
                $fileTasksByExternalKey[$extKey] = $rowData;
            }
        }

        // Delete temporary upload file immediately
        @unlink($filePath);

        if (empty($parsedRows)) {
            abort(422, "Sheet 'TASKS' không có dữ liệu công việc nào.");
        }

        // 6. Validate Each Row & Hierarchy
        $previewRows = [];
        $validRowsCount = 0;
        $invalidRowsCount = 0;

        foreach ($parsedRows as $r) {
            $errors = [];
            $rowNum = $r['_row_index'];
            $extKeyRaw = $r['external_key'];
            $extKeyLower = mb_strtolower(trim($extKeyRaw));
            $parentKeyRaw = $r['parent_external_key'];
            $parentKeyLower = mb_strtolower(trim($parentKeyRaw));

            // Validate external_key
            if ($extKeyLower === '') {
                $errors[] = 'external_key là bắt buộc không được để trống.';
            } else {
                if (isset($encounteredFileKeys[$extKeyLower])) {
                    $errors[] = "Mã external_key '{$extKeyRaw}' bị trùng lặp trong file (dòng {$encounteredFileKeys[$extKeyLower]} và {$rowNum}).";
                } else {
                    $encounteredFileKeys[$extKeyLower] = $rowNum;
                }

                if (isset($existingExternalKeysInBoard[$extKeyLower])) {
                    $errors[] = "Mã external_key '{$extKeyRaw}' đã tồn tại trong Board này từ trước.";
                }
            }

            // Validate title
            if ($r['title'] === '') {
                $errors[] = 'Tiêu đề công việc (title) là bắt buộc.';
            } elseif (mb_strlen($r['title']) > 255) {
                $errors[] = 'Tiêu đề công việc vượt quá 255 ký tự.';
            }

            // Validate column
            $resolvedColumn = null;
            if ($r['column'] !== '') {
                $colKeyLower = mb_strtolower(trim($r['column']));
                if (isset($columnsByName[$colKeyLower])) {
                    $resolvedColumn = $columnsByName[$colKeyLower];
                } elseif (isset($columnsById[$r['column']])) {
                    $resolvedColumn = $columnsById[$r['column']];
                } else {
                    $errors[] = "Cột '{$r['column']}' không tồn tại trong Board này.";
                }
            } else {
                $resolvedColumn = $defaultColumn;
            }

            // Validate priority
            $priority = $this->normalizePriority($r['priority']);

            // Validate complexity
            $complexity = strtoupper(trim($r['complexity'] ?: 'M'));
            if (!in_array($complexity, ['XS', 'S', 'M', 'L', 'XL'])) {
                $errors[] = "Độ phức tạp '{$r['complexity']}' không hợp lệ. Chỉ chấp nhận: XS, S, M, L, XL.";
            }

            // Validate estimated_points
            $estimatedPoints = null;
            if ($r['estimated_points'] !== '') {
                if (!is_numeric($r['estimated_points']) || (float)$r['estimated_points'] < 0) {
                    $errors[] = 'Điểm ước lượng (estimated_points) phải là số dương hoặc 0.';
                } else {
                    $estimatedPoints = round((float)$r['estimated_points'], 2);
                }
            }

            // Validate progress_percent
            $progressPercent = 0;
            if ($r['progress_percent'] !== '') {
                if (!is_numeric($r['progress_percent']) || (int)$r['progress_percent'] < 0 || (int)$r['progress_percent'] > 100) {
                    $errors[] = 'Tiến độ (progress_percent) phải là số nguyên từ 0 đến 100.';
                } else {
                    $progressPercent = (int)$r['progress_percent'];
                }
            }

            // Validate dates
            $startDate = $this->parseDateSafely($r['start_date'], $errors, 'start_date');
            $dueDate = $this->parseDateSafely($r['due_date'], $errors, 'due_date');
            if ($startDate && $dueDate && $startDate > $dueDate) {
                $errors[] = 'Ngày bắt đầu (start_date) không được lớn hơn ngày hạn chót (due_date).';
            }

            // Validate assignees
            $resolvedAssignees = [];
            if ($r['assignee_usernames'] !== '') {
                $rawUsernames = array_map('trim', explode(';', $r['assignee_usernames']));
                $seenUsernames = [];

                foreach ($rawUsernames as $rawU) {
                    if ($rawU === '') continue;
                    $uLower = mb_strtolower($rawU);
                    if (isset($seenUsernames[$uLower])) continue; // de-duplicate inside same task
                    $seenUsernames[$uLower] = true;

                    if (!isset($boardMembers[$uLower])) {
                        $errors[] = "Thành viên '@{$rawU}' không thuộc Board này. Hệ thống không cho phép gán người ngoài Board.";
                    } else {
                        $resolvedAssignees[] = $boardMembers[$uLower];
                    }
                }
            }

            // Validate contribution_percentages
            $assigneeCount = count($resolvedAssignees);
            $resolvedContributions = [];

            if ($assigneeCount > 0) {
                if ($r['contribution_percentages'] === '') {
                    // Divide equally
                    $equalPart = round(100 / $assigneeCount, 2);
                    $sum = 0;
                    for ($i = 0; $i < $assigneeCount; $i++) {
                        if ($i === $assigneeCount - 1) {
                            $resolvedContributions[] = round(100 - $sum, 2);
                        } else {
                            $resolvedContributions[] = $equalPart;
                            $sum += $equalPart;
                        }
                    }
                } else {
                    $rawPercents = array_map('trim', explode(';', $r['contribution_percentages']));
                    if (count($rawPercents) !== $assigneeCount) {
                        $errors[] = "Số lượng % đóng góp (" . count($rawPercents) . ") không khớp với số lượng người phụ trách ({$assigneeCount}).";
                    } else {
                        $sum = 0;
                        foreach ($rawPercents as $p) {
                            if (!is_numeric($p) || (float)$p <= 0 || (float)$p > 100) {
                                $errors[] = "Giá trị tỷ lệ đóng góp '{$p}' không hợp lệ (phải > 0 và <= 100).";
                            } else {
                                $valP = round((float)$p, 2);
                                $resolvedContributions[] = $valP;
                                $sum += $valP;
                            }
                        }
                        if (abs($sum - 100) > 0.05) {
                            $errors[] = "Tổng tỷ lệ đóng góp của các thành viên phải bằng 100% (hiện tại: {$sum}%).";
                        }
                    }
                }
            }

            // Validate parent_external_key & hierarchy rules
            $isSubtask = false;
            if ($parentKeyLower !== '') {
                $isSubtask = true;

                if ($parentKeyLower === $extKeyLower) {
                    $errors[] = "Task không thể chọn chính nó làm task cha.";
                } elseif (!isset($fileTasksByExternalKey[$parentKeyLower])) {
                    // Check if parent task exists in board DB
                    $dbParentTask = Task::whereHas('column', fn($q) => $q->where('board_id', $board->id))
                        ->where('external_key', $parentKeyRaw)
                        ->first();

                    if (!$dbParentTask) {
                        $errors[] = "Không tìm thấy task cha có external_key '{$parentKeyRaw}' trong file hoặc trong Board.";
                    } elseif ($dbParentTask->parent_task_id !== null) {
                        $errors[] = "Không được tạo Task cháu: Task cha '{$parentKeyRaw}' cũng là một task con.";
                    }
                } else {
                    // Parent is inside file
                    $parentRow = $fileTasksByExternalKey[$parentKeyLower];
                    $grandParentKey = mb_strtolower(trim($parentRow['parent_external_key'] ?? ''));

                    // Rule: No grandchildren
                    if ($grandParentKey !== '') {
                        $errors[] = "Không được tạo Task cháu: Task cha '{$parentKeyRaw}' cũng là một task con của '{$parentRow['parent_external_key']}'.";
                    }

                    // Rule: Detect cyclic reference
                    if ($grandParentKey === $extKeyLower) {
                        $errors[] = "Phát hiện vòng lặp phụ thuộc (Cyclic reference) giữa '{$extKeyRaw}' và '{$parentKeyRaw}'.";
                    }
                }
            }

            // Validate sprint
            $resolvedSprint = null;
            if ($r['sprint'] !== '') {
                $sprintKey = mb_strtolower(trim($r['sprint']));
                if (isset($sprintsByName[$sprintKey])) {
                    $resolvedSprint = $sprintsByName[$sprintKey];
                } else {
                    $errors[] = "Sprint '{$r['sprint']}' không tồn tại trong Board này.";
                }
            }

            // Completed flag
            $isCompleted = in_array(mb_strtolower(trim($r['completed'])), ['1', 'true', 'có', 'yes', 'hoàn thành']);

            $isValid = empty($errors);
            if ($isValid) {
                $validRowsCount++;
            } else {
                $invalidRowsCount++;
            }

            $previewRows[] = [
                'row_index' => $rowNum,
                'is_valid' => $isValid,
                'errors' => $errors,
                'data' => [
                    'external_key' => $extKeyRaw,
                    'parent_external_key' => $parentKeyRaw,
                    'is_subtask' => $isSubtask,
                    'title' => $r['title'],
                    'description' => $r['description'],
                    'notes' => $r['notes'],
                    'column_id' => $resolvedColumn?->id,
                    'column_title' => $resolvedColumn?->title ?? 'Mặc định',
                    'priority' => $priority,
                    'complexity' => $complexity,
                    'estimated_points' => $estimatedPoints,
                    'progress_percent' => $progressPercent,
                    'start_date' => $startDate?->format('Y-m-d H:i:s'),
                    'due_date' => $dueDate?->format('Y-m-d H:i:s'),
                    'assignees' => array_map(function ($u, $idx) use ($resolvedContributions) {
                        return [
                            'id' => $u->id,
                            'name' => $u->name,
                            'username' => $u->username,
                            'avatar' => $u->avatar,
                            'contribution_percent' => $resolvedContributions[$idx] ?? null,
                        ];
                    }, $resolvedAssignees, array_keys($resolvedAssignees)),
                    'labels' => $this->parseLabels($r['labels']),
                    'sprint_id' => $resolvedSprint?->id,
                    'sprint_title' => $resolvedSprint?->title,
                    'completed' => $isCompleted,
                ],
            ];
        }

        $allValid = ($invalidRowsCount === 0);
        $previewToken = (string) Str::uuid();

        $previewPayload = [
            'board_id' => $board->id,
            'preview_token' => $previewToken,
            'is_valid' => $allValid,
            'total_rows' => count($previewRows),
            'valid_rows_count' => $validRowsCount,
            'invalid_rows_count' => $invalidRowsCount,
            'created_at' => now()->toIso8601String(),
            'rows' => $previewRows,
        ];

        // Cache preview payload for 2 hours
        Cache::put("excel_import_preview_{$board->id}_{$previewToken}", $previewPayload, now()->addHours(2));

        return $previewPayload;
    }

    /**
     * Confirm import using the cached preview token inside a strict DB transaction.
     */
    public function confirmImport(Board $board, string $previewToken, User $actor): array
    {
        $cacheKey = "excel_import_preview_{$board->id}_{$previewToken}";
        $cachedData = Cache::get($cacheKey);

        if (!$cachedData) {
            abort(400, 'Phiên xem trước Import đã hết hạn hoặc không tồn tại. Vui lòng tải lên lại.');
        }

        if (!$cachedData['is_valid']) {
            abort(422, 'Tệp tải lên có chứa dòng lỗi, không thể tiến hành import theo nguyên tắc nguyên tử.');
        }

        $rows = $cachedData['rows'];
        $createdTasksByExtKey = [];
        $createdTaskIds = [];

        DB::transaction(function () use ($board, $rows, $actor, &$createdTasksByExtKey, &$createdTaskIds) {
            // PASS 1: Create all Root Tasks (parent_external_key is null or empty)
            foreach ($rows as $item) {
                $d = $item['data'];
                if (!empty($d['parent_external_key'])) {
                    continue; // Skip subtasks on pass 1
                }

                $task = $this->createSingleTaskRecord($board, $d, null, $actor);
                $createdTasksByExtKey[mb_strtolower(trim($d['external_key']))] = $task;
                $createdTaskIds[] = $task->id;
            }

            // PASS 2: Create all Subtasks (linking to their created parent task)
            foreach ($rows as $item) {
                $d = $item['data'];
                if (empty($d['parent_external_key'])) {
                    continue; // Skip root tasks on pass 2
                }

                $parentKeyLower = mb_strtolower(trim($d['parent_external_key']));
                $parentTask = $createdTasksByExtKey[$parentKeyLower] ?? null;

                if (!$parentTask) {
                    // Try finding parent in DB
                    $parentTask = Task::whereHas('column', fn($q) => $q->where('board_id', $board->id))
                        ->where('external_key', $d['parent_external_key'])
                        ->first();
                }

                if (!$parentTask) {
                    throw new \RuntimeException("Không thể liên kết task con '{$d['external_key']}' với task cha '{$d['parent_external_key']}'.");
                }

                $subtask = $this->createSingleTaskRecord($board, $d, $parentTask->id, $actor);
                $createdTasksByExtKey[mb_strtolower(trim($d['external_key']))] = $subtask;
                $createdTaskIds[] = $subtask->id;
            }

            // Record Board Activity Log
            ActivityLog::create([
                'board_id' => $board->id,
                'task_id' => $createdTaskIds[0] ?? null,
                'user_id' => $actor->id,
                'action' => 'imported_from_excel',
                'old_value' => null,
                'new_value' => "Đã import thành công " . count($createdTaskIds) . " công việc từ tệp Excel.",
            ]);
        });

        // Clear preview cache after successful import
        Cache::forget($cacheKey);

        return [
            'success' => true,
            'imported_count' => count($createdTaskIds),
            'message' => "Đã import thành công " . count($createdTaskIds) . " công việc vào Board.",
        ];
    }

    /**
     * Generate an Excel error file for invalid preview sessions.
     */
    public function generateErrorSpreadsheet(Board $board, string $previewToken): string
    {
        $cacheKey = "excel_import_preview_{$board->id}_{$previewToken}";
        $cachedData = Cache::get($cacheKey);

        if (!$cachedData) {
            abort(404, 'Không tìm thấy dữ liệu lỗi cho phiên này.');
        }

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('DANH_SACH_LOI');

        // Headers
        $headers = array_merge(self::COLUMNS, ['CHI_TIET_LOI']);
        $colIdx = 1;
        foreach ($headers as $h) {
            $sheet->setCellValue([$colIdx, 1], $h);
            $sheet->getColumnDimensionByColumn($colIdx)->setAutoSize(true);
            $colIdx++;
        }

        $sheet->getStyle('A1:R1')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle('A1:R1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E11D48'); // Red header

        $rowNum = 2;
        foreach ($cachedData['rows'] as $r) {
            $colIdx = 1;
            foreach (self::COLUMNS as $colName) {
                $sheet->setCellValue([$colIdx, $rowNum], $r['data'][$colName] ?? '');
                $colIdx++;
            }
            $errorMsg = empty($r['errors']) ? 'Hợp lệ' : implode(' | ', $r['errors']);
            $sheet->setCellValue([$colIdx, $rowNum], $errorMsg);

            if (!empty($r['errors'])) {
                $sheet->getStyle("A{$rowNum}:R{$rowNum}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('FFE4E6');
            }
            $rowNum++;
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'danava_task_errors_') . '.xlsx';
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);

        return $tempPath;
    }

    // -------------------------------------------------------------
    // HELPER METHODS
    // -------------------------------------------------------------

    private function createSingleTaskRecord(Board $board, array $d, ?int $parentTaskId, User $actor): Task
    {
        $now = now();
        $completedAt = $d['completed'] ? $now : null;
        $completedBy = $d['completed'] ? $actor->id : null;

        $task = Task::create([
            'external_key' => $d['external_key'],
            'parent_task_id' => $parentTaskId,
            'column_id' => $d['column_id'],
            'sprint_id' => $d['sprint_id'] ?? null,
            'created_by' => $actor->id,
            'title' => $d['title'],
            'description' => $d['description'] ?? null,
            'notes' => $d['notes'] ?? null,
            'priority' => $d['priority'],
            'complexity' => $d['complexity'],
            'estimated_points' => $d['estimated_points'],
            'progress_percent' => $d['progress_percent'],
            'start_date' => $d['start_date'],
            'due_date' => $d['due_date'],
            'completed_at' => $completedAt,
            'completed_by' => $completedBy,
            'sort_order' => 0,
            'order' => 0,
        ]);

        // Attach assignees with contribution_percent
        if (!empty($d['assignees'])) {
            $pivotData = [];
            foreach ($d['assignees'] as $assignee) {
                $pivotData[$assignee['id']] = [
                    'assigned_by' => $actor->id,
                    'contribution_percent' => $assignee['contribution_percent'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            $task->assignees()->attach($pivotData);

            // Legacy primary assignee
            if (!empty($d['assignees'][0]['id'])) {
                $task->update(['assignee_id' => $d['assignees'][0]['id']]);
            }
        }

        // Attach labels
        if (!empty($d['labels'])) {
            $labelIds = [];
            foreach ($d['labels'] as $labelName) {
                $label = Label::firstOrCreate(
                    ['board_id' => $board->id, 'name' => $labelName],
                    ['color' => '#6366F1']
                );
                $labelIds[] = $label->id;
            }
            $task->labels()->syncWithoutDetaching($labelIds);
        }

        return $task;
    }

    private function getBoardMembersLookup(Board $board): array
    {
        $lookup = [];

        // Owner
        if ($board->owner) {
            $lookup[mb_strtolower(trim($board->owner->username))] = $board->owner;
        }

        // Board members
        $members = $board->members()->get();
        foreach ($members as $m) {
            $lookup[mb_strtolower(trim($m->username))] = $m;
        }

        return $lookup;
    }

    private function parseLabels(?string $rawLabels): array
    {
        if (!$rawLabels) return [];
        $split = preg_split('/[;,]/', $rawLabels);
        $result = [];
        foreach ($split as $item) {
            $clean = trim($item);
            if ($clean !== '') {
                $result[] = $clean;
            }
        }
        return array_unique($result);
    }

    private function normalizePriority(?string $priority): string
    {
        $clean = mb_strtolower(trim($priority ?? ''));
        return match ($clean) {
            'thấp', 'low' => 'Thấp',
            'cao', 'high' => 'Cao',
            'khẩn cấp', 'urgent' => 'Khẩn cấp',
            default => 'Bình thường',
        };
    }

    private function parseDateSafely(?string $dateStr, array &$errors, string $field): ?Carbon
    {
        if (!$dateStr) return null;

        // Numeric Excel timestamp check
        if (is_numeric($dateStr)) {
            try {
                $unix = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToTimestamp((float)$dateStr);
                return Carbon::createFromTimestamp($unix);
            } catch (\Throwable $e) {
                // fall through to string parsing
            }
        }

        $formats = [
            'Y-m-d H:i:s',
            'Y-m-d H:i',
            'Y-m-d',
            'd/m/Y H:i:s',
            'd/m/Y H:i',
            'd/m/Y',
        ];

        foreach ($formats as $fmt) {
            try {
                $parsed = Carbon::createFromFormat($fmt, $dateStr);
                if ($parsed !== false) {
                    return $parsed;
                }
            } catch (\Throwable $e) {
                continue;
            }
        }

        try {
            return Carbon::parse($dateStr);
        } catch (\Throwable $e) {
            $errors[] = "Định dạng {$field} '{$dateStr}' không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD hoặc YYYY-MM-DD HH:mm.";
            return null;
        }
    }

    private function assertSafeXlsxFile(string $filePath): void
    {
        // 1. Inspect Zip Container
        $zip = new ZipArchive();
        $res = $zip->open($filePath, ZipArchive::RDONLY);
        if ($res !== true) {
            abort(422, 'Tệp tải lên không phải là tệp nén ZIP/OpenXML hợp lệ.');
        }

        // 2. Reject macro files (.xlsm / vbaProject.bin)
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            if (str_ends_with(strtolower($filename), 'vbaproject.bin')) {
                $zip->close();
                abort(422, 'Tệp chứa mã macro VBA (vbaProject.bin). Để đảm bảo an toàn, hệ thống từ chối xử lý.');
            }
        }

        $zip->close();
    }

    // -------------------------------------------------------------
    // TEMPLATE SHEET BUILDERS
    // -------------------------------------------------------------

    private function buildGuideSheet($sheet, Board $board): void
    {
        $sheet->getColumnDimension('A')->setWidth(26);
        $sheet->getColumnDimension('B')->setWidth(80);

        $sheet->setCellValue('A1', 'QUY TẮC NHẬP DỮ LIỆU CÔNG VIỆC TỪ EXCEL (DANAVA TRELLO)');
        $sheet->mergeCells('A1:B1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->getColor()->setRGB('1E1B4B');
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $guidelines = [
            ['external_key', 'Mã định danh duy nhất của task trong file (VD: TASK-001, FE-10). Bắt buộc, không được để trống và không được trùng lặp.'],
            ['parent_external_key', 'Nếu là task con, điền external_key của task cha. Để trống nếu là task chính. Tuyệt đối không tạo Task cháu.'],
            ['title', 'Tiêu đề công việc. Bắt buộc, tối đa 255 ký tự.'],
            ['description', 'Mô tả chi tiết nội dung công việc (tuỳ chọn).'],
            ['column', 'Tên cột hoặc ID cột trong Board (xem sheet COT_KANBAN). Để trống sẽ tự đưa vào cột đầu tiên của Board.'],
            ['priority', "Mức độ ưu tiên: 'Thấp', 'Bình thường', 'Cao', 'Khẩn cấp'. Mặc định: 'Bình thường'."],
            ['complexity', "Độ phức tạp task: 'XS' (1đ), 'S' (2đ), 'M' (3đ), 'L' (5đ), 'XL' (8đ). Mặc định: 'M'."],
            ['estimated_points', 'Điểm ước lượng / Story point (số dương hoặc 0).'],
            ['progress_percent', 'Tiến độ hoàn thành (từ 0 đến 100).'],
            ['start_date', 'Ngày bắt đầu theo chuẩn YYYY-MM-DD hoặc YYYY-MM-DD HH:mm (VD: 2026-10-25 hoặc 2026-10-25 08:30).'],
            ['due_date', 'Ngày hạn chót theo chuẩn YYYY-MM-DD hoặc YYYY-MM-DD HH:mm (VD: 2026-10-30 hoặc 2026-10-30 17:30).'],
            ['assignee_usernames', 'Tên đăng nhập (username) các thành viên phụ trách, phân cách bằng dấu ; (VD: hung;nam). Chỉ gán người đã thuộc Board (xem sheet THANH_VIEN).'],
            ['contribution_percentages', 'Tỷ lệ đóng góp tương ứng (%) cho mỗi người phụ trách, phân cách bằng ; (VD: 60;40). Tổng phải bằng 100%. Để trống sẽ tự chia đều.'],
            ['labels', 'Tên các nhãn, phân cách bằng dấu ; hoặc , (VD: Frontend;Bug;UI).'],
            ['sprint', 'Tên sprint trong Board (nếu có).'],
            ['completed', "Trạng thái hoàn thành: '1', 'Có' hoặc 'true' nếu đã xong; để trống hoặc '0' nếu chưa."],
            ['notes', 'Ghi chú nội bộ cho công việc.'],
        ];

        $sheet->setCellValue('A3', 'Tên cột');
        $sheet->setCellValue('B3', 'Hướng dẫn chi tiết & Ràng buộc nghiệp vụ');
        $sheet->getStyle('A3:B3')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle('A3:B3')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('4F46E5');

        $r = 4;
        foreach ($guidelines as $item) {
            $sheet->setCellValue('A' . $r, $item[0]);
            $sheet->setCellValue('B' . $r, $item[1]);
            $sheet->getStyle('A' . $r)->getFont()->setBold(true)->getColor()->setRGB('4338CA');
            $sheet->getStyle("A{$r}:B{$r}")->getAlignment()->setWrapText(true);
            $sheet->getStyle("A{$r}:B{$r}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('E2E8F0');
            $r++;
        }

        // Safety notes
        $r += 2;
        $sheet->setCellValue("A{$r}", 'LƯU Ý VỀ TÍNH TOÀN VẸN & AN TOÀN:');
        $sheet->mergeCells("A{$r}:B{$r}");
        $sheet->getStyle("A{$r}")->getFont()->setBold(true)->getColor()->setRGB('DC2626');
        $r++;

        $notes = [
            '1. Hệ thống áp dụng nguyên tắc nguyên tử: Nếu 1 dòng bị lỗi, toàn bộ file sẽ không được import cho đến khi bạn sửa lại.',
            '2. Khi upload lên, hệ thống sẽ thực hiện VALIDATE và hiển thị BẢN XEM TRƯỚC (PREVIEW). Dữ liệu chỉ được tạo khi bạn bấm "Xác nhận Import".',
            '3. Tuyệt đối không tạo tài khoản mới từ Excel hoặc gán người lạ ngoài Board này.',
            '4. Tối đa 2.000 dòng công việc và dung lượng tệp dưới 10MB.',
        ];

        foreach ($notes as $n) {
            $sheet->setCellValue("A{$r}", $n);
            $sheet->mergeCells("A{$r}:B{$r}");
            $sheet->getStyle("A{$r}")->getFont()->setItalic(true);
            $r++;
        }
    }

    private function buildTasksSheet($sheet): void
    {
        $headers = self::COLUMNS;
        $colIdx = 1;

        foreach ($headers as $h) {
            $sheet->setCellValue([$colIdx, 1], $h);
            $colIdx++;
        }

        // Header style
        $lastCol = Coordinate::stringFromColumnIndex(count($headers));
        $sheet->getStyle("A1:{$lastCol}1")->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle("A1:{$lastCol}1")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('1E293B');
        $sheet->getRowDimension(1)->setRowHeight(28);

        // Auto width
        for ($i = 1; $i <= count($headers); $i++) {
            $sheet->getColumnDimensionByColumn($i)->setAutoSize(true);
        }
    }

    private function buildMembersSheet($sheet, Board $board): void
    {
        $sheet->setCellValue('A1', 'username');
        $sheet->setCellValue('B1', 'Họ và tên');
        $sheet->setCellValue('C1', 'Email');
        $sheet->setCellValue('D1', 'Vai trò trong Board');

        $sheet->getStyle('A1:D1')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle('A1:D1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('059669'); // Green

        $r = 2;
        if ($board->owner) {
            $sheet->setCellValue('A' . $r, $board->owner->username);
            $sheet->setCellValue('B' . $r, $board->owner->name);
            $sheet->setCellValue('C' . $r, $board->owner->email);
            $sheet->setCellValue('D' . $r, 'Owner (Chủ bảng)');
            $r++;
        }

        $members = $board->members()->get();
        foreach ($members as $m) {
            if ($board->owner && $m->id === $board->owner->id) continue;
            $sheet->setCellValue('A' . $r, $m->username);
            $sheet->setCellValue('B' . $r, $m->name);
            $sheet->setCellValue('C' . $r, $m->email);
            $sheet->setCellValue('D' . $r, $m->pivot->role ?? 'member');
            $r++;
        }

        for ($i = 1; $i <= 4; $i++) {
            $sheet->getColumnDimensionByColumn($i)->setAutoSize(true);
        }
    }

    private function buildColumnsSheet($sheet, Board $board): void
    {
        $sheet->setCellValue('A1', 'ID Cột');
        $sheet->setCellValue('B1', 'Tên Cột Kanban');
        $sheet->setCellValue('C1', 'Thứ tự');

        $sheet->getStyle('A1:C1')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle('A1:C1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB'); // Blue

        $columns = KanbanColumn::where('board_id', $board->id)
            ->whereNull('archived_at')
            ->orderBy('order')
            ->get();

        $r = 2;
        foreach ($columns as $c) {
            $sheet->setCellValue('A' . $r, $c->id);
            $sheet->setCellValue('B' . $r, $c->title);
            $sheet->setCellValue('C' . $r, $c->order);
            $r++;
        }

        for ($i = 1; $i <= 3; $i++) {
            $sheet->getColumnDimensionByColumn($i)->setAutoSize(true);
        }
    }

    private function buildLabelsSheet($sheet, Board $board): void
    {
        $sheet->setCellValue('A1', 'Tên Nhãn');
        $sheet->setCellValue('B1', 'Mã màu');

        $sheet->getStyle('A1:B1')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle('A1:B1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('D97706'); // Amber

        $labels = Label::where('board_id', $board->id)->get();
        $r = 2;
        foreach ($labels as $lbl) {
            $sheet->setCellValue('A' . $r, $lbl->name);
            $sheet->setCellValue('B' . $r, $lbl->color);
            $r++;
        }

        $sheet->getColumnDimension('A')->setAutoSize(true);
        $sheet->getColumnDimension('B')->setAutoSize(true);
    }

    private function buildExamplesSheet($sheet, Board $board): void
    {
        $headers = self::COLUMNS;
        $colIdx = 1;

        foreach ($headers as $h) {
            $sheet->setCellValue([$colIdx, 1], $h);
            $colIdx++;
        }

        $lastCol = Coordinate::stringFromColumnIndex(count($headers));
        $sheet->getStyle("A1:{$lastCol}1")->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle("A1:{$lastCol}1")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('475569');

        $firstCol = KanbanColumn::where('board_id', $board->id)->whereNull('archived_at')->first()?->title ?? 'Cần làm';
        $sampleUser = $board->owner?->username ?? 'admin';

        $samples = [
            [
                'external_key' => 'TASK-001',
                'parent_external_key' => '',
                'title' => 'Thiết kế giao diện Dashboard và Trang thống kê',
                'description' => 'Hoàn thiện bản vẽ Figma đầy đủ component và Dark mode.',
                'column' => $firstCol,
                'priority' => 'Cao',
                'complexity' => 'L',
                'estimated_points' => '5',
                'progress_percent' => '50',
                'start_date' => '2026-10-20 08:00',
                'due_date' => '2026-10-25 17:00',
                'assignee_usernames' => $sampleUser,
                'contribution_percentages' => '100',
                'labels' => 'UI;Design',
                'sprint' => '',
                'completed' => '0',
                'notes' => 'Task cha chính',
            ],
            [
                'external_key' => 'TASK-002',
                'parent_external_key' => 'TASK-001',
                'title' => 'Vẽ wireframe khung màn hình KPI',
                'description' => 'Task con trực thuộc TASK-001',
                'column' => $firstCol,
                'priority' => 'Bình thường',
                'complexity' => 'S',
                'estimated_points' => '2',
                'progress_percent' => '100',
                'start_date' => '2026-10-20 08:00',
                'due_date' => '2026-10-21 17:00',
                'assignee_usernames' => $sampleUser,
                'contribution_percentages' => '100',
                'labels' => 'UI',
                'sprint' => '',
                'completed' => '1',
                'notes' => 'Subtask 1 của TASK-001',
            ],
            [
                'external_key' => 'TASK-003',
                'parent_external_key' => 'TASK-001',
                'title' => 'Hoàn thiện phối màu và responsive mobile',
                'description' => 'Task con thứ 2 trực thuộc TASK-001',
                'column' => $firstCol,
                'priority' => 'Cao',
                'complexity' => 'M',
                'estimated_points' => '3',
                'progress_percent' => '20',
                'start_date' => '2026-10-22 08:00',
                'due_date' => '2026-10-25 17:00',
                'assignee_usernames' => $sampleUser,
                'contribution_percentages' => '100',
                'labels' => 'Design',
                'sprint' => '',
                'completed' => '0',
                'notes' => 'Subtask 2 của TASK-001',
            ],
            [
                'external_key' => 'TASK-004',
                'parent_external_key' => '',
                'title' => 'Tối ưu hóa truy vấn cơ sở dữ liệu cho kỳ đánh giá',
                'description' => 'Đánh chỉ mục và tối ưu aggregate queries.',
                'column' => $firstCol,
                'priority' => 'Khẩn cấp',
                'complexity' => 'XL',
                'estimated_points' => '8',
                'progress_percent' => '0',
                'start_date' => '2026-10-26 09:00',
                'due_date' => '2026-10-28 18:00',
                'assignee_usernames' => $sampleUser,
                'contribution_percentages' => '100',
                'labels' => 'Backend;Performance',
                'sprint' => '',
                'completed' => '0',
                'notes' => 'Task độc lập',
            ],
        ];

        $r = 2;
        foreach ($samples as $sample) {
            $colIdx = 1;
            foreach (self::COLUMNS as $colName) {
                $sheet->setCellValue([$colIdx, $r], $sample[$colName] ?? '');
                $colIdx++;
            }
            $r++;
        }

        for ($i = 1; $i <= count($headers); $i++) {
            $sheet->getColumnDimensionByColumn($i)->setAutoSize(true);
        }
    }
}
