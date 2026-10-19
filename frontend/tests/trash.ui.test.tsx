import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TrashView } from '../src/pages/TrashView';
import * as trashApi from '../src/lib/api/trash';

vi.mock('../src/lib/api/trash', () => ({
  getTrashItems: vi.fn(),
  restoreTrashItem: vi.fn(),
  forceDeleteTrashItem: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockTrashData: trashApi.TrashResponse = {
  data: [
    {
      id: 101,
      type: 'task',
      title: 'Thiết kế Logo DANAVA',
      deleted_at: '2026-10-18T10:00:00Z',
      deleted_by: {
        id: 1,
        name: 'Nguyễn Nam Hùng',
        username: 'namhung',
      },
      board_id: 1,
      board_name: 'DANAVA Dev Board',
      board_code: 'DANAVA-DEV',
      is_column_deleted: false,
      column_id: 10,
      column_title: 'Đang làm',
      parent_id: null,
      parent_title: null,
      is_subtask: false,
      extra: { priority: 'high' },
    },
    {
      id: 102,
      type: 'task',
      title: 'Tối ưu hiệu năng Database',
      deleted_at: '2026-10-17T08:30:00Z',
      deleted_by: {
        id: 2,
        name: 'Trần Văn Quản Trị',
        username: 'admin2',
      },
      board_id: 1,
      board_name: 'DANAVA Dev Board',
      board_code: 'DANAVA-DEV',
      is_column_deleted: true, // column was deleted!
      column_id: 99,
      column_title: 'Cột Cũ Đã Xóa',
      parent_id: null,
      parent_title: null,
      is_subtask: false,
      extra: { priority: 'medium' },
    },
    {
      id: 50,
      type: 'column',
      title: 'Cột Thử Nghiệm',
      deleted_at: '2026-10-16T15:00:00Z',
      deleted_by: {
        id: 1,
        name: 'Nguyễn Nam Hùng',
        username: 'namhung',
      },
      board_id: 1,
      board_name: 'DANAVA Dev Board',
      board_code: 'DANAVA-DEV',
      is_column_deleted: false,
      column_id: 50,
      column_title: 'Cột Thử Nghiệm',
      parent_id: null,
      parent_title: null,
      is_subtask: false,
    },
    {
      id: 201,
      type: 'attachment',
      title: 'spec_document.pdf',
      deleted_at: '2026-10-15T12:00:00Z',
      deleted_by: {
        id: 1,
        name: 'Nguyễn Nam Hùng',
        username: 'namhung',
      },
      board_id: 1,
      board_name: 'DANAVA Dev Board',
      board_code: 'DANAVA-DEV',
      is_column_deleted: false,
      column_id: 10,
      column_title: 'Đang làm',
      parent_id: 101,
      parent_title: 'Thiết kế Logo DANAVA',
      is_subtask: false,
    },
  ],
  counts: {
    all: 4,
    board: 0,
    column: 1,
    task: 2,
    attachment: 1,
  },
  available_columns: [
    { id: 10, title: 'Đang làm' },
    { id: 11, title: 'Đã hoàn thành' },
  ],
};

function renderWithRouter(initialEntry = '/DANAVA-DEV/trash') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:boardCode/trash" element={<TrashView />} />
        <Route path="/trash" element={<TrashView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TrashView Component UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trash header, counts, and items with metadata', async () => {
    (trashApi.getTrashItems as any).mockResolvedValue(mockTrashData);

    renderWithRouter();

    // Check loading indicator appears or items resolve
    await waitFor(() => {
      expect(screen.getByText('Thùng rác của Bảng')).toBeTruthy();
    });

    expect(screen.getByText(/30 ngày/i)).toBeTruthy();
    expect(screen.getByText('Thiết kế Logo DANAVA')).toBeTruthy();
    expect(screen.getByText('Tối ưu hiệu năng Database')).toBeTruthy();
    expect(screen.getByText('Cột Thử Nghiệm')).toBeTruthy();
    expect(screen.getByText('spec_document.pdf')).toBeTruthy();

    // Deleted by
    expect(screen.getAllByText('Nguyễn Nam Hùng').length).toBeGreaterThan(0);
  });

  it('displays empty state when trash is empty', async () => {
    (trashApi.getTrashItems as any).mockResolvedValue({
      data: [],
      counts: { all: 0, board: 0, column: 0, task: 0, attachment: 0 },
      available_columns: [],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Thùng rác trống')).toBeTruthy();
    });
  });

  it('displays error state when unauthorized (403)', async () => {
    (trashApi.getTrashItems as any).mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Chỉ Chủ sở hữu hoặc Quản trị viên mới có quyền xem thùng rác.' },
      },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Không thể truy cập thùng rác')).toBeTruthy();
      expect(screen.getByText('Chỉ Chủ sở hữu hoặc Quản trị viên mới có quyền xem thùng rác.')).toBeTruthy();
    });
  });

  it('restores task directly when original column is active', async () => {
    const user = userEvent.setup();
    (trashApi.getTrashItems as any).mockResolvedValue(mockTrashData);
    (trashApi.restoreTrashItem as any).mockResolvedValue({
      success: true,
      message: "Đã khôi phục công việc 'Thiết kế Logo DANAVA' thành công.",
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Thiết kế Logo DANAVA')).toBeTruthy();
    });

    // Find all restore buttons
    const restoreButtons = screen.getAllByRole('button', { name: /Khôi phục/i });
    expect(restoreButtons.length).toBeGreaterThan(0);

    // Click restore on first item (Thiết kế Logo DANAVA - column still active)
    await user.click(restoreButtons[0]);

    await waitFor(() => {
      expect(trashApi.restoreTrashItem).toHaveBeenCalledWith('task', 101, undefined);
    });
  });

  it('opens target column picker modal when restoring task whose column was deleted', async () => {
    const user = userEvent.setup();
    (trashApi.getTrashItems as any).mockResolvedValue(mockTrashData);
    (trashApi.restoreTrashItem as any).mockResolvedValue({
      success: true,
      message: 'Khôi phục thành công',
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hiệu năng Database')).toBeTruthy();
    });

    // Item 102 has is_column_deleted: true
    // Find restore button for item 102 (second restore button)
    const restoreButtons = screen.getAllByRole('button', { name: /Khôi phục/i });
    await user.click(restoreButtons[1]);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Chọn cột để khôi phục công việc')).toBeTruthy();
      expect(screen.getByText('Cột ban đầu đã bị xóa hoặc không còn tồn tại')).toBeTruthy();
    });

    // Choose target column and confirm
    const confirmBtn = screen.getByRole('button', { name: /Khôi phục vào cột này/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(trashApi.restoreTrashItem).toHaveBeenCalledWith('task', 102, 10);
    });
  });

  it('requires two-step confirmation with exact object name for force delete', async () => {
    const user = userEvent.setup();
    (trashApi.getTrashItems as any).mockResolvedValue(mockTrashData);
    (trashApi.forceDeleteTrashItem as any).mockResolvedValue({
      success: true,
      message: "Đã xóa vĩnh viễn 'Thiết kế Logo DANAVA' thành công.",
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Thiết kế Logo DANAVA')).toBeTruthy();
    });

    // Click force delete on first item
    const deleteButtons = screen.getAllByRole('button', { name: /Xóa vĩnh viễn/i });
    await user.click(deleteButtons[0]);

    // 2-Step Modal opens
    await waitFor(() => {
      expect(screen.getByText('Xác nhận xóa vĩnh viễn')).toBeTruthy();
      expect(screen.getByText(/Bước xác thực bảo mật 2 bước/i)).toBeTruthy();
    });

    const submitBtn = screen.getByRole('button', { name: /Tôi hiểu rủi ro, Xóa vĩnh viễn/i });
    // Button must be disabled until exact name is typed
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    const input = screen.getByPlaceholderText('Thiết kế Logo DANAVA');
    
    // Type partial/wrong name
    await user.type(input, 'Sai ten roi');
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    // Clear and type exact name
    await user.clear(input);
    await user.type(input, 'Thiết kế Logo DANAVA');

    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    await user.click(submitBtn);

    await waitFor(() => {
      expect(trashApi.forceDeleteTrashItem).toHaveBeenCalledWith('task', 101, 'Thiết kế Logo DANAVA');
    });
  });
});
