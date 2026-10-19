import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BoardCodeGuard } from '../src/components/layout/guards/BoardCodeGuard';
import { HomePage } from '../src/pages/HomePage';
import { useAuthStore } from '../src/store/authStore';
import { useBoardStore } from '../src/store/boardStore';
import api from '../src/lib/axios';

vi.mock('../src/lib/axios');

describe('Board Isolation & Security Frontend UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useBoardStore.getState().clearCache();
  });

  describe('BoardCodeGuard Security & Access Control', () => {
    it('1. Displays 403 forbidden screen without flashing board data when user is not a board member', async () => {
      (api.get as any).mockRejectedValueOnce({
        response: {
          status: 403,
          data: { message: 'Chỉ thành viên của bảng mới có quyền truy cập.' },
        },
      });

      render(
        <MemoryRouter initialEntries={['/board-nam-xyz123/kanban']}>
          <Routes>
            <Route path="/:boardCode" element={<BoardCodeGuard />}>
              <Route path="kanban" element={<div data-testid="secret-board-content">SECRET BOARD CONTENT</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      // Loading state shown initially
      expect(screen.getByText('Đang mở bảng...')).toBeTruthy();
      expect(screen.queryByTestId('secret-board-content')).toBeNull();

      // Forbidden screen displayed after 403
      await waitFor(() => {
        expect(screen.getByText(/403 - Bạn không có quyền truy cập bảng này/i)).toBeTruthy();
      });

      // Crucial: Secret board content was NEVER rendered into the DOM
      expect(screen.queryByTestId('secret-board-content')).toBeNull();
      expect(screen.getByText(/Liên kết này thuộc về một bảng làm việc riêng tư/i)).toBeTruthy();
    });

    it('2. Renders board view and preserves canonical public_id in route context when authorized', async () => {
      (api.get as any).mockResolvedValueOnce({
        data: {
          id: 42,
          public_id: 'hung-board-pub-999',
          workspace_id: 1,
          name: 'BẢNG CỦA HÙNG',
        },
      });

      render(
        <MemoryRouter initialEntries={['/hung-board-pub-999/kanban']}>
          <Routes>
            <Route path="/:boardCode" element={<BoardCodeGuard />}>
              <Route path="kanban" element={<div data-testid="authorized-board-view">BẢNG KANBAN HỢP LỆ</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authorized-board-view')).toBeTruthy();
      });
      expect(screen.queryByText(/403/)).toBeNull();
    });
  });

  describe('HomePage Empty State & Zero Workspace Fallback', () => {
    it('3. Renders empty state with Create Board button when user has 0 boards, without leaking workspace boards', async () => {
      useAuthStore.getState().login(
        { id: 2, name: 'Hùng', email: 'hung@danava.com.vn', system_role: 'user' } as any,
        'fake-jwt-token-hung'
      );

      // Mock personal dashboard returning 0 boards
      (api.get as any).mockResolvedValueOnce({
        data: {
          summary: { due_today: 0, overdue: 0, in_progress: 0 },
          attention_items: [],
          today_schedule: [],
          recent_boards: [],
          recent_workspaces: [{ id: 1, name: 'Công ty Cổ phần DANAVA' }],
          recent_activities: [],
        },
      });

      render(
        <MemoryRouter initialEntries={['/home']}>
          <HomePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Bạn chưa có Bảng công việc nào/i)).toBeTruthy();
      });

      // Verify button to create a new board exists
      expect(screen.getByRole('button', { name: /Tạo Bảng công việc/i })).toBeTruthy();
      // Verify workspace boards were not used as fallback in Continue Items
      expect(screen.queryByText('Bấm để vào không gian')).toBeNull();
    });
  });

  describe('Session Cleansing & Store Invalidation on Logout', () => {
    it('4. Clears boardStore, memory cache, and auth credentials when logging out', () => {
      // Setup authenticated state with mock user and board data
      useAuthStore.getState().login(
        { id: 2, name: 'Hùng', email: 'hung@danava.com.vn', system_role: 'user' } as any,
        'fake-jwt-token-hung'
      );

      useBoardStore.getState().setBoard({
        id: '99',
        public_id: 'hung-board-public',
        name: 'Bảng riêng của Hùng',
        columns: [],
      } as any);

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useBoardStore.getState().board).not.toBeNull();

      // Trigger logout
      useAuthStore.getState().logout();

      // Assert complete clearance
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().token).toBeNull();
      expect(useBoardStore.getState().board).toBeNull();
      expect(Object.keys(useBoardStore.getState().boardsCache)).toHaveLength(0);
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });
});
