import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PerformancePolicyView } from '../src/pages/PerformancePolicyView';
import * as performanceApi from '../src/lib/api/performance';
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
