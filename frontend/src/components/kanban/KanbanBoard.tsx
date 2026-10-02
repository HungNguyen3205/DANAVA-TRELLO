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
    
    // Strip prefixes
    const draggedId = String(dragged.id).replace('col-', '').replace('task-', '');
    const overId = String(over.id).replace('col-', '').replace('task-', '');

    if (data?.type === "Column") {
      const target =
        over.data.current?.type === "Task"
          ? over.data.current.task.columnId
          : overId;
      const next = moveColumn(board, draggedId, target);
      if (next !== board) void onSave(next, "Sắp xếp các cột");
    } else if (data?.type === "Task") {
      const target =
        over.data.current?.type === "Task"
          ? over.data.current.task.columnId
          : overId;
      const next = moveTask(
        board,
        draggedId,
        target,
        over.data.current?.type === "Task" ? overId : undefined,
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
            items={board.columns.map((c) => `col-${c.id}`)}
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
              <article className="w-[268px] rotate-2 shadow-2xl opacity-90 bg-white rounded-[12px] border border-primary/30 scale-[1.02] overflow-hidden">
                <div className="p-3.5">
                  <CardContent task={active} board={board} theme={theme} />
                </div>
              </article>
            );
          })() : (() => {
            const col = active as Column;
            const tStr = (col.title || "").toLowerCase();
            const PREDEFINED_THEMES: Record<string, any> = {
              violet: { bg: "bg-[#F6F3FF]", header: "text-[#7C5CFC]", iconBg: "bg-[#E8E1FF]", iconColor: "text-[#7C5CFC]", dot: "bg-[#7C5CFC]" },
              blue: { bg: "bg-[#F1F6FF]", header: "text-[#4F7DF3]", iconBg: "bg-[#DFE9FF]", iconColor: "text-[#4F7DF3]", dot: "bg-[#4F7DF3]" },
              orange: { bg: "bg-[#FFF9EA]", header: "text-[#E6A92D]", iconBg: "bg-[#FFF0C2]", iconColor: "text-[#E6A92D]", dot: "bg-[#E6A92D]" },
              green: { bg: "bg-[#EFFAF6]", header: "text-[#2FAF83]", iconBg: "bg-[#D9F5EA]", iconColor: "text-[#2FAF83]", dot: "bg-[#2FAF83]" },
              gray: { bg: "bg-muted/30", header: "text-foreground", iconBg: "bg-muted", iconColor: "text-muted-foreground", dot: "bg-muted-foreground" }
            };
            let theme = PREDEFINED_THEMES.gray;
            if (col.color && PREDEFINED_THEMES[col.color]) theme = PREDEFINED_THEMES[col.color];
            else if (tStr.includes("to do") || tStr.includes("cần làm") || tStr.includes("mới") || tStr.includes("bắt đầu")) theme = PREDEFINED_THEMES.violet;
            else if (tStr.includes("progress") || tStr.includes("đang làm") || tStr.includes("thực hiện")) theme = PREDEFINED_THEMES.blue;
            else if (tStr.includes("review") || tStr.includes("đánh giá") || tStr.includes("kiểm tra") || tStr.includes("duyệt")) theme = PREDEFINED_THEMES.orange;
            else if (tStr.includes("done") || tStr.includes("hoàn thành") || col.completed) theme = PREDEFINED_THEMES.green;

            const columnTasks = board.tasks.filter(t => t.columnId === col.id);

            return (
              <div className={`w-[300px] opacity-90 rotate-2 scale-[1.02] shadow-2xl ${theme.bg} rounded-[16px] p-4 border border-primary/20 flex flex-col max-h-[800px]`}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${theme.iconBg}`}>
                    <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                  </div>
                  <h3 className={`font-bold text-[14px] tracking-tight ${theme.header}`}>{col.title}</h3>
                </div>
                <div className="flex-1 overflow-hidden space-y-3">
                  {columnTasks.map(t => (
                    <article key={t.id} className="relative bg-white border border-border/60 shadow-sm rounded-[12px] overflow-hidden">
                      <div className="p-3.5">
                        <CardContent task={t} board={board} theme={theme} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })())}
      </DragOverlay>
    </DndContext>
  );
}
