import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import { PromptModal } from '../components/ui/PromptModal';
import { 
  Filter, Search, Share2, LayoutDashboard, 
  ChevronRight, Plus, List as ListIcon, Calendar as CalendarIcon,
  Clock, LayoutGrid
} from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'sonner';
import type { Board, Task, Column } from '../types';

// Tab Component for Header
function BoardTabs({ boardId, workspaceId, activeTab }: { boardId: string, workspaceId: string, activeTab: 'kanban' | 'list' | 'calendar' }) {
  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
      <Link 
        to={`/w/${workspaceId}/b/${boardId}/kanban`}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'kanban' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <LayoutGrid size={16} /> Kanban
      </Link>
      <Link 
        to={`/w/${workspaceId}/b/${boardId}/list`}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <ListIcon size={16} /> Danh sách
      </Link>
      <Link 
        to={`/w/${workspaceId}/b/${boardId}/calendar`}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <CalendarIcon size={16} /> Lịch
      </Link>
    </div>
  );
}
import { useBoardStore } from '../store/boardStore';

export function ListView() {
  const { workspaceId, boardId } = useParams();
  const { board, setBoard, fetchBoard, loading } = useBoardStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupBy, setGroupBy] = useState<'status' | 'sprint' | 'assignee' | 'none'>('status');

  useEffect(() => {
    if (boardId) {
      fetchBoard(boardId).catch(e => toast.error('Không thể tải dữ liệu bảng'));
    }
  }, [boardId, fetchBoard]);

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

  const handleStatusChange = async (taskId: string, newColumnId: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { column_id: newColumnId });
      toast.success('Đã chuyển trạng thái');
      // Optimistic update locally
      setBoard(prev => {
        if (!prev) return prev;
        const newTasks = prev.tasks.map(t => t.id === taskId ? { ...t, columnId: newColumnId } : t);
        return { ...prev, tasks: newTasks };
      });
    } catch (e) {
      toast.error('Lỗi khi chuyển trạng thái');
      fetchBoard(boardId || '1', true); // Revert
    }
  };

  // Filter tasks based on search
  const visibleTasks = useMemo(() => {
    if (!board) return [];
    const normalizedSearch = searchQuery.toLowerCase().trim();
    return board.tasks.filter((t) => {
      if (!normalizedSearch) return true;
      if (t.title.toLowerCase().includes(normalizedSearch)) return true;
      if (t.description?.toLowerCase().includes(normalizedSearch)) return true;
      const assignee = board.users.find((u) => u.id === t.assigneeId);
      if (assignee && assignee.name.toLowerCase().includes(normalizedSearch)) return true;
      return false;
    });
  }, [board, searchQuery]);

  // Group tasks based on groupBy state
  const groupedTasks = useMemo(() => {
    if (!board) return [];
    
    if (groupBy === 'none') {
      return [{ id: 'all', title: 'Tất cả công việc', tasks: visibleTasks, color: '#94A3B8' }];
    }

    if (groupBy === 'status') {
      return board.columns.map(col => ({
        id: col.id,
        title: col.title,
        color: col.color || '#94A3B8',
        tasks: visibleTasks.filter(t => t.columnId === col.id)
      }));
    }

    if (groupBy === 'assignee') {
      const groups = board.users.map(u => ({
        id: String(u.id),
        title: u.name,
        color: '#4F7DF3',
        tasks: visibleTasks.filter(t => t.assigneeId === String(u.id))
      }));
      const unassigned = visibleTasks.filter(t => !t.assigneeId);
      if (unassigned.length > 0) {
        groups.push({ id: 'unassigned', title: 'Chưa phân công', color: '#94A3B8', tasks: unassigned });
      }
      return groups.filter(g => g.tasks.length > 0);
    }

    return [{ id: 'all', title: 'Tất cả công việc', tasks: visibleTasks, color: '#94A3B8' }];
  }, [board, visibleTasks, groupBy]);

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Khẩn cấp': return 'bg-red-100 text-red-700 border-red-200';
      case 'Cao': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Trung bình':
      case 'Bình thường': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Thấp': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getDueColor = (due: string, columnTitle: string) => {
    if (!due) return 'text-muted-foreground';
    const isCompleted = ['done', 'hoàn thành', 'completed'].includes(columnTitle.toLowerCase());
    if (isCompleted) return 'text-green-600 bg-green-50 px-2 py-0.5 rounded';
    
    const dueDate = new Date(due);
    const now = new Date();
    if (dueDate < now) return 'text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded';
    return 'text-muted-foreground';
  };

  if (!board) return <div className="p-8 text-primary flex justify-center items-center h-full font-medium animate-pulse">Đang tải danh sách công việc...</div>;

  return (
    <div className="flex-1 overflow-hidden h-full flex flex-col relative bg-background">
      {/* Top Header / Breadcrumb */}
      <header className="px-6 py-3 flex items-center justify-between shrink-0 bg-transparent relative z-10 border-b border-border/50">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
          <Link to={`/w/${workspaceId}/boards`} className="hover:text-primary transition-colors flex items-center gap-1.5">
            <LayoutDashboard size={14} /> Không gian làm việc
          </Link>
          <ChevronRight size={14} className="opacity-50" />
          <span className="text-foreground font-semibold">{board.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <BoardTabs boardId={boardId || ''} workspaceId={workspaceId || ''} activeTab="list" />
          
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="flex -space-x-2 mr-2">
              {board.users?.slice(0, 3).map((u: any, i: number) => (
                <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-background flex items-center justify-center text-[10px] font-bold z-10 relative shadow-sm text-white" title={u.name}>
                  {u.initials}
                </div>
              ))}
            </div>
            <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors border border-transparent">
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Container */}
      <div className="flex-1 overflow-hidden relative z-0 flex flex-col bg-card">
        
        {/* Toolbar */}
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setPromptData({
                isOpen: true,
                title: 'Thêm công việc',
                onConfirm: () => { setPromptData(null); handleAdd(board.columns[0]?.id); }
              })}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-[#5B4BD6] rounded-lg transition-all shadow-sm"
            >
              <Plus size={16} />
              Thêm công việc
            </button>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Tìm kiếm công việc..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9 pr-3 py-2 text-[13px] bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Nhóm theo:</span>
              <select 
                value={groupBy} 
                onChange={e => setGroupBy(e.target.value as any)}
                className="text-[13px] border border-border rounded-lg px-3 py-1.5 bg-background focus:ring-2 focus:ring-primary/20"
              >
                <option value="status">Trạng thái</option>
                <option value="assignee">Người phụ trách</option>
                <option value="none">Không nhóm</option>
              </select>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-foreground bg-card hover:bg-muted rounded-lg transition-colors border border-border shadow-sm">
              <Filter size={14} className="text-muted-foreground" />
              Bộ lọc
            </button>
          </div>
        </div>

        {/* List View Data Table */}
        <div className="flex-1 overflow-auto custom-scrollbar px-6 py-4">
          
          <div className="w-full">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 md:gap-4 px-2 md:px-4 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-card z-10 shadow-sm">
              <div className="col-span-8 md:col-span-4 lg:col-span-5 flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                <span>Tên công việc</span>
              </div>
              <div className="col-span-4 md:col-span-3 lg:col-span-2">Trạng thái</div>
              <div className="hidden lg:block lg:col-span-2">Độ ưu tiên</div>
              <div className="hidden md:block md:col-span-3 lg:col-span-2">Người phụ trách</div>
              <div className="hidden md:block md:col-span-2 lg:col-span-1">Đến hạn</div>
            </div>

            {/* Table Body */}
            {groupedTasks.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <ListIcon size={32} className="text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Không tìm thấy công việc phù hợp</h3>
                <p className="text-sm text-muted-foreground mt-1">Hãy thử thay đổi hoặc xóa bộ lọc tìm kiếm.</p>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="mt-4 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                    Xóa tìm kiếm
                  </button>
                )}
              </div>
            ) : (
              <div className="pb-20">
                {groupedTasks.map(group => (
                  <div key={group.id} className="mb-6">
                    {/* Group Header */}
                    {groupBy !== 'none' && (
                      <div className="flex items-center gap-2 py-3 border-b border-border/50 sticky top-10 bg-card/95 backdrop-blur z-0">
                        <div 
                          className="w-3 h-3 rounded-sm" 
                          style={{ backgroundColor: group.color }}
                        />
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                          {group.title}
                          <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                            {group.tasks.length}
                          </span>
                        </h3>
                      </div>
                    )}

                    {/* Group Tasks */}
                    <div className="divide-y divide-border/50 border-x border-b border-border/50 rounded-b-lg shadow-sm bg-card">
                      {group.tasks.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground bg-muted/20">
                          Không có công việc nào trong nhóm này
                        </div>
                      ) : (
                        group.tasks.map(task => {
                          const assignee = board.users.find(u => u.id === task.assigneeId);
                          const currentColumn = board.columns.find(c => c.id === task.columnId);
                          
                          return (
                            <div 
                              key={task.id} 
                              className="grid grid-cols-12 gap-2 md:gap-4 px-2 md:px-4 py-3 items-center hover:bg-accent/50 transition-colors group cursor-pointer"
                              onClick={() => handleOpen(task)}
                            >
                              {/* Task Name */}
                              <div className="col-span-8 md:col-span-4 lg:col-span-5 flex items-center gap-2 md:gap-3">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-gray-300 text-primary focus:ring-primary opacity-0 group-hover:opacity-100 transition-opacity" 
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                                  {task.description && (
                                    <span className="text-xs text-muted-foreground truncate">{task.description}</span>
                                  )}
                                </div>
                              </div>

                              {/* Status Column */}
                              <div className="col-span-4 md:col-span-3 lg:col-span-2" onClick={(e) => e.stopPropagation()}>
                                <select 
                                  value={task.columnId}
                                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                  className="text-[13px] bg-transparent border-0 p-0 font-medium cursor-pointer focus:ring-0 truncate w-full"
                                  style={{ color: currentColumn?.color || '#64748b' }}
                                >
                                  {board.columns.map(c => (
                                    <option key={c.id} value={c.id}>{c.title}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Priority Column */}
                              <div className="hidden lg:block lg:col-span-2">
                                <span className={`text-[11px] font-semibold px-2 py-1 rounded border ${getPriorityColor(task.priority)} truncate`}>
                                  {task.priority || 'Bình thường'}
                                </span>
                              </div>

                              {/* Assignee Column */}
                              <div className="hidden md:flex md:col-span-3 lg:col-span-2 items-center gap-2 min-w-0">
                                {assignee ? (
                                  <>
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-background flex items-center justify-center text-[9px] font-bold text-white shadow-sm shrink-0 overflow-hidden" title={assignee.name}>
                                      {assignee.avatar ? (
                                        <img src={assignee.avatar.startsWith('http') ? assignee.avatar : `http://localhost:8000${assignee.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                                      ) : (
                                        assignee.initials
                                      )}
                                    </div>
                                    <span className="text-xs font-medium truncate text-foreground flex-1">{assignee.name}</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic truncate">Trống</span>
                                )}
                              </div>

                              {/* Due Date Column */}
                              <div className="hidden md:block md:col-span-2 lg:col-span-1 min-w-0">
                                {task.dueDate ? (
                                  <span className={`text-[12px] flex items-center gap-1 truncate ${getDueColor(task.dueDate, currentColumn?.title || '')}`}>
                                    <Clock size={12} className="shrink-0" />
                                    <span className="truncate">{new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                      
                      {/* Quick Add Row in Group */}
                      {groupBy !== 'none' && (
                        <div 
                          className="px-4 py-2 border-t border-border/50 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer flex items-center gap-2 transition-colors"
                          onClick={() => {
                            if (groupBy === 'status') {
                              handleAdd(group.id);
                            } else {
                              handleAdd(board.columns[0]?.id);
                            }
                          }}
                        >
                          <Plus size={16} />
                          Thêm công việc vào {group.title.toLowerCase()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
