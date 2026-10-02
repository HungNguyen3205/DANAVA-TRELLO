import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Columns, Users, Settings, Plus, LayoutDashboard, Activity } from 'lucide-react';
import { CreateBoardModal } from '../components/workspace/CreateBoardModal';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

export function WorkspaceDetail() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [workspace, setWorkspace] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('boards');
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/workspaces/${id}`);
      setWorkspace(data);
      setBoards(data.boards || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspaceId) {
      void loadWorkspace(workspaceId);
    }
  }, [workspaceId, loadWorkspace]);

  const createBoard = async (name: string, color: string) => {
    if (!name || !workspaceId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/boards`, { name, color });
      loadWorkspace(workspaceId);
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
      setBoards(boards.map(b => b.id === boardId ? { ...b, is_starred: currentStatus } : b));
    }
  };

  if (loading) return <div className="animate-pulse text-primary font-medium">Đang tải Không gian...</div>;
  if (!workspace) return <div className="text-destructive font-medium">Không tìm thấy Không gian làm việc.</div>;

  const workspaceMember = workspace.members?.find((m: any) => m.id === user?.id);
  const isAdmin = workspaceMember?.pivot?.role === 'admin';

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Info */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {workspace.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{workspace.name}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">Khu vực làm việc chung của nhóm. Quản lý dự án, công việc và theo dõi tiến độ một cách hiệu quả.</p>
              
              <div className="flex items-center gap-3 mt-3">
                <div className="flex -space-x-2">
                  {workspace.members?.slice(0, 5).map((m: any) => (
                    <div key={m.id} className="w-7 h-7 rounded-full bg-secondary border border-card flex items-center justify-center text-[10px] font-bold z-10 relative overflow-hidden">
                      {m.avatar ? (
                        <img src={m.avatar.startsWith('http') ? m.avatar : `http://localhost:8000${m.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        m.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                  ))}
                  {workspace.members?.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-accent border border-card flex items-center justify-center text-[10px] font-medium z-10 relative">
                      +{workspace.members.length - 5}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <button className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded hover:bg-secondary/80 transition-colors">
                    Mời thành viên
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab Content: Boards */}
      {activeTab === 'boards' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              Các Bảng của bạn
            </h3>
            <div className="text-sm text-muted-foreground bg-accent/50 px-3 py-1 rounded-full">
              {boards.length} bảng
            </div>
          </div>
          
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
            {isAdmin && (
              <button 
                onClick={() => setIsCreateBoardOpen(true)}
                className="h-28 rounded-xl bg-card/50 border border-border border-dashed flex flex-col items-center justify-center text-sm font-medium text-muted-foreground hover:bg-accent hover:border-primary/50 hover:text-foreground transition-all group shadow-sm hover:shadow-md gap-2"
              >
                <Plus size={20} className="group-hover:scale-110 transition-transform group-hover:text-primary" />
                <span>Tạo bảng mới</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && workspace.stats && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="text-base font-bold mb-4">Thống kê Không gian làm việc</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard title="Tổng số Bảng" value={workspace.stats.total_boards} icon={<Columns className="text-blue-500" />} />
            <StatCard title="Thành viên" value={workspace.stats.total_members} icon={<Users className="text-indigo-500" />} />
            <StatCard title="Công việc hoàn thành" value={workspace.stats.completed_tasks} total={workspace.stats.total_tasks} icon={<Star className="text-emerald-500" />} />
            <StatCard title="Quá hạn" value={workspace.stats.overdue_tasks} icon={<Activity className="text-red-500" />} valueClass="text-red-500" />
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold">Tiến độ chung</h4>
              <p className="text-sm text-muted-foreground mt-1">Tỷ lệ hoàn thành công việc trên toàn bộ các dự án.</p>
            </div>
            <div className="text-4xl font-black text-primary bg-primary/10 px-6 py-4 rounded-xl">
              {workspace.stats.completion_rate}%
            </div>
          </div>
        </div>
      )}

      {/* Other Tabs placeholders */}
      {activeTab !== 'boards' && activeTab !== 'overview' && (
        <div className="py-10 text-center border border-dashed border-border/50 rounded-xl bg-card/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-muted-foreground">Tính năng đang được phát triển</p>
        </div>
      )}

      <CreateBoardModal 
        isOpen={isCreateBoardOpen}
        onClose={() => setIsCreateBoardOpen(false)}
        onSubmit={createBoard}
        workspaceName={workspace?.name}
      />
    </div>
  );
}

function StatCard({ title, value, total, icon, valueClass }: { title: string, value: number, total?: number, icon: React.ReactNode, valueClass?: string }) {
  return (
    <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="p-2 bg-background rounded-lg">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${valueClass || 'text-foreground'}`}>{value}</span>
        {total !== undefined && <span className="text-sm text-muted-foreground font-medium">/ {total}</span>}
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
        active 
          ? 'border-primary text-primary' 
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
      }`}
    >
      {icon}
      {label}
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
