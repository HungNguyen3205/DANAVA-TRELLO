import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import { PromptModal } from '../components/ui/PromptModal';
import { Users, Filter, Search, Share2, MoreHorizontal, LayoutDashboard, ChevronRight, Play, Star, Plus, BarChart3, Archive, FileSpreadsheet } from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'sonner';
import type { Board, Task, Column } from '../types';
import { useBoardStore } from '../store/boardStore';
import { useAuthStore } from '../store/authStore';
import { getAvatarUrl } from '../lib/avatar';
import { useBoardRoute } from '../components/layout/BoardRouteContext';
import { BoardMembersHeader } from '../components/layout/BoardMembersHeader';
import { ArchivedColumnsModal } from '../components/kanban/ArchivedColumnsModal';
import { ShareBoardModal } from '../components/kanban/ShareBoardModal';
import { TaskExcelImportModal } from '../components/kanban/TaskExcelImportModal';

export function BoardView() {
  const { boardId, basePath } = useBoardRoute();
  const { board, setBoard, fetchBoard, loading } = useBoardStore();
  const user = useAuthStore((state) => state.user);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isStarred, setIsStarred] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const openedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (boardId) {
      fetchBoard(boardId).catch(e => toast.error('Không thể tải dữ liệu bảng'));
    }
  }, [boardId, fetchBoard]);

  useEffect(() => {
    if (board && typeof (board as any).is_starred !== 'undefined') {
      setIsStarred(!!(board as any).is_starred);
    }
  }, [(board as any)?.is_starred]);

  const handleToggleStar = async () => {
    if (!board) return;
    const nextStatus = !isStarred;
    setIsStarred(nextStatus);
    try {
      await api.post(`/boards/${board.id}/toggle-star`);
      toast.success(nextStatus ? 'Đã thêm vào danh sách yêu thích' : 'Đã bỏ khỏi danh sách yêu thích');
    } catch {
      setIsStarred(!nextStatus);
      toast.error('Không thể cập nhật trạng thái yêu thích');
    }
  };

  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId) {
      openedTaskIdRef.current = null;
      return;
    }

    if (board && !loading && openedTaskIdRef.current !== taskId) {
      openedTaskIdRef.current = taskId;
      const t = board.tasks.find((taskItem: any) => taskItem.id.toString() === taskId);
      if (t) {
        setActiveTask(t);
      } else {
        api.get(`/tasks/${taskId}`)
          .then(({ data }) => {
            if (data) {
              const formattedTask: Task = {
                id: String(data.id),
                parentTaskId: data.parent_task_id ? String(data.parent_task_id) : null,
                columnId: String(data.column_id),
                title: data.title,
                description: data.description || '',
                priority: data.priority,
                labels: (data.labels || []).map((l: any) => ({ id: String(l.id), name: l.name, color: l.color })),
                assigneeId: data.assignee_id ? String(data.assignee_id) : '',
                assignees: data.assignees || [],
                collaborators: [],
                dueDate: data.due_date || '',
                completedAt: data.completed_at || null,
                checklists: [],
                attachments: [],
                comments: [],
              };
              setActiveTask(formattedTask);
            }
          })
          .catch(() => {
            toast.error('Không tìm thấy công việc được yêu cầu');
          });
      }
      // Remove query param from URL so closing the modal or refetching board won't reopen it
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('task');
      setSearchParams(newParams, { replace: true });
    }
  }, [board, loading, searchParams, setSearchParams]);

  const handleOpen = (t: Task) => setActiveTask(t);
  
  const handleAdd = (columnId: string) => {
    const targetCol = board?.columns.find(c => String(c.id) === String(columnId));
    const rootTasksInCol = board?.tasks.filter(t => String(t.columnId) === String(columnId) && !t.parentTaskId) || [];
    const hasLimit = Boolean(targetCol?.wip_limit && targetCol.wip_limit > 0);
    const isLimitReached = hasLimit && rootTasksInCol.length >= (targetCol?.wip_limit || 0);

    if (isLimitReached && targetCol?.wip_enforcement === 'strict') {
      toast.error(`Cột "${targetCol.title}" đã đạt giới hạn WIP tối đa (${targetCol.wip_limit} công việc). Chế độ Nghiêm ngặt không cho phép thêm thẻ mới.`);
      return;
    }

    setPromptData({
      isOpen: true,
      title: isLimitReached
        ? `Cột "${targetCol?.title}" đã đạt giới hạn WIP (${rootTasksInCol.length}/${targetCol?.wip_limit}). Nhập tên công việc mới để tiếp tục:`
        : 'Nhập tên công việc mới:',
      onConfirm: async (title) => {
        if (!title?.trim()) {
          setPromptData(null);
          return;
        }
        try {
          await api.post(`/columns/${columnId}/tasks`, { title: title.trim() });
          setPromptData(null);
          toast.success('Đã thêm thẻ mới');
          fetchBoard(boardId || '1', true);
        } catch (e: any) {
          setPromptData(null);
          toast.error(e?.response?.data?.message || 'Lỗi khi thêm thẻ');
        }
      }
    });
  };

  const handleColumn = (c: Column | null) => {
    if (!c) {
      setPromptData({
        isOpen: true,
        title: 'Nhập tên cột mới:',
        onConfirm: async (title) => {
          if (!title?.trim()) {
            setPromptData(null);
            return;
          }
          try {
            const id = boardId?.replace('board-', '') || '1';
            const res = await api.post(`/boards/${id}/columns`, { title: title.trim() });
            setPromptData(null);
            toast.success('Đã tạo cột mới');
            if (res.data) {
              setBoard((prev) => {
                if (!prev) return prev;
                const newCol: Column = {
                  id: String(res.data.id),
                  title: res.data.title,
                  color: res.data.color || undefined,
                };
                return {
                  ...prev,
                  columns: [...prev.columns, newCol],
                };
              });
            }
            await fetchBoard(boardId || '1', true);
          } catch (e: any) {
            setPromptData(null);
            toast.error(e?.response?.data?.message || 'Lỗi khi tạo cột');
          }
        }
      });
    } else {
      // Edit column
      setPromptData({
        isOpen: true,
        title: `Đổi tên cột "${c.title}"`,
        onConfirm: async (title) => {
          if (!title?.trim()) {
            setPromptData(null);
            return;
          }
          try {
            await api.patch(`/columns/${c.id}`, { title: title.trim() });
            setPromptData(null);
            toast.success('Đã cập nhật cột');
            setBoard((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                columns: prev.columns.map(col => col.id === c.id ? { ...col, title: title.trim() } : col)
              };
            });
            await fetchBoard(boardId || '1', true);
          } catch (e: any) {
            setPromptData(null);
            toast.error(e?.response?.data?.message || 'Lỗi khi cập nhật cột');
          }
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
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Lỗi khi lưu vị trí kéo thả';
      toast.error(msg);
      // Rollback UI on drag & drop failure
      await fetchBoard(boardId || '1', true);
      return false;
    }
    return true; 
  };

  if (!board) return <div className="p-8 text-primary flex justify-center items-center h-full font-medium animate-pulse">Đang tải dữ liệu Bảng...</div>;

  return (
    <div className="flex-1 min-h-0 overflow-hidden h-full flex flex-col relative bg-background">
      <header className="px-6 py-3 flex items-center justify-between shrink-0 bg-transparent relative z-10 border-b border-border/50">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
          <Link to="/boards" className="hover:text-primary transition-colors flex items-center gap-1.5">
            <LayoutDashboard size={14} /> Bảng công việc
          </Link>
          <ChevronRight size={14} className="opacity-50" />
          <span className="text-foreground font-semibold">{board.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <Link 
              to={`${basePath}/kanban`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-background shadow-sm text-foreground"
            >
              <LayoutDashboard size={16} /> Kanban
            </Link>
            <Link 
              to={`${basePath}/list`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
            >
              <LayoutDashboard size={16} /> Danh sách
            </Link>
            <Link 
              to={`${basePath}/calendar`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
            >
              <LayoutDashboard size={16} /> Lịch
            </Link>
            <Link 
              to={`${basePath}/dashboard`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
            >
              <BarChart3 size={16} /> Thống kê
            </Link>
          </div>
          
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <BoardMembersHeader users={board.users} basePath={basePath} />
            <button 
              onClick={() => setShowShareModal(true)}
              title="Chia sẻ bảng công việc"
              aria-label="Chia sẻ bảng công việc"
              className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors border border-transparent hover:border-border hover:shadow-2xs"
            >
              <Share2 size={18} />
            </button>
            <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors border border-transparent hover:border-border hover:shadow-sm">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Container */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 relative z-0 flex flex-col">
        <div className="bg-card border border-border shadow-sm rounded-[20px] p-6 flex-1 min-h-0 flex flex-col overflow-hidden">
          
          {/* Board Internal Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-6 shrink-0">
            <div className="flex items-center gap-3.5 min-w-0 flex-1 max-w-full sm:max-w-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F0EDFF] to-[#E8E1FF] dark:from-purple-950/40 dark:to-indigo-900/30 flex items-center justify-center text-primary shadow-xs border border-primary/15 shrink-0">
                <LayoutDashboard size={20} className="text-primary" />
              </div>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <h2 className="text-lg lg:text-xl font-bold tracking-tight text-foreground truncate" title={board.title}>
                  {board.title}
                </h2>
                <button
                  type="button"
                  onClick={handleToggleStar}
                  title={isStarred ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap shrink-0 shadow-2xs select-none active:scale-95 ${
                    isStarred
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                  }`}
                >
                  <Star size={12} className="fill-amber-500 text-amber-500 shrink-0" />
                  <span className="whitespace-nowrap font-medium">Yêu thích</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setShowExcelImportModal(true)}
                className="h-9 px-3.5 inline-flex items-center gap-2 text-xs lg:text-[13px] font-medium text-slate-700 dark:text-slate-200 bg-background hover:bg-muted/80 active:bg-muted rounded-xl border border-border/80 shadow-2xs hover:shadow-xs transition-all whitespace-nowrap shrink-0"
                title="Nhập công việc từ Excel"
              >
                <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">Nhập từ Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setShowArchivedModal(true)}
                className="h-9 px-3.5 inline-flex items-center gap-2 text-xs lg:text-[13px] font-medium text-slate-700 dark:text-slate-200 bg-background hover:bg-muted/80 active:bg-muted rounded-xl border border-border/80 shadow-2xs hover:shadow-xs transition-all whitespace-nowrap shrink-0"
                title="Xem các cột đã lưu trữ"
              >
                <Archive size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="whitespace-nowrap">Cột lưu trữ</span>
              </button>

              <div className="relative w-40 sm:w-48 lg:w-56 shrink min-w-[140px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm công việc..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs lg:text-[13px] bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs placeholder:text-muted-foreground/70"
                />
              </div>

              {board.columns && board.columns.length > 0 && (
                <button 
                  type="button"
                  onClick={() => handleAdd(board.columns[0]?.id)}
                  className="h-9 px-4 inline-flex items-center gap-1.5 text-xs lg:text-[13px] font-semibold text-white bg-primary hover:bg-[#5B4BD6] active:scale-[0.98] rounded-xl transition-all shadow-xs hover:shadow-sm hover:-translate-y-[0.5px] whitespace-nowrap shrink-0"
                >
                  <Plus size={16} className="shrink-0 stroke-[2.5]" />
                  <span className="whitespace-nowrap">Thêm công việc</span>
                </button>
              )}
            </div>
          </div>

          {/* Kanban Board Render */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
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
            if (searchParams.get('task')) {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('task');
              setSearchParams(newParams, { replace: true });
            }
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

      {showArchivedModal && (
        <ArchivedColumnsModal
          isOpen={showArchivedModal}
          board={board}
          canManage={Boolean(
            board.is_owner ||
            board.my_role === 'owner' ||
            board.my_role === 'admin' ||
            (user && board.owner_id && String(board.owner_id) === String(user.id)) ||
            (user && board.users?.some(u => String(u.id) === String(user.id) && (u.role === 'admin' || u.role === 'owner')))
          )}
          onClose={() => setShowArchivedModal(false)}
        />
      )}

      {showShareModal && (
        <ShareBoardModal
          isOpen={showShareModal}
          board={board}
          canManage={Boolean(
            board.is_owner ||
            board.my_role === 'owner' ||
            board.my_role === 'admin' ||
            (user && board.owner_id && String(board.owner_id) === String(user.id)) ||
            (user && board.users?.some(u => String(u.id) === String(user.id) && (u.role === 'admin' || u.role === 'owner')))
          )}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showExcelImportModal && (
        <TaskExcelImportModal
          isOpen={showExcelImportModal}
          boardId={board.id}
          boardCode={board.publicId || board.id}
          onImportSuccess={() => fetchBoard(boardId, true)}
          onClose={() => setShowExcelImportModal(false)}
        />
      )}
    </div>
  );
}
