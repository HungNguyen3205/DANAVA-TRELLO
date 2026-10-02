import React, { useState, useEffect } from 'react';
import { Check, CheckSquare, Clock, Filter, AlertCircle, CheckCircle2, ChevronRight, LayoutDashboard, Search, Star, MoreHorizontal, MessageSquare, Paperclip, CheckSquare as CheckIcon } from 'lucide-react';
import api from '../lib/axios';
import { useNavigate, Link } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';

interface Task {
  id: number;
  title: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  status: string;
  workspace: { id: number; name: string } | null;
  board: { id: number; name: string; color: string } | null;
  sprint: { id: number; name: string } | null;
}

export const MyTasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todo' | 'in_progress' | 'overdue' | 'upcoming' | 'completed' | 'all'>('todo');
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
  }, [filter]); 

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTasks();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleTaskClick = (task: Task) => {
    if (task.workspace && task.board) {
      navigate(`/w/${task.workspace.id}/b/${task.board.id}/kanban?task=${task.id}`);
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
                const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !task.completed_at;
                const isDueToday = task.due_date && isToday(new Date(task.due_date)) && !task.completed_at;
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
                      
                      <div className="min-w-0">
                        <h4 className={`text-[15px] font-semibold text-foreground truncate mb-1.5 ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 textxs text-muted-foreground">
                          {task.board && (
                            <div className="flex items-center gap-1.5 font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                              <LayoutDashboard size={12} className="opacity-70" />
                              <span className="truncate max-w-[120px]">{task.board.name}</span>
                            </div>
                          )}
                          <span className="hidden sm:inline opacity-50">•</span>
                          <span className="truncate max-w-[100px]">{task.status}</span>
                          
                          {task.due_date && (
                            <>
                              <span className="hidden sm:inline opacity-50">•</span>
                              <div className={`flex items-center gap-1 font-medium ${
                                isCompleted ? 'text-muted-foreground' :
                                isOverdue ? 'text-red-500 bg-red-500/10 px-1.5 rounded' : 
                                isDueToday ? 'text-orange-500 bg-orange-500/10 px-1.5 rounded' : ''
                              }`}>
                                <Clock size={12} />
                                <span>{format(new Date(task.due_date), 'dd/MM/yyyy HH:mm')}</span>
                                {isOverdue && !isCompleted && <span className="uppercase text-[10px] ml-1 font-bold">Quá hạn</span>}
                              </div>
                            </>
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
