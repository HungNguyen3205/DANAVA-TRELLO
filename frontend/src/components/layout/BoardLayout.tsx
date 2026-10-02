import React, { useEffect } from 'react';
import { LayoutDashboard, Grid, Calendar, Users, Settings, ArrowLeft } from 'lucide-react';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';

export function BoardLayout() {
  const location = useLocation();
  const { workspaceId, boardId } = useParams();
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

      {/* Sidebar Bảng */}
      <aside className={`w-64 border-r border-border bg-card flex flex-col transition-transform duration-300 shrink-0 absolute md:relative z-50 h-full ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          
          <Link 
            to={`/w/${workspaceId}/boards`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Quay lại Không gian
          </Link>
          
          <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Bảng công việc
          </div>
          
          <SidebarItem icon={<Grid size={18} />} label="Kanban" to={`/w/${workspaceId}/b/${boardId}/kanban`} active={location.pathname.includes('/kanban')} />
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Danh sách" to={`/w/${workspaceId}/b/${boardId}/list`} active={location.pathname.includes('/list')} />
          <SidebarItem icon={<Calendar size={18} />} label="Lịch" to={`/w/${workspaceId}/b/${boardId}/calendar`} active={location.pathname.includes('/calendar')} />
          <SidebarItem icon={<Users size={18} />} label="Thành viên" to={`/w/${workspaceId}/b/${boardId}/members`} active={location.pathname.includes('/members')} />
          <SidebarItem icon={<Settings size={18} />} label="Cài đặt bảng" to={`/w/${workspaceId}/b/${boardId}/settings`} active={location.pathname.includes('/settings')} />
          
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background flex flex-col relative">
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
