import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TaskMemberPicker } from '../src/components/kanban/TaskMemberPicker';
import { TaskContributionModal } from '../src/components/kanban/TaskContributionModal';
import { RemoveAssigneeWarningModal } from '../src/components/kanban/RemoveAssigneeWarningModal';
import type { Board, Task, User } from '../src/types';
import api from '../src/lib/axios';

vi.mock('../src/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn().mockResolvedValue({ data: { message: 'Success' } }),
    post: vi.fn().mockResolvedValue({ data: { message: 'Success' } }),
    delete: vi.fn().mockResolvedValue({ data: { message: 'Success' } }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockBoardUsers: User[] = [
  {
    id: '1',
    name: 'Nguyễn Nam Hùng',
    email: 'hung@danava.vn',
    username: 'namhung',
    role: 'owner',
    department: { id: 1, name: 'Công nghệ', code: 'TECH', status: 'active', created_at: '2026-01-01' },
  },
  {
    id: '2',
    name: 'Trần Danh Đại',
    email: 'dai@danava.vn',
    username: 'danhdai',
    role: 'member',
    department: { id: 1, name: 'Công nghệ', code: 'TECH', status: 'active', created_at: '2026-01-01' },
  },
  {
    id: '3',
    name: 'Trần Văn Nam',
    email: 'nam@danava.vn',
    username: 'vannam',
    role: 'member',
    department: { id: 2, name: 'Thiết kế', code: 'DESIGN', status: 'active', created_at: '2026-01-01' },
  },
];

const mockParentTask: Task = {
  id: '100',
  title: 'Triển khai Progressive Web App',
  columnId: '1',
  description: 'Test parent task',
  priority: 'Cao',
  labels: [],
  assigneeId: '1',
  assignees: [
    { ...mockBoardUsers[0], pivot: { contribution_percent: 50 } },
    { ...mockBoardUsers[1], pivot: { contribution_percent: 50 } },
  ],
  collaborators: [],
  dueDate: '2026-10-30',
  checklists: [],
  comments: [],
  attachments: [],
};

const mockSubtasks: Task[] = [
  {
    id: '101',
    parentTaskId: '100',
    title: 'Thiết kế giao diện PWA',
    columnId: '1',
    description: '',
    priority: 'Bình thường',
    labels: [],
    assigneeId: '1',
    assignees: [mockBoardUsers[0]],
    collaborators: [],
    dueDate: '2026-10-25',
    checklists: [],
    comments: [],
    attachments: [],
  },
  {
    id: '102',
    parentTaskId: '100',
    title: 'Cấu hình Service Worker',
    columnId: '1',
    description: '',
    priority: 'Cao',
    labels: [],
    assigneeId: '1',
    assignees: [mockBoardUsers[0], mockBoardUsers[1]],
    collaborators: [],
    dueDate: '2026-10-28',
    checklists: [],
    comments: [],
    attachments: [],
  },
];

describe('Multi-Assignee UI Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TaskMemberPicker Component', () => {
    it('renders board members and allows multi-selection', async () => {
      const user = userEvent.setup();
      const onApplyMock = vi.fn();
      const onCancelMock = vi.fn();

      render(
        <TaskMemberPicker
          boardUsers={mockBoardUsers}
          initialSelectedUserIds={['1']}
          isParentTask={true}
          onApply={onApplyMock}
          onCancel={onCancelMock}
        />
      );

      // Verify all users are rendered
      expect(screen.getByText('Nguyễn Nam Hùng')).toBeDefined();
      expect(screen.getByText('Trần Danh Đại')).toBeDefined();
      expect(screen.getByText('Trần Văn Nam')).toBeDefined();

      // Check department name rendered
      expect(screen.getAllByText('Công nghệ').length).toBeGreaterThan(0);
      expect(screen.getByText('Thiết kế')).toBeDefined();

      // Click on Trần Danh Đại to toggle select
      await user.click(screen.getByText('Trần Danh Đại'));

      // Check apply button
      const applyBtn = screen.getByRole('button', { name: /Áp dụng/i });
      await user.click(applyBtn);

      expect(onApplyMock).toHaveBeenCalledWith(['1', '2'], false);
    });

    it('filters member list when typing in search box', async () => {
      const user = userEvent.setup();
      render(
        <TaskMemberPicker
          boardUsers={mockBoardUsers}
          initialSelectedUserIds={[]}
          onApply={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Tìm theo tên, email, phòng ban/i);
      await user.type(searchInput, 'Thiết kế');

      // Only Trần Văn Nam belongs to Thiết kế
      expect(screen.getByText('Trần Văn Nam')).toBeDefined();
      expect(screen.queryByText('Nguyễn Nam Hùng')).toBeNull();
      expect(screen.queryByText('Trần Danh Đại')).toBeNull();
    });

    it('in parent task mode: supports applying assignees to subtasks', async () => {
      const user = userEvent.setup();
      const onApplyMock = vi.fn();

      render(
        <TaskMemberPicker
          boardUsers={mockBoardUsers}
          initialSelectedUserIds={['1', '2']}
          isParentTask={true}
          onApply={onApplyMock}
          onCancel={vi.fn()}
        />
      );

      // Checkbox "Áp dụng thành viên mới cho các Task con"
      const checkbox = screen.getByLabelText(/Áp dụng thành viên mới cho các Task con/i);
      expect(checkbox).toBeDefined();
      await user.click(checkbox);

      const applyBtn = screen.getByRole('button', { name: /Áp dụng/i });
      await user.click(applyBtn);

      expect(onApplyMock).toHaveBeenCalledWith(['1', '2'], true);
    });

    it('in subtask mode: has copy from parent task and clear all buttons', async () => {
      const user = userEvent.setup();
      const onApplyMock = vi.fn();

      render(
        <TaskMemberPicker
          boardUsers={mockBoardUsers}
          initialSelectedUserIds={['3']}
          isSubtask={true}
          parentTaskAssignees={[mockBoardUsers[0], mockBoardUsers[1]]}
          onApply={onApplyMock}
          onCancel={vi.fn()}
        />
      );

      // Has button "Sao chép từ Task cha"
      const copyBtn = screen.getByRole('button', { name: /Sao chép từ Task cha/i });
      expect(copyBtn).toBeDefined();
      await user.click(copyBtn);

      const applyBtn = screen.getByRole('button', { name: /Áp dụng/i });
      await user.click(applyBtn);

      // Should now contain '3' + '1' and '2'
      expect(onApplyMock).toHaveBeenCalledWith(
        expect.arrayContaining(['1', '2', '3']),
        false
      );
    });
  });

  describe('TaskContributionModal Component', () => {
    it('renders assignees and validates contribution percentages sum', async () => {
      const user = userEvent.setup();
      const onCloseMock = vi.fn();

      render(
        <TaskContributionModal
          task={mockParentTask}
          onClose={onCloseMock}
        />
      );

      expect(screen.getByText('Phân bổ tỷ lệ đóng góp')).toBeDefined();
      expect(screen.getByText('Nguyễn Nam Hùng')).toBeDefined();
      expect(screen.getByText('Trần Danh Đại')).toBeDefined();

      // Check sum indicator initially 100%
      expect(screen.getByText(/100% \/ 100%/i)).toBeDefined();

      // Has "Chia đều" button
      const splitBtn = screen.getByRole('button', { name: /Chia đều/i });
      expect(splitBtn).toBeDefined();

      // Click save button
      const saveBtn = screen.getByRole('button', { name: /Lưu tỷ lệ/i });
      expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
      await user.click(saveBtn);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          `/tasks/${mockParentTask.id}/contribution-percents`,
          expect.objectContaining({
            contribution_percents: expect.any(Object),
          })
        );
      });
    });
  });

  describe('RemoveAssigneeWarningModal Component', () => {
    it('warns when user is still assigned to subtasks and allows selecting options', async () => {
      const user = userEvent.setup();
      const onCancelMock = vi.fn();
      const onConfirmMock = vi.fn();
      const onRemoveOnlyParentMock = vi.fn();

      render(
        <RemoveAssigneeWarningModal
          user={mockBoardUsers[0]}
          parentTask={mockParentTask}
          affectedSubtasks={mockSubtasks}
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
          onRemoveOnlyParent={onRemoveOnlyParentMock}
        />
      );

      expect(screen.getByText('Cảnh báo phân công công việc')).toBeDefined();
      expect(screen.getByText(/Đang phụ trách 2 Task con trong công việc này/i)).toBeDefined();
      expect(screen.getByText('Thiết kế giao diện PWA')).toBeDefined();
      expect(screen.getByText('Cấu hình Service Worker')).toBeDefined();

      // Click "Chỉ xóa khỏi Task cha"
      const onlyParentBtn = screen.getByRole('button', { name: /Chỉ xóa khỏi Task cha/i });
      await user.click(onlyParentBtn);
      expect(onRemoveOnlyParentMock).toHaveBeenCalled();

      // Or click "Xóa khỏi Task cha và 2 Task con đã chọn"
      const confirmBothBtn = screen.getByRole('button', { name: /Xóa khỏi Task cha và 2 Task con đã chọn/i });
      await user.click(confirmBothBtn);
      expect(onConfirmMock).toHaveBeenCalledWith(['101', '102']);
    });
  });
});
