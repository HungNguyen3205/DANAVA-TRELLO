import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Search, ShieldAlert,
  Lock, Unlock, KeyRound, UserPlus, Trash2, Edit2, Briefcase, Mail, Phone, Calendar,
  Building2, ArrowRightLeft
} from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'sonner';
import { getAvatarUrl } from '../lib/avatar';
import { getDepartmentOptions, type DepartmentOption } from '../lib/api/departments';
import { EmployeeTransferModal } from '../components/department/EmployeeTransferModal';

export function EmployeeManagementView() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [transferringEmployees, setTransferringEmployees] = useState<any[] | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [showResetModal, setShowResetModal] = useState<string | null>(null);

  useEffect(() => {
    getDepartmentOptions().then(setDepartments).catch(console.error);
  }, []);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/employees', {
        params: { search: searchQuery, status: filterStatus, department_id: filterDepartment }
      });
      setEmployees(res.data.data || []);
      setSelectedEmployeeIds([]);
    } catch (e: any) {
      if (e.response?.status === 403) {
        toast.error('Bạn không có quyền truy cập');
      } else {
        toast.error('Lỗi tải danh sách nhân viên');
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus, filterDepartment]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      await api.patch(`/admin/employees/${userId}/status`, { status: newStatus });
      toast.success(newStatus === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
      fetchEmployees();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleDeleteEmployee = async (userId: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mềm tài khoản "${name}" khỏi hệ thống?`)) return;
    try {
      await api.delete(`/admin/employees/${userId}`);
      toast.success('Đã xóa mềm tài khoản thành công');
      fetchEmployees();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi xóa tài khoản');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedEmployeeIds.length === employees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(employees.map(e => String(e.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 overflow-hidden h-full flex flex-col relative bg-background p-6 lg:p-10 max-w-7xl mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between shrink-0 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={28} className="text-primary" /> Quản lý nhân viên
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý tài khoản, phân quyền và bảo mật toàn hệ thống (Dành riêng cho System Admin).
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Tìm theo tên, username, chức vụ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9 pr-3 py-2 text-[13px] bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>

          {/* Department Filter */}
          <select 
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="py-2 px-3 text-[13px] bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
          >
            <option value="">Tất cả phòng ban</option>
            <option value="unassigned">Chưa phân phòng</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="py-2 px-3 text-[13px] bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>

          {selectedEmployeeIds.length > 0 && (
            <button
              onClick={() => {
                const selected = employees.filter((e) => selectedEmployeeIds.includes(String(e.id)));
                setTransferringEmployees(selected);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 rounded-xl transition-all shadow-xs"
            >
              <ArrowRightLeft size={15} />
              Chuyển phòng ban ({selectedEmployeeIds.length})
            </button>
          )}

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm shrink-0"
          >
            <UserPlus size={16} />
            Tạo tài khoản
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-card border border-border rounded-xl shadow-sm">
        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground animate-pulse">Đang tải...</div>
        ) : employees.length === 0 ? (
          <div className="text-center p-12">
            <Users size={48} className="mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Không tìm thấy tài khoản nào</h3>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={employees.length > 0 && selectedEmployeeIds.length === employees.length}
                    onChange={handleToggleSelectAll}
                    className="rounded text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3.5">Họ và tên & Tài khoản</th>
                <th className="px-5 py-3.5">Phòng ban</th>
                <th className="px-5 py-3.5">Chức vụ</th>
                <th className="px-4 py-3.5">Vai trò</th>
                <th className="px-4 py-3.5 text-center">Trạng thái</th>
                <th className="px-4 py-3.5 text-center">Bảng tham gia</th>
                <th className="px-6 py-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {employees.map((emp) => {
                const isSelected = selectedEmployeeIds.includes(String(emp.id));
                return (
                  <tr key={emp.id} className={`hover:bg-muted/40 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="w-10 px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(String(emp.id))}
                        className="rounded text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 overflow-hidden">
                          {emp.avatar ? (
                            <img src={getAvatarUrl(emp.avatar)} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            emp.name ? emp.name.charAt(0).toUpperCase() : 'U'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{emp.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate flex items-center gap-1.5">
                            <span>@{emp.username}</span>
                            {emp.email && (
                              <>
                                <span>•</span>
                                <span className="font-sans text-muted-foreground/80">{emp.email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {emp.department ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            backgroundColor: emp.department.color ? `${emp.department.color}18` : '#6366f118',
                            color: emp.department.color || '#6366f1',
                          }}
                        >
                          <Building2 size={13} />
                          {emp.department.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Chưa phân phòng
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-foreground bg-accent/60 px-2.5 py-1 rounded-md">
                        {emp.position || 'Chưa cập nhật'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${emp.system_role === 'system_admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {emp.system_role === 'system_admin' ? <ShieldAlert size={13} /> : <Users size={13} />}
                        {emp.system_role === 'system_admin' ? 'System Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-xs ${
                        emp.account_status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.account_status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {emp.account_status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap" title={`${emp.boards_count ?? 0} bảng công việc`}>
                        {emp.boards_count ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Transfer Department */}
                        <button
                          onClick={() => setTransferringEmployees([emp])}
                          className="inline-flex items-center justify-center p-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-800/40 rounded-lg transition-colors shadow-xs"
                          title="Điều chuyển phòng ban"
                        >
                          <ArrowRightLeft size={15} />
                        </button>

                        {/* Edit Employee Info */}
                        <button 
                          onClick={() => setEditingEmployee(emp)}
                          className="inline-flex items-center justify-center p-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-800/40 rounded-lg transition-colors shadow-xs"
                          title="Sửa thông tin tài khoản"
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* Reset Password */}
                        <button 
                          onClick={() => setShowResetModal(emp.id)}
                          className="inline-flex items-center justify-center p-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-800/40 rounded-lg transition-colors shadow-xs"
                          title="Đặt lại mật khẩu"
                        >
                          <KeyRound size={15} />
                        </button>
                        
                        {/* Lock / Unlock */}
                        {emp.account_status === 'active' ? (
                          <button 
                            onClick={() => handleUpdateStatus(emp.id, 'locked')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-800/40 rounded-lg transition-colors shadow-xs"
                            title="Khóa tài khoản"
                          >
                            <Lock size={14} />
                            <span>Khóa</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleUpdateStatus(emp.id, 'active')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 hover:bg-green-100 dark:bg-green-500/10 dark:hover:bg-green-500/20 border border-green-200 dark:border-green-800/40 rounded-lg transition-colors shadow-xs"
                            title="Mở khóa tài khoản"
                          >
                            <Unlock size={14} />
                            <span>Mở</span>
                          </button>
                        )}

                        {/* Soft Delete */}
                        <button 
                          onClick={() => handleDeleteEmployee(emp.id, emp.name || emp.username)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-800/40 rounded-lg transition-colors shadow-xs"
                          title="Xóa mềm tài khoản"
                        >
                          <Trash2 size={14} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <CreateEmployeeModal
          departments={departments}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchEmployees}
        />
      )}
      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          departments={departments}
          onClose={() => setEditingEmployee(null)}
          onUpdated={fetchEmployees}
        />
      )}
      {showResetModal && (
        <ResetPasswordModal userId={showResetModal} onClose={() => setShowResetModal(null)} />
      )}
      {transferringEmployees && (
        <EmployeeTransferModal
          isOpen={!!transferringEmployees}
          onClose={() => setTransferringEmployees(null)}
          employees={transferringEmployees}
          currentDepartmentId={transferringEmployees[0]?.department_id}
          onSuccess={fetchEmployees}
        />
      )}
    </div>
  );
}

function CreateEmployeeModal({
  departments,
  onClose,
  onCreated,
}: {
  departments: DepartmentOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState('user');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Mật khẩu tạm phải có tối thiểu 8 ký tự');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/admin/employees', { 
        name: name.trim(),
        username: username.trim(), 
        password,
        email: email.trim() ? email.trim() : null,
        position: position.trim() ? position.trim() : null,
        system_role: role,
        department_id: departmentId ? Number(departmentId) : null,
      });
      toast.success('Đã tạo tài khoản nhân viên thành công');
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi tạo tài khoản');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Cấp tài khoản nhân viên mới</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Tài khoản mới sẽ có trạng thái Hoạt động và bắt buộc đổi mật khẩu lần đầu.</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-md">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Tên hiển thị <span className="text-rose-500">*</span>
              </label>
              <input 
                required 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="VD: Nguyễn Văn A" 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Username (Tên đăng nhập) <span className="text-rose-500">*</span>
              </label>
              <input 
                required 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="VD: nguyenvana" 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
              <p className="text-[11px] text-muted-foreground mt-1">Dùng để đăng nhập, viết liền không dấu.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Mật khẩu tạm thời <span className="text-rose-500">*</span>
              </label>
              <input 
                required 
                minLength={8} 
                type="text" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Tối thiểu 8 ký tự"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
              <p className="text-[11px] text-muted-foreground mt-1">Tối thiểu 8 ký tự.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Email liên hệ (Tùy chọn)
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="VD: vana@company.com" 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Chức vụ (Tùy chọn)</label>
              <input 
                type="text" 
                value={position} 
                onChange={e => setPosition(e.target.value)} 
                placeholder="VD: Kỹ sư phần mềm" 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Phòng ban (Tùy chọn)</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">-- Chưa phân phòng --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Vai trò hệ thống</label>
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)} 
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="user">Người dùng (User)</option>
              <option value="system_admin">Quản trị viên (System Admin)</option>
            </select>
          </div>

          <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Thiết lập mặc định theo chính sách:</div>
            <div>• Trạng thái tài khoản: <b>Hoạt động (Active)</b></div>
            <div>• Lần đăng nhập đầu tiên: <b>Bắt buộc đổi mật khẩu</b></div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm disabled:opacity-50">
              {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditEmployeeModal({
  employee,
  departments,
  onClose,
  onUpdated,
}: {
  employee: any;
  departments: DepartmentOption[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(employee.name || '');
  const [username, setUsername] = useState(employee.username || '');
  const [email, setEmail] = useState(employee.email || '');
  const [position, setPosition] = useState(employee.position || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [role, setRole] = useState(employee.system_role || 'user');
  const [status, setStatus] = useState(employee.account_status || 'active');
  const [departmentId, setDepartmentId] = useState<string>(employee.department_id ? String(employee.department_id) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.put(`/admin/employees/${employee.id}`, {
        name: name.trim(),
        username: username.trim(),
        email: email.trim() ? email.trim() : null,
        position: position.trim() ? position.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        system_role: role,
        account_status: status,
        department_id: departmentId ? Number(departmentId) : null,
      });
      toast.success('Cập nhật tài khoản thành công');
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi cập nhật tài khoản');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Sửa thông tin tài khoản</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-md">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Tên hiển thị <span className="text-rose-500">*</span>
              </label>
              <input 
                required 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Username <span className="text-rose-500">*</span>
              </label>
              <input 
                required 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="vana@company.com"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Số điện thoại</label>
              <input 
                type="tel" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="09..."
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Chức vụ</label>
              <input 
                type="text" 
                value={position} 
                onChange={e => setPosition(e.target.value)} 
                placeholder="VD: Kỹ sư..."
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Phòng ban</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">-- Chưa phân phòng --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Vai trò</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)} 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="user">User</option>
                <option value="system_admin">System Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Trạng thái</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)} 
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="active">Hoạt động</option>
                <option value="locked">Bị khóa</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm disabled:opacity-50">
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/admin/employees/${userId}/reset-password`, { 
        password,
        must_change_password: mustChangePassword 
      });
      toast.success('Đã đặt lại mật khẩu thành công');
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi đặt lại mật khẩu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Đặt lại mật khẩu</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-md">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Mật khẩu mới (Tối thiểu 8 ký tự) <span className="text-rose-500">*</span></label>
            <input 
              required 
              minLength={8} 
              type="text" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Nhập tối thiểu 8 ký tự"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="must_change_reset" 
              checked={mustChangePassword} 
              onChange={e => setMustChangePassword(e.target.checked)} 
              className="rounded border-border text-primary focus:ring-primary/20 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="must_change_reset" className="text-xs text-muted-foreground cursor-pointer select-none !mb-0">
              Bắt buộc nhân viên đổi mật khẩu ở lần đăng nhập tiếp theo
            </label>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm disabled:opacity-50">
              {isSubmitting ? 'Đang cập nhật...' : 'Xác nhận đặt lại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
