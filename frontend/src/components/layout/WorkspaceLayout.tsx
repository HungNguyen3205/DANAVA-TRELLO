import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, Link, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, Grid, Users, Settings, ChartNoAxesCombined } from 'lucide-react';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import api from '../../lib/axios';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useUIStore } from '../../store/uiStore';

export function WorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceId } = useParams();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { isMobileSidebarOpen, closeMobileSidebar } = useUIStore();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/workspaces');
      setWorkspaces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [navigate, workspaceId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname]);

  // We remove the blocking loading screen here to allow child routes (Outlet) 
  // to start fetching their own data immediately (parallel fetching).
  // if (loading && workspaces.length === 0) return ...;

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Overlay for mobile */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={closeMobileSidebar}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`w-64 border-r border-border bg-card flex flex-col transition-transform duration-300 shrink-0 absolute md:relative z-50 h-full ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="pt-4">
          <WorkspaceSwitcher workspaces={workspaces} />
        </div>
        <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto custom-scrollbar">
          {workspaceId && (
            <>
              <SidebarItem
                icon={<ChartNoAxesCombined size={18} />}
                label="Tổng quan"
                to={`/w/${workspaceId}/dashboard`}
                active={location.pathname.includes('/dashboard')}
              />
              <SidebarItem
                icon={<LayoutDashboard size={18} />}
                label="Bảng công việc"
                to={`/w/${workspaceId}/boards`}
                active={location.pathname.includes('/boards')}
              />
              {/* <SidebarItem icon={<Grid size={18} />} label="Sprint & Backlog" to={`/w/${workspaceId}/sprints`} active={location.pathname.includes('/sprints')} />
              <SidebarItem icon={<Users size={18} />} label="Thành viên" to={`/w/${workspaceId}/members`} active={location.pathname.includes('/members')} />
              <SidebarItem icon={<Settings size={18} />} label="Cài đặt" to={`/w/${workspaceId}/settings`} active={location.pathname.includes('/settings')} /> */}
            </>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="relative flex-1 overflow-y-auto bg-background p-4 sm:p-6 xl:p-8">
        <Outlet context={{ workspaces, fetchData }} />
      </main>

      <CreateWorkspaceModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (name, desc) => {
          await api.post('/workspaces', { name, description: desc });
          await fetchData();
        }}
      />
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


