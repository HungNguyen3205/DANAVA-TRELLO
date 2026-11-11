import { Outlet, useLocation } from 'react-router-dom';
import { Home, CheckSquare, Bell, Search, User, Settings, Users, ShieldAlert, ChartNoAxesCombined, Columns, Trash2, Building2, CalendarClock, BarChart3 } from 'lucide-react';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { SidebarItem, SidebarSection, SidebarShell } from './Sidebar';

export function PersonalLayout() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { closeMobileSidebar } = useUIStore();
  const path = location.pathname;

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [path, closeMobileSidebar]);

  return (
    <div className="flex flex-1 overflow-hidden w-full h-full relative">
      <SidebarShell>
        <SidebarSection>Chung</SidebarSection>
        <SidebarItem icon={<ChartNoAxesCombined size={18} />} label="Tổng quan" to="/dashboard" active={path === '/dashboard'} />

        <SidebarSection>Khu vực làm việc</SidebarSection>
        <SidebarItem icon={<Home size={18} />} label="Trang chủ của tôi" to="/home" active={path === '/home'} />
        <SidebarItem icon={<Columns size={18} />} label="Bảng công việc" to="/boards" active={path === '/boards'} />
        <SidebarItem icon={<CheckSquare size={18} />} label="Công việc của tôi" to="/my-tasks" active={path === '/my-tasks'} />
        <SidebarItem icon={<CalendarClock size={18} />} label="Chấm công" to="/attendance" active={path === '/attendance'} />
        <SidebarItem icon={<Bell size={18} />} label="Thông báo" to="/notifications" active={path === '/notifications'} />
        <SidebarItem icon={<Search size={18} />} label="Tìm kiếm" to="/search" active={path === '/search'} />
        <SidebarItem icon={<Trash2 size={18} />} label="Thùng rác" to="/trash" active={path === '/trash'} />

        <SidebarSection>Tài khoản</SidebarSection>
        <SidebarItem icon={<User size={18} />} label="Hồ sơ cá nhân" to="/profile" active={path === '/profile'} />
        <SidebarItem icon={<Settings size={18} />} label="Cài đặt tài khoản" to="/account/settings" active={path === '/account/settings'} />

        {(user?.system_role === 'system_admin' || user?.system_role === 'admin') && (
          <>
            <SidebarSection className="!text-amber-600 dark:!text-amber-500 flex items-center gap-1.5">
              <ShieldAlert size={14} /> Quản trị hệ thống
            </SidebarSection>
            <SidebarItem icon={<Users size={18} />} label="Quản lý nhân viên" to="/admin/employees" active={path === '/admin/employees'} />
            <SidebarItem icon={<Building2 size={18} />} label="Phòng ban" to="/admin/departments" active={path.startsWith('/admin/departments')} />
            <SidebarItem icon={<BarChart3 size={18} />} label="Thống kê chấm công" to="/attendance/report" active={path === '/attendance/report'} />
          </>
        )}
      </SidebarShell>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-background flex flex-col relative">
        <Outlet />
      </main>
    </div>
  );
}
