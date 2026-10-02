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
      <div className="flex-1 overflow-x-auto overflow-y-hidden w-full h-full pb-4 custom-scrollbar">
        <div className="flex h-full gap-4 min-w-max items-start px-1">
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
          <button 
            className="flex items-center justify-center gap-2 w-[280px] shrink-0 border-2 border-dashed border-border/50 text-muted-foreground bg-card/10 hover:bg-card/40 hover:border-border hover:text-foreground rounded-xl py-4 transition-colors font-medium text-sm"
            onClick={() => onColumn(null)}
          >
            <Plus size={18} />
            Thêm cột mới
          </button>
        </div>
      </div>
      <DragOverlay>
        {active &&
          ("columnId" in active ? (() => {
            const col = board.columns.find(c => c.id === active.columnId);
            
            const PREDEFINED_THEMES: Record<string, any> = {
              violet: { dot: "bg-[#7C5CFC]" },
              blue: { dot: "bg-[#4F7DF3]" },
              orange: { dot: "bg-[#E6A92D]" },
              green: { dot: "bg-[#2FAF83]" },
              gray: { dot: "bg-muted-foreground" }
            };

            let theme = PREDEFINED_THEMES.gray;
            if (col?.color && PREDEFINED_THEMES[col.color]) {
              theme = PREDEFINED_THEMES[col.color];
            } else {
              const tStr = (col?.title || "").toLowerCase();
              if (tStr.includes("to do") || tStr.includes("cần làm") || tStr.includes("mới") || tStr.includes("bắt đầu")) theme = PREDEFINED_THEMES.violet;
              else if (tStr.includes("progress") || tStr.includes("đang làm") || tStr.includes("thực hiện")) theme = PREDEFINED_THEMES.blue;
              else if (tStr.includes("review") || tStr.includes("đánh giá") || tStr.includes("kiểm tra") || tStr.includes("duyệt")) theme = PREDEFINED_THEMES.orange;
              else if (tStr.includes("done") || tStr.includes("hoàn thành") || col?.completed) theme = PREDEFINED_THEMES.green;
            }

            return (
              <article className="w-[300px] rotate-2 shadow-2xl opacity-90 bg-white rounded-[12px] border border-primary/30 scale-[1.02] overflow-hidden">
                <div className="p-3.5">
                  <CardContent task={active} board={board} theme={theme} />
                </div>
              </article>
            );
          })() : (
            <div className="w-[300px] p-4 bg-white border-2 border-primary/40 rounded-[16px] rotate-1 shadow-2xl opacity-90 font-bold text-foreground">
              {active.title}
            </div>
          ))}
      </DragOverlay>
    </DndContext>
  );
}
