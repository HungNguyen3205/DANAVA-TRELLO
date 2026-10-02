import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, Link, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, Grid, Plus, Users, Activity, Settings, ChartNoAxesCombined } from 'lucide-react';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import api from '../../lib/axios';

export function WorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceId } = useParams();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/workspaces');
      setWorkspaces(data);
      if (data.length > 0 && !workspaceId) {
        navigate(`/w/${data[0].id}/dashboard`, { replace: true });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [navigate, workspaceId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-primary font-medium">Đang tải dữ liệu...</div></div>;
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-border bg-card/30 hidden md:flex flex-col transition-all duration-300">
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {workspaceId && (
            <>
              <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Không gian hiện tại</div>
              <SidebarItem
                icon={<ChartNoAxesCombined size={18} />}
                label="Dashboard"
                to={`/w/${workspaceId}/dashboard`}
                active={location.pathname.endsWith('/dashboard')}
              />
              <SidebarItem
                icon={<LayoutDashboard size={18} />}
                label="Bảng công việc"
                to={`/w/${workspaceId}`}
                active={location.pathname === `/w/${workspaceId}`}
              />
              <SidebarPreview icon={<Grid size={18} />} label="Sprint & Backlog" />
              <SidebarPreview icon={<Users size={18} />} label="Thành viên" />
              <SidebarPreview icon={<Activity size={18} />} label="Hoạt động" />
              <SidebarPreview icon={<Settings size={18} />} label="Cài đặt" />
            </>
          )}
          
          <div className="mt-6 mb-2 flex items-center justify-between px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Các Không gian làm việc
            </span>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Tạo không gian làm việc"
            >
              <Plus size={14} />
            </button>
          </div>
          
          <div className="space-y-1">
            {workspaces.map(ws => (
              <Link
                key={ws.id} 
                to={`/w/${ws.id}/dashboard`}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer group transition-colors ${Number(workspaceId) === ws.id ? 'bg-accent/80' : 'hover:bg-accent/50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${Number(workspaceId) === ws.id ? 'text-primary' : 'group-hover:text-foreground text-muted-foreground'}`}>
                    {ws.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
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

function SidebarPreview({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2 text-muted-foreground/70" title="Trang đang được lên kế hoạch">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Sắp có</span>
    </div>
  );
}
