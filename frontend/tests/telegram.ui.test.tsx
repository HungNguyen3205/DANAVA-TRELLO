import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DepartmentTelegramCard } from '../src/components/department/DepartmentTelegramCard';
import { BoardTelegramSettings } from '../src/components/board/BoardTelegramSettings';
import * as telegramApi from '../src/lib/api/telegram';
import { useAuthStore } from '../src/store/authStore';

// Mock telegram api
vi.mock('../src/lib/api/telegram', () => ({
  getDepartmentTelegram: vi.fn(),
  updateDepartmentTelegram: vi.fn(),
  verifyDepartmentTelegram: vi.fn(),
  testDepartmentTelegram: vi.fn(),
  disconnectDepartmentTelegram: vi.fn(),
  getBoardTelegram: vi.fn(),
  updateBoardTelegram: vi.fn(),
  verifyBoardTelegram: vi.fn(),
  testBoardTelegram: vi.fn(),
  disconnectBoardTelegram: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Telegram Integration UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 1,
        name: 'Admin User',
        email: 'admin@danava.vn',
        username: 'admin',
        system_role: 'system_admin',
      } as any,
    });
  });

  describe('DepartmentTelegramCard Component', () => {
    const mockInitialDepartmentStatus: telegramApi.TelegramIntegrationStatus = {
      enabled: false,
      chat_id: null,
      chat_id_masked: null,
      chat_title: null,
      status: 'disconnected',
      verified_at: null,
      last_tested_at: null,
      last_sent_at: null,
      last_error_message: null,
      event_settings: {
        employee_added: true,
        employee_transferred: true,
        task_assigned: true,
        task_completed: true,
        task_overdue: true,
        daily_summary: false,
        weekly_performance_summary: true,
      },
    };

    it('renders empty disconnected state and fetches department telegram status', async () => {
      vi.mocked(telegramApi.getDepartmentTelegram).mockResolvedValueOnce(mockInitialDepartmentStatus);

      render(<DepartmentTelegramCard departmentId={1} departmentName="Phòng Kỹ thuật" />);

      await waitFor(() => {
        expect(screen.getByText('Telegram của phòng ban')).toBeDefined();
      });

      expect(screen.getByText('Chưa kết nối')).toBeDefined();
      expect(screen.getByPlaceholderText('-100xxxxxxxxxx')).toBeDefined();
      expect(telegramApi.getDepartmentTelegram).toHaveBeenCalledWith(1);
    });

    it('renders connected state with group title and masked chat ID', async () => {
      const connectedStatus: telegramApi.TelegramIntegrationStatus = {
        ...mockInitialDepartmentStatus,
        enabled: true,
        status: 'connected',
        chat_id: '-1004340949074',
        chat_id_masked: '-100******9074',
        chat_title: 'DANAVA Dev Team',
        verified_at: '2026-10-19T10:00:00Z',
      };
      vi.mocked(telegramApi.getDepartmentTelegram).mockResolvedValueOnce(connectedStatus);

      render(<DepartmentTelegramCard departmentId={1} departmentName="Phòng Kỹ thuật" />);

      await waitFor(() => {
        expect(screen.getByText('Đã kết nối')).toBeDefined();
      });

      expect(screen.getByText('DANAVA Dev Team')).toBeDefined();
      expect(screen.getByText(/Gửi tin thử/i)).toBeDefined();
      expect(screen.getByText(/Ngắt kết nối/i)).toBeDefined();
    });

    it('handles verify chat ID flow', async () => {
      const user = userEvent.setup();
      vi.mocked(telegramApi.getDepartmentTelegram).mockResolvedValue(mockInitialDepartmentStatus);
      vi.mocked(telegramApi.verifyDepartmentTelegram).mockResolvedValueOnce({
        message: 'Xác minh thành công',
        chat_id: '-1001234567890',
        chat_title: 'DANAVA Tech Support',
        status: 'connected',
      });

      render(<DepartmentTelegramCard departmentId={1} departmentName="Phòng Kỹ thuật" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('-100xxxxxxxxxx')).toBeDefined();
      });

      const input = screen.getByPlaceholderText('-100xxxxxxxxxx');
      await user.type(input, '-1001234567890');

      const verifyBtn = screen.getByRole('button', { name: /Kiểm tra kết nối/i });
      await user.click(verifyBtn);

      expect(telegramApi.verifyDepartmentTelegram).toHaveBeenCalledWith(1, '-1001234567890');
    });

    it('toggles collapsible instruction guide', async () => {
      const user = userEvent.setup();
      vi.mocked(telegramApi.getDepartmentTelegram).mockResolvedValueOnce(mockInitialDepartmentStatus);

      render(<DepartmentTelegramCard departmentId={1} departmentName="Phòng Kỹ thuật" />);

      await waitFor(() => {
        expect(screen.getByText(/Hướng dẫn cách lấy Chat ID/i)).toBeDefined();
      });

      expect(screen.queryByText(/Tạo hoặc mở nhóm Telegram/i)).toBeNull();

      const guideBtn = screen.getByText(/Hướng dẫn cách lấy Chat ID/i);
      await user.click(guideBtn);

      expect(screen.getByText(/Tạo hoặc mở nhóm Telegram/i)).toBeDefined();
      expect(screen.getAllByText(/trolyNotificationAI_bot/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('BoardTelegramSettings Component', () => {
    const mockBoardTelegramStatus: telegramApi.BoardTelegramStatus = {
      board_id: 10,
      board_name: 'DANAVA WORK App',
      department_id: 1,
      allow_department_notification: true,
      delivery_mode: 'inherit_department',
      enabled: true,
      chat_id: null,
      chat_id_masked: null,
      chat_title: null,
      status: 'connected',
      verified_at: null,
      last_tested_at: null,
      last_sent_at: null,
      last_error_message: null,
      can_manage: true,
      event_settings: {
        member_added: true,
        task_created: false,
        task_assigned: true,
        task_moved: true,
        task_completed: true,
        task_overdue: true,
        daily_summary: false,
      },
      department_telegram: {
        department_id: 1,
        department_name: 'Phòng Kỹ thuật',
        status: 'connected',
        chat_title: 'DANAVA Dev Group',
        is_enabled: true,
      },
    };

    it('renders Board Telegram settings with inherited department details', async () => {
      vi.mocked(telegramApi.getBoardTelegram).mockResolvedValueOnce(mockBoardTelegramStatus);

      render(<BoardTelegramSettings boardId={10} boardName="DANAVA WORK App" />);

      await waitFor(() => {
        expect(screen.getByText('Tích hợp Telegram Board')).toBeDefined();
      });

      expect(screen.getByText(/Kế thừa Telegram của phòng ban/i)).toBeDefined();
      expect(screen.getByText('Phòng Kỹ thuật')).toBeDefined();
      expect(screen.getByText('DANAVA Dev Group')).toBeDefined();
      expect(telegramApi.getBoardTelegram).toHaveBeenCalledWith(10);
    });

    it('displays warning when board has no linked department in inherit mode', async () => {
      const noDeptStatus: telegramApi.BoardTelegramStatus = {
        ...mockBoardTelegramStatus,
        department_id: null,
        department_telegram: null,
      };
      vi.mocked(telegramApi.getBoardTelegram).mockResolvedValueOnce(noDeptStatus);

      render(<BoardTelegramSettings boardId={10} boardName="DANAVA WORK App" />);

      await waitFor(() => {
        expect(screen.getByText(/Board này chưa được gắn phòng ban nào/i)).toBeDefined();
      });
    });

    it('shows board chat input when switching to board_only mode and saves settings', async () => {
      const user = userEvent.setup();
      vi.mocked(telegramApi.getBoardTelegram).mockResolvedValue(mockBoardTelegramStatus);
      vi.mocked(telegramApi.updateBoardTelegram).mockResolvedValueOnce({
        message: 'Lưu cài đặt thành công',
      });

      render(<BoardTelegramSettings boardId={10} boardName="DANAVA WORK App" />);

      await waitFor(() => {
        expect(screen.getByText(/Chỉ gửi nhóm Telegram của Board/i)).toBeDefined();
      });

      // Switch to board_only
      const boardOnlyCard = screen.getByText(/Chỉ gửi nhóm Telegram của Board/i);
      await user.click(boardOnlyCard);

      // Now the chat ID input should be visible
      expect(screen.getByPlaceholderText('-1004340949074')).toBeDefined();
      const input = screen.getByPlaceholderText('-1004340949074');
      await user.type(input, '-1009988776655');

      const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt Telegram/i });
      await user.click(saveBtn);

      expect(telegramApi.updateBoardTelegram).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          delivery_mode: 'board_only',
          chat_id: '-1009988776655',
          enabled: true,
        })
      );
    });

    it('enforces read-only UI for normal members with can_manage: false', async () => {
      const readOnlyStatus: telegramApi.BoardTelegramStatus = {
        ...mockBoardTelegramStatus,
        can_manage: false,
        chat_id: null,
        chat_id_masked: '-100******9999',
      };
      vi.mocked(telegramApi.getBoardTelegram).mockResolvedValueOnce(readOnlyStatus);

      render(<BoardTelegramSettings boardId={10} boardName="DANAVA WORK App" />);

      await waitFor(() => {
        expect(screen.getByText('Chỉ xem')).toBeDefined();
      });

      // Action buttons like Save or Disconnect should not be visible for read-only members
      expect(screen.queryByRole('button', { name: /Lưu cài đặt Telegram/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Ngắt kết nối/i })).toBeNull();
    });

    it('handles event selection presets correctly', async () => {
      const user = userEvent.setup();
      vi.mocked(telegramApi.getBoardTelegram).mockResolvedValueOnce(mockBoardTelegramStatus);

      render(<BoardTelegramSettings boardId={10} boardName="DANAVA WORK App" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Sự kiện quan trọng' })).toBeDefined();
      });

      const selectAllBtn = screen.getByRole('button', { name: 'Chọn tất cả' });
      await user.click(selectAllBtn);

      const deselectAllBtn = screen.getByRole('button', { name: 'Bỏ chọn tất cả' });
      await user.click(deselectAllBtn);
    });
  });
});
