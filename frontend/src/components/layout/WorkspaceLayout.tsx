import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useParams } from 'react-router-dom';
import { LayoutDashboard, Grid, Clock, Plus } from 'lucide-react';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import api from '../../lib/axios';

export function WorkspaceLayout() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/workspaces');
      setWorkspaces(data);
      if (data.length > 0 && !workspaceId) {
        navigate(`/w/${data[0].id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-primary font-medium">Đang tải dữ liệu...</div></div>;
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-border bg-card/30 hidden md:flex flex-col transition-all duration-300">
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Bảng" active />
          <SidebarItem icon={<Grid size={18} />} label="Mẫu" />
          <SidebarItem icon={<Clock size={18} />} label="Trang chủ" />
          
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
                to={`/w/${ws.id}`}
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
      <main className="flex-1 overflow-y-auto bg-background relative p-8">
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

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <Link 
      to="/"
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
