import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useState, useEffect } from 'react';
import api from '../../../lib/axios';
import { toast } from 'sonner';

export function AuthGuard() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [loading, setLoading] = useState(!user && isAuthenticated);
  
  useEffect(() => {
    if (isAuthenticated && !user) {
      checkAuth().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user, checkAuth]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <>
      <Outlet />
      {user?.must_change_password && <ForceChangePasswordModal />}
    </>
  );
}

function ForceChangePasswordModal() {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkAuth = useAuthStore(state => state.checkAuth);
  const logout = useAuthStore(state => state.logout);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/auth/change-password', { password });
      toast.success('Đổi mật khẩu thành công!');
      await checkAuth(); // refresh user info
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi đổi mật khẩu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border p-8 text-center animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Đổi mật khẩu bắt buộc</h2>
        <p className="text-muted-foreground mb-8 text-sm">
          Vì lý do bảo mật, bạn bắt buộc phải đổi mật khẩu tạm thời thành mật khẩu cá nhân mới có thể tiếp tục sử dụng hệ thống.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <label className="block text-sm font-medium text-foreground mb-1">Mật khẩu mới</label>
            <input 
              required 
              type="password" 
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              placeholder="Nhập ít nhất 8 ký tự..."
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
          >
            {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </form>

        <button 
          onClick={() => logout()}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors underline"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
