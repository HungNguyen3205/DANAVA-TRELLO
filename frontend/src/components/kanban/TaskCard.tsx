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

export function CardContent({ task, board, theme }: { task: Task; board: Board; theme?: any }) {
  const assignee = board.users.find((u) => u.id === task.assigneeId);
  const totalChecklistsItems = task.checklists?.reduce((acc, c) => acc + c.items.length, 0) || 0;
  const doneChecklistsItems = task.checklists?.reduce((acc, c) => acc + c.items.filter(i => i.done).length, 0) || 0;
  
  const progress = totalChecklistsItems > 0 ? Math.round((doneChecklistsItems / totalChecklistsItems) * 100) : 0;
  const isDone = doneChecklistsItems === totalChecklistsItems && totalChecklistsItems > 0;
    
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
        
        {totalChecklistsItems > 0 && (
          <div className="w-full mb-3">
            <div className="flex items-center justify-between gap-2 mb-1 text-[10px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1"><ListChecks size={12} /> Tiến độ</span>
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
        
        <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-border/40 w-full">
          <div className="flex flex-wrap gap-2.5 text-[11px] text-muted-foreground font-medium">
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${overdue(task, board) ? "text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-semibold" : ""}`}>
                <CalendarDays size={13} className={overdue(task, board) ? "" : "opacity-70"} />
                <span className="tracking-tight">{task.dueDate.split("-").slice(1).reverse().join("/")}</span>
              </span>
            )}
            {task.comments.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={13} className="opacity-70" />
                <span className="tracking-tight">{task.comments.length}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Paperclip size={13} className="opacity-70" />
              <span className="tracking-tight">{task.attachments?.length || 0}</span>
            </span>
          </div>
          
          {task.assigneeId && (
            <span 
              className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-white z-10" 
              title={`User: ${assignee?.name || task.assigneeId}`}
            >
              {assignee?.initials || task.assigneeId.charAt(0).toUpperCase()}
            </span>
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
      className={`relative group bg-white border border-border/60 rounded-[12px] shadow-sm hover:shadow hover:border-primary/30 hover:-translate-y-px transition-all duration-200 overflow-hidden ${isDragging ? "opacity-0" : ""}`}
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
