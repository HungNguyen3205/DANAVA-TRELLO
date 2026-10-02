import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import type { Event, View } from 'react-big-calendar';
import withDragAndDropModule from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import { PromptModal } from '../components/ui/PromptModal';
import { 
  LayoutDashboard, ChevronRight, Share2, 
  Plus, List as ListIcon, Calendar as CalendarIcon,
  LayoutGrid, Filter, Search, ChevronLeft
} from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'sonner';
import type { Board, Task, Column } from '../types';

const locales = {
  'vi': viLocale,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // Thứ Hai
  getDay,
  locales,
});

const withDragAndDrop = (withDragAndDropModule as any).default || withDragAndDropModule;
const DnDCalendar = withDragAndDrop(Calendar);

// Custom Event interface
interface TaskEvent extends Event {
  task: Task;
  isUnscheduled?: boolean;
}

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

// Custom Toolbar
const CustomToolbar = (toolbar: any) => {
  const { date, onNavigate, onView, view } = toolbar;
  
  const goToBack = () => {
    onNavigate('PREV');
  };
  const goToNext = () => {
    onNavigate('NEXT');
  };
  const goToCurrent = () => {
    onNavigate('TODAY');
  };

  const label = () => {
    const month = format(date, 'MM', { locale: viLocale });
    const year = format(date, 'yyyy');
    return `Tháng ${month}, ${year}`;
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
      <div className="flex items-center gap-2">
        <button 
          onClick={goToCurrent}
          className="px-4 py-2 text-[13px] font-medium border border-border rounded-lg bg-card hover:bg-muted text-foreground transition-colors shadow-sm"
        >
          Hôm nay
        </button>
        <div className="flex items-center gap-1">
          <button 
            onClick={goToBack}
            className="p-2 border border-border rounded-lg bg-card hover:bg-muted text-foreground transition-colors shadow-sm"
            aria-label="Trước"
            title="Trước"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={goToNext}
            className="p-2 border border-border rounded-lg bg-card hover:bg-muted text-foreground transition-colors shadow-sm"
            aria-label="Tiếp"
            title="Tiếp"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="text-[16px] font-bold text-foreground">
        {label()}
      </div>

      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
        <button 
          onClick={() => onView(Views.MONTH)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === Views.MONTH ? 'bg-[#E0E7FF] text-[#4F46E5] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Tháng
        </button>
        <button 
          onClick={() => onView(Views.AGENDA)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === Views.AGENDA ? 'bg-[#E0E7FF] text-[#4F46E5] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Lịch biểu
        </button>
      </div>
    </div>
  );
};

import { useBoardStore } from '../store/boardStore';

export function CalendarView() {
  const { workspaceId, boardId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { board, setBoard, fetchBoard, loading } = useBoardStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnscheduled, setShowUnscheduled] = useState(true);

  const viewParam = searchParams.get('view') || Views.MONTH;
  const dateParam = searchParams.get('date');
  const currentDate = dateParam ? new Date(dateParam) : new Date();
  
  // Custom Styles for RBC injected here
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .rbc-calendar { font-family: inherit; }
      .rbc-header { padding: 12px 8px; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
      .rbc-month-view { border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; background: #fff; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
      .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #f1f5f9; }
      .rbc-month-row + .rbc-month-row { border-top: 1px solid #f1f5f9; }
      .rbc-today { background-color: #f8fafc; }
      .rbc-event { padding: 4px 6px; border-radius: 6px; font-size: 12px; font-weight: 500; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
      .rbc-event-content { font-weight: 500; }
      .rbc-off-range-bg { background: #f8fafc; }
      .rbc-date-cell { padding: 8px; font-weight: 500; font-size: 13px; color: #334155; }
      .rbc-off-range .rbc-date-cell { color: #cbd5e1; }
      .rbc-btn-group button { border-color: #e2e8f0; color: #475569; font-weight: 500; transition: all 0.2s; }
      .rbc-btn-group button:hover { background: #f1f5f9; }
      .rbc-btn-group button.rbc-active { background: #e0e7ff; color: #4f46e5; border-color: #c7d2fe; box-shadow: none; }
      .rbc-toolbar button:active, .rbc-toolbar button.rbc-active:active, .rbc-toolbar button.rbc-active:hover, .rbc-toolbar button:focus { box-shadow: none; outline: none; }
      .rbc-time-view { border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; background: #fff; }
      .rbc-agenda-view { border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; background: #fff; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    if (boardId) {
      fetchBoard(boardId).catch(e => toast.error('Không thể tải dữ liệu bảng'));
    }
  }, [boardId, fetchBoard]);

  const handleAddTask = async (title: string, dateStr?: string) => {
    if (!title.trim() || !board || board.columns.length === 0) return;
    const firstColumn = board.columns[0];
    const payload: any = { title, column_id: firstColumn.id };
    if (dateStr) {
      payload.due_date = dateStr;
    }
    
    // Optimistic Update
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      columnId: firstColumn.id,
      title,
      description: '',
      priority: 'Bình thường',
      labels: [],
      assigneeId: '',
      collaborators: [],
      dueDate: dateStr || '',
      checklists: [],
      attachments: [],
      comments: []
    };
    
    setBoard(prev => {
      if (!prev) return prev;
      return { ...prev, tasks: [...prev.tasks, newTask] };
    });

    try {
      await api.post(`/columns/${firstColumn.id}/tasks`, payload);
      fetchBoard(boardId || '1', true);
      toast.success('Đã tạo công việc');
    } catch (e) {
      toast.error('Lỗi khi tạo công việc');
      fetchBoard(boardId || '1', true);
    }
  };

  const handleOpen = (t: Task) => setActiveTask(t);
  
  const handleEventDrop = async ({ event, end }: any) => {
    const taskEvent = event as TaskEvent;
    
    // Update local state optimistically
    setBoard(prev => {
      if (!prev) return prev;
      const newTasks = prev.tasks.map(t => {
        if (t.id === taskEvent.task.id) {
          return { ...t, dueDate: end.toISOString() }; // Typically due_date shifts
        }
        return t;
      });
      return { ...prev, tasks: newTasks };
    });

    try {
      await api.put(`/tasks/${taskEvent.task.id}`, { due_date: end.toISOString() });
      toast.success('Đã cập nhật ngày');
    } catch (e) {
      toast.error('Lỗi khi đổi ngày, đang hoàn tác...');
      fetchBoard(boardId || '1', true);
    }
  };

  const { events, unscheduled } = useMemo(() => {
    if (!board) return { events: [], unscheduled: [] };
    
    const normalizedSearch = searchQuery.toLowerCase().trim();
    const visibleTasks = board.tasks.filter((t) => {
      if (!normalizedSearch) return true;
      if (t.title.toLowerCase().includes(normalizedSearch)) return true;
      return false;
    });

    const scheduledEvents: TaskEvent[] = [];
    const unscheduledTasks: Task[] = [];

    visibleTasks.forEach(task => {
      if (task.dueDate || task.startDate) {
        // Fallback start to due or due to start
        const end = task.dueDate ? new Date(task.dueDate) : new Date(task.startDate!);
        const start = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
        
        scheduledEvents.push({
          title: task.title,
          start,
          end,
          allDay: start.getHours() === 0 && end.getHours() === 0,
          task,
        });
      } else {
        unscheduledTasks.push(task);
      }
    });

    return { events: scheduledEvents, unscheduled: unscheduledTasks };
  }, [board, searchQuery]);

  // Render Custom Event
  const EventComponent = ({ event }: { event: TaskEvent }) => {
    const task = event.task;
    const currentColumn = board?.columns.find(c => c.id === task.columnId);
    
    return (
      <div className="flex items-center gap-1.5 w-full truncate h-full" title={task.title}>
        <div 
          className="w-2 h-2 rounded-full shrink-0" 
          style={{ backgroundColor: currentColumn?.color || '#94A3B8' }}
        />
        <span className="truncate flex-1">{task.title}</span>
      </div>
    );
  };

  const getEventPropGetter = (event: TaskEvent) => {
    const task = event.task;
    const currentColumn = board?.columns.find(c => c.id === task.columnId);
    return {
      style: {
        backgroundColor: currentColumn?.color ? `${currentColumn.color}15` : '#f1f5f9',
        color: currentColumn?.color || '#334155',
        borderColor: currentColumn?.color ? `${currentColumn.color}30` : '#e2e8f0',
      }
    };
  };

  if (!board) return <div className="p-8 text-primary flex justify-center items-center h-full font-medium animate-pulse">Đang tải lịch...</div>;

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
          <BoardTabs boardId={boardId || ''} workspaceId={workspaceId || ''} activeTab="calendar" />
          
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
          </div>
        </div>
      </header>

      {/* Main Board Container */}
      <div className="flex-1 overflow-hidden relative z-0 flex flex-col lg:flex-row bg-background">
        
        {/* Calendar Area */}
        <div className="flex-1 overflow-auto flex flex-col p-3 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button 
                onClick={() => setPromptData({
                  isOpen: true,
                  title: 'Thêm công việc mới',
                  onConfirm: (v) => { setPromptData(null); handleAddTask(v); }
                })}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-[#5B4BD6] rounded-lg transition-all shadow-sm w-full sm:w-auto"
              >
                <Plus size={16} />
                Thêm công việc
              </button>
              <div className="relative w-full sm:w-56">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm lịch..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>
            </div>
            
            <button 
              onClick={() => setShowUnscheduled(!showUnscheduled)}
              className={`flex items-center gap-2 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors border shadow-sm ${showUnscheduled ? 'bg-primary/10 text-primary border-primary/20' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
            >
              <Filter size={16} />
              Chưa lên lịch ({unscheduled.length})
            </button>
          </div>

          <div className="flex-1 bg-transparent rounded-xl flex flex-col h-[700px] min-h-[500px]">
            <DnDCalendar<TaskEvent>
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              culture="vi"
              view={viewParam as View}
              date={currentDate}
              onView={(newView: View) => {
                searchParams.set('view', newView);
                setSearchParams(searchParams, { replace: true });
              }}
              onNavigate={(newDate: Date) => {
                searchParams.set('date', format(newDate, 'yyyy-MM-dd'));
                setSearchParams(searchParams, { replace: true });
              }}
              messages={{
                next: "Tiếp",
                previous: "Trước",
                today: "Hôm nay",
                month: "Tháng",
                week: "Tuần",
                day: "Ngày",
                agenda: "Lịch biểu"
              }}
              onEventDrop={handleEventDrop}
              resizable={false}
              onSelectEvent={(event: object) => handleOpen((event as TaskEvent).task)}
              selectable
              onSelectSlot={(slotInfo: any) => {
                const dateStr = slotInfo.start.toISOString();
                setPromptData({
                  isOpen: true,
                  title: `Thêm việc vào ${format(slotInfo.start, 'dd/MM/yyyy')}`,
                  onConfirm: (v) => { setPromptData(null); handleAddTask(v, dateStr); }
                });
              }}
              components={{
                toolbar: CustomToolbar as any,
                event: EventComponent as any
              }}
              eventPropGetter={getEventPropGetter as any}
              popup
            />
          </div>
        </div>

        {/* Unscheduled Panel (Right Sidebar / Bottom on mobile) */}
        {showUnscheduled && (
          <div className="w-full lg:w-80 bg-card lg:border-l border-t lg:border-t-0 border-border flex flex-col shrink-0 min-h-[300px]">
            <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
              <span>Chưa lên lịch ({unscheduled.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
              {unscheduled.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Tất cả công việc đã được lên lịch
                </div>
              ) : (
                unscheduled.map(task => {
                  const currentColumn = board.columns.find(c => c.id === task.columnId);
                  return (
                    <div 
                      key={task.id} 
                      className="p-3 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => handleOpen(task)}
                    >
                      <h4 className="text-sm font-medium text-foreground mb-1 group-hover:text-primary transition-colors">{task.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full border border-border/50" style={{ color: currentColumn?.color || '#64748b', backgroundColor: currentColumn?.color ? `${currentColumn.color}10` : '#f8fafc' }}>
                          {currentColumn?.title}
                        </span>
                        <span>{task.priority || 'Bình thường'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

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
