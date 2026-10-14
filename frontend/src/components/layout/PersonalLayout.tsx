import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Briefcase, CheckSquare, Bell, Search, User, Settings, Users, ShieldAlert, ChartNoAxesCombined } from 'lucide-react';
import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

export function PersonalLayout() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { isMobileSidebarOpen, closeMobileSidebar } = useUIStore();

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname]);

  return (
    <div className="flex flex-1 overflow-hidden w-full h-full relative">
      {/* Overlay for mobile */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar Cá nhân */}
      <aside className={`w-64 border-r border-border bg-card flex flex-col transition-transform duration-300 shrink-0 absolute md:relative z-50 h-full ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Mục CHUNG */}
          <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Chung
          </div>
          <SidebarItem 
            icon={<ChartNoAxesCombined size={18} />} 
            label="Tổng quan" 
            to="/dashboard" 
            active={location.pathname === '/dashboard'} 
          />

          <div className="mt-6 mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Không gian cá nhân
          </div>
          
          <SidebarItem icon={<Home size={18} />} label="Trang chủ của tôi" to="/home" active={location.pathname === '/home'} />
          <SidebarItem icon={<Briefcase size={18} />} label="Không gian làm việc" to="/workspaces" active={location.pathname === '/workspaces'} />
          <SidebarItem icon={<CheckSquare size={18} />} label="Công việc của tôi" to="/my-tasks" active={location.pathname === '/my-tasks'} />
          <SidebarItem icon={<Bell size={18} />} label="Thông báo" to="/notifications" active={location.pathname === '/notifications'} />
          <SidebarItem icon={<Search size={18} />} label="Tìm kiếm" to="/search" active={location.pathname === '/search'} />
          
          <div className="mt-8 mb-4 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Tài khoản
          </div>
          <SidebarItem icon={<User size={18} />} label="Hồ sơ cá nhân" to="/profile" active={location.pathname === '/profile'} />
          <SidebarItem icon={<Settings size={18} />} label="Cài đặt tài khoản" to="/account/settings" active={location.pathname === '/account/settings'} />

          {(user?.system_role === 'system_admin' || user?.system_role === 'admin') && (
            <>
              <div className="mt-8 mb-4 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                <ShieldAlert size={14} /> Quản trị hệ thống
              </div>
              <SidebarItem icon={<Users size={18} />} label="Quản lý nhân viên" to="/admin/employees" active={location.pathname === '/admin/employees'} />
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-background flex flex-col relative">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, to, active = false }: { icon: React.ReactNode, label: string, to: string, active?: boolean }) {
  return (
    <Link 
      to={to}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
        active 
          ? 'bg-primary/10 text-primary font-medium' 
          : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
