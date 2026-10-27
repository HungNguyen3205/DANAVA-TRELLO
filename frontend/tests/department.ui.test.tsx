import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PersonalLayout } from '../src/components/layout/PersonalLayout';
import { DepartmentModal } from '../src/components/department/DepartmentModal';
import { EmployeeTransferModal } from '../src/components/department/EmployeeTransferModal';
import { DepartmentManagementView } from '../src/pages/DepartmentManagementView';
import * as departmentsApi from '../src/lib/api/departments';
import api from '../src/lib/axios';
import { useAuthStore } from '../src/store/authStore';

// Mock departments API
vi.mock('../src/lib/api/departments', () => ({
  getDepartments: vi.fn(),
  getDepartmentDetails: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
  getDepartmentOptions: vi.fn(),
  transferEmployeeDepartment: vi.fn(),
  bulkTransferEmployees: vi.fn(),
  assignDepartmentEmployees: vi.fn(),
  removeDepartmentEmployee: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock axios instance
vi.mock('../src/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('Department Module UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PersonalLayout Sidebar Role Authorization', () => {
    it('displays the "Phòng ban" sidebar item for System Admin', () => {
      useAuthStore.setState({
        user: {
          id: 1,
          name: 'Admin User',
          email: 'admin@danava.vn',
          username: 'admin',
          system_role: 'system_admin',
        } as any,
      });

      render(
        <MemoryRouter initialEntries={['/home']}>
          <PersonalLayout />
        </MemoryRouter>
      );

      expect(screen.getByText('Phòng ban')).toBeDefined();
      expect(screen.getByText('Quản lý nhân viên')).toBeDefined();
    });

    it('hides the "Phòng ban" sidebar item for regular users', () => {
      useAuthStore.setState({
        user: {
          id: 2,
          name: 'Regular Employee',
          email: 'employee@danava.vn',
          username: 'employee',
          system_role: 'user',
        } as any,
      });

      render(
        <MemoryRouter initialEntries={['/home']}>
          <PersonalLayout />
        </MemoryRouter>
      );

      expect(screen.queryByText('Phòng ban')).toBeNull();
      expect(screen.queryByText('Quản trị hệ thống')).toBeNull();
    });
  });

  describe('DepartmentModal Form Validation', () => {
    it('validates required name and code fields and displays errors on submit', async () => {
      const u = userEvent.setup();
      const handleSuccess = vi.fn();

      render(
        <DepartmentModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          department={null}
        />
      );

      // Verify modal is open
      expect(screen.getByText('Tạo phòng ban mới')).toBeDefined();

      // Submit without entering name or code
      const submitBtn = screen.getByRole('button', { name: /Tạo phòng ban/i });
      await u.click(submitBtn);

      // Should show error messages under fields
      await waitFor(() => {
        expect(screen.getByText('Tên phòng ban là bắt buộc')).toBeDefined();
        expect(screen.getByText('Mã phòng ban là bắt buộc')).toBeDefined();
      });

      expect(departmentsApi.createDepartment).not.toHaveBeenCalled();
      expect(handleSuccess).not.toHaveBeenCalled();
    });

    it('submits valid department data and triggers createDepartment API', async () => {
      const u = userEvent.setup();
      const handleSuccess = vi.fn();
      (departmentsApi.createDepartment as any).mockResolvedValue({
        department: { id: 1, name: 'Phòng Kỹ Thuật', code: 'TECH' },
        message: 'Tạo phòng ban thành công',
      });

      render(
        <DepartmentModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          department={null}
        />
      );

      // Type valid name and code
      const nameInput = screen.getByPlaceholderText(/Phòng Kỹ thuật & Công nghệ/i);
      const codeInput = screen.getByPlaceholderText(/TECH/i);

      await u.type(nameInput, 'Phòng Kỹ Thuật');
      await u.type(codeInput, 'TECH');

      const submitBtn = screen.getByRole('button', { name: /Tạo phòng ban/i });
      await u.click(submitBtn);

      await waitFor(() => {
        expect(departmentsApi.createDepartment).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Phòng Kỹ Thuật',
            code: 'TECH',
            status: 'active',
          })
        );
        expect(handleSuccess).toHaveBeenCalled();
      });
    });

    it('populates active employees in manager select dropdown and allows selecting a manager', async () => {
      const u = userEvent.setup();
      const handleSuccess = vi.fn();
      (api.get as any).mockResolvedValue({
        data: [
          { id: 10, name: 'Nguyễn Văn Lead', username: 'lead_nv', position: 'Trưởng nhóm Backend', account_status: 'active' },
          { id: 20, name: 'Lê Thị Dev', username: 'dev_lt', position: 'Frontend Developer', account_status: 'active' },
        ],
      });
      (departmentsApi.createDepartment as any).mockResolvedValue({
        department: { id: 1, name: 'Phòng Công Nghệ', code: 'IT', manager_id: 10 },
        message: 'Tạo phòng ban thành công',
      });

      render(
        <DepartmentModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          department={null}
        />
      );

      // Wait for users to load in dropdown
      await waitFor(() => {
        expect(screen.getAllByText(/Nguyễn Văn Lead/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Lê Thị Dev/i).length).toBeGreaterThanOrEqual(1);
      });

      // Type name and code
      await u.type(screen.getByPlaceholderText(/Phòng Kỹ thuật & Công nghệ/i), 'Phòng Công Nghệ');
      await u.type(screen.getByPlaceholderText(/TECH/i), 'IT');

      // Select manager
      const managerSelect = screen.getByRole('combobox');
      await u.selectOptions(managerSelect, '10');

      const submitBtn = screen.getByRole('button', { name: /Tạo phòng ban/i });
      await u.click(submitBtn);

      await waitFor(() => {
        expect(departmentsApi.createDepartment).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Phòng Công Nghệ',
            code: 'IT',
            manager_id: 10,
          })
        );
        expect(handleSuccess).toHaveBeenCalled();
      });
    });

    it('allows admin to edit department and change manager', async () => {
      const u = userEvent.setup();
      const handleSuccess = vi.fn();
      const existingDept: any = {
        id: 5,
        name: 'Phòng Kinh Doanh',
        code: 'BIZ',
        description: 'Phòng kinh doanh toàn quốc',
        color: '#3b82f6',
        status: 'active',
        manager_id: 10,
        manager: { id: 10, name: 'Nguyễn Văn Lead', username: 'lead_nv', position: 'Lead' },
      };

      (api.get as any).mockResolvedValue({
        data: [
          { id: 10, name: 'Nguyễn Văn Lead', username: 'lead_nv', position: 'Lead', account_status: 'active' },
          { id: 30, name: 'Trần Văn Giám Đốc', username: 'giamdoc_tv', position: 'Giám đốc kinh doanh', account_status: 'active' },
        ],
      });
      (departmentsApi.updateDepartment as any).mockResolvedValue({
        department: { ...existingDept, manager_id: 30 },
        message: 'Cập nhật phòng ban thành công',
      });

      render(
        <DepartmentModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          department={existingDept}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chỉnh sửa phòng ban')).toBeDefined();
        expect(screen.getByText(/Trần Văn Giám Đốc/i)).toBeDefined();
      });

      const managerSelect = screen.getByRole('combobox');
      await u.selectOptions(managerSelect, '30');

      const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
      await u.click(submitBtn);

      await waitFor(() => {
        expect(departmentsApi.updateDepartment).toHaveBeenCalledWith(
          5,
          expect.objectContaining({
            name: 'Phòng Kinh Doanh',
            code: 'BIZ',
            manager_id: 30,
          })
        );
        expect(handleSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('DepartmentManagementView Authorization and Data States', () => {
    it('blocks regular users with 403 Access Denied screen', () => {
      useAuthStore.setState({
        user: {
          id: 5,
          name: 'Regular User',
          username: 'regular',
          system_role: 'user',
        } as any,
      });

      render(
        <MemoryRouter initialEntries={['/admin/departments']}>
          <DepartmentManagementView />
        </MemoryRouter>
      );

      expect(screen.getByText(/Truy Cập Bị Từ Chối \(403\)/i)).toBeDefined();
      expect(screen.getByText(/chỉ dành riêng cho Quản trị viên hệ thống/i)).toBeDefined();
    });

    it('shows loading indicator and renders department list and stats for admin', async () => {
      useAuthStore.setState({
        user: {
          id: 1,
          name: 'System Admin',
          username: 'sysadmin',
          system_role: 'system_admin',
        } as any,
      });

      (departmentsApi.getDepartments as any).mockResolvedValue({
        departments: {
          data: [
            {
              id: 1,
              name: 'Phòng Kỹ Thuật',
              code: 'TECH',
              description: 'Phát triển phần mềm',
              status: 'active',
              color: '#3b82f6',
              employees_count: 5,
              manager: {
                id: 10,
                name: 'Trần Văn Trưởng',
                username: 'truongtv',
                email: 'truong@danava.vn',
              },
              updated_at: '2026-10-19T10:00:00Z',
              created_at: '2026-10-19T08:00:00Z',
            },
          ],
          total: 1,
          last_page: 1,
        },
        summary: {
          total_departments: 1,
          active_departments: 1,
          assigned_employees: 5,
          unassigned_employees: 2,
        },
      });

      render(
        <MemoryRouter initialEntries={['/admin/departments']}>
          <DepartmentManagementView />
        </MemoryRouter>
      );

      // Loading state or immediately rendered items
      await waitFor(() => {
        expect(screen.getByText('Quản lý phòng ban')).toBeDefined();
        expect(screen.getByText('Phòng Kỹ Thuật')).toBeDefined();
        expect(screen.getByText('TECH')).toBeDefined();
        expect(screen.getByText('Trần Văn Trưởng')).toBeDefined();
      });
    });

    it('shows empty state when no departments exist', async () => {
      useAuthStore.setState({
        user: {
          id: 1,
          name: 'System Admin',
          username: 'sysadmin',
          system_role: 'admin',
        } as any,
      });

      (departmentsApi.getDepartments as any).mockResolvedValue({
        departments: {
          data: [],
          total: 0,
          last_page: 1,
        },
        summary: {
          total_departments: 0,
          active_departments: 0,
          assigned_employees: 0,
          unassigned_employees: 0,
        },
      });

      render(
        <MemoryRouter initialEntries={['/admin/departments']}>
          <DepartmentManagementView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Không có phòng ban nào')).toBeDefined();
      });
    });
  });

  describe('EmployeeTransferModal Transfer Confirmation', () => {
    it('renders employee transfer modal and calls transfer API upon confirmation', async () => {
      const u = userEvent.setup();
      const handleSuccess = vi.fn();

      (departmentsApi.getDepartmentOptions as any).mockResolvedValue([
        { id: 1, name: 'Phòng Kỹ Thuật', code: 'TECH', color: '#3b82f6' },
        { id: 2, name: 'Phòng Kinh Doanh', code: 'SALES', color: '#10b981' },
      ]);
      (departmentsApi.transferEmployeeDepartment as any).mockResolvedValue({
        message: 'Đã điều chuyển nhân viên thành công',
      });

      const mockEmployee = {
        id: 20,
        name: 'Nguyễn Nhân Viên',
        username: 'nhanvien',
        email: 'nv@danava.vn',
        department_id: 1,
        department: {
          id: 1,
          name: 'Phòng Kỹ Thuật',
          code: 'TECH',
          color: '#3b82f6',
        },
      };

      render(
        <EmployeeTransferModal
          isOpen={true}
          onClose={vi.fn()}
          employees={[mockEmployee as any]}
          currentDepartmentId={1}
          onSuccess={handleSuccess}
        />
      );

      // Verify modal elements
      expect(screen.getByText('Điều chuyển nhân viên')).toBeDefined();
      expect(screen.getByText('Nguyễn Nhân Viên')).toBeDefined();

      // Wait for department options to load in select
      await waitFor(() => {
        expect(screen.getByText(/Phòng Kinh Doanh \(SALES\)/i)).toBeDefined();
      });

      // Select destination department
      const select = screen.getByRole('combobox');
      await u.selectOptions(select, '2');

      // Click Confirm Transfer
      const confirmBtn = screen.getByRole('button', { name: /Xác nhận điều chuyển/i });
      await u.click(confirmBtn);

      await waitFor(() => {
        expect(departmentsApi.transferEmployeeDepartment).toHaveBeenCalledWith(20, 2);
        expect(handleSuccess).toHaveBeenCalled();
      });
    });
  });
});
