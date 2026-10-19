import api from '../axios';
import type { Department, User } from '../../types';

export interface DepartmentSummaryStats {
  total_departments: number;
  active_departments: number;
  assigned_employees: number;
  unassigned_employees: number;
}

export interface DepartmentListResponse {
  departments: {
    data: Department[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
  summary: DepartmentSummaryStats;
}

export interface DepartmentStatistics {
  total_employees: number;
  active_employees: number;
  total_tasks: number;
  completed_tasks: number;
  incomplete_tasks: number;
  overdue_tasks: number;
  completed_on_time: number;
  avg_performance_score: number | null;
}

export interface DepartmentDetailResponse {
  department: Department;
  employees: (User & { boards_count?: number; tasks_count?: number })[];
  stats?: DepartmentStatistics;
  statistics: DepartmentStatistics;
  recent_activities: any[];
}

export interface DepartmentOption {
  id: number;
  name: string;
  code: string;
  color?: string | null;
}

/**
 * Get paginated list of departments with optional search and status filter
 */
export async function getDepartments(params?: {
  search?: string;
  status?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}): Promise<DepartmentListResponse> {
  const res = await api.get('/admin/departments', { params });
  return res.data;
}

/**
 * Get detailed department info, employee list, real metrics and logs
 */
export async function getDepartmentDetails(id: number | string): Promise<DepartmentDetailResponse> {
  const res = await api.get(`/admin/departments/${id}`);
  return res.data;
}

/**
 * Create a new department
 */
export async function createDepartment(data: {
  name: string;
  code: string;
  description?: string;
  color?: string;
  manager_id?: number | null;
  status?: 'active' | 'inactive';
  employee_ids?: number[];
}): Promise<{ message: string; department: Department }> {
  const res = await api.post('/admin/departments', data);
  return res.data;
}

/**
 * Update department
 */
export async function updateDepartment(
  id: number | string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    color?: string;
    manager_id?: number | null;
    status?: 'active' | 'inactive';
  }
): Promise<{ message: string; department: Department }> {
  const res = await api.put(`/admin/departments/${id}`, data);
  return res.data;
}

/**
 * Soft delete department
 */
export async function deleteDepartment(id: number | string): Promise<{ message: string }> {
  const res = await api.delete(`/admin/departments/${id}`);
  return res.data;
}

/**
 * Restore soft-deleted department
 */
export async function restoreDepartment(id: number | string): Promise<{ message: string; department: Department }> {
  const res = await api.patch(`/admin/departments/${id}/restore`);
  return res.data;
}

/**
 * Assign employees to department
 */
export async function assignDepartmentEmployees(
  departmentId: number | string,
  userIds: (number | string)[]
): Promise<{ message: string; transferred_count: number }> {
  const res = await api.post(`/admin/departments/${departmentId}/employees`, {
    user_ids: userIds,
  });
  return res.data;
}

/**
 * Remove employee from department
 */
export async function removeDepartmentEmployee(
  departmentId: number | string,
  userId: number | string
): Promise<{ message: string }> {
  const res = await api.delete(`/admin/departments/${departmentId}/employees/${userId}`);
  return res.data;
}

/**
 * Transfer single employee to another department or unassign
 */
export async function transferEmployeeDepartment(
  userId: number | string,
  departmentId: number | string | null
): Promise<{ message: string; user: User }> {
  const res = await api.patch(`/admin/employees/${userId}/department`, {
    department_id: departmentId,
  });
  return res.data;
}

/**
 * Bulk transfer multiple employees
 */
export async function bulkTransferEmployees(
  userIds: (number | string)[],
  departmentId: number | string | null
): Promise<{ message: string; transferred_count: number }> {
  const res = await api.post('/admin/employees/bulk-department', {
    user_ids: userIds,
    department_id: departmentId,
  });
  return res.data;
}

/**
 * Minimal active department options for dropdowns
 */
export async function getDepartmentOptions(): Promise<DepartmentOption[]> {
  try {
    const res = await api.get('/departments/options');
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (Array.isArray(res.data?.data)) {
      return res.data.data;
    }
    return [];
  } catch (err) {
    console.warn('Could not load department options:', err);
    return [];
  }
}
