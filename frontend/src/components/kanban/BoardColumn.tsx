import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
import type { Board, Column, Task } from "../../types";
import { TaskCard } from "./TaskCard";
export function BoardColumn({
  column,
  tasks,
  board,
  onOpen,
  onAdd,
  onEdit,
  disabled,
}: {
  column: Column;
  tasks: Task[];
  board: Board;
  onOpen: (t: Task) => void;
  onAdd: (id: string) => void;
  onEdit: (c: Column) => void;
  disabled: boolean;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "Column", column },
    disabled,
  });
  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`board-column ${column.completed ? "column-done" : ""}`}
      aria-label={column.title}
    >
      <header className="column-heading">
        <div>
          <span className="column-dot" />
          <h3>{column.title}</h3>
          <span className="column-count">{tasks.length}</span>
        </div>
        <div className="column-actions">
          {!disabled && (
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="icon-button column-grip"
              aria-label={`Kéo cột: ${column.title}`}
            >
              <GripVertical size={16} />
            </button>
          )}
          <button
            className="icon-button"
            disabled={disabled}
            onClick={() => onEdit(column)}
            aria-label={`Cài đặt cột: ${column.title}`}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>
      <div className="column-body">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              board={board}
              onOpen={onOpen}
              disabled={disabled}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="column-empty">Chưa có công việc</div>
        )}
        <button
          disabled={disabled}
          className="add-card"
          onClick={() => onAdd(column.id)}
        >
          <Plus size={16} />
          Thêm công việc
        </button>
      </div>
    </section>
  );
}
