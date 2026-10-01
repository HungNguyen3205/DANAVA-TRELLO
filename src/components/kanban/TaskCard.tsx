import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  GripVertical,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import type { Board, Task } from "../../types";
import { overdue } from "../../lib/board";
export function CardContent({ task, board }: { task: Task; board: Board }) {
  const assignee = board.users.find((u) => u.id === task.assigneeId),
    done = task.checklist.filter((i) => i.done).length;
  return (
    <>
      <div className="card-tags">
        {task.labels.slice(0, 2).map((l) => (
          <span key={l} className="tag">
            {l}
          </span>
        ))}
        <span
          className={`priority priority-${task.priority === "Khẩn cấp" ? "urgent" : task.priority === "Cao" ? "high" : task.priority === "Thấp" ? "low" : "normal"}`}
        >
          {task.priority}
        </span>
      </div>
      <h4>{task.title}</h4>
      {task.description && (
        <p className="card-description">{task.description}</p>
      )}
      <div className="card-footer">
        <div className="card-metadata">
          {task.dueDate && (
            <span className={overdue(task, board) ? "overdue" : ""}>
              <CalendarDays size={14} />
              {task.dueDate.split("-").slice(1).reverse().join("/")}
              {overdue(task, board) ? " · Quá hạn" : ""}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span>
              <ListChecks size={14} />
              {done}/{task.checklist.length}
            </span>
          )}
          {task.comments.length > 0 && (
            <span>
              <MessageSquare size={14} />
              {task.comments.length}
            </span>
          )}
        </div>
        {assignee && (
          <span className="avatar" title={assignee.name}>
            {assignee.initials}
          </span>
        )}
      </div>
    </>
  );
}
export function TaskCard({
  task,
  board,
  onOpen,
  disabled = false,
}: {
  task: Task;
  board: Board;
  onOpen: (t: Task) => void;
  disabled?: boolean;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "Task", task }, disabled });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className="task-card"
    >
      <button
        className="card-open"
        onClick={() => onOpen(task)}
        aria-label={`Mở công việc: ${task.title}`}
      >
        <CardContent task={task} board={board} />
      </button>
      {!disabled && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="drag-handle"
          aria-label={`Kéo công việc: ${task.title}`}
        >
          <GripVertical size={16} />
        </button>
      )}
    </article>
  );
}
