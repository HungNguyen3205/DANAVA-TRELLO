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
     * Generate Excel template with 1 single sheet populated with board-specific metadata and samples.
     */
    public function generateTemplate(Board $board): string
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('TASKS');

        $this->buildSingleTasksSheet($sheet, $board);

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

        $tasksSheet = $spreadsheet->getSheetByName('TASKS') ?? $spreadsheet->getSheet(0);
        if (!$tasksSheet) {
            @unlink($filePath);
            abort(422, 'Không tìm thấy dữ liệu trang tính trong tệp Excel.');
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

        $aliasMap = [
            'title' => 'title',
            'tieu_de' => 'title',
            'tiêu_đề' => 'title',
            'ten_cong_viec' => 'title',
            'tên_công_việc' => 'title',
            'tên_task' => 'title',
            'ten_task' => 'title',
            'task_name' => 'title',
            'name' => 'title',
            'external_key' => 'external_key',
            'ma_cong_viec' => 'external_key',
            'mã_công_việc' => 'external_key',
            'ma_task' => 'external_key',
            'mã_task' => 'external_key',
            'key' => 'external_key',
            'parent_external_key' => 'parent_external_key',
            'parent_key' => 'parent_external_key',
            'ma_task_cha' => 'parent_external_key',
            'mã_task_cha' => 'parent_external_key',
            'task_cha' => 'parent_external_key',
            'parent' => 'parent_external_key',
            'description' => 'description',
            'mo_ta' => 'description',
            'mô_tả' => 'description',
            'desc' => 'description',
            'column' => 'column',
            'cot' => 'column',
            'cột' => 'column',
            'cot_kanban' => 'column',
            'cột_kanban' => 'column',
            'trang_thai' => 'column',
            'trạng_thái' => 'column',
            'status' => 'column',
            'priority' => 'priority',
            'do_uu_tien' => 'priority',
            'độ_ưu_tiên' => 'priority',
            'muc_do_uu_tien' => 'priority',
            'mức_độ_ưu_tiên' => 'priority',
            'uu_tien' => 'priority',
            'ưu_tiên' => 'priority',
            'complexity' => 'complexity',
            'do_phuc_tap' => 'complexity',
            'độ_phức_tạp' => 'complexity',
            'estimated_points' => 'estimated_points',
            'diem_uoc_luong' => 'estimated_points',
            'điểm_ước_lượng' => 'estimated_points',
            'diem' => 'estimated_points',
            'điểm' => 'estimated_points',
            'points' => 'estimated_points',
            'progress_percent' => 'progress_percent',
            'tien_do' => 'progress_percent',
            'tiến_độ' => 'progress_percent',
            'tien_do_%' => 'progress_percent',
            'tiến_độ_%' => 'progress_percent',
            'progress' => 'progress_percent',
            'start_date' => 'start_date',
            'ngay_bat_dau' => 'start_date',
            'ngày_bắt_đầu' => 'start_date',
            'start' => 'start_date',
            'due_date' => 'due_date',
            'ngay_han_chot' => 'due_date',
            'ngày_hạn_chót' => 'due_date',
            'han_chot' => 'due_date',
            'hạn_chót' => 'due_date',
            'deadline' => 'due_date',
            'assignee_usernames' => 'assignee_usernames',
            'nguoi_thuc_hien' => 'assignee_usernames',
            'người_thực_hiện' => 'assignee_usernames',
            'nguoi_phu_trach' => 'assignee_usernames',
            'người_phụ_trách' => 'assignee_usernames',
            'thanh_vien' => 'assignee_usernames',
            'thành_viên' => 'assignee_usernames',
            'assignees' => 'assignee_usernames',
            'assignee' => 'assignee_usernames',
            'contribution_percentages' => 'contribution_percentages',
            'ty_le_dong_gop' => 'contribution_percentages',
            'tỷ_lệ_đóng_góp' => 'contribution_percentages',
            'ty_le_%' => 'contribution_percentages',
            'tỷ_lệ_%' => 'contribution_percentages',
            'contribution' => 'contribution_percentages',
            'labels' => 'labels',
            'nhan' => 'labels',
            'nhãn' => 'labels',
            'tags' => 'labels',
            'tag' => 'labels',
            'sprint' => 'sprint',
            'chu_ky' => 'sprint',
            'chu_kỳ' => 'sprint',
            'completed' => 'completed',
            'hoan_thanh' => 'completed',
            'hoàn_thành' => 'completed',
            'done' => 'completed',
            'notes' => 'notes',
            'ghi_chu' => 'notes',
            'ghi_chú' => 'notes',
            'note' => 'notes',
        ];

        $headerMap = [];
        for ($col = 1; $col <= $highestColumnIndex; $col++) {
            $val = trim((string)$tasksSheet->getCell([$col, 1])->getValue());
            if ($val !== '') {
                $cleanCol = mb_strtolower(str_replace([' ', '-'], '_', $val));
                $canonicalCol = $aliasMap[$cleanCol] ?? $cleanCol;
                if (!isset($headerMap[$canonicalCol])) {
                    $headerMap[$canonicalCol] = $col;
                }
            }
        }

        if (!isset($headerMap['title'])) {
            @unlink($filePath);
            abort(422, "Tệp Excel thiếu cột bắt buộc: 'title' (hoặc Tiêu đề công việc).");
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

            // Auto-generate external_key if not provided
            if (empty($rowData['external_key'])) {
                do {
                    $genKey = 'TASK-' . Str::upper(Str::random(6));
                    $genLower = mb_strtolower($genKey);
                } while (isset($encounteredFileKeys[$genLower]) || isset($existingExternalKeysInBoard[$genLower]));
                $rowData['external_key'] = $genKey;
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
            abort(422, 'Tệp Excel không có dữ liệu công việc nào.');
        }

        // 6. Validate Each Row & Hierarchy
        $previewRows = [];
        $validRowsCount = 0;
        $invalidRowsCount = 0;

        foreach ($parsedRows as &$r) {
            $errors = [];
            $rowNum = $r['_row_index'];
            $extKeyRaw = $r['external_key'];
            $extKeyLower = mb_strtolower(trim($extKeyRaw));
            $parentKeyRaw = $r['parent_external_key'];
            $parentKeyLower = mb_strtolower(trim($parentKeyRaw));

            // Validate external_key
            if (isset($encounteredFileKeys[$extKeyLower])) {
                $errors[] = "Mã external_key '{$extKeyRaw}' bị trùng lặp trong file (dòng {$encounteredFileKeys[$extKeyLower]} và {$rowNum}).";
            } else {
                $encounteredFileKeys[$extKeyLower] = $rowNum;
            }

            if (isset($existingExternalKeysInBoard[$extKeyLower])) {
                $errors[] = "Mã external_key '{$extKeyRaw}' đã tồn tại trong Board này từ trước.";
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

    private function buildSingleTasksSheet($sheet, Board $board): void
    {
        // 1. Headers
        $headers = self::COLUMNS;
        $colIdx = 1;
        foreach ($headers as $h) {
            $sheet->setCellValue([$colIdx, 1], $h);
            $colIdx++;
        }

        $lastCol = Coordinate::stringFromColumnIndex(count($headers));

        // Header Styling
        $sheet->getStyle("A1:{$lastCol}1")->getFont()->setBold(true)->setSize(11)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle("A1:{$lastCol}1")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('1E293B');
        $sheet->getStyle("A1:{$lastCol}1")->getAlignment()->setVertical(Alignment::VERTICAL_CENTER)->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension(1)->setRowHeight(32);

        // Freeze pane at row 2 so headers remain visible when scrolling
        $sheet->freezePane('A2');

        // Preload Board Metadata
        $boardColumns = KanbanColumn::where('board_id', $board->id)
            ->whereNull('archived_at')
            ->orderBy('order')
            ->get();
        $colTitles = $boardColumns->pluck('title')->toArray();
        $firstCol = $colTitles[0] ?? 'Cần làm';

        $memberUsernames = [];
        if ($board->owner) {
            $memberUsernames[] = $board->owner->username . ' (Chủ bảng)';
        }
        foreach ($board->members as $m) {
            if ($board->owner && $m->id === $board->owner->id) continue;
            $memberUsernames[] = $m->username;
        }
        $sampleUser = $board->owner?->username ?? ($board->members->first()?->username ?? 'admin');

        // 2. Add Informative Tooltip Comments on Header Cells
        $comments = [
            'A1' => "MÃ CÔNG VIỆC (external_key)\nMã định danh duy nhất (VD: TASK-001, FE-10).\nCó thể để trống hệ thống sẽ tự sinh mã.",
            'B1' => "TASK CHA (parent_external_key)\nNếu là task con, điền external_key của task cha (VD: TASK-001).\nĐể trống nếu là công việc chính.",
            'C1' => "TIÊU ĐỀ (title)\nTiêu đề công việc (BẮT BUỘC). Tối đa 255 ký tự.",
            'D1' => "MÔ TẢ (description)\nMô tả chi tiết nội dung công việc (tuỳ chọn).",
            'E1' => "CỘT KANBAN (column)\nCác cột hiện có trong bảng:\n" . (empty($colTitles) ? "- Cần làm" : "- " . implode("\n- ", $colTitles)) . "\n(Để trống sẽ tự động vào cột đầu tiên).",
            'F1' => "MỨC ƯU TIÊN (priority)\nCác mức: Thấp, Bình thường, Cao, Khẩn cấp.\n(Mặc định: Bình thường).",
            'G1' => "ĐỘ PHỨC TẠP (complexity)\nCác mức: XS (1đ), S (2đ), M (3đ), L (5đ), XL (8đ).\n(Mặc định: M).",
            'H1' => "ĐIỂM ƯỚC LƯỢNG (estimated_points)\nStory point / Điểm đánh giá (số >= 0).",
            'I1' => "TIẾN ĐỘ % (progress_percent)\nTiến độ hoàn thành từ 0 đến 100.",
            'J1' => "NGÀY BẮT ĐẦU (start_date)\nĐịnh dạng: YYYY-MM-DD (VD: 2026-10-25 hoặc 2026-10-25 08:30).",
            'K1' => "HẠN CHÓT (due_date)\nĐịnh dạng: YYYY-MM-DD (VD: 2026-10-30 hoặc 2026-10-30 17:30).",
            'L1' => "NGƯỜI PHỤ TRÁCH (assignee_usernames)\nUsername thành viên trong bảng này:\n" . (empty($memberUsernames) ? "- {$sampleUser}" : "- @" . implode("\n- @", $memberUsernames)) . "\nPhân cách nhiều người bằng dấu ; (VD: {$sampleUser}).",
            'M1' => "TỶ LỆ ĐÓNG GÓP % (contribution_percentages)\nTỷ lệ đóng góp tương ứng cho mỗi người (VD: 60;40).\nTổng bằng 100%. Để trống tự chia đều.",
            'N1' => "NHÃN (labels)\nNhãn phân loại (VD: Tính năng;Giao diện;Bug).\nPhân cách bằng dấu ; hoặc ,",
            'O1' => "SPRINT (sprint)\nTên Sprint trong bảng (nếu có).",
            'P1' => "HOÀN THÀNH (completed)\nĐiền 1 nếu đã xong; Điền 0 hoặc để trống nếu chưa xong.",
            'Q1' => "GHI CHÚ (notes)\nGhi chú nội bộ cho công việc.",
        ];

        foreach ($comments as $cellCoord => $commentText) {
            $sheet->getComment($cellCoord)->getText()->createTextRun($commentText);
            $sheet->getComment($cellCoord)->setWidth('320pt');
            $sheet->getComment($cellCoord)->setHeight('110pt');
        }

        // 3. Populate Sample Rows (Rows 2, 3, 4)
        $today = Carbon::now()->format('Y-m-d');
        $in3Days = Carbon::now()->addDays(3)->format('Y-m-d');
        $in7Days = Carbon::now()->addDays(7)->format('Y-m-d');

        $samples = [
            [
                'external_key' => 'TASK-001',
                'parent_external_key' => '',
                'title' => 'Phát triển tính năng và giao diện mới',
                'description' => 'Công việc mẫu chính (Task cha). Hoàn thiện giao diện và API.',
                'column' => $firstCol,
                'priority' => 'Cao',
                'complexity' => 'L',
                'estimated_points' => '5',
                'progress_percent' => '50',
                'start_date' => $today,
                'due_date' => $in7Days,
                'assignee_usernames' => $sampleUser,
                'contribution_percentages' => '100',
                'labels' => 'Tính năng;UI',
                'sprint' => '',
                'completed' => '0',
                'notes' => 'Task cha mẫu',
            ],
            [
                'external_key' => 'TASK-002',
                'parent_external_key' => 'TASK-001',
                'title' => 'Thiết kế bản vẽ mockup chi tiết',
                'description' => 'Công việc con mẫu (trỏ tới TASK-001).',
                'column' => $firstCol,
                'priority' => 'Bình thường',
                'complexity' => 'S',
                'estimated_points' => '2',
                'progress_percent' => '100',
                'start_date' => $today,
                'due_date' => $in3Days,
                'assignee_usernames' => $sampleUser,
                'contribution_percentages' => '100',
                'labels' => 'UI',
                'sprint' => '',
                'completed' => '1',
                'notes' => 'Task con mẫu đã xong',
            ],
            [
                'external_key' => 'TASK-003',
                'parent_external_key' => '',
                'title' => 'Kiểm thử chất lượng và hoàn thiện tài liệu',
                'description' => 'Công việc mẫu độc lập.',
                'column' => $firstCol,
                'priority' => 'Bình thường',
                'complexity' => 'M',
                'estimated_points' => '3',
                'progress_percent' => '0',
                'start_date' => $today,
                'due_date' => $in7Days,
                'assignee_usernames' => $sampleUser,
                'contribution_percentages' => '100',
                'labels' => 'Testing',
                'sprint' => '',
                'completed' => '0',
                'notes' => 'Task độc lập mẫu',
            ],
        ];

        $r = 2;
        foreach ($samples as $sample) {
            $colIdx = 1;
            foreach ($headers as $h) {
                $sheet->setCellValue([$colIdx, $r], $sample[$h] ?? '');
                $colIdx++;
            }
            $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFont()->setSize(10);
            $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('E2E8F0');
            if ($r % 2 === 1) {
                $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F8FAFC');
            }
            $r++;
        }

        // Auto width for all columns
        for ($i = 1; $i <= count($headers); $i++) {
            $sheet->getColumnDimensionByColumn($i)->setAutoSize(true);
        }
    }
}
