import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { BoardReviewView } from '../src/pages/BoardReviewView';
import api from '../src/lib/axios';

const renderComponent = () => render(
  <MemoryRouter>
    <BoardReviewView />
  </MemoryRouter>
);

// Mock BoardRouteContext
vi.mock('../src/components/layout/BoardRouteContext', () => ({
  useBoardRoute: () => ({
    boardId: '1',
    boardCode: 'DANAVA-APP',
    basePath: '/DANAVA-APP',
  }),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock axios
vi.mock('../src/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockPublishedResponse = {
  board: {
    id: 1,
    name: 'Dự án Website Danava',
    public_id: 'DANAVA-APP',
    owner_id: 1,
    is_admin: true,
  },
  review: {
    id: 10,
    board_id: 1,
    status: 'published',
    goals: 'Mục tiêu hoàn thành đúng tiến độ',
    summary: 'Dự án đã nghiệm thu thành công',
    achievements: 'Đạt 100% mục tiêu ban đầu',
    unfinished_work: 'Không có tồn đọng',
    issues: 'Không có vấn đề lớn',
    lessons_learned: 'Cần duy trì quy trình code review chặt chẽ',
    revenue: 100000000,
    cost: 60000000,
    profit: 40000000,
    overall_rating: 5,
    member_reviews: [
      { user_id: 1, note: 'Quản lý xuất sắc', rating: 5 },
    ],
    attachments: [
      { name: 'Biên bản nghiệm thu.pdf', url: 'https://example.com/tailieu.pdf' },
    ],
    creator: { id: 1, name: 'Nguyễn Nam Hùng' },
    publisher: { id: 1, name: 'Nguyễn Nam Hùng' },
    published_at: '2026-10-19T10:00:00Z',
  },
  stats: {
    total_tasks: 10,
    completed_tasks: 8,
    incomplete_tasks: 2,
    overdue_tasks: 1,
    completion_rate: 80.0,
    members_stats: [
      {
        user_id: 1,
        name: 'Nguyễn Nam Hùng',
        username: 'namhung',
        email: 'hung@danava.vn',
        role: 'owner',
        total_tasks: 6,
        completed_tasks: 5,
        incomplete_tasks: 1,
        overdue_tasks: 0,
        completion_rate: 83.3,
        saved_review: { user_id: 1, note: 'Quản lý xuất sắc', rating: 5 },
      },
    ],
  },
};

describe('BoardReviewView UI Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders published board review with accurate KPI metrics and narrative sections', async () => {
    (api.get as any).mockResolvedValueOnce({ data: mockPublishedResponse });

    renderComponent();

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Tổng kết dự án')).toBeDefined();
    });

    // Check KPI metrics
    expect(screen.getByText('10')).toBeDefined(); // Total tasks
    expect(screen.getByText('8')).toBeDefined(); // Completed tasks
    expect(screen.getByText('2')).toBeDefined(); // Incomplete tasks
    expect(screen.getByText('1')).toBeDefined(); // Overdue tasks

    // Check badges and text
    expect(screen.getByText('Đã công bố')).toBeDefined();
    expect(screen.getByText('Dự án đã nghiệm thu thành công')).toBeDefined();
    expect(screen.getByText('Đạt 100% mục tiêu ban đầu')).toBeDefined();

    // Check member section
    expect(screen.getByText('Đóng góp từng thành viên')).toBeDefined();
    expect(screen.getByText('"Quản lý xuất sắc"')).toBeDefined();

    // Check attachments
    expect(screen.getByText('Biên bản nghiệm thu.pdf')).toBeDefined();
  });

  it('allows owner to click edit, change goals, and save review', async () => {
    (api.get as any).mockResolvedValue({ data: mockPublishedResponse });
    (api.post as any).mockResolvedValueOnce({
      data: {
        message: 'Đã lưu bản tổng kết dự án thành công',
        review: { ...mockPublishedResponse.review, goals: 'Mục tiêu mới cập nhật' },
        stats: mockPublishedResponse.stats,
      },
    });

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Chỉnh sửa')).toBeDefined();
    });

    // Click Chỉnh sửa
    await user.click(screen.getByText('Chỉnh sửa'));

    // Check if Save button appears
    await waitFor(() => {
      expect(screen.getByText('Lưu bản tổng kết')).toBeDefined();
    });

    // Edit goals textarea
    const goalsInput = screen.getByPlaceholderText('Nêu rõ các mục tiêu trọng tâm đã đề ra cho dự án...');
    expect(goalsInput).toBeDefined();
    await user.clear(goalsInput);
    await user.type(goalsInput, 'Mục tiêu mới cập nhật');

    // Click Lưu bản tổng kết
    await user.click(screen.getByText('Lưu bản tổng kết'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/boards/DANAVA-APP/review',
        expect.objectContaining({
          goals: 'Mục tiêu mới cập nhật',
          status: 'draft',
        })
      );
    });
  });

  it('allows owner to lock review when published', async () => {
    // Window confirm mock
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    (api.get as any).mockResolvedValue({ data: mockPublishedResponse });
    (api.post as any).mockResolvedValueOnce({
      data: {
        message: 'Đã khóa bản tổng kết dự án thành công',
        review: { ...mockPublishedResponse.review, status: 'locked' },
      },
    });

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Khóa')).toBeDefined();
    });

    await user.click(screen.getByText('Khóa'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/boards/DANAVA-APP/review/lock');
    });
  });

  it('displays error state when unauthorized or draft hidden from regular member', async () => {
    (api.get as any).mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          message: 'Bản tổng kết đang là bản nháp và chưa được công bố.',
        },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Không thể xem bản tổng kết')).toBeDefined();
      expect(screen.getByText('Bản tổng kết đang là bản nháp và chưa được công bố.')).toBeDefined();
    });
  });

  it('triggers window.print when Print button is clicked', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    (api.get as any).mockResolvedValueOnce({ data: mockPublishedResponse });

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('In / Xuất PDF')).toBeDefined();
    });

    await user.click(screen.getByText('In / Xuất PDF'));
    expect(printSpy).toHaveBeenCalled();
  });
});
