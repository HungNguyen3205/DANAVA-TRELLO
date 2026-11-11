import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, Link, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { SidebarItem, SidebarShell } from './Sidebar';
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
  const { closeMobileSidebar } = useUIStore();

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const { getWorkspaces } = await import('../../lib/workspace');
      const data = await getWorkspaces(force);
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
      <SidebarShell header={<div className="pt-4"><WorkspaceSwitcher workspaces={workspaces} /></div>}>
        {workspaceId && (
          <SidebarItem
            icon={<LayoutDashboard size={18} />}
            label="Bảng công việc"
            to={`/w/${workspaceId}/boards`}
            active={location.pathname.includes('/boards')}
          />
        )}
      </SidebarShell>

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
