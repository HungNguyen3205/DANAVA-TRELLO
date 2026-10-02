import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import { PromptModal } from '../components/ui/PromptModal';
import { Users, Filter, Search, Share2, MoreHorizontal, LayoutDashboard, ChevronRight, Play, Star, Plus } from 'lucide-react';
import api from '../lib/axios';
import { useBoardStore } from '../store/boardStore';

export function BoardView() {
  const { workspaceId, boardId } = useParams();
  const { board, setBoard, fetchBoard, loading } = useBoardStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (boardId) {
      fetchBoard(boardId).catch(e => toast.error('Không thể tải dữ liệu bảng'));
    }
  }, [boardId, fetchBoard]);

  useEffect(() => {
    if (board && !loading) {
      const taskId = searchParams.get('task');
      if (taskId) {
        const t = board.tasks.find((t: any) => t.id.toString() === taskId);
        if (t) {
          setActiveTask(t);
          // Remove param to not reopen on refresh if intended
          // searchParams.delete('task');
          // setSearchParams(searchParams, { replace: true });
        }
      }
    }
  }, [board, loading, searchParams]);

  const handleOpen = (t: Task) => setActiveTask(t);
  
  const handleAdd = (columnId: string) => {
    setPromptData({
      isOpen: true,
      title: 'Nhập tên công việc mới:',
      onConfirm: async (title) => {
        if (title) {
          try {
            await api.post(`/columns/${columnId}/tasks`, { title });
            toast.success('Đã thêm thẻ mới');
            fetchBoard(boardId || '1', true);
          } catch (e) {
            toast.error('Lỗi khi thêm thẻ');
          }
        }
        setPromptData(null);
      }
    });
  };

  const handleColumn = (c: Column | null) => {
    if (!c) {
      setPromptData({
        isOpen: true,
        title: 'Nhập tên cột mới:',
        onConfirm: async (title) => {
          if (title) {
            try {
              const id = boardId?.replace('board-', '') || '1';
              await api.post(`/boards/${id}/columns`, { title });
              toast.success('Đã tạo cột mới');
              fetchBoard(boardId || '1', true);
            } catch (e) {
              toast.error('Lỗi khi tạo cột');
            }
          }
          setPromptData(null);
        }
      });
    } else {
      // Edit column
      setPromptData({
        isOpen: true,
        title: `Đổi tên cột "${c.title}"`,
        onConfirm: async (title) => {
          if (title) {
            try {
              await api.put(`/columns/${c.id}`, { title });
              toast.success('Đã cập nhật cột');
              fetchBoard(boardId || '1', true);
            } catch (e) {
              toast.error('Lỗi khi cập nhật cột');
            }
          }
          setPromptData(null);
        }
      });
    }
  };
  
  const handleSave = async (b: Board, _text: string, taskMoveData?: { taskId: string, columnId: string, prevId?: string, nextId?: string }) => { 
    setBoard(b);
    try {
      const id = boardId?.replace('board-', '') || '1';
      
      if (taskMoveData) {
        // Trello-style single task move (Fractional Indexing)
        const payload = {
          column_id: Number(taskMoveData.columnId),
          prev_id: taskMoveData.prevId ? Number(taskMoveData.prevId) : null,
          next_id: taskMoveData.nextId ? Number(taskMoveData.nextId) : null,
        };
        await api.put(`/tasks/${taskMoveData.taskId}/move`, payload);
      } else {
        // Legacy column/board sorting
        const payload = b.tasks.map((t, idx) => ({
          id: Number(t.id),
          column_id: Number(t.columnId),
          order: idx * 1000
        }));
        await api.put(`/boards/${id}/tasks/reorder`, { tasks: payload });
      }
    } catch (e) {
      toast.error('Lỗi khi lưu vị trí kéo thả');
    }
    return true; 
  };

  if (!board) return <div className="p-8 text-primary flex justify-center items-center h-full font-medium animate-pulse">Đang tải dữ liệu Bảng...</div>;

  return (
    <div className="flex-1 overflow-hidden h-full flex flex-col relative bg-background">
      <header className="px-6 py-3 flex items-center justify-between shrink-0 bg-transparent relative z-10 border-b border-border/50">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
          <Link to={`/w/${workspaceId}/boards`} className="hover:text-primary transition-colors flex items-center gap-1.5">
            <LayoutDashboard size={14} /> Không gian làm việc
          </Link>
          <ChevronRight size={14} className="opacity-50" />
          <span className="text-foreground font-semibold">{board.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <Link 
              to={`/w/${workspaceId}/b/${boardId}/kanban`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-background shadow-sm text-foreground"
            >
              <LayoutDashboard size={16} /> Kanban
            </Link>
            <Link 
              to={`/w/${workspaceId}/b/${boardId}/list`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
            >
              <LayoutDashboard size={16} /> Danh sách
            </Link>
            <Link 
              to={`/w/${workspaceId}/b/${boardId}/calendar`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
            >
              <LayoutDashboard size={16} /> Lịch
            </Link>
          </div>
          
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="flex -space-x-2 mr-2">
              {board.users?.slice(0, 3).map((u: any, i: number) => (
                <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-background flex items-center justify-center text-[10px] font-bold z-10 relative shadow-sm text-white overflow-hidden" title={u.name}>
                  {u.avatar ? (
                    <img src={u.avatar.startsWith('http') ? u.avatar : `http://localhost:8000${u.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    u.initials
                  )}
                </div>
              ))}
            </div>
            <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors border border-transparent">
              <Share2 size={18} />
            </button>
            <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors border border-transparent hover:border-border hover:shadow-sm">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Container */}
      <div className="flex-1 overflow-hidden px-6 pb-6 relative z-0 flex flex-col">
        <div className="bg-card border border-border shadow-sm rounded-[20px] p-6 flex-1 flex flex-col overflow-hidden">
          
          {/* Board Internal Header */}
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F0EDFF] to-[#E8E1FF] flex items-center justify-center text-primary shadow-sm border border-primary/10">
                <LayoutDashboard size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {board.title}
                  <button className="text-[10px] font-semibold px-2 py-0.5 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded hover:bg-yellow-500/20 transition-colors flex items-center gap-1 ml-2">
                    <Star size={10} className="fill-yellow-500" />
                    Yêu thích
                  </button>
                </h2>
                {/* <div className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-2">
                  <Play size={12} className="text-primary" />
                  <span className="font-medium text-primary/80">
                    {board.sprints && board.sprints.length > 0 
                      ? board.sprints.find((s: any) => s.status === 'active')?.name || board.sprints[0].name 
                      : "Chưa có Sprint"}
                  </span>
                </div> */}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm công việc..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 pl-9 pr-3 py-2 text-[13px] bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>
              <button 
                onClick={() => setPromptData({
                  isOpen: true,
                  title: 'Thêm công việc',
                  onConfirm: () => { setPromptData(null); handleAdd(board.columns[0]?.id, "New Task"); }
                })}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-[#5B4BD6] rounded-xl transition-all shadow-sm hover:-translate-y-[1px]"
              >
                <Plus size={16} />
                Thêm công việc
              </button>
            </div>
          </div>

          {/* Kanban Board Render */}
          <div className="flex-1 overflow-hidden relative">
            {(() => {
              const normalizedSearch = searchQuery.toLowerCase().trim();
              const visibleTasks = board.tasks.filter((t) => {
                if (!normalizedSearch) return true;
                if (t.title.toLowerCase().includes(normalizedSearch)) return true;
                if (t.description?.toLowerCase().includes(normalizedSearch)) return true;
                if (t.labels.some(l => l.name.toLowerCase().includes(normalizedSearch))) return true;
                const assignee = board.users.find((u) => u.id === t.assigneeId);
                if (assignee && assignee.name.toLowerCase().includes(normalizedSearch)) return true;
                return false;
              });

              return (
                <KanbanBoard 
                  board={board}
                  visibleTasks={visibleTasks}
                  onOpen={handleOpen}
                  onAdd={handleAdd}
                  onColumn={handleColumn}
                  onSave={handleSave}
                  disabled={false}
                />
              );
            })()}
          </div>
        </div>
      </div>

      {activeTask && (
        <TaskDetailModal 
          task={activeTask} 
          board={board}
          onClose={() => {
            setActiveTask(null);
            fetchBoard(boardId || '1', true);
          }} 
        />
      )}

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
