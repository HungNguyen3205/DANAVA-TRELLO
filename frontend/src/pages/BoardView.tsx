import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import { PromptModal } from '../components/ui/PromptModal';
import { Search, Plus, Archive, FileSpreadsheet, FolderInput } from 'lucide-react';
import { MoveBoardDialog } from '../components/project/MoveBoardDialog';
import api from '../lib/axios';
import { toast } from 'sonner';
import type { Board, Task, Column } from '../types';
import { useBoardStore } from '../store/boardStore';
import { useAuthStore } from '../store/authStore';
import { getAvatarUrl } from '../lib/avatar';
import { useBoardRoute } from '../components/layout/BoardRouteContext';
import { ArchivedColumnsModal } from '../components/kanban/ArchivedColumnsModal';
import { BoardHeaderBar } from '../components/board/BoardHeaderBar';
import { TaskExcelImportModal } from '../components/kanban/TaskExcelImportModal';

export function BoardView() {
  const { boardId } = useBoardRoute();
  const { board, setBoard, fetchBoard, loading } = useBoardStore();
  const user = useAuthStore((state) => state.user);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [showMoveBoard, setShowMoveBoard] = useState(false);
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
  
  const handleSave = async (
    b: Board,
    _text: string,
    moveData?: { taskId: string, columnId: string, prevId?: string, nextId?: string } | { reorderColumns: true },
  ) => {
    setBoard(b);
    try {
      const id = boardId?.replace('board-', '') || '1';
      const taskMoveData = moveData && 'taskId' in moveData ? moveData : undefined;

      if (moveData && 'reorderColumns' in moveData) {
        // Column drag-and-drop: persist only the column order
        const columns = b.columns.map((c, idx) => ({ id: Number(c.id), order: (idx + 1) * 1000 }));
        await api.put(`/boards/${id}/columns/reorder`, { columns });
      } else if (taskMoveData) {
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
    <div
      className={`flex-1 min-h-0 overflow-hidden h-full flex flex-col relative bg-background ${board.background_image ? 'board-glass' : ''}`}
      style={board.background_image ? {
        // Trello-style: the photo fills the board, only the toolbar and the lists sit on top of it.
        backgroundImage: `linear-gradient(rgb(0 0 0 / 0.04), rgb(0 0 0 / 0.12)), url("${getAvatarUrl(board.background_image)}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >

      {/* Main Board Container */}
      <div className="flex-1 min-h-0 overflow-hidden px-3 sm:px-5 pt-3 sm:pt-4 pb-3 sm:pb-5 relative z-0 flex flex-col">
        <div className="board-glass-panel bg-card border border-border shadow-sm rounded-[20px] p-3 sm:p-5 flex-1 min-h-0 flex flex-col overflow-hidden">
          
          {/* One compact header: title + favourite, search, members, add task, ⋯ menu */}
          <BoardHeaderBar
            board={board}
            star={{ active: isStarred, onToggle: handleToggleStar }}
            menuItems={[
              { icon: <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" />, label: 'Nhập từ Excel', hint: 'Tạo nhiều công việc từ file', onClick: () => setShowExcelImportModal(true) },
              { icon: <Archive size={16} className="text-amber-600 dark:text-amber-400" />, label: 'Cột lưu trữ', hint: 'Xem và khôi phục cột đã lưu trữ', onClick: () => setShowArchivedModal(true) },
              ...(board.is_owner || board.my_role === 'admin' || board.my_role === 'owner'
                ? [{ icon: <FolderInput size={16} className="text-primary" />, label: 'Chuyển sang dự án khác', hint: board.project ? `Đang ở: ${board.project.name}` : 'Chưa thuộc dự án', onClick: () => setShowMoveBoard(true) }]
                : []),
            ]}
          >
            {/* Search: an icon on phones that opens when tapped, a box on larger screens */}
            <div className="relative overflow-hidden rounded-full h-8 w-8 min-w-8 sm:w-44 lg:w-56 focus-within:w-40 sm:focus-within:w-44 lg:focus-within:w-56 transition-[width] duration-200 shrink-0" title="Tìm kiếm công việc">
              <Search size={15} className="absolute z-10 left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm công việc…"
                aria-label="Tìm kiếm công việc"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`absolute inset-0 m-0 w-full h-8 pl-8 pr-3 text-[13px] bg-background/60 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/70 ${searchQuery ? '' : 'max-sm:placeholder:text-transparent max-sm:cursor-pointer'}`}
              />
            </div>

            {board.columns && board.columns.length > 0 && (
              <button
                type="button"
                onClick={() => handleAdd(board.columns[0]?.id)}
                title="Thêm công việc"
                className="h-8 w-8 sm:w-auto sm:px-3.5 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-foreground bg-brand hover:brightness-95 active:scale-[0.98] rounded-full transition-all shadow-xs whitespace-nowrap shrink-0"
              >
                <Plus size={16} className="shrink-0 stroke-[2.5]" />
                <span className="hidden sm:inline">Thêm việc</span>
              </button>
            )}
          </BoardHeaderBar>

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

      {showMoveBoard && (
        <MoveBoardDialog
          board={{ id: Number(board.id), name: board.title, project_id: board.project_id ?? null }}
          onClose={() => setShowMoveBoard(false)}
          onMoved={() => {
            setShowMoveBoard(false);
            fetchBoard(boardId, true);
          }}
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
