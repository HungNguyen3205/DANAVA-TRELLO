import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star, Columns, Users, Settings, Briefcase, Plus, LayoutDashboard, Clock, ChevronDown, Grid } from 'lucide-react';
import { PromptModal } from '../components/ui/PromptModal';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

export function WorkspaceHome() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/workspaces');
      setWorkspaces(data);
      if (data.length > 0) {
        setSelectedWorkspace(data[0]);
        const bRes = await api.get(`/workspaces/${data[0].id}/boards`);
        setBoards(bRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async (name: string) => {
    if (!name || !selectedWorkspace) return;
    try {
      await api.post(`/workspaces/${selectedWorkspace.id}/boards`, { name });
      const bRes = await api.get(`/workspaces/${selectedWorkspace.id}/boards`);
      setBoards(bRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const createWorkspace = async (name: string) => {
    if (!name) return;
    try {
      await api.post(`/workspaces`, { name });
      fetchData();
    } catch (e) {
      console.error(e);
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
              onClick={() => setPromptData({ isOpen: true, title: 'Tên không gian mới:', onConfirm: (v) => { createWorkspace(v); setPromptData(null); }})}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Tạo không gian làm việc"
            >
              <Plus size={14} />
            </button>
          </div>
          
          <div className="space-y-1">
            {workspaces.map(ws => (
              <div 
                key={ws.id} 
                onClick={() => {
                  setSelectedWorkspace(ws);
                  api.get(`/workspaces/${ws.id}/boards`).then(res => setBoards(res.data));
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer group transition-colors ${selectedWorkspace?.id === ws.id ? 'bg-accent/80' : 'hover:bg-accent/50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${selectedWorkspace?.id === ws.id ? 'text-primary' : 'group-hover:text-foreground text-muted-foreground'}`}>
                    {ws.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background relative p-8">
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center">
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-2 shadow-lg border border-border">
                <Briefcase size={32} className="text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold">Chào mừng đến với DANAVA WORK</h2>
              <p className="text-muted-foreground max-w-md">Bạn chưa tham gia không gian làm việc nào. Hãy tạo một không gian mới để bắt đầu quản lý dự án.</p>
              <button 
                onClick={() => setPromptData({ isOpen: true, title: 'Nhập tên Không gian làm việc:', onConfirm: (v) => { createWorkspace(v); setPromptData(null); }})}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-md mt-4"
              >
                Tạo Không gian làm việc
              </button>
            </div>
          ) : (
            <section>
              <div className="mb-6 pb-6 border-b border-border/50">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">KHÔNG GIAN LÀM VIỆC HIỆN TẠI</h2>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                      {selectedWorkspace?.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{selectedWorkspace?.name}</h3>
                      <p className="text-sm text-muted-foreground">Khu vực làm việc chung</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <WorkspaceAction icon={<Columns size={14} />} label="Bảng" />
                    <WorkspaceAction icon={<Users size={14} />} label="Thành viên" />
                    <WorkspaceAction icon={<Settings size={14} />} label="Cài đặt" />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <LayoutDashboard size={18} className="text-primary" />
                  Các Bảng của bạn
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {boards.map(board => (
                    <BoardThumbnail 
                      key={board.id}
                      title={board.name} 
                      bgClass={board.color || 'bg-gradient-to-br from-blue-500 to-cyan-400'} 
                      onClick={() => navigate(`/b/${board.id}`)}
                    />
                  ))}
                  <button 
                    onClick={() => setPromptData({ isOpen: true, title: 'Nhập tên bảng mới:', onConfirm: (v) => { createBoard(v); setPromptData(null); }})}
                    className="h-28 rounded-lg bg-card/50 border border-border border-dashed flex flex-col items-center justify-center text-sm font-medium text-muted-foreground hover:bg-accent hover:border-primary/50 hover:text-foreground transition-all group shadow-sm hover:shadow-md gap-2"
                  >
                    <Plus size={20} className="group-hover:scale-110 transition-transform group-hover:text-primary" />
                    <span>Tạo bảng mới</span>
                  </button>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      {promptData && (
        <PromptModal 
          isOpen={promptData.isOpen}
          title={promptData.title}
          onConfirm={promptData.onConfirm}
          onCancel={() => setPromptData(null)}
        />
      )}
    </div>
  );
}

function WorkspaceAction({ icon, label, highlight }: { icon: React.ReactNode, label: string, highlight?: boolean }) {
  return (
    <button className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm ${
      highlight 
        ? 'bg-gradient-to-r from-primary to-orange-600 text-white hover:brightness-110' 
        : 'bg-card border border-border hover:bg-accent text-foreground'
    }`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BoardThumbnail({ title, bgClass, isStarred, onClick }: { title: string, bgClass: string, isStarred?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`relative h-28 rounded-xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${bgClass}`}
    >
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors"></div>
      <div className="absolute inset-0 p-4 flex flex-col justify-between">
        <h4 className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2">{title}</h4>
        <div className="self-end">
          <Star 
            size={16} 
            className={`transition-all ${isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-white/50 opacity-0 group-hover:opacity-100 hover:scale-110'}`} 
          />
        </div>
      </div>
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

