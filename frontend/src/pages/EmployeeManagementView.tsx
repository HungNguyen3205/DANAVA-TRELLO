import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Search, ShieldAlert,
  Lock, Unlock, KeyRound, UserPlus, Trash2, User
} from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'sonner';

export function EmployeeManagementView() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/employees', {
        params: { search: searchQuery, status: filterStatus }
      });
      setEmployees(res.data.data || []);
    } catch (e: any) {
      if (e.response?.status === 403) {
        toast.error('Bạn không có quyền truy cập');
      } else {
        toast.error('Lỗi tải danh sách nhân viên');
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus]);

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
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản "${name}" khỏi hệ thống?`)) return;
    try {
      await api.delete(`/admin/employees/${userId}`);
      toast.success('Đã xóa tài khoản thành công');
      fetchEmployees();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi xóa tài khoản');
    }
  };

  return (
    <div className="flex-1 overflow-hidden h-full flex flex-col relative bg-background p-6 lg:p-10 max-w-7xl mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between shrink-0 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={28} className="text-primary" /> Quản lý nhân viên
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý tài khoản, phân quyền và bảo mật toàn hệ thống.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9 pr-3 py-2 text-[13px] bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="py-2 px-3 text-[13px] bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-[#5B4BD6] rounded-xl transition-all shadow-sm"
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
                <th className="px-6 py-3.5">Họ và tên</th>
                <th className="px-6 py-3.5">Tên tài khoản</th>
                <th className="px-6 py-3.5">Vai trò</th>
                <th className="px-6 py-3.5">Trạng thái</th>
                <th className="px-6 py-3.5">Không gian</th>
                <th className="px-6 py-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                        {emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{emp.name}</div>
                        {emp.email && (
                          <div className="text-xs text-muted-foreground truncate">{emp.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-mono text-xs font-semibold">
                      <User size={13} className="shrink-0" />
                      {emp.username?.startsWith('@') ? emp.username : `@${emp.username}`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${emp.system_role === 'system_admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {emp.system_role === 'system_admin' ? <ShieldAlert size={12} /> : <Users size={12} />}
                      {emp.system_role === 'system_admin' ? 'System Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${emp.account_status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                      {emp.account_status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                    {emp.workspaces_count} không gian
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setShowResetModal(emp.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 border border-border rounded-lg transition-colors shadow-xs"
                        title="Đổi mật khẩu"
                      >
                        <KeyRound size={14} className="text-amber-600 dark:text-amber-400" />
                        <span>Đổi MK</span>
                      </button>
                      
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
                          <span>Mở khóa</span>
                        </button>
                      )}

                      <button 
                        onClick={() => handleDeleteEmployee(emp.id, emp.name || emp.username)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-800/40 rounded-lg transition-colors shadow-xs"
                        title="Xóa tài khoản khỏi hệ thống"
                      >
                        <Trash2 size={14} />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <CreateEmployeeModal onClose={() => setShowAddModal(false)} onCreated={fetchEmployees} />
      )}
      {showResetModal && (
        <ResetPasswordModal userId={showResetModal} onClose={() => setShowResetModal(null)} />
      )}
    </div>
  );
}

function CreateEmployeeModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/admin/employees', { username, password, system_role: role });
      toast.success('Đã tạo tài khoản');
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
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Tạo tài khoản mới</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-md">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Username (Tài khoản)</label>
            <div className="relative">
              <input required type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="VD: namhung" className="w-full pl-3 pr-[100px] py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                @danava.vn
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Chỉ cần nhập tên, hệ thống tự động gắn đuôi email <b>@danava.vn</b>. Nhân viên có thể đăng nhập bằng tên ngắn hoặc email đều được.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Mật khẩu tạm</label>
            <input required type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <p className="text-xs text-muted-foreground mt-1">Người dùng sẽ bị ép đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Vai trò hệ thống</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="user">Người dùng (User)</option>
              <option value="admin">Quản trị viên (System Admin)</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">Tạo tài khoản</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/admin/employees/${userId}/reset-password`, { password });
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
            <label className="block text-sm font-medium text-foreground mb-1">Mật khẩu mới</label>
            <input required type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <p className="text-xs text-muted-foreground mt-1">Người dùng sẽ bị ép đổi mật khẩu lại và đăng xuất khỏi mọi thiết bị.</p>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">Xác nhận</button>
          </div>
        </form>
      </div>
    </div>
  );
}
