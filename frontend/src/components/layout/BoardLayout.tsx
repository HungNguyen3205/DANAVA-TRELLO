import React, { useEffect } from 'react';
import { LayoutDashboard, Grid, Calendar, Users, Settings, BarChart3, FileText, Award, ShieldCheck, Trash2 } from 'lucide-react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useBoardStore } from '../../store/boardStore';
import { useBoardRoute } from './BoardRouteContext';
import { SidebarBack, SidebarItem, SidebarSection, SidebarShell } from './Sidebar';

export function BoardLayout() {
  const location = useLocation();
  const { basePath, boardType } = useBoardRoute();
  const isProject = boardType === 'project';
  const { closeMobileSidebar } = useUIStore();
  const board = useBoardStore((state) => state.board);
  const isOwnerOrAdmin = board?.is_owner || board?.my_role === 'owner' || board?.my_role === 'admin';
  const path = location.pathname;

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [path, closeMobileSidebar]);

  return (
    <div className="flex flex-1 overflow-hidden w-full h-full relative">
      <SidebarShell>
        <SidebarBack to="/boards" label="Quay lại danh sách bảng" />

        <SidebarSection>{isProject ? 'Dự án' : 'Bảng công việc'}</SidebarSection>
        <SidebarItem icon={<Grid size={18} />} label="Kanban" to={`${basePath}/kanban`} active={path.includes('/kanban')} />
        <SidebarItem icon={<LayoutDashboard size={18} />} label="Danh sách" to={`${basePath}/list`} active={path.includes('/list')} />
        <SidebarItem icon={<Calendar size={18} />} label="Lịch" to={`${basePath}/calendar`} active={path.includes('/calendar')} />
        <SidebarItem icon={<BarChart3 size={18} />} label="Thống kê" to={`${basePath}/dashboard`} active={path.includes('/dashboard')} />
        <SidebarItem icon={<Users size={18} />} label="Thành viên" to={`${basePath}/members`} active={path.includes('/members')} />

        {/* Advanced features only appear on project boards to keep simple boards easy to use */}
        {isProject && (
          <>
            <SidebarSection>Quản lý dự án</SidebarSection>
            <SidebarItem icon={<Award size={18} />} label="Điểm hiệu suất" to={`${basePath}/performance`} active={path.includes('/performance') && !path.includes('/performance-policy')} />
            <SidebarItem icon={<ShieldCheck size={18} />} label="Nội quy hiệu suất" to={`${basePath}/performance-policy`} active={path.includes('/performance-policy')} />
            <SidebarItem icon={<FileText size={18} />} label="Tổng kết dự án" to={`${basePath}/review`} active={path.includes('/review')} />
          </>
        )}

        <SidebarSection>Thiết lập</SidebarSection>
        <SidebarItem icon={<Settings size={18} />} label={isProject ? 'Cài đặt dự án' : 'Cài đặt bảng'} to={`${basePath}/settings`} active={path.includes('/settings')} />
        {isOwnerOrAdmin && (
          <SidebarItem icon={<Trash2 size={18} />} label="Thùng rác" to={`${basePath}/trash`} active={path.includes('/trash')} />
        )}
      </SidebarShell>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-y-auto bg-background flex flex-col relative">
        <Outlet />
      </main>
    </div>
  );
}

/** Redirects to the Kanban view when a project-only page is opened on a simple task board. */
export function ProjectOnlyRoute({ children }: { children: React.ReactNode }) {
  const { basePath, boardType } = useBoardRoute();
  if (boardType !== 'project') {
    return <Navigate to={`${basePath}/kanban`} replace />;
  }
  return <>{children}</>;
}
