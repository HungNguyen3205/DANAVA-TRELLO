import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, Plus, Search, Filter, ArrowUpDown, LayoutGrid, Table as TableIcon,
  Users, UserCheck, MoreVertical, Edit2, Power, Trash2, ExternalLink,
  ShieldAlert, RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getDepartments, deleteDepartment, updateDepartment } from '../lib/api/departments';
import type { Department } from '../types';
import type { DepartmentSummaryStats } from '../lib/api/departments';
import { DepartmentModal } from '../components/department/DepartmentModal';
import { getAvatarUrl } from '../lib/avatar';
import { toast } from 'sonner';

export const DepartmentManagementView: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const isSystemAdmin = user?.system_role === 'system_admin' || user?.system_role === 'admin';

  // State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [summary, setSummary] = useState<DepartmentSummaryStats>({
    total_departments: 0,
    active_departments: 0,
    assigned_employees: 0,
    unassigned_employees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const fetchDepartments = useCallback(async () => {
    if (!isSystemAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDepartments({
        search,
        status: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        per_page: 20,
      });
      setDepartments(data.departments.data || []);
      setSummary(data.summary);
      setTotalPages(data.departments.last_page || 1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Bạn không có quyền truy cập trang quản trị này.');
      } else {
        setError(err.response?.data?.message || 'Không thể tải danh sách phòng ban.');
      }
    } finally {
      setLoading(false);
    }
  }, [isSystemAdmin, search, statusFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Click outside to close actions menu
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleToggleStatus = async (dept: Department) => {
    const newStatus = dept.status === 'active' ? 'inactive' : 'active';
    const actionText = newStatus === 'active' ? 'kích hoạt' : 'ngừng hoạt động';

    if (dept.status === 'active' && (dept.employees_count || 0) > 0) {
      const confirmed = window.confirm(
        `Phòng ban "${dept.name}" hiện đang có ${dept.employees_count} nhân viên. Bạn có chắc muốn chuyển sang trạng thái ngừng hoạt động? Nhân viên vẫn sẽ tạm thời ở trong phòng ban này nhưng không thể thêm người mới.`
      );
      if (!confirmed) return;
    } else {
      if (!window.confirm(`Bạn có chắc muốn ${actionText} phòng ban "${dept.name}"?`)) {
        return;
      }
    }

    try {
      await updateDepartment(dept.id, { status: newStatus });
      toast.success(`Đã ${actionText} phòng ban "${dept.name}" thành công`);
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Lỗi khi ${actionText} phòng ban`);
    }
  };

  const handleDelete = async (dept: Department) => {
    if ((dept.employees_count || 0) > 0) {
      toast.error(`Phòng ban đang có ${dept.employees_count} nhân viên. Vui lòng điều chuyển nhân viên trước khi xóa.`);
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa mềm phòng ban "${dept.name}"?`)) {
      return;
    }

    try {
      const res = await deleteDepartment(dept.id);
      toast.success(res.message || 'Xóa phòng ban thành công');
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa phòng ban');
    }
  };

  // If user is not system admin, show clear 403 access restricted view
  if (!isSystemAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/50">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Truy Cập Bị Từ Chối (403)</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-6">
          Khu vực quản lý phòng ban chỉ dành riêng cho Quản trị viên hệ thống (System Admin).
        </p>
        <button
          onClick={() => navigate('/home')}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all"
        >
          Quay lại Trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 lg:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">
              <span>Admin</span>
              <span>/</span>
              <span className="text-indigo-600 dark:text-indigo-400">Phòng ban</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Quản lý phòng ban
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Quản lý cơ cấu tổ chức, nhân sự phòng ban và phân bổ đội ngũ (System Admin).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingDepartment(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tạo phòng ban</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tổng phòng ban</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{summary.total_departments}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Đang hoạt động</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{summary.active_departments}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Đã phân phòng</p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">{summary.assigned_employees}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chưa phân phòng</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{summary.unassigned_employees}</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hoặc mã phòng ban..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-700 dark:text-slate-300"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>

            {/* Sắp xếp */}
            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-700 dark:text-slate-300"
              >
                <option value="created_at">Mới tạo gần nhất</option>
                <option value="name">Tên phòng ban</option>
                <option value="employees_count">Số lượng nhân viên</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Dạng lưới"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Dạng bảng"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchDepartments}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content View: Loading / Error / Empty / Grid / Table */}
        {loading && departments.length === 0 ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Đang tải danh sách phòng ban...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">{error}</p>
            <button
              onClick={fetchDepartments}
              className="mt-3 px-4 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-xl"
            >
              Thử lại
            </button>
          </div>
        ) : departments.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Không có phòng ban nào</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || statusFilter
                ? 'Không tìm thấy phòng ban phù hợp với bộ lọc hiện tại.'
                : 'Hệ thống chưa có phòng ban. Bắt đầu bằng cách tạo phòng ban đầu tiên.'}
            </p>
            {!search && !statusFilter && (
              <button
                onClick={() => {
                  setEditingDepartment(null);
                  setIsModalOpen(true);
                }}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                + Tạo phòng ban ngay
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {departments.map((dept) => {
              const deptColor = dept.color || '#6366f1';
              return (
                <div
                  key={dept.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col relative group"
                >
                  {/* Top Color Accent */}
                  <div className="h-2 w-full" style={{ backgroundColor: deptColor }} />

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Code Badge & Actions */}
                      <div className="flex items-center justify-between mb-2.5">
                        <span
                          className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold"
                          style={{
                            backgroundColor: `${deptColor}15`,
                            color: deptColor,
                          }}
                        >
                          {dept.code}
                        </span>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              dept.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {dept.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
                          </span>

                          {/* 3-dots Menu */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === dept.id ? null : dept.id);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuId === dept.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1 text-xs"
                              >
                                <button
                                  onClick={() => {
                                    setEditingDepartment(dept);
                                    setIsModalOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Sửa thông tin</span>
                                </button>

                                <button
                                  onClick={() => {
                                    handleToggleStatus(dept);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                                >
                                  <Power className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{dept.status === 'active' ? 'Ngừng hoạt động' : 'Kích hoạt lại'}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    handleDelete(dept);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa mềm</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <Link
                        to={`/admin/departments/${dept.id}`}
                        className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                      >
                        {dept.name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[2rem]">
                        {dept.description || 'Chưa có mô tả nhiệm vụ cho phòng ban này.'}
                      </p>
                    </div>

                    {/* Meta: Manager & Employees Count */}
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Trưởng phòng:</span>
                        {dept.manager ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center font-bold text-[9px] text-slate-600 shrink-0">
                              {dept.manager.avatar ? (
                                <img src={getAvatarUrl(dept.manager.avatar)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                dept.manager.name?.charAt(0).toUpperCase() || 'U'
                              )}
                            </div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 max-w-[130px] truncate">
                              {dept.manager.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa chỉ định</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Nhân sự:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-500" />
                          {dept.employees_count || 0} nhân viên
                        </span>
                      </div>

                      {/* Bottom Button */}
                      <div className="pt-2">
                        <Link
                          to={`/admin/departments/${dept.id}`}
                          className="w-full py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>Xem chi tiết & Nhân sự</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3.5">Phòng ban</th>
                    <th className="px-4 py-3.5">Mã</th>
                    <th className="px-4 py-3.5">Trưởng phòng</th>
                    <th className="px-4 py-3.5 text-center">Số nhân viên</th>
                    <th className="px-4 py-3.5 text-center">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {departments.map((dept) => {
                    const deptColor = dept.color || '#6366f1';
                    return (
                      <tr key={dept.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-8 rounded-full shrink-0" style={{ backgroundColor: deptColor }} />
                            <div>
                              <Link
                                to={`/admin/departments/${dept.id}`}
                                className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                              >
                                {dept.name}
                              </Link>
                              {dept.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 max-w-sm">{dept.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-600 dark:text-slate-300">
                          {dept.code}
                        </td>
                        <td className="px-4 py-3.5">
                          {dept.manager ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center font-bold text-[10px]">
                                {dept.manager.avatar ? (
                                  <img src={getAvatarUrl(dept.manager.avatar)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  dept.manager.name?.charAt(0).toUpperCase() || 'U'
                                )}
                              </div>
                              <span className="font-medium text-slate-800 dark:text-slate-200">{dept.manager.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa chỉ định</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                          {dept.employees_count || 0}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              dept.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {dept.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/admin/departments/${dept.id}`}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Xem chi tiết"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => {
                                setEditingDepartment(dept);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(dept)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Đổi trạng thái"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(dept)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Xóa mềm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        <DepartmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          department={editingDepartment}
          onSuccess={fetchDepartments}
        />
      </div>
    </div>
  );
};
