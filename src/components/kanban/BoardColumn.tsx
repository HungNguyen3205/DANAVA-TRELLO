import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column, Task } from '../../types';
import { TaskCard } from './TaskCard';
import { useMemo } from 'react';
import { Menu, Plus } from 'lucide-react';

interface Props {
  column: Column;
  tasks: Task[];
  createTask: (columnId: string) => void;
}

export function BoardColumn({ column, tasks, createTask }: Props) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
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
        className="w-[320px] shrink-0 h-[500px] rounded-xl border-2 border-primary bg-kanban-column/50 opacity-50"
      ></div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-[320px] shrink-0 flex flex-col h-full max-h-full rounded-xl bg-kanban-column border border-border shadow-sm overflow-hidden"
    >
      {/* Column Header */}
      <div
        {...attributes}
        {...listeners}
        className="p-4 flex items-center justify-between border-b border-border/50 bg-kanban-column/80 backdrop-blur-sm sticky top-0 z-10 cursor-grab touch-none"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <span className="bg-background text-muted-foreground text-xs py-0.5 px-2 rounded-full border border-border">
            {tasks.length}
          </span>
        </div>
        <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <Menu size={16} />
        </button>
      </div>

      {/* Column Content */}
      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-0">
        <SortableContext items={taskIds}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        
        {/* Add task button */}
        <button
          onClick={() => createTask(column.id as string)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 p-2 rounded-lg text-sm font-medium transition-colors mt-2"
        >
          <Plus size={16} />
          Thêm thẻ
        </button>
      </div>
    </div>
  );
}
