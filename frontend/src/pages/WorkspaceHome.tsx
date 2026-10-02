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
        // Fire request but don't wait sequentially for workspaces if we can optimize
        api.get(`/workspaces/${data[0].id}/boards`).then(bRes => {
            setBoards(bRes.data);
        }).catch(console.error);
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

  const toggleStar = async (boardId: number, currentStatus: boolean) => {
    try {
      setBoards(boards.map(b => b.id === boardId ? { ...b, is_starred: !currentStatus } : b));
      await api.post(`/boards/${boardId}/toggle-star`);
    } catch (e) {
      console.error(e);
      // Revert on error
      setBoards(boards.map(b => b.id === boardId ? { ...b, is_starred: currentStatus } : b));
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-primary font-medium">Đang tải dữ liệu...</div></div>;
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background relative p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-card rounded-full flex items-center justify-center mb-2 shadow-lg border border-border">
                <Briefcase size={32} className="text-muted-foreground w-6 h-6 md:w-8 md:h-8" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold">Chào mừng đến với DANAVA WORK</h2>
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
                      isStarred={board.is_starred}
                      onToggleStar={(e) => { e.stopPropagation(); toggleStar(board.id, board.is_starred); }}
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

function BoardThumbnail({ title, bgClass, isStarred, onClick, onToggleStar }: { title: string, bgClass: string, isStarred?: boolean, onClick?: () => void, onToggleStar?: (e: React.MouseEvent) => void }) {
  return (
    <div 
      onClick={onClick}
      className={`relative h-28 rounded-xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${bgClass}`}
    >
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
      <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
        <h4 className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2">{title}</h4>
        <div className="self-end pointer-events-auto">
          <button 
            type="button"
            className="p-2 -m-2 rounded-full hover:bg-black/30 transition-colors relative z-50 flex items-center justify-center" 
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              if (onToggleStar) onToggleStar(e); 
            }}
          >
            <Star 
              size={18} 
              className={`transition-all ${isStarred ? 'text-yellow-400 fill-yellow-400 opacity-100' : 'text-white/70 opacity-0 group-hover:opacity-100 hover:scale-125'}`} 
            />
          </button>
        </div>
      </div>
    </div>
  );
}

