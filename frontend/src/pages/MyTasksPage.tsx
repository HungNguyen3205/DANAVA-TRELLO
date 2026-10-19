import React, { useState, useEffect } from 'react';
import { 
  Check, CheckSquare, Clock, Filter, AlertCircle, 
  CheckCircle2, ChevronRight, LayoutDashboard, Search, 
  Star, MoreHorizontal, MessageSquare, Paperclip, 
  CheckSquare as CheckIcon, Briefcase, GitBranch, Users, PieChart 
} from 'lucide-react';
import api from '../lib/axios';
import { useNavigate, Link } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import { getAvatarUrl } from '../lib/avatar';

interface Task {
  id: number;
  parent_task_id?: number | null;
  is_subtask?: boolean;
  type?: string;
  parent_task?: { id: number; title: string } | null;
  title: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  status: string;
  workspace: { id: number; name: string } | null;
  board: { id: number; public_id?: string; name: string; color: string } | null;
  sprint: { id: number; name: string } | null;
  assignees?: { id: number; name: string; username?: string; avatar?: string; contribution_percent?: number }[];
  co_assignees_count?: number;
  my_contribution_percent?: number | null;
}

export const MyTasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todo' | 'in_progress' | 'overdue' | 'upcoming' | 'completed' | 'all'>('todo');
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'root' | 'subtask'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'solo' | 'shared'>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'todo') params.append('status_type', 'todo');
      else if (filter === 'in_progress') params.append('status_type', 'in_progress');
      else if (filter === 'overdue') params.append('due', 'overdue');
      else if (filter === 'upcoming') {
        params.append('status_type', 'pending_all'); 
      }
      else if (filter === 'completed') params.append('due', 'completed');
      else if (filter === 'all') params.append('status_type', 'pending_all');

      if (taskTypeFilter !== 'all') params.append('task_type', taskTypeFilter);
      if (assignmentFilter !== 'all') params.append('assignment_type', assignmentFilter);

      if (search) {
        params.append('search', search);
      }

      params.append('sort', filter === 'overdue' || filter === 'upcoming' ? 'due_date' : 'updated_at');
      params.append('direction', filter === 'overdue' ? 'asc' : 'desc');

      const res = await api.get(`/me/tasks?${params.toString()}`);
      let data = res.data.data;
      
      if (filter === 'upcoming') {
        const today = new Date();
        today.setHours(0,0,0,0);
        data = data.filter((t: Task) => t.due_date && new Date(t.due_date) >= today);
      }

      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter, taskTypeFilter, assignmentFilter]); 

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTasks();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const formatDateText = (d: string) => {
    try {
      const date = new Date(d);
      if (d.includes('T') && !d.includes('T00:00:00')) {
        return format(date, 'HH:mm dd/MM/yyyy');
      }
      return format(date, 'dd/MM/yyyy');
    } catch {
      return d;
    }
  };

  const handleTaskClick = (task: Task) => {
    if (task.board?.public_id) {
      navigate(`/${task.board.public_id}/kanban?task=${task.id}`);
    } else if (task.board) {
      navigate(`/b/${task.board.id}?task=${task.id}`);
    }
  };

  const markComplete = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (!task.board) return;
    try {
      // Find columns of the board
      const res = await api.get(`/boards/${task.board.id}`);
      const columns = res.data.columns || [];
      const doneCol = columns.find((c: any) => c.title.toLowerCase().includes('hoàn thành') || c.title.toLowerCase().includes('done'));
      
      if (doneCol) {
        await api.put(`/tasks/${task.id}`, { column_id: doneCol.id });
        toast.success('Đã đánh dấu hoàn thành');
        fetchTasks();
      } else {
        toast.error('Bảng này chưa có cột "Hoàn thành" hoặc "Done"');
      }
    } catch (e) {
      toast.error('Lỗi khi hoàn thành công việc');
    }
  };

  const renderEmptyState = () => {
    let msg = "Bạn không có công việc nào.";
    if (filter === 'todo') msg = "Bạn chưa có công việc cần làm.";
    if (filter === 'in_progress') msg = "Bạn không có công việc nào đang thực hiện.";
    if (filter === 'overdue') msg = "Tuyệt vời! Bạn không có công việc nào quá hạn.";
    if (filter === 'upcoming') msg = "Bạn không có công việc nào sắp đến hạn.";
    if (filter === 'completed') msg = "Bạn chưa có công việc nào đã hoàn thành.";
    
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-2xl shadow-sm text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <CheckSquare size={32} className="text-primary opacity-60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{msg}</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Các nhiệm vụ được giao cho bạn từ các bảng khác nhau sẽ xuất hiện tại đây.
        </p>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-background flex flex-col">
      <div className="max-w-6xl mx-auto w-full p-4 md:p-8 flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="cursor-default select-none">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">Công việc của tôi</h1>
              <span className="bg-primary text-primary-foreground text-sm font-bold px-3 py-1 rounded-full">
                {tasks.length}
              </span>
            </div>
            <p className="text-muted-foreground text-[15px]">Tổng hợp nhiệm vụ được giao từ tất cả các bảng.</p>
          </div>

          <div className="relative w-full md:w-64 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhiệm vụ..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar shrink-0">
          {[
            { id: 'todo', label: 'Cần làm' },
            { id: 'in_progress', label: 'Đang thực hiện' },
            { id: 'upcoming', label: 'Sắp đến hạn' },
            { id: 'overdue', label: 'Quá hạn', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
            { id: 'completed', label: 'Đã hoàn thành', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
            { id: 'all', label: 'Tất cả' },
          ].map(f => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                  isActive 
                    ? f.color ? `${f.color} shadow-sm ring-1 ring-inset ring-current` : 'bg-foreground text-background shadow-sm' 
                    : 'bg-card text-muted-foreground border border-border hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Sub Filters: Task Type & Assignment Type */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-card/50 border border-border/70 p-3 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Phân loại:</span>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'root', label: 'Task chính' },
              { id: 'subtask', label: 'Task con' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTaskTypeFilter(t.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  taskTypeFilter === t.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Hình thức:</span>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'solo', label: 'Được giao riêng' },
              { id: 'shared', label: 'Tôi cùng thực hiện' },
            ].map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAssignmentFilter(a.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  assignmentFilter === a.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-card rounded-2xl border border-border animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="flex flex-col gap-3 pb-8">
              {tasks.map(task => {
                const isDueToday = task.due_date ? isToday(new Date(task.due_date)) : false;
                const isOverdue = task.due_date ? (isPast(new Date(task.due_date)) && !isDueToday && !task.completed_at) : false;
                const isCompleted = filter === 'completed' || !!task.completed_at;

                return (
                  <div 
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="group bg-card hover:bg-accent border border-border rounded-2xl p-4 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col sm:flex-row gap-4 sm:items-center"
                  >
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <div 
                        onClick={(e) => !isCompleted && markComplete(e, task)}
                        className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                          isCompleted ? 'bg-green-500 border-green-500 text-white cursor-default' : 'border-muted-foreground/30 text-transparent group-hover:border-primary/50 hover:bg-primary/10 cursor-pointer'
                        }`}
                      >
                        <Check size={14} className={isCompleted ? 'opacity-100' : 'opacity-0 group-hover:opacity-50 hover:!opacity-100 text-primary'} />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {task.is_subtask || task.type === 'Task con' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-200/40 dark:border-purple-900/40">
                              Task con
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-200/40 dark:border-blue-900/40">
                              Task chính
                            </span>
                          )}

                          <h4 className={`text-[15px] font-semibold text-foreground truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
                          {task.is_subtask && task.parent_task && (
                            <div className="flex items-center gap-1 font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded-md text-[11px]" title={`Thuộc Task cha: ${task.parent_task.title}`}>
                              <GitBranch size={11} className="opacity-70 text-purple-500 shrink-0" />
                              <span className="truncate max-w-[140px]">Thuộc: {task.parent_task.title}</span>
                            </div>
                          )}

                          {task.workspace && (
                            <div className="flex items-center gap-1.5 font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-md" title={`Không gian: ${task.workspace.name}`}>
                              <Briefcase size={12} className="opacity-80 shrink-0" />
                              <span className="truncate max-w-[130px]">{task.workspace.name}</span>
                            </div>
                          )}

                          {task.board && (
                            <div className="flex items-center gap-1.5 font-medium text-foreground bg-muted/60 px-2.5 py-0.5 rounded-md" title={`Bảng: ${task.board.name}`}>
                              <LayoutDashboard size={12} className="opacity-70 text-indigo-500 shrink-0" />
                              <span className="truncate max-w-[130px]">{task.board.name}</span>
                            </div>
                          )}

                          {task.status && (
                            <div className="flex items-center gap-1.5 font-medium text-foreground bg-accent/70 px-2.5 py-0.5 rounded-md border border-border/50" title={`Tiến độ / Trạng thái: ${task.status}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0"></span>
                              <span className="truncate max-w-[110px]">{task.status}</span>
                            </div>
                          )}
                          
                          {task.due_date && (
                            <div className={`flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-md ${
                              isCompleted ? 'text-muted-foreground bg-muted/30' :
                              isOverdue ? 'text-red-600 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50' : 
                              isDueToday ? 'text-orange-600 bg-orange-100 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900/50' : 
                              'text-muted-foreground bg-muted/40'
                            }`} title={`Hạn hoàn thành: ${formatDateText(task.due_date)}`}>
                              <Clock size={12} className="shrink-0" />
                              <span>{formatDateText(task.due_date)}</span>
                              {isOverdue && !isCompleted && <span className="uppercase text-[10px] ml-0.5 font-bold">Quá hạn</span>}
                              {isDueToday && !isCompleted && <span className="uppercase text-[10px] ml-0.5 font-bold">Hôm nay</span>}
                            </div>
                          )}

                          {/* Co-assignees and contribution */}
                          {task.assignees && task.assignees.length > 0 && (
                            <div className="flex items-center gap-1.5 pl-1">
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {task.assignees.slice(0, 3).map(u => (
                                  <span
                                    key={u.id}
                                    title={u.name}
                                    className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-card overflow-hidden shrink-0 shadow-2xs"
                                  >
                                    {u.avatar ? (
                                      <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                                    ) : (
                                      u.username?.charAt(0).toUpperCase() || u.name?.charAt(0).toUpperCase() || 'U'
                                    )}
                                  </span>
                                ))}
                                {task.assignees.length > 3 && (
                                  <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-bold ring-2 ring-card">
                                    +{task.assignees.length - 3}
                                  </span>
                                )}
                              </div>
                              {task.my_contribution_percent !== undefined && task.my_contribution_percent !== null && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20" title="Tỷ lệ đóng góp của bạn">
                                  {task.my_contribution_percent}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 sm:ml-auto">
                      {task.priority && task.priority !== 'Bình thường' && (
                        <div className={`text-[11px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${
                          task.priority === 'Khẩn cấp' ? 'bg-red-500/10 text-red-600' :
                          task.priority === 'Cao' ? 'bg-orange-500/10 text-orange-600' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {task.priority}
                        </div>
                      )}
                      
                      <ChevronRight size={18} className="text-muted-foreground/40 group-hover:text-foreground transition-colors hidden sm:block" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
