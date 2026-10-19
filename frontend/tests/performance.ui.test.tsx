import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PerformancePolicyView } from '../src/pages/PerformancePolicyView';
import { PerformanceDashboardView } from '../src/pages/PerformanceDashboardView';
import * as performanceApi from '../src/lib/api/performance';
import * as departmentApi from '../src/lib/api/departments';
import * as boardRouteContext from '../src/components/layout/BoardRouteContext';

// Mock board route context
vi.mock('../src/components/layout/BoardRouteContext', () => ({
  useBoardRoute: vi.fn(),
}));

// Mock performance API
vi.mock('../src/lib/api/performance', () => ({
  getPerformancePolicy: vi.fn(),
  acknowledgePerformancePolicy: vi.fn(),
  updatePerformancePolicy: vi.fn(),
  getPerformancePeriods: vi.fn(),
  getPerformancePeriodDetails: vi.fn(),
  createPerformancePeriod: vi.fn(),
  recalculatePerformancePeriod: vi.fn(),
  publishPerformancePeriod: vi.fn(),
  lockPerformancePeriod: vi.fn(),
  unlockPerformancePeriod: vi.fn(),
  getMemberPerformanceLineage: vi.fn(),
}));

// Mock departments API
vi.mock('../src/lib/api/departments', () => ({
  getDepartmentOptions: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PerformancePolicyView UI Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (boardRouteContext.useBoardRoute as any).mockReturnValue({
      boardId: '1',
      boardCode: 'DANAVA-TEST',
    });
  });

  it('renders policy document, version badge, and acknowledgment status', async () => {
    (performanceApi.getPerformancePolicy as any).mockResolvedValue({
      board_id: 1,
      can_manage: false,
      is_acknowledged: false,
      acknowledged_at: null,
      total_acknowledged: 5,
      total_members: 10,
      policy: {
        id: 1,
        board_id: 1,
        title: 'Quy Chế Đánh Giá Hiệu Suất Công Việc',
        version: 'v1.0',
        content: 'Nội quy đánh giá hiệu suất minh bạch theo thang điểm 100.',
        is_active: true,
        created_at: '2026-10-19T00:00:00Z',
      },
      acknowledgements: [],
      history: [],
    });

    render(<PerformancePolicyView />);

    expect(screen.getByText('Đang tải nội quy đánh giá hiệu suất...')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Quy Chế Đánh Giá Hiệu Suất Công Việc')).toBeTruthy();
      expect(screen.getByText(/Phiên Bản v1.0/i)).toBeTruthy();
      expect(screen.getByText('Chờ Xác Nhận')).toBeTruthy();
      expect(screen.getByText(/Tôi đã đọc, hiểu rõ và đồng thuận/i)).toBeTruthy();
    });
  });

  it('allows user to check acknowledgement box and click confirm', async () => {
    const user = userEvent.setup();
    (performanceApi.getPerformancePolicy as any).mockResolvedValue({
      board_id: 1,
      can_manage: false,
      is_acknowledged: false,
      acknowledged_at: null,
      total_acknowledged: 0,
      total_members: 5,
      policy: {
        id: 1,
        board_id: 1,
        title: 'Quy Chế Đánh Giá Hiệu Suất Công Việc',
        version: 'v1.0',
        content: 'Nội quy mẫu.',
        is_active: true,
        created_at: '2026-10-19T00:00:00Z',
      },
      acknowledgements: [],
      history: [],
    });

    (performanceApi.acknowledgePerformancePolicy as any).mockResolvedValue({
      message: 'Xác nhận nội quy thành công',
      acknowledged_at: '2026-10-19 12:00:00',
    });

    render(<PerformancePolicyView />);

    await waitFor(() => {
      expect(screen.getByText('Quy Chế Đánh Giá Hiệu Suất Công Việc')).toBeTruthy();
    });

    const checkbox = screen.getByRole('checkbox');
    const submitBtn = screen.getByRole('button', { name: /Xác nhận đã đọc nội quy/i });

    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    await user.click(checkbox);
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    await user.click(submitBtn);

    expect(performanceApi.acknowledgePerformancePolicy).toHaveBeenCalledWith('DANAVA-TEST');
  });

  it('shows edit button when user has manage permissions', async () => {
    (performanceApi.getPerformancePolicy as any).mockResolvedValue({
      board_id: 1,
      can_manage: true,
      is_acknowledged: true,
      acknowledged_at: '2026-10-19 10:00:00',
      total_acknowledged: 1,
      total_members: 1,
      policy: {
        id: 1,
        board_id: 1,
        title: 'Quy Chế Đánh Giá Hiệu Suất Công Việc',
        version: 'v1.0',
        content: 'Nội quy v1.0',
        is_active: true,
        created_at: '2026-10-19T00:00:00Z',
      },
      acknowledgements: [],
      history: [],
    });

    render(<PerformancePolicyView />);

    await waitFor(() => {
      expect(screen.getByText('Ban hành phiên bản mới')).toBeTruthy();
    });
  });
});

describe('PerformanceDashboardView UI Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (boardRouteContext.useBoardRoute as any).mockReturnValue({
      boardId: '1',
      boardCode: 'kheklha3eogh',
    });
  });

  it('renders gracefully without crashing when periods and departments are empty or undefined', async () => {
    (performanceApi.getPerformancePeriods as any).mockResolvedValue({
      periods: [],
      can_manage: true,
    });
    (departmentApi.getDepartmentOptions as any).mockResolvedValue([]);

    render(<PerformanceDashboardView />);

    await waitFor(() => {
      expect(screen.getByText('Bảng Điểm Hiệu Suất Công Việc')).toBeTruthy();
      expect(screen.getByText('Chưa có kỳ đánh giá nào')).toBeTruthy();
      expect(screen.getByText('Tất cả phòng ban')).toBeTruthy();
    });
  });

  it('renders correctly when period data is available', async () => {
    (performanceApi.getPerformancePeriods as any).mockResolvedValue({
      periods: [
        {
          id: 10,
          board_id: 1,
          title: 'Kỳ Tháng 10/2026',
          period_type: 'monthly',
          start_date: '2026-10-01',
          end_date: '2026-10-31',
          status: 'published',
        },
      ],
      can_manage: true,
    });

    (departmentApi.getDepartmentOptions as any).mockResolvedValue([
      { id: 1, name: 'Kỹ thuật', code: 'DEV', color: '#3b82f6' },
    ]);

    (performanceApi.getPerformancePeriodDetails as any).mockResolvedValue({
      period: {
        id: 10,
        board_id: 1,
        title: 'Kỳ Tháng 10/2026',
        period_type: 'monthly',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        status: 'published',
      },
      scores: [
        {
          user_id: 2,
          user_name: 'Nguyễn Văn A',
          user_username: 'vana',
          user_email: 'vana@example.com',
          role: 'member',
          workload_score: 35.0,
          on_time_score: 22.5,
          quality_score: 20.0,
          progress_score: 8.0,
          total_points_earned: 85.5,
          available_weight: 100,
          final_score: 85.5,
          is_provisional: false,
          rank: 'Tốt',
          metrics_breakdown: {
            workload: { has_data: true, score: 35 },
            on_time: { has_data: true, score: 22.5 },
            quality: { has_data: true, score: 20 },
            progress: { has_data: true, score: 8 },
          },
          task_details: [],
        },
      ],
      analytics: {
        total_members: 1,
        board_average: 85.5,
        rank_distribution: { 'Tốt': 1 },
        top_performers: [],
      },
      can_manage: true,
    });

    render(<PerformanceDashboardView />);

    await waitFor(() => {
      expect(screen.getByText('Bảng Điểm Hiệu Suất Công Việc')).toBeTruthy();
      expect(screen.getByText(/Kỳ Tháng 10\/2026/)).toBeTruthy();
      expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    });
  });
});
