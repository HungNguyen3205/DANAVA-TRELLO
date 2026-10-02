import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Bell, LogOut, Check, Smartphone, ArrowRight, UserCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';

export const SettingsPage = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Notifications state
  const [prefs, setPrefs] = useState({
    assigned: true,
    approaching_due: true,
    due_today: true,
    overdue: true,
  });
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  // Sessions state
  const [loadingLogout, setLoadingLogout] = useState(false);

  useEffect(() => {
    if (user?.notification_preferences) {
      setPrefs({
        assigned: user.notification_preferences.assigned ?? true,
        approaching_due: user.notification_preferences.approaching_due ?? true,
        due_today: user.notification_preferences.due_today ?? true,
        overdue: user.notification_preferences.overdue ?? true,
      });
    }
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoadingPassword(true);
    try {
      await api.post('/account/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      toast.success('Đổi mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      if (e.response?.data?.errors?.current_password) {
        toast.error(e.response.data.errors.current_password[0]);
      } else {
        toast.error('Lỗi khi đổi mật khẩu');
      }
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleTogglePref = async (key: keyof typeof prefs) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    
    setLoadingPrefs(true);
    try {
      await api.post('/account/notification-preferences', { preferences: newPrefs });
      toast.success('Đã lưu tùy chọn thông báo');
      // Update local storage user data to prevent resetting on reload if possible
      // In a real app we'd trigger a fetchMe() to sync the state
    } catch (e) {
      toast.error('Lỗi khi lưu tùy chọn');
      setPrefs(prefs); // Revert
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handleLogoutOtherDevices = async () => {
    if (!window.confirm('Bạn có chắc muốn đăng xuất khỏi tất cả các thiết bị khác không?')) return;
    
    setLoadingLogout(true);
    try {
      await api.post('/account/logout-other-devices');
      toast.success('Đã đăng xuất khỏi các thiết bị khác');
    } catch (e) {
      toast.error('Lỗi khi thực hiện thao tác');
    } finally {
      setLoadingLogout(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Cài đặt tài khoản</h1>
          <p className="text-muted-foreground mt-1 text-sm">Quản lý bảo mật, mật khẩu và tùy chọn ứng dụng của bạn.</p>
        </div>

        <div className="space-y-6">
          
          {/* Card: Tài khoản đăng nhập */}
          <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
            <div className="p-5 md:p-6 border-b border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Tài khoản đăng nhập</h3>
                <p className="text-muted-foreground text-sm">Tài khoản đăng nhập do Admin cấp và quản lý</p>
              </div>
            </div>
            <div className="p-5 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email / Username</label>
                <input 
                  type="text" 
                  value={user?.email || user?.username || ''} 
                  readOnly 
                  className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground cursor-not-allowed opacity-80"
                />
              </div>
              <div className="pt-2">
                <Link to="/profile" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                  <UserCircle size={16} />
                  Xem hồ sơ cá nhân
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Card: Đổi mật khẩu */}
          <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
            <div className="p-5 md:p-6 border-b border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Đổi mật khẩu</h3>
                <p className="text-muted-foreground text-sm">Cập nhật mật khẩu để bảo vệ tài khoản của bạn</p>
              </div>
            </div>
            <div className="p-5 md:p-6">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <input 
                      type={showCurrent ? 'text' : 'password'} 
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground pr-12"
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium px-1">
                      {showCurrent ? 'ẨN' : 'HIỆN'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Mật khẩu mới</label>
                    <div className="relative">
                      <input 
                        type={showNew ? 'text' : 'password'} 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required minLength={6}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground pr-12"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium px-1">
                        {showNew ? 'ẨN' : 'HIỆN'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Xác nhận mật khẩu mới</label>
                    <div className="relative">
                      <input 
                        type={showConfirm ? 'text' : 'password'} 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required minLength={6}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground pr-12"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium px-1">
                        {showConfirm ? 'ẨN' : 'HIỆN'}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={loadingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingPassword ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Card: Tùy chọn thông báo */}
          <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
            <div className="p-5 md:p-6 border-b border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Tùy chọn thông báo</h3>
                <p className="text-muted-foreground text-sm">Cấu hình cách hệ thống gửi thông báo cho bạn</p>
              </div>
            </div>
            <div className="p-5 md:p-6">
              <div className="space-y-1 divide-y divide-border/50 border border-border rounded-xl overflow-hidden">
                {[
                  { key: 'assigned', title: 'Khi được giao việc', desc: 'Nhận thông báo khi bạn được thêm vào một nhiệm vụ' },
                  { key: 'approaching_due', title: 'Sắp đến hạn', desc: 'Nhắc nhở 24h trước khi nhiệm vụ đến hạn' },
                  { key: 'due_today', title: 'Đến hạn hôm nay', desc: 'Nhắc nhở các nhiệm vụ có hạn chót trong ngày' },
                  { key: 'overdue', title: 'Nhiệm vụ quá hạn', desc: 'Nhắc nhở khi nhiệm vụ đã trễ hạn mà chưa hoàn thành' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-background hover:bg-muted/30 transition-colors">
                    <div className="pr-4">
                      <div className="font-medium text-foreground text-[15px] mb-0.5">{item.title}</div>
                      <div className="text-sm text-muted-foreground">{item.desc}</div>
                    </div>
                    <button
                      disabled={loadingPrefs}
                      onClick={() => handleTogglePref(item.key as keyof typeof prefs)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                        prefs[item.key as keyof typeof prefs] ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          prefs[item.key as keyof typeof prefs] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card: Phiên đăng nhập */}
          <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
            <div className="p-5 md:p-6 border-b border-border/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-500/10 text-zinc-600 flex items-center justify-center shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Phiên đăng nhập</h3>
                <p className="text-muted-foreground text-sm">Quản lý các thiết bị đang đăng nhập tài khoản của bạn</p>
              </div>
            </div>
            <div className="p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0">
                    <Smartphone size={18} className="text-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-[15px]">Thiết bị hiện tại</p>
                    <p className="text-sm text-primary font-medium flex items-center gap-1 mt-0.5">
                      <Check size={14} /> Đang hoạt động
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if(window.confirm('Bạn có chắc muốn đăng xuất?')) {
                      logout();
                      navigate('/login');
                    }
                  }}
                  className="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
                >
                  Đăng xuất
                </button>
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleLogoutOtherDevices}
                  disabled={loadingLogout}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground bg-background border border-border hover:bg-muted rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  <LogOut size={16} className="text-muted-foreground" />
                  {loadingLogout ? 'Đang xử lý...' : 'Đăng xuất khỏi các thiết bị khác'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="h-8"></div>
        </div>
      </div>
    </div>
  );
};
