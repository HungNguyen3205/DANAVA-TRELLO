import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Plus, Columns, Users, Search, Shield, UserCheck } from 'lucide-react';
import { PromptModal } from '../components/ui/PromptModal';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export function WorkspaceHome() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [boards, setBoards] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'starred' | 'created' | 'joined'>('all');
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBoards = async () => {
    setLoading(true);
    try {
      const res = await api.get('/me/boards');
      setBoards(res.data || []);
    } catch (e) {
      setBoards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleCreateBoard = async (name: string) => {
    if (!name.trim()) return;
    try {
      const res = await api.post('/boards', { name: name.trim() });
      toast.success('Đã tạo bảng mới thành công');
      setPromptData(null);
      await fetchBoards();
      if (res.data?.public_id) {
        navigate(`/${res.data.public_id}/kanban`);
      } else if (res.data?.id) {
        navigate(`/b/${res.data.id}`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi tạo bảng');
    }
  };

  const toggleStar = async (boardId: number, currentStatus: boolean) => {
    try {
      setBoards(prev => prev.map(b => b.id === boardId ? { ...b, is_starred: !currentStatus } : b));
      await api.post(`/boards/${boardId}/toggle-star`);
    } catch (e) {
      console.error(e);
      // Revert on error
      setBoards(prev => prev.map(b => b.id === boardId ? { ...b, is_starred: currentStatus } : b));
    }
  };

  const filteredBoards = boards.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterTab === 'starred') return b.is_starred;
    if (filterTab === 'created') return b.my_role === 'admin';
    if (filterTab === 'joined') return b.my_role === 'member';
    return true;
  });

  const starredCount = boards.filter(b => b.is_starred).length;
  const createdCount = boards.filter(b => b.my_role === 'admin').length;
  const joinedCount = boards.filter(b => b.my_role === 'member').length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-medium flex items-center gap-2">
          <Columns size={20} className="animate-spin text-primary/50" />
          <span>Đang tải các bảng công việc...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">
      <main className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Columns size={20} />
                </div>
                Bảng công việc của bạn
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Xem và quản lý tất cả các bảng bạn đã tạo hoặc được mời tham gia.
              </p>
            </div>

            <button 
              onClick={() => setPromptData({ 
                isOpen: true, 
                title: 'Nhập tên bảng mới:', 
                onConfirm: (name) => handleCreateBoard(name)
              })}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-orange-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm shrink-0 self-start md:self-auto"
            >
              <Plus size={18} />
              <span>Tạo bảng mới</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterTab === 'all' 
                    ? 'bg-primary text-primary-foreground shadow-xs' 
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                Tất cả ({boards.length})
              </button>
              {starredCount > 0 && (
                <button
                  onClick={() => setFilterTab('starred')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    filterTab === 'starred' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Star size={12} className="fill-current text-yellow-400" />
                  Đã gắn sao ({starredCount})
                </button>
              )}
              <button
                onClick={() => setFilterTab('created')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterTab === 'created' 
                    ? 'bg-primary text-primary-foreground shadow-xs' 
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                Do tôi tạo ({createdCount})
              </button>
              {joinedCount > 0 && (
                <button
                  onClick={() => setFilterTab('joined')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    filterTab === 'joined' 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  Được mời ({joinedCount})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Tìm bảng..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              />
            </div>
          </div>

          {/* Boards Grid */}
          {filteredBoards.length === 0 ? (
            <div className="bg-card border border-dashed border-border/80 rounded-2xl p-10 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Columns size={26} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {search ? 'Không tìm thấy bảng nào khớp với từ khóa' : 'Bạn chưa có bảng công việc nào'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {search 
                    ? 'Hãy thử kiểm tra lại từ khóa hoặc xóa bộ lọc để tìm lại.' 
                    : 'Hãy tạo bảng công việc đầu tiên của bạn để phân công và theo dõi tiến độ công việc.'}
                </p>
              </div>
              {!search && (
                <button 
                  onClick={() => setPromptData({ 
                    isOpen: true, 
                    title: 'Nhập tên bảng mới:', 
                    onConfirm: (name) => handleCreateBoard(name)
                  })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
                >
                  <Plus size={15} />
                  Tạo bảng mới ngay
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredBoards.map(board => (
                <BoardCard 
                  key={board.id}
                  board={board}
                  onToggleStar={(e) => {
                    e.stopPropagation();
                    toggleStar(board.id, board.is_starred);
                  }}
                  onClick={() => navigate(board.public_id ? `/${board.public_id}/kanban` : `/b/${board.id}`)}
                />
              ))}

              {/* Add Board Card */}
              <button 
                onClick={() => setPromptData({ 
                  isOpen: true, 
                  title: 'Nhập tên bảng mới:', 
                  onConfirm: (name) => handleCreateBoard(name)
                })}
                className="h-32 rounded-2xl bg-card/60 border border-border border-dashed flex flex-col items-center justify-center text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:border-primary/50 hover:text-foreground transition-all group shadow-xs hover:shadow-md gap-2"
              >
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-primary/10 group-hover:text-primary">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-semibold">Tạo bảng mới</span>
              </button>
            </div>
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

function BoardCard({ 
  board, 
  onClick, 
  onToggleStar 
}: { 
  board: any, 
  onClick?: () => void, 
  onToggleStar?: (e: React.MouseEvent) => void 
}) {
  const bgClass = board.color || 'bg-gradient-to-br from-blue-600 to-cyan-500';
  const isOwner = board.my_role === 'admin';

  return (
    <div 
      onClick={onClick}
      className={`relative h-32 rounded-2xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${bgClass} flex flex-col justify-between p-4`}
    >
      {/* Background shading overlay */}
      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors pointer-events-none" />

      {/* Top Header Row in Card */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs backdrop-blur-xs ${
          isOwner 
            ? 'bg-amber-400/90 text-amber-950 font-extrabold' 
            : 'bg-white/20 text-white'
        }`}>
          {isOwner ? <Shield size={10} /> : <UserCheck size={10} />}
          {isOwner ? 'Chủ bảng' : 'Thành viên'}
        </span>

        <button 
          type="button"
          className="p-1 rounded-full hover:bg-black/20 transition-colors text-white relative z-20" 
          onClick={onToggleStar}
          title={board.is_starred ? 'Bỏ gắn sao' : 'Gắn sao bảng này'}
        >
          <Star 
            size={16} 
            className={`transition-all ${board.is_starred ? 'text-yellow-300 fill-yellow-300 opacity-100 scale-110' : 'text-white/70 opacity-0 group-hover:opacity-100 hover:scale-125'}`} 
          />
        </button>
      </div>

      {/* Bottom Title & Members Row in Card */}
      <div className="relative z-10">
        <h4 className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2 mb-1.5">
          {board.name}
        </h4>
        <div className="flex items-center gap-1.5 text-[11px] text-white/80 font-medium">
          <Users size={12} />
          <span>{board.members_count || 1} thành viên</span>
        </div>
      </div>
    </div>
  );
}
