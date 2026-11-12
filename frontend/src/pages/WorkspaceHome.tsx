import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Plus, Columns, Search } from 'lucide-react';
import { MoveBoardDialog } from '../components/project/MoveBoardDialog';
import { BoardCard } from '../components/board/BoardCard';
import type { ReactNode } from 'react';
import { NewBoardModal, type NewBoardPayload } from '../components/workspace/NewBoardModal';
import { ProjectsTabs } from '../components/project/ProjectsTabs';
import api from '../lib/axios';
import { toast } from 'sonner';

export function WorkspaceHome() {
  return <BoardsBrowser />;
}

/**
 * The boards grid (cards with background, star, role badge), with filters and search.
 * Used for "all my boards" and, with `projectId`, for the boards of one project.
 */
export function BoardsBrowser({ projectId, embedded = false, actions }: {
  /** Only show boards of this project, and create new boards inside it. */
  projectId?: number;
  /** Render inside another page (no own scroll area or page header). */
  embedded?: boolean;
  /** Extra buttons next to "Tạo bảng mới" (embedded mode). */
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'starred' | 'created' | 'joined'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<any | null>(null);

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

  const handleCreateBoard = async (payload: NewBoardPayload) => {
    if (!payload.name.trim()) return;
    try {
      const res = await api.post('/boards', payload);
      toast.success('Đã tạo bảng mới thành công');
      setIsCreateOpen(false);
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

  const scoped = projectId === undefined ? boards : boards.filter(b => b.project_id === projectId);

  const filteredBoards = scoped.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterTab === 'starred') return b.is_starred;
    if (filterTab === 'created') return b.my_role === 'admin';
    if (filterTab === 'joined') return b.my_role === 'member';
    return true;
  });

  const starredCount = scoped.filter(b => b.is_starred).length;
  const createdCount = scoped.filter(b => b.my_role === 'admin').length;
  const joinedCount = scoped.filter(b => b.my_role === 'member').length;

  if (loading) {
    return (
      <div className={`${embedded ? 'py-10' : 'flex-1'} flex items-center justify-center bg-background`}>
        <div className="animate-pulse text-primary font-medium flex items-center gap-2">
          <Columns size={20} className="animate-spin text-primary/50" />
          <span>Đang tải các bảng công việc...</span>
        </div>
      </div>
    );
  }

  const content = (
        <div className={embedded ? 'space-y-5' : 'max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500'}>

          {embedded ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Columns size={18} className="text-primary" /> Bảng công việc của dự án
              </h2>
              <div className="flex flex-wrap gap-2">
                {actions}
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:brightness-95 transition"
                >
                  <Plus size={16} /> Tạo bảng mới
                </button>
              </div>
            </div>
          ) : (
          <>
          <ProjectsTabs />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Columns size={20} />
                </div>
                Tất cả bảng của bạn
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Xem và quản lý tất cả các bảng bạn đã tạo hoặc được mời tham gia.
              </p>
            </div>

            <button 
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand text-brand-foreground hover:brightness-95 rounded-xl font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm shrink-0 self-start md:self-auto"
            >
              <Plus size={18} />
              <span>Tạo bảng mới</span>
            </button>
          </div>
          </>
          )}

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
                Tất cả ({scoped.length})
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
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
                >
                  <Plus size={15} />
                  Tạo bảng mới ngay
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
              {filteredBoards.map(board => (
                <BoardCard 
                  key={board.id}
                  board={board}
                  hideProject={projectId !== undefined}
                  onMove={board.my_role === 'admin' ? () => setMoving(board) : undefined}
                  onToggleStar={(e) => {
                    e.stopPropagation();
                    toggleStar(board.id, board.is_starred);
                  }}
                  onClick={() => navigate(board.public_id ? `/${board.public_id}/kanban` : `/b/${board.id}`)}
                />
              ))}

              {/* Add Board Card */}
              <button 
                onClick={() => setIsCreateOpen(true)}
                className="min-h-[11rem] h-full rounded-2xl bg-card/60 border border-border border-dashed flex flex-col items-center justify-center text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:border-primary/50 hover:text-foreground transition-all group shadow-xs hover:shadow-md gap-2"
              >
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-primary/10 group-hover:text-primary">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-semibold">Tạo bảng mới</span>
              </button>
            </div>
          )}

        </div>
  );

  const moveDialog = moving && (
    <MoveBoardDialog
      board={moving}
      onClose={() => setMoving(null)}
      onMoved={() => {
        setMoving(null);
        fetchBoards();
      }}
    />
  );

  const modal = isCreateOpen && (
    <NewBoardModal
      isOpen
      defaultProjectId={projectId}
      onClose={() => setIsCreateOpen(false)}
      onSubmit={handleCreateBoard}
    />
  );

  if (embedded) {
    return (
      <>
        {content}
        {modal}
        {moveDialog}
      </>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">
      <main className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar p-4 md:p-8">
        {content}
      </main>
      {modal}
      {moveDialog}
    </div>
  );
}

