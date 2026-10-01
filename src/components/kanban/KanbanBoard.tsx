import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { Board, Column, Task } from "../../types";
import { moveColumn, moveTask } from "../../lib/board";
import { BoardColumn } from "./BoardColumn";
import { CardContent } from "./TaskCard";
export function KanbanBoard({
  board,
  visibleTasks,
  onOpen,
  onAdd,
  onColumn,
  onSave,
  disabled,
}: {
  board: Board;
  visibleTasks: Task[];
  onOpen: (t: Task) => void;
  onAdd: (id: string) => void;
  onColumn: (c: Column | null) => void;
  onSave: (b: Board, text: string) => Promise<boolean>;
  disabled: boolean;
}) {
  const [active, setActive] = useState<Task | Column | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function finish({ active: dragged, over }: DragEndEvent) {
    setActive(null);
    if (!over || dragged.id === over.id) return;
    const data = dragged.data.current;
    if (data?.type === "Column") {
      const target =
        over.data.current?.type === "Task"
          ? over.data.current.task.columnId
          : String(over.id);
      const next = moveColumn(board, String(dragged.id), target);
      if (next !== board) void onSave(next, "Sắp xếp các cột");
    } else if (data?.type === "Task") {
      const target =
        over.data.current?.type === "Task"
          ? over.data.current.task.columnId
          : String(over.id);
      const next = moveTask(
        board,
        String(dragged.id),
        target,
        over.data.current?.type === "Task" ? String(over.id) : undefined,
      );
      if (next !== board) void onSave(next, `Di chuyển: ${data.task.title}`);
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) =>
        setActive(
          e.active.data.current?.task || e.active.data.current?.column || null,
        )
      }
      onDragCancel={() => setActive(null)}
      onDragEnd={finish}
    >
      <div className="kanban-scroll">
        <div className="kanban-columns">
          <SortableContext
            items={board.columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {board.columns.map((c) => (
              <BoardColumn
                key={c.id}
                column={c}
                tasks={visibleTasks.filter((t) => t.columnId === c.id)}
                board={board}
                onOpen={onOpen}
                onAdd={onAdd}
                onEdit={onColumn}
                disabled={disabled}
              />
            ))}
          </SortableContext>
          <button className="add-column" onClick={() => onColumn(null)}>
            <Plus size={18} />
            Thêm cột
          </button>
        </div>
      </div>
      <DragOverlay>
        {active &&
          ("columnId" in active ? (
            <article className="task-card overlay-card">
              <CardContent task={active} board={board} />
            </article>
          ) : (
            <div className="overlay-column">{active.title}</div>
          ))}
      </DragOverlay>
    </DndContext>
  );
}
