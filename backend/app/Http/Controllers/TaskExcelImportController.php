<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Services\TaskExcelImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TaskExcelImportController extends Controller
{
    public function __construct(
        protected TaskExcelImportService $importService
    ) {}

    protected function resolveBoard(Board|string|int $board): Board
    {
        if ($board instanceof Board) {
            return $board;
        }

        if (is_numeric($board)) {
            $found = Board::where('id', $board)->first();
            if ($found) {
                return $found;
            }
        }

        $found = Board::where('public_id', $board)->first();

        if (!$found) {
            abort(404, 'Không tìm thấy bảng làm việc.');
        }

        return $found;
    }

    /**
     * Download the official DANAVA task import template for this board.
     * Accessible by Board Members, Board Admins, and Board Owner.
     */
    public function downloadTemplate(Request $request, Board|string|int $board): BinaryFileResponse
    {
        $board = $this->resolveBoard($board);
        $user = $request->user();

        // System Admin or outsider cannot access if not a board member
        if (!$user->isBoardMember($board->id)) {
            abort(403, 'Bạn không có quyền truy cập bảng làm việc này.');
        }

        $filePath = $this->importService->generateTemplate($board);

        return response()->download(
            $filePath,
            'DANAVA_WORK_TASK_IMPORT_TEMPLATE.xlsx',
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]
        )->deleteFileAfterSend(true);
    }

    /**
     * Upload .xlsx file and generate validation preview.
     * Strictly restricted to Board Owner and Board Admin.
     */
    public function preview(Request $request, Board|string|int $board): JsonResponse
    {
        $board = $this->resolveBoard($board);
        $user = $request->user();

        // Check Board Owner or Board Admin permission (System admin without board role is denied)
        if (!$user->isBoardAdmin($board->id)) {
            abort(403, 'Chỉ Chủ bảng (Owner) hoặc Quản trị viên (Admin) của Board mới có quyền import công việc.');
        }

        $request->validate([
            'file' => ['required', 'file', 'max:10240'], // 10MB max
        ], [
            'file.required' => 'Vui lòng chọn tệp Excel để tải lên.',
            'file.max' => 'Dung lượng tệp tối đa không được vượt quá 10MB.',
        ]);

        $previewData = $this->importService->validateAndPreview($board, $request->file('file'));

        return response()->json($previewData);
    }

    /**
     * Confirm import and persist data to database in a single atomic transaction.
     * Strictly restricted to Board Owner and Board Admin.
     */
    public function confirm(Request $request, Board|string|int $board): JsonResponse
    {
        $board = $this->resolveBoard($board);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            abort(403, 'Chỉ Chủ bảng (Owner) hoặc Quản trị viên (Admin) của Board mới có quyền import công việc.');
        }

        $request->validate([
            'preview_token' => ['required', 'string'],
        ], [
            'preview_token.required' => 'Mã xác nhận phiên import không hợp lệ.',
        ]);

        $result = $this->importService->confirmImport($board, $request->input('preview_token'), $user);

        return response()->json($result);
    }

    /**
     * Download Excel file containing error details for invalid rows.
     */
    public function downloadErrors(Request $request, Board|string|int $board, string $token): BinaryFileResponse
    {
        $board = $this->resolveBoard($board);
        $user = $request->user();

        if (!$user->isBoardAdmin($board->id)) {
            abort(403, 'Bạn không có quyền tải tệp báo cáo lỗi của bảng này.');
        }

        $filePath = $this->importService->generateErrorSpreadsheet($board, $token);
        $boardCode = $board->public_id ?? (string)$board->id;

        return response()->download(
            $filePath,
            "DANAVA_IMPORT_ERRORS_{$boardCode}_{$token}.xlsx",
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]
        )->deleteFileAfterSend(true);
    }
}
