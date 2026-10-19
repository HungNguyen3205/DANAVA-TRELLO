import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TaskExcelImportModal } from '../src/components/kanban/TaskExcelImportModal';
import * as excelApi from '../src/lib/api/taskExcelImport';

vi.mock('../src/lib/api/taskExcelImport', () => ({
  downloadImportTemplate: vi.fn(),
  previewTaskImport: vi.fn(),
  confirmTaskImport: vi.fn(),
  downloadImportErrors: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('TaskExcelImportModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 with template download and upload dropzone', () => {
    render(
      <TaskExcelImportModal
        isOpen={true}
        onClose={vi.fn()}
        boardId="1"
        boardCode="DANAVA-TEST"
      />
    );

    expect(screen.getByText('Nhập Công Việc Từ Excel')).toBeTruthy();
    expect(screen.getByText('Tải file mẫu Excel')).toBeTruthy();
    expect(screen.getByText(/Nhấp để chọn tệp hoặc kéo thả tệp .xlsx vào đây/i)).toBeTruthy();
    expect(screen.getByText(/Không thêm người ngoài/i)).toBeTruthy();
    expect(screen.getByText(/Nguyên tắc nguyên tử/i)).toBeTruthy();
  });

  it('triggers template download when button is clicked', async () => {
    const user = userEvent.setup();
    (excelApi.downloadImportTemplate as any).mockResolvedValue(undefined);

    render(
      <TaskExcelImportModal
        isOpen={true}
        onClose={vi.fn()}
        boardId="1"
        boardCode="DANAVA-TEST"
      />
    );

    const downloadBtn = screen.getByRole('button', { name: /Tải file mẫu Excel/i });
    await user.click(downloadBtn);

    expect(excelApi.downloadImportTemplate).toHaveBeenCalledWith('DANAVA-TEST');
  });

  it('displays validation preview (Step 2) with invalid rows and disables confirm button', async () => {
    const user = userEvent.setup();

    (excelApi.previewTaskImport as any).mockResolvedValue({
      board_id: 1,
      preview_token: 'test-token-123',
      is_valid: false,
      total_rows: 2,
      valid_rows_count: 1,
      invalid_rows_count: 1,
      created_at: '2026-10-19T00:00:00Z',
      rows: [
        {
          row_index: 2,
          is_valid: true,
          errors: [],
          data: {
            external_key: 'TASK-001',
            parent_external_key: '',
            is_subtask: false,
            title: 'Hợp lệ task',
            description: '',
            priority: 'Cao',
            complexity: 'L',
            column_title: 'Cần làm',
            assignees: [{ id: 1, username: 'admin', contribution_percent: 100 }],
            labels: [],
            completed: false,
          },
        },
        {
          row_index: 3,
          is_valid: false,
          errors: ["Thành viên '@outsider' không thuộc Board này."],
          data: {
            external_key: 'TASK-002',
            parent_external_key: '',
            is_subtask: false,
            title: 'Lỗi gán người ngoài',
            description: '',
            priority: 'Bình thường',
            complexity: 'M',
            column_title: 'Cần làm',
            assignees: [],
            labels: [],
            completed: false,
          },
        },
      ],
    });

    render(
      <TaskExcelImportModal
        isOpen={true}
        onClose={vi.fn()}
        boardId="1"
        boardCode="DANAVA-TEST"
      />
    );

    // Mock selecting a valid xlsx file
    const file = new File(['mock content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const previewBtn = screen.getByRole('button', { name: /Kiểm tra dữ liệu/i });
    await user.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText('Phát hiện 1 dòng dữ liệu không hợp lệ')).toBeTruthy();
      expect(screen.getByText("Thành viên '@outsider' không thuộc Board này.")).toBeTruthy();
      expect(screen.getByText('Tải file báo cáo lỗi (.xlsx)')).toBeTruthy();
    });

    // Confirm button should be disabled because is_valid is false
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận Import/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows confirming import when all rows are valid', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();

    (excelApi.previewTaskImport as any).mockResolvedValue({
      board_id: 1,
      preview_token: 'valid-token-456',
      is_valid: true,
      total_rows: 1,
      valid_rows_count: 1,
      invalid_rows_count: 0,
      created_at: '2026-10-19T00:00:00Z',
      rows: [
        {
          row_index: 2,
          is_valid: true,
          errors: [],
          data: {
            external_key: 'TASK-001',
            parent_external_key: '',
            is_subtask: false,
            title: 'Công việc hoàn hảo',
            description: 'Mô tả',
            priority: 'Cao',
            complexity: 'M',
            column_title: 'Cần làm',
            assignees: [{ id: 1, username: 'admin', contribution_percent: 100 }],
            labels: ['UI'],
            completed: false,
          },
        },
      ],
    });

    (excelApi.confirmTaskImport as any).mockResolvedValue({
      success: true,
      imported_count: 1,
      message: 'Đã import thành công 1 công việc vào Board.',
    });

    render(
      <TaskExcelImportModal
        isOpen={true}
        onClose={vi.fn()}
        boardId="1"
        boardCode="DANAVA-TEST"
        onImportSuccess={mockOnSuccess}
      />
    );

    const file = new File(['mock content'], 'valid.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const previewBtn = screen.getByRole('button', { name: /Kiểm tra dữ liệu/i });
    await user.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText('Tất cả các dòng đều hợp lệ!')).toBeTruthy();
    });

    const confirmBtn = screen.getByRole('button', { name: /Xác nhận Import \(1 công việc\)/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);

    await user.click(confirmBtn);

    expect(excelApi.confirmTaskImport).toHaveBeenCalledWith('DANAVA-TEST', 'valid-token-456');
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
