import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { Plus, X, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import type { Board, Column, Task } from "../../types";
import { moveColumn, moveTask } from "../../lib/board";
import { BoardColumn } from "./BoardColumn";
import { CardContent } from "./TaskCard";
import { WipConfirmModal } from "./WipConfirmModal";
import { KanbanSelectionContext } from "./KanbanSelection";

export type BulkMove = { bulkMove: { taskIds: string[]; columnId: string; prevId?: string; nextId?: string } };
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Esc clears the selection.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") clearSelection(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.size, clearSelection]);

  // Forget cards that left the board (deleted, moved away by someone else...).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(board.tasks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [board.tasks]);

  const selection = useMemo(() => ({ selectedIds, toggle, draggingIds }), [selectedIds, toggle, draggingIds]);

  /**
   * Move the given cards to `target` as one block, in board order, placed before
   * `beforeId` (a card in the target column) or at the end of the column.
   */
  const moveGroup = (ids: string[], target: string, beforeId?: string) => {
    const group = board.tasks.filter((t) => ids.includes(t.id));
    if (group.length === 0) return;
    const destCol = board.columns.find((c) => String(c.id) === String(target));
    if (!destCol) return;

    const run = async () => {
      const rest = board.tasks.filter((t) => !ids.includes(t.id));
      const block = group.map((t) => ({ ...t, columnId: target }));
      let at = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
      if (at < 0) {
        const last = rest.map((t) => t.columnId).lastIndexOf(target);
        at = last >= 0 ? last + 1 : rest.length;
      }
      const tasks = [...rest.slice(0, at), ...block, ...rest.slice(at)];
      const inCol = tasks.filter((t) => t.columnId === target);
      const first = inCol.findIndex((t) => t.id === block[0].id);
      const prevId = first > 0 ? inCol[first - 1].id : undefined;
      const nextId = inCol[first + block.length]?.id;

      setMoving(true);
      const move: BulkMove = { bulkMove: { taskIds: block.map((t) => t.id), columnId: target, prevId, nextId } };
      const ok = await (onSave as any)({ ...board, tasks }, `Di chuyển ${block.length} công việc`, move);
      setMoving(false);
      if (ok) {
        toast.success(`Đã chuyển ${block.length} công việc sang "${destCol.title}"`);
        clearSelection();
      }
    };

    // WIP limit: count only root tasks that actually change column.
    const entering = group.filter((t) => String(t.columnId) !== String(target) && !t.parentTaskId).length;
    if (entering > 0 && destCol.wip_limit && destCol.wip_limit > 0) {
      const current = board.tasks.filter((t) => String(t.columnId) === String(target) && !t.parentTaskId).length;
      if (current + entering > destCol.wip_limit) {
        if (destCol.wip_enforcement === "strict") {
          toast.error(`Cột "${destCol.title}" chỉ còn chỗ cho ${Math.max(destCol.wip_limit - current, 0)} công việc (giới hạn WIP ${destCol.wip_limit}, chế độ Nghiêm ngặt).`);
          return;
        }
        setWipWarningPrompt({
          isOpen: true,
          columnTitle: destCol.title,
          wipLimit: destCol.wip_limit,
          currentCount: current,
          actionType: "move",
          onConfirm: () => { setWipWarningPrompt(null); void run(); },
          onCancel: () => setWipWarningPrompt(null),
        });
        return;
      }
    }
    void run();
  };
  const [dragWidth, setDragWidth] = useState<number | undefined>();
  const fitColumns = board.columns.length <= 4;
  const columnLayout = {
    '--kanban-column-count': Math.max(board.columns.length, 1),
    '--kanban-gap-space': `${Math.max(board.columns.length - 1, 0) * 12}px`,
  } as CSSProperties;
  const [wipWarningPrompt, setWipWarningPrompt] = useState<{
    isOpen: boolean;
    columnTitle: string;
    wipLimit: number;
    currentCount: number;
    actionType: 'move';
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function finish({ active: dragged, over }: DragEndEvent) {
    setActive(null);
    const group = draggingIds;
    setDraggingIds(new Set());
    if (!over || dragged.id === over.id) return;
    const data = dragged.data.current;

    // Dragging one of several selected cards moves them all.
    if (data?.type === "Task" && group.size > 1) {
      const overTask = over.data.current?.type === "Task" ? (over.data.current.task as Task) : null;
      const target = overTask ? overTask.columnId : String(over.id).replace("col-", "");
      const beforeId = overTask && !group.has(overTask.id) ? overTask.id : undefined;
      moveGroup([...group], target, beforeId);
      return;
    }
    
    // Strip prefixes
    const draggedId = String(dragged.id).replace('col-', '').replace('task-', '');
    const overId = String(over.id).replace('col-', '').replace('task-', '');

    if (data?.type === "Column") {
      const target =
        over.data.current?.type === "Task"
          ? over.data.current.task.columnId
          : overId;
      const next = moveColumn(board, draggedId, target);
      if (next !== board) void (onSave as any)(next, "Sắp xếp các cột", { reorderColumns: true });
    } else if (data?.type === "Task") {
      const target =
        over.data.current?.type === "Task"
          ? over.data.current.task.columnId
          : overId;

      const sourceColumnId = data.task.columnId;
      const isChangingColumn = String(sourceColumnId) !== String(target);
      const isRootTask = !data.task.parentTaskId;

      const executeMove = () => {
        const next = moveTask(
          board,
          draggedId,
          target,
          over.data.current?.type === "Task" ? overId : undefined,
        );
        if (next !== board) {
          // Calculate previous and next siblings in the new column
          const newTasksInCol = next.tasks.filter((t) => t.columnId === target);
          const newIdx = newTasksInCol.findIndex((t) => t.id === draggedId);
          const prevId = newIdx > 0 ? newTasksInCol[newIdx - 1].id : undefined;
          const nextId = newIdx < newTasksInCol.length - 1 ? newTasksInCol[newIdx + 1].id : undefined;
          
          // Use any to pass extra arguments safely
          void (onSave as any)(next, `Di chuyển: ${data.task.title}`, { taskId: draggedId, columnId: target, prevId, nextId });
        }
      };

      // WIP Limit check when moving a root task to a different column
      if (isChangingColumn && isRootTask) {
        const destCol = board.columns.find((c) => String(c.id) === String(target));
        if (destCol && destCol.wip_limit && destCol.wip_limit > 0) {
          const destRootTasksCount = board.tasks.filter((t) => String(t.columnId) === String(target) && !t.parentTaskId).length;
          if (destRootTasksCount >= destCol.wip_limit) {
            if (destCol.wip_enforcement === 'strict') {
              toast.error(`Cột "${destCol.title}" đã đạt giới hạn WIP tối đa (${destCol.wip_limit} công việc). Chế độ Nghiêm ngặt không cho phép chuyển vào.`);
              return;
            } else {
              // Warning mode: prompt confirmation
              setWipWarningPrompt({
                isOpen: true,
                columnTitle: destCol.title,
                wipLimit: destCol.wip_limit,
                currentCount: destRootTasksCount,
                actionType: 'move',
                onConfirm: () => {
                  setWipWarningPrompt(null);
                  executeMove();
                },
                onCancel: () => {
                  setWipWarningPrompt(null);
                }
              });
              return;
            }
          }
        }
      }

      executeMove();
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => {
        setDragWidth(e.active.rect.current.initial?.width);
        const draggedTask = e.active.data.current?.type === "Task" ? (e.active.data.current.task as Task) : null;
        setDraggingIds(draggedTask && selectedIds.has(draggedTask.id) && selectedIds.size > 1 ? new Set(selectedIds) : new Set());
        setActive(
          e.active.data.current?.task || e.active.data.current?.column || null,
        );
      }}
      onDragCancel={() => { setActive(null); setDraggingIds(new Set()); }}
      onDragEnd={finish}
    >
      <KanbanSelectionContext.Provider value={selection}>
      {fitColumns && board.columns.length > 0 && (
        <div className="flex shrink-0 justify-end px-3 pb-2 sm:px-4">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-card/50 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
            onClick={() => onColumn(null)}>
            <Plus size={16} /> Thêm cột
          </button>
        </div>
      )}
      <div className="kanban-scroll flex-1 min-h-0 overflow-x-auto overflow-y-hidden w-full h-full pb-4 custom-scrollbar snap-x snap-proximity"
        data-fit-columns={fitColumns} style={columnLayout}>
        <div className="kanban-track flex h-full min-h-0 gap-3 items-stretch">
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
          {(!fitColumns || board.columns.length === 0) && <button
            className="kanban-add-column board-glass-add flex items-center justify-center gap-2 shrink-0 border-2 border-dashed border-border/50 text-muted-foreground bg-card/10 hover:bg-card/40 hover:border-border hover:text-foreground rounded-xl py-4 transition-colors font-medium text-sm"
            onClick={() => onColumn(null)}
          >
            <Plus size={18} />
            Thêm cột mới
          </button>}
        </div>
      </div>
      <DragOverlay>
        {active &&
          ("columnId" in active ? (() => {
            const col = board.columns.find(c => c.id === active.columnId);
            
            const PREDEFINED_THEMES: Record<string, any> = {
              violet: { dot: "bg-[#2F4CB0]" },
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
              <div className="relative" style={{ width: dragWidth ?? 268 }}>
                {draggingIds.size > 1 && (
                  <>
                    <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-3 rounded-[12px] bg-card border border-primary/20 shadow-lg" />
                    <span className="absolute -top-2.5 -right-2.5 z-10 min-w-6 h-6 px-1.5 rounded-full bg-primary text-white text-xs font-bold inline-flex items-center justify-center shadow-md">
                      {draggingIds.size}
                    </span>
                  </>
                )}
                <article className="relative rotate-2 shadow-2xl opacity-90 bg-card rounded-[12px] border border-primary/30 scale-[1.02] overflow-hidden">
                  <div className="p-3.5">
                    <CardContent task={active} board={board} theme={theme} />
                  </div>
                </article>
              </div>
            );
          })() : (() => {
            const col = active as Column;
            const tStr = (col.title || "").toLowerCase();
            const PREDEFINED_THEMES: Record<string, any> = {
              violet: { bg: "bg-[#F1F4FB]", header: "text-[#2F4CB0]", iconBg: "bg-[#DCE4F8]", iconColor: "text-[#2F4CB0]", dot: "bg-[#2F4CB0]" },
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
              <div style={{ width: dragWidth ?? 300 }} className={`opacity-90 rotate-2 scale-[1.02] shadow-2xl ${theme.bg} rounded-[16px] p-4 border border-primary/20 flex flex-col max-h-[800px]`}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${theme.iconBg}`}>
                    <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                  </div>
                  <h3 className={`font-bold text-[14px] tracking-tight ${theme.header}`}>{col.title}</h3>
                </div>
                <div className="flex-1 overflow-hidden space-y-3">
                  {columnTasks.map(t => (
                    <article key={t.id} className="relative bg-card border border-border/60 shadow-sm rounded-[12px] overflow-hidden">
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

      </KanbanSelectionContext.Provider>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-popover/95 backdrop-blur px-3 py-2.5 shadow-2xl">
            <span className="text-[13px] font-semibold text-foreground whitespace-nowrap">
              Đã chọn {selectedIds.size} việc
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">· kéo một thẻ để chuyển cả nhóm, hoặc</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              <ArrowRightLeft size={14} className="text-muted-foreground shrink-0" />
              {board.columns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={moving}
                  onClick={() => moveGroup([...selectedIds], c.id)}
                  className="h-7 px-2.5 rounded-lg border border-border bg-card hover:bg-primary hover:text-white hover:border-primary text-xs font-medium text-foreground transition-colors whitespace-nowrap disabled:opacity-50 max-w-[10rem] truncate"
                  title={`Chuyển sang "${c.title}"`}
                >
                  {c.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground whitespace-nowrap"
              title="Bỏ chọn (Esc)"
            >
              <X size={13} /> Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {wipWarningPrompt && (
        <WipConfirmModal
          isOpen={wipWarningPrompt.isOpen}
          columnTitle={wipWarningPrompt.columnTitle}
          wipLimit={wipWarningPrompt.wipLimit}
          currentCount={wipWarningPrompt.currentCount}
          actionType="move"
          onConfirm={wipWarningPrompt.onConfirm}
          onCancel={wipWarningPrompt.onCancel}
        />
      )}
    </DndContext>
  );
}
