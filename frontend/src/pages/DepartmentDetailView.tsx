import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, ArrowLeft, Users, UserCheck, CheckCircle2, Clock,
  AlertTriangle, Award, Edit2, ArrowRightLeft, UserMinus, Plus,
  Calendar, Shield, ShieldAlert, Activity, RefreshCw, AlertCircle, ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getDepartmentDetails, removeDepartmentEmployee, assignDepartmentEmployees } from '../lib/api/departments';
import type { DepartmentDetailResponse } from '../lib/api/departments';
import type { User } from '../types';
import { DepartmentModal } from '../components/department/DepartmentModal';
import { EmployeeTransferModal } from '../components/department/EmployeeTransferModal';
import { DepartmentTelegramCard } from '../components/department/DepartmentTelegramCard';
import { getAvatarUrl } from '../lib/avatar';
import api from '../lib/axios';
import { toast } from 'sonner';

export const DepartmentDetailView: React.FC = () => {
  const { departmentId } = useParams<{ departmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const isSystemAdmin = user?.system_role === 'system_admin' || user?.system_role === 'admin';

  const [data, setData] = useState<DepartmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transferringEmployee, setTransferringEmployee] = useState<User | null>(null);
  const [isAddEmployeesModalOpen, setIsAddEmployeesModalOpen] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!departmentId || !isSystemAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getDepartmentDetails(departmentId);
      setData(res);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Bạn không có quyền truy cập thông tin phòng ban này.');
      } else {
        setError(err.response?.data?.message || 'Không thể tải thông tin phòng ban.');
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId, isSystemAdmin]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleRemoveEmployee = async (emp: User) => {
    if (!data?.department) return;
    if (!window.confirm(`Bạn có chắc muốn gỡ nhân viên "${emp.name}" khỏi phòng ban "${data.department.name}"?`)) {
      return;
    }

    try {
      const res = await removeDepartmentEmployee(data.department.id, emp.id);
      toast.success(res.message || 'Đã gỡ nhân viên khỏi phòng ban');
      fetchDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi gỡ nhân viên');
    }
  };

  if (!isSystemAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/50">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Truy Cập Bị Từ Chối (403)</h2>
        <p className="text-xs text-slate-500 mb-4">Chỉ Quản trị viên hệ thống mới có quyền xem trang này.</p>
        <button
          onClick={() => navigate('/home')}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Quay lại Trang chủ
        </button>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Đang tải chi tiết phòng ban...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-rose-600 mb-4">{error || 'Không tìm thấy phòng ban.'}</p>
        <button
          onClick={() => navigate('/admin/departments')}
          className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
        >
          Quay lại danh sách phòng ban
        </button>
      </div>
    );
  }

  const { department, employees, statistics, recent_activities } = data;
  const deptColor = department.color || '#6366f1';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 lg:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/departments')}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Link to="/admin/departments" className="hover:text-indigo-600">Phòng ban</Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300 font-bold">{department.name}</span>
          </div>
        </div>

        {/* Department Overview Banner Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-3"
            style={{ backgroundColor: deptColor }}
          />

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pt-2">
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
                style={{ backgroundColor: deptColor }}
              >
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                    {department.name}
                  </h1>
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                    style={{ backgroundColor: `${deptColor}15`, color: deptColor }}
                  >
                    {department.code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      department.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {department.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                  {department.description || 'Chưa cập nhật mô tả chức năng, nhiệm vụ phòng ban.'}
                </p>

                {/* Manager & Created Info */}
                <div className="flex items-center gap-6 mt-4 text-xs flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Trưởng phòng:</span>
                    {department.manager ? (
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center font-bold text-[10px]">
                          {department.manager.avatar ? (
                            <img src={getAvatarUrl(department.manager.avatar)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            department.manager.name?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>
                        <span>{department.manager.name}</span>
                        {department.manager.position && (
                          <span className="text-[11px] font-normal text-slate-400">({department.manager.position})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Chưa chỉ định</span>
                    )}
                  </div>

                  {department.creator && (
                    <div className="text-slate-400 flex items-center gap-1.5">
                      <span>Tạo bởi:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{department.creator.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                <Edit2 className="w-4 h-4 text-slate-500" />
                <span>Chỉnh sửa phòng ban</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5 Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Tổng công việc</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{statistics.total_tasks}</p>
            <p className="text-[11px] text-slate-400 mt-1">Được giao cho nhân sự phòng</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Đã hoàn thành</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{statistics.completed_tasks}</p>
            <p className="text-[11px] text-slate-400 mt-1">Đạt kết quả thực tế</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Đang thực hiện</span>
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">{statistics.incomplete_tasks}</p>
            <p className="text-[11px] text-slate-400 mt-1">Chưa hoàn thành</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Quá hạn</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">{statistics.overdue_tasks}</p>
            <p className="text-[11px] text-slate-400 mt-1">Trễ hạn kế hoạch</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Điểm hiệu suất</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
              {statistics.avg_performance_score !== null ? `${statistics.avg_performance_score}` : '--'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Trung bình các kỳ đánh giá</p>
          </div>
        </div>

        {/* Telegram Department Integration Card */}
        <DepartmentTelegramCard
          departmentId={department.id}
          departmentName={department.name}
        />

        {/* 2 Columns: Employees List & Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main: Employees List (Col Span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    Danh sách nhân viên ({employees.length})
                  </h2>
                  <p className="text-xs text-slate-400">Các nhân viên hiện đang thuộc phòng ban này</p>
                </div>

                <button
                  onClick={() => setIsAddEmployeesModalOpen(true)}
                  disabled={department.status !== 'active'}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Thêm nhân viên</span>
                </button>
              </div>

              {employees.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Phòng ban chưa có nhân viên nào</p>
                  <p className="text-[11px] text-slate-400 mt-1">Bấm nút "Thêm nhân viên" để bắt đầu phân bổ đội ngũ.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3">Nhân sự</th>
                        <th className="px-4 py-3">Chức vụ</th>
                        <th className="px-3 py-3 text-center">Bảng</th>
                        <th className="px-3 py-3 text-center">Tasks</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-5 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {employees.map((emp) => {
                        const isManager = department.manager_id === Number(emp.id);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-600 shrink-0">
                                  {emp.avatar ? (
                                    <img src={getAvatarUrl(emp.avatar)} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    emp.name?.charAt(0).toUpperCase() || 'U'
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{emp.name}</span>
                                    {isManager && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                                        Trưởng phòng
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-mono">@{emp.username}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                              {emp.position || '--'}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              {emp.boards_count || 0}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              {emp.tasks_count || 0}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  emp.account_status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                }`}
                              >
                                {emp.account_status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setTransferringEmployee(emp)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Điều chuyển phòng ban"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRemoveEmployee(emp)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Gỡ khỏi phòng ban"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Recent Activities */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-indigo-500" />
                Hoạt động gần đây
              </h2>

              {recent_activities.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Chưa có ghi nhận hoạt động nào</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                  {recent_activities.map((act) => (
                    <div
                      key={act.id}
                      className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {act.user?.name || 'Hệ thống'}
                        </span>
                        <span>{new Date(act.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {act.action}: <span className="text-indigo-600 dark:text-indigo-400">{act.new_value}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Department Modal */}
        <DepartmentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          department={department}
          onSuccess={fetchDetails}
        />

        {/* Transfer Employee Modal */}
        {transferringEmployee && (
          <EmployeeTransferModal
            isOpen={!!transferringEmployee}
            onClose={() => setTransferringEmployee(null)}
            employees={[transferringEmployee]}
            currentDepartmentId={department.id}
            onSuccess={fetchDetails}
          />
        )}

        {/* Add Employees to Department Modal */}
        <AddEmployeesToDepartmentModal
          isOpen={isAddEmployeesModalOpen}
          onClose={() => setIsAddEmployeesModalOpen(false)}
          departmentId={department.id}
          existingEmployeeIds={employees.map((e) => Number(e.id))}
          onSuccess={fetchDetails}
        />
      </div>
    </div>
  );
};

/**
 * Small helper modal to select and add multiple employees to current department
 */
function AddEmployeesToDepartmentModal({
  isOpen,
  onClose,
  departmentId,
  existingEmployeeIds,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  departmentId: number;
  existingEmployeeIds: number[];
  onSuccess: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadUsers() {
      setLoading(true);
      try {
        const res = await api.get('/users/search?q=');
        if (isMounted) {
          const available = (res.data || []).filter(
            (u: User) => !existingEmployeeIds.includes(Number(u.id)) && u.account_status !== 'locked'
          );
          setUsers(available);
          setSelectedIds([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadUsers();
    return () => { isMounted = false; };
  }, [isOpen, existingEmployeeIds]);

  if (!isOpen) return null;

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAssign = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await assignDepartmentEmployees(departmentId, selectedIds);
      toast.success(res.message || 'Thêm nhân viên vào phòng ban thành công');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Thêm nhân viên vào phòng ban</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 custom-scrollbar">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400">Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">Không có nhân viên phù hợp</div>
            ) : (
              filtered.map((u) => {
                const isSelected = selectedIds.includes(Number(u.id));
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      const uid = Number(u.id);
                      setSelectedIds((prev) =>
                        isSelected ? prev.filter((id) => id !== uid) : [...prev, uid]
                      );
                    }}
                    className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                      isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{u.name}</span>
                      <span className="text-slate-400 ml-1.5 font-mono">@{u.username}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-indigo-600 cursor-pointer"
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-500">
            Hủy
          </button>
          <button
            onClick={handleAssign}
            disabled={selectedIds.length === 0 || submitting}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
          >
            {submitting ? 'Đang thêm...' : `Thêm ${selectedIds.length} nhân viên`}
          </button>
        </div>
      </div>
    </div>
  );
}
