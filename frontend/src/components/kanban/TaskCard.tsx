import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  GripVertical,
  ListChecks,
  MessageSquare,
  Paperclip
} from "lucide-react";
import type { Board, Task } from "../../types";
import { overdue } from "../../lib/board";
import { getAvatarUrl } from "../../lib/avatar";

export function CardContent({ task, board, theme }: { task: Task; board: Board; theme?: any }) {
  const totalSubtasks = (task as any).total_subtasks_count ?? task.totalSubtasksCount ?? (task.subtasks?.length || 0);
  const doneSubtasks = (task as any).done_subtasks_count ?? task.doneSubtasksCount ?? (task.subtasks?.filter(s => !!s.completed_at || s.completedAt).length || 0);

  const totalChecklistsItems = (task as any).total_checklists_items ?? task.totalChecklistsItems ?? task.checklists?.reduce((acc, c) => acc + (c.items?.length || 0), 0) ?? 0;
  const doneChecklistsItems = (task as any).done_checklists_items ?? task.doneChecklistsItems ?? task.checklists?.reduce((acc, c) => acc + (c.items?.filter(i => i.done)?.length || 0), 0) ?? 0;

  const totalItems = totalSubtasks > 0 ? totalSubtasks : totalChecklistsItems;
  const doneItems = totalSubtasks > 0 ? doneSubtasks : doneChecklistsItems;
  
  const commentsCount = (task as any).comments_count ?? task.commentsCount ?? (task.comments?.length || 0);
  const attachmentsCount = (task as any).attachments_count ?? task.attachmentsCount ?? (task.attachments?.length || 0);

  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const isDone = doneItems === totalItems && totalItems > 0;
  const assignee = board?.users?.find((u) => u.id === task.assigneeId);
  const displayAssignees = (task.assignees && task.assignees.length > 0) 
    ? task.assignees 
    : (assignee ? [assignee] : []);
    
  return (
    <div className="flex flex-col relative w-full h-full">
      {/* Left Colored Bar */}
      {theme && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[85%] rounded-r-full ${theme.dot}`} />
      )}
      
      <div className="pl-3.5 flex-1 flex flex-col w-full">
        <div className="flex flex-wrap gap-1.5 mb-2.5 pr-6 w-full">
          {task.labels.slice(0, 2).map((l) => (
            <span 
              key={l.id} 
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm text-white"
              style={{ backgroundColor: l.color }}
              title={l.name}
            >
              {l.name}
            </span>
          ))}
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              task.priority === "Khẩn cấp" 
                ? "bg-red-500/10 text-red-600" 
                : task.priority === "Cao" 
                  ? "bg-orange-500/10 text-orange-600" 
                  : task.priority === "Thấp" 
                    ? "bg-gray-100 text-gray-500" 
                    : "bg-blue-500/10 text-blue-600"
            }`}
          >
            {task.priority}
          </span>
        </div>
        
        <h4 className="text-[14px] font-semibold leading-snug mb-2 text-foreground group-hover:text-primary transition-colors text-left line-clamp-2 w-full">{task.title}</h4>
        
        {totalItems > 0 && (
          <div className="w-full mb-3">
            <div className="flex items-center justify-between gap-2 mb-1 text-[10px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1 font-semibold text-primary">
                <ListChecks size={12} /> {totalSubtasks > 0 ? 'Việc con' : 'Tiến độ'} ({doneItems}/{totalItems})
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-primary'}`} 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>
        )}
        
        <div className={`flex items-center justify-between gap-2 mt-auto pt-3 border-t w-full min-h-[36px] ${
          (task.dueDate || commentsCount > 0 || attachmentsCount > 0 || displayAssignees.length > 0) 
          ? 'border-border/40' 
          : 'border-transparent'
        }`}>
          <div className="flex flex-wrap gap-2.5 text-[11px] text-muted-foreground font-medium">
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${overdue(task, board) ? "text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-semibold" : ""}`}>
                <CalendarDays size={13} className={overdue(task, board) ? "" : "opacity-70"} />
                <span className="tracking-tight">{task.dueDate.split("-").slice(1).reverse().join("/")}</span>
              </span>
            )}
            {commentsCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={13} className="opacity-70" />
                <span className="tracking-tight">{commentsCount}</span>
              </span>
            )}
            {attachmentsCount > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip size={13} className="opacity-70" />
                <span className="tracking-tight">{attachmentsCount}</span>
              </span>
            )}
          </div>
          
          {displayAssignees.length > 0 && (
            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
              {displayAssignees.slice(0, 3).map((u) => (
                <span 
                  key={u.id}
                  className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shadow-xs ring-2 ring-card z-10 overflow-hidden" 
                  title={`Thành viên: ${u.name}`}
                >
                  {u.avatar ? (
                    <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                  ) : (
                    u.initials || u.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </span>
              ))}
              {displayAssignees.length > 3 && (
                <span className="w-6 h-6 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-bold ring-2 ring-card z-10">
                  +{displayAssignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskCard({
  task,
  board,
  onOpen,
  disabled = false,
  theme,
}: {
  task: Task;
  board: Board;
  onOpen: (t: Task) => void;
  disabled?: boolean;
  theme?: any;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `task-${task.id}`, data: { type: "Task", task }, disabled });
  
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      className={`relative group shrink-0 bg-card border border-border/60 rounded-[12px] shadow-sm hover:shadow hover:border-primary/30 hover:-translate-y-px transition-all duration-200 overflow-hidden ${isDragging ? "opacity-0" : ""}`}
    >
      <button
        className="w-full text-left p-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => onOpen(task)}
        aria-label={`Mở công việc: ${task.title}`}
      >
        <CardContent task={task} board={board} theme={theme} />
      </button>
      {!disabled && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="absolute right-2 top-2.5 p-1 text-muted-foreground/30 hover:text-foreground hover:bg-black/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing focus:opacity-100"
          aria-label={`Kéo công việc: ${task.title}`}
        >
          <GripVertical size={16} />
        </button>
      )}
    </article>
  );
}
