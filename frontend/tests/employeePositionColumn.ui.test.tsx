import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { EmployeeManagementView } from '../src/pages/EmployeeManagementView';
import api from '../src/lib/axios';

// Mock dependencies
vi.mock('../src/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../src/lib/api/departments', () => ({
  getDepartmentOptions: vi.fn().mockResolvedValue([
    { id: 1, name: 'Kỹ thuật', code: 'KT', color: '#6366f1' },
    { id: 2, name: 'Marketing', code: 'MKT', color: '#ec4899' },
  ]),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EmployeeManagementView - Position Column & Table UI Tests', () => {
  const mockEmployees = [
    {
      id: 1,
      name: 'Nguyễn Văn Lead',
      username: 'lead_kt',
      email: 'lead@danava.vn',
      system_role: 'user',
      department_id: 1,
      department_title: 'Trưởng phòng Kỹ thuật',
      position: 'Lập trình viên Principal',
      account_status: 'active',
      created_at: '2026-01-15T08:00:00.000Z',
      boards_count: 5,
      department: { id: 1, name: 'Kỹ thuật', code: 'KT', color: '#6366f1', manager_id: 1 },
    },
    {
      id: 2,
      name: 'Trần Thị Nhân Viên',
      username: 'nhanvien_mkt',
      email: 'nhanvien@danava.vn',
      system_role: 'user',
      department_id: 2,
      department_title: 'Nhân viên Marketing',
      position: 'Chuyên viên Content',
      account_status: 'active',
      created_at: '2026-03-20T09:30:00.000Z',
      boards_count: 2,
      department: { id: 2, name: 'Marketing', code: 'MKT', color: '#ec4899', manager_id: 99 },
    },
    {
      id: 3,
      name: 'Phạm Văn Long Title',
      username: 'long_title',
      email: 'long@danava.vn',
      system_role: 'admin',
      department_id: 1,
      department_title: 'Trưởng phòng Phát triển Sản phẩm và Công nghệ',
      position: 'Kiến trúc sư giải pháp',
      account_status: 'active',
      created_at: '2026-05-10T14:15:00.000Z',
      boards_count: 8,
      department: { id: 1, name: 'Kỹ thuật', code: 'KT', color: '#6366f1', manager_id: 3 },
    },
    {
      id: 4,
      name: 'Lê Văn Unassigned',
      username: 'unassigned_user',
      email: 'unassigned@danava.vn',
      system_role: 'system_admin',
      department_id: null,
      department_title: null,
      position: 'Cố vấn độc lập',
      account_status: 'locked',
      created_at: '2026-08-01T11:00:00.000Z',
      boards_count: 0,
      department: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockResolvedValue({
      data: {
        data: mockEmployees,
      },
    });
  });

  it('renders table headers with proposed order and correct widths', async () => {
    render(<EmployeeManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Quản lý nhân viên')).toBeDefined();
    });

    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map(th => th.textContent?.trim());

    // Proposed columns: Checkbox, Nhân viên, Phòng ban, Chức vụ, Vai trò hệ thống, Trạng thái, Ngày tham gia, Hành động
    expect(headerTexts).toContain('Nhân viên');
    expect(headerTexts).toContain('Phòng ban');
    expect(headerTexts).toContain('Chức vụ');
    expect(headerTexts).toContain('Vai trò hệ thống');
    expect(headerTexts).toContain('Trạng thái');
    expect(headerTexts).toContain('Ngày tham gia');
    expect(headerTexts).toContain('Hành động');

    // Verify Chức vụ th has non-wrapping and width constraints
    const positionHeader = headers.find(th => th.textContent?.trim() === 'Chức vụ');
    expect(positionHeader).toBeDefined();
    expect(positionHeader?.className).toContain('whitespace-nowrap');
    expect(positionHeader?.className).toContain('min-w-[180px]');
    expect(positionHeader?.className).toContain('max-w-[240px]');
  });

  it('renders Trưởng phòng badge with purple style, crown icon, and tooltip', async () => {
    render(<EmployeeManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Lead')).toBeDefined();
    });

    const leadBadge = screen.getByTitle('Trưởng phòng Kỹ thuật');
    expect(leadBadge).toBeDefined();
    expect(leadBadge.className).toContain('bg-purple-50');
    expect(leadBadge.className).toContain('text-purple-700');
    expect(leadBadge.className).toContain('whitespace-nowrap');

    // Personal position specialization is preserved below
    expect(screen.getByText('Lập trình viên Principal')).toBeDefined();
  });

  it('renders Nhân viên badge with sky style, briefcase icon, and tooltip', async () => {
    render(<EmployeeManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Trần Thị Nhân Viên')).toBeDefined();
    });

    const staffBadge = screen.getByTitle('Nhân viên Marketing');
    expect(staffBadge).toBeDefined();
    expect(staffBadge.className).toContain('bg-sky-50');
    expect(staffBadge.className).toContain('text-sky-700');
    expect(staffBadge.className).toContain('whitespace-nowrap');

    // Personal position specialization is preserved below
    expect(screen.getByText('Chuyên viên Content')).toBeDefined();
  });

  it('renders very long title with truncate and full tooltip on single line', async () => {
    render(<EmployeeManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Phạm Văn Long Title')).toBeDefined();
    });

    const longTitleBadge = screen.getByTitle('Trưởng phòng Phát triển Sản phẩm và Công nghệ');
    expect(longTitleBadge).toBeDefined();
    expect(longTitleBadge.className).toContain('whitespace-nowrap');

    // Check inner text has truncate class
    const truncateSpan = longTitleBadge.querySelector('.truncate');
    expect(truncateSpan).toBeDefined();
    expect(truncateSpan?.textContent).toBe('Trưởng phòng Phát triển Sản phẩm và Công nghệ');
  });

  it('renders "Chưa cập nhật" for unassigned user without crashing or breaking words', async () => {
    render(<EmployeeManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Lê Văn Unassigned')).toBeDefined();
    });

    const unassignedBadge = screen.getByTitle('Chưa cập nhật');
    expect(unassignedBadge).toBeDefined();
    expect(unassignedBadge.textContent).toContain('Chưa cập nhật');
    expect(unassignedBadge.className).toContain('bg-muted/60');
    expect(unassignedBadge.className).toContain('whitespace-nowrap');

    // Ensure it does not say null or undefined or empty dash
    expect(unassignedBadge.textContent).not.toBe('null');
    expect(unassignedBadge.textContent).not.toBe('undefined');
  });

  it('renders system role clearly distinguished under Vai trò hệ thống', async () => {
    render(<EmployeeManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Lê Văn Unassigned')).toBeDefined();
    });

    // System role shows System Admin, while position shows "Chưa cập nhật"
    const systemAdminBadges = screen.getAllByText('System Admin');
    expect(systemAdminBadges.length).toBeGreaterThanOrEqual(1);

    const userBadges = screen.getAllByText('User');
    expect(userBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('formats joined date correctly under Ngày tham gia', async () => {
    render(<EmployeeManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Lead')).toBeDefined();
    });

    // 2026-01-15 in vi-VN locale is 15/01/2026
    expect(screen.getByText('15/01/2026')).toBeDefined();
  });
});
