import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BoardColumn } from '../src/components/kanban/BoardColumn';
import type { Board, Column, Task } from '../src/types';
import * as apiModule from '../src/lib/axios';

vi.mock('../src/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockBoard: Board = {
  id: '1',
  title: 'Test WIP Board',
  is_owner: true,
  my_role: 'owner',
  columns: [],
  tasks: [],
  users: [
    { id: '1', name: 'Board Owner', role: 'owner' },
  ],
  activity: [],
};

const mockStrictColumn: Column = {
  id: '10',
  title: 'Đang thực hiện',
  color: 'blue',
  wip_limit: 2,
  wip_enforcement: 'strict',
  wip_count: 2,
};

const mockWarningColumn: Column = {
  id: '20',
  title: 'Đang kiểm thử',
  color: 'orange',
  wip_limit: 2,
  wip_enforcement: 'warning',
  wip_count: 2,
};

const mockTasksWithSubtask: Task[] = [
  {
    id: '101',
    columnId: '10',
    title: 'Công việc cha 1',
    description: '',
    priority: 'Cao',
    labels: [],
    assigneeId: '',
    collaborators: [],
    dueDate: '',
    checklists: [],
    comments: [],
    attachments: [],
  },
  {
    id: '102',
    columnId: '10',
    title: 'Công việc cha 2',
    description: '',
    priority: 'Bình thường',
    labels: [],
    assigneeId: '',
    collaborators: [],
    dueDate: '',
    checklists: [],
    comments: [],
    attachments: [],
  },
  // Subtask: parentTaskId is NOT null, must NOT be counted!
  {
    id: '103',
    parentTaskId: '101',
    columnId: '10',
    title: 'Task con 1 (Không tính vào WIP)',
    description: '',
    priority: 'Thấp',
    labels: [],
    assigneeId: '',
    collaborators: [],
    dueDate: '',
    checklists: [],
    comments: [],
    attachments: [],
  },
];

describe('WIP Limit UI Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders WIP limit badge in 2/2 format and ignores subtasks', () => {
    render(
      <BoardColumn
        column={mockStrictColumn}
        tasks={mockTasksWithSubtask}
        board={mockBoard}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        disabled={false}
      />
    );

    // 2 parent tasks + 1 subtask = 3 tasks total, but WIP badge must be 2/2 (ignoring subtask)
    expect(screen.getByText('2/2')).toBeTruthy();
    expect(screen.getByText('Đang thực hiện')).toBeTruthy();
  });

  it('shows tooltip explaining WIP limit, current count, and enforcement mode', () => {
    render(
      <BoardColumn
        column={mockStrictColumn}
        tasks={mockTasksWithSubtask}
        board={mockBoard}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        disabled={false}
      />
    );

    const badge = screen.getByText('2/2');
    expect(badge.getAttribute('title')).toContain('Giới hạn WIP: 2/2 công việc');
    expect(badge.getAttribute('title')).toContain('Chế độ Nghiêm ngặt');
    expect(badge.getAttribute('title')).toContain('Không tính task con');
  });

  it('blocks adding new task in strict mode when limit is reached', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    render(
      <BoardColumn
        column={mockStrictColumn}
        tasks={mockTasksWithSubtask}
        board={mockBoard}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        disabled={false}
      />
    );

    // Click "Thêm công việc" button
    const addBtn = screen.getByRole('button', { name: /Thêm công việc/i });
    await user.click(addBtn);

    // Type new task title
    const textarea = screen.getByPlaceholderText(/Nhập tiêu đề cho thẻ này.../i);
    await user.type(textarea, 'Thẻ mới vượt limit');

    // Click "Thêm thẻ"
    const submitBtn = screen.getByRole('button', { name: /Thêm thẻ/i });
    await user.click(submitBtn);

    // Strict mode must block and show toast error without calling backend
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Chế độ Nghiêm ngặt không cho phép thêm thẻ mới')
    );
    expect(apiModule.default.post).not.toHaveBeenCalled();
  });

  it('displays WipConfirmModal in warning mode and proceeds upon confirmation', async () => {
    const user = userEvent.setup();
    (apiModule.default.post as any).mockResolvedValue({ data: { id: 999, title: 'Task Vượt Limit' } });

    render(
      <BoardColumn
        column={mockWarningColumn}
        tasks={mockTasksWithSubtask}
        board={mockBoard}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        disabled={false}
      />
    );

    // Click "Thêm công việc" button
    const addBtn = screen.getByRole('button', { name: /Thêm công việc/i });
    await user.click(addBtn);

    // Type task title
    const textarea = screen.getByPlaceholderText(/Nhập tiêu đề cho thẻ này.../i);
    await user.type(textarea, 'Thẻ mới vượt warning');

    // Click "Thêm thẻ"
    const submitBtn = screen.getByRole('button', { name: /Thêm thẻ/i });
    await user.click(submitBtn);

    // WipConfirmModal must appear
    await waitFor(() => {
      expect(screen.getByText('Cảnh báo giới hạn WIP')).toBeTruthy();
      expect(screen.getByText(/Chế độ Cảnh báo \(Warning\)/i)).toBeTruthy();
    });

    // Confirm addition
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận tiếp tục/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(apiModule.default.post).toHaveBeenCalledWith(
        '/columns/20/tasks',
        { title: 'Thẻ mới vượt warning' }
      );
    });
  });

  it('allows Owner/Admin to open WipLimitModal to configure limit and enforcement', async () => {
    const user = userEvent.setup();

    render(
      <BoardColumn
        column={mockStrictColumn}
        tasks={mockTasksWithSubtask}
        board={mockBoard}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        disabled={false}
      />
    );

    // Click column options menu button (Three dots)
    const menuBtn = screen.getByRole('button', { name: /Tùy chọn cột: Đang thực hiện/i });
    await user.click(menuBtn);

    // Click "Cấu hình WIP Limit"
    const configBtn = screen.getByText('Cấu hình WIP Limit');
    await user.click(configBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Cấu hình WIP Limit')).toBeTruthy();
      expect(screen.getByText(/Bật giới hạn WIP cho cột này/i)).toBeTruthy();
      expect(screen.getByText(/Chế độ thực thi:/i)).toBeTruthy();
    });
  });
});
