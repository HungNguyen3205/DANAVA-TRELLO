import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Search, ShieldAlert,
  MoreVertical, Lock, Unlock, KeyRound, UserPlus
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
      toast.success('Đã cập nhật trạng thái');
      fetchEmployees();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
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

      <div className="flex-1 overflow-auto bg-white border border-border rounded-xl shadow-sm">
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
                <th className="px-6 py-3">Nhân viên</th>
                <th className="px-6 py-3">Vai trò</th>
                <th className="px-6 py-3">Trạng thái</th>
                <th className="px-6 py-3">Workspaces</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/10 transition-colors group">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">@{emp.username} {emp.email && `• ${emp.email}`}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${emp.system_role === 'system_admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {emp.system_role === 'system_admin' ? <ShieldAlert size={12} /> : <Users size={12} />}
                      {emp.system_role === 'system_admin' ? 'System Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${emp.account_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.account_status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {emp.workspaces_count} không gian
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setShowResetModal(emp.id)}
                        className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"
                        title="Đặt lại mật khẩu"
                      >
                        <KeyRound size={16} />
                      </button>
                      {emp.account_status === 'active' ? (
                        <button 
                          onClick={() => handleUpdateStatus(emp.id, 'locked')}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Khóa tài khoản"
                        >
                          <Lock size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateStatus(emp.id, 'active')}
                          className="p-1.5 text-green-600 hover:bg-green-600/10 rounded-md transition-colors"
                          title="Mở khóa tài khoản"
                        >
                          <Unlock size={16} />
                        </button>
                      )}
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
            <label className="block text-sm font-medium text-foreground mb-1">Username</label>
            <input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary" />
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
