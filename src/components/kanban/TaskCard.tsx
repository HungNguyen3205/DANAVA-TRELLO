import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types';
import { CheckSquare, MessageSquare, Paperclip, Clock } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Props {
  task: Task;
}

export function TaskCard({ task }: Props) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-kanban-card/50 opacity-50 border-2 border-primary rounded-lg h-[120px] shadow-sm mb-3"
      />
    );
  }

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'Khẩn cấp': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'Cao': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'Bình thường': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const isOverdue = task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && task.columnId !== 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-kanban-card p-4 rounded-lg shadow-sm border border-border cursor-grab hover:border-primary/50 transition-all hover:shadow-md group mb-3 relative touch-none"
    >
      <div className="flex flex-wrap gap-2 mb-3">
        {task.labels.map(l => (
          <span key={l} className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-sm bg-accent text-accent-foreground">
            {l}
          </span>
        ))}
        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-sm border ${getPriorityStyles(task.priority)}`}>
          {task.priority}
        </span>
      </div>
      
      <p className="font-medium text-sm mb-4 leading-snug group-hover:text-primary transition-colors">
        {task.title}
      </p>
      
      <div className="flex items-center justify-between text-muted-foreground text-xs mt-auto">
        <div className="flex items-center gap-3">
          {task.totalChecklistItems > 0 && (
            <div className="flex items-center gap-1" title="Checklist">
              <CheckSquare size={14} className={task.completedChecklistItems === task.totalChecklistItems ? 'text-green-500' : ''} />
              <span>{task.completedChecklistItems}/{task.totalChecklistItems}</span>
            </div>
          )}
          
          {task.commentCount > 0 && (
            <div className="flex items-center gap-1" title="Bình luận">
              <MessageSquare size={14} />
              <span>{task.commentCount}</span>
            </div>
          )}

          {task.attachmentCount > 0 && (
            <div className="flex items-center gap-1" title="Đính kèm">
              <Paperclip size={14} />
              <span>{task.attachmentCount}</span>
            </div>
          )}

          {task.dueDate && (
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium bg-destructive/10 px-1.5 py-0.5 rounded-sm' : ''}`} title="Hạn hoàn thành">
              <Clock size={14} />
              <span>{format(task.dueDate, 'dd MMM', { locale: vi })}</span>
            </div>
          )}
        </div>

        {task.assignee && (
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-background shadow-sm ml-2 shrink-0">
            {task.assignee.initials}
          </div>
        )}
      </div>
    </div>
  );
}
