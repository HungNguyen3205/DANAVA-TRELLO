import { useState } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Plus, Palette } from "lucide-react";
import type { Board, Column, Task } from "../../types";
import { TaskCard } from "./TaskCard";
import api from "../../lib/axios";

const PREDEFINED_THEMES: Record<string, any> = {
  violet: { bg: "bg-[#F6F3FF] dark:bg-[#7C5CFC]/15", header: "text-[#7C5CFC] dark:text-[#a78bfa]", iconBg: "bg-[#E8E1FF] dark:bg-[#7C5CFC]/20", iconColor: "text-[#7C5CFC] dark:text-[#a78bfa]", dot: "bg-[#7C5CFC] dark:bg-[#a78bfa]", border: "border-[#7C5CFC]/20 dark:border-[#7C5CFC]/30", hoverBg: "hover:bg-card" },
  blue: { bg: "bg-[#F1F6FF] dark:bg-[#4F7DF3]/15", header: "text-[#4F7DF3] dark:text-[#60a5fa]", iconBg: "bg-[#DFE9FF] dark:bg-[#4F7DF3]/20", iconColor: "text-[#4F7DF3] dark:text-[#60a5fa]", dot: "bg-[#4F7DF3] dark:bg-[#60a5fa]", border: "border-[#4F7DF3]/20 dark:border-[#4F7DF3]/30", hoverBg: "hover:bg-card" },
  orange: { bg: "bg-[#FFF9EA] dark:bg-[#E6A92D]/15", header: "text-[#E6A92D] dark:text-[#fbbf24]", iconBg: "bg-[#FFF0C2] dark:bg-[#E6A92D]/20", iconColor: "text-[#E6A92D] dark:text-[#fbbf24]", dot: "bg-[#E6A92D] dark:bg-[#fbbf24]", border: "border-[#E6A92D]/20 dark:border-[#E6A92D]/30", hoverBg: "hover:bg-card" },
  green: { bg: "bg-[#EFFAF6] dark:bg-[#2FAF83]/15", header: "text-[#2FAF83] dark:text-[#34d399]", iconBg: "bg-[#D9F5EA] dark:bg-[#2FAF83]/20", iconColor: "text-[#2FAF83] dark:text-[#34d399]", dot: "bg-[#2FAF83] dark:bg-[#34d399]", border: "border-[#2FAF83]/20 dark:border-[#2FAF83]/30", hoverBg: "hover:bg-card" },
  gray: { bg: "bg-muted/30 dark:bg-muted/10", header: "text-foreground", iconBg: "bg-muted dark:bg-muted/20", iconColor: "text-muted-foreground", dot: "bg-muted-foreground", border: "border-border/50", hoverBg: "hover:bg-card" }
};

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
    id: `col-${column.id}`,
    data: { type: "Column", column },
    disabled,
  });

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState(column.color || "");

  const t = column.title.toLowerCase();
  let theme = PREDEFINED_THEMES.gray;

  if (currentColor && PREDEFINED_THEMES[currentColor]) {
    theme = PREDEFINED_THEMES[currentColor];
  } else {
    // Fallback to name matching
    if (t.includes("to do") || t.includes("cần làm") || t.includes("mới") || t.includes("bắt đầu")) theme = PREDEFINED_THEMES.violet;
    else if (t.includes("progress") || t.includes("đang làm") || t.includes("thực hiện")) theme = PREDEFINED_THEMES.blue;
    else if (t.includes("review") || t.includes("đánh giá") || t.includes("kiểm tra") || t.includes("duyệt")) theme = PREDEFINED_THEMES.orange;
    else if (t.includes("done") || t.includes("hoàn thành") || column.completed) theme = PREDEFINED_THEMES.green;
  }

  const updateColor = async (colorKey: string) => {
    setCurrentColor(colorKey);
    setShowColorPicker(false);
    try {
      await api.put(`/columns/${column.id}`, { color: colorKey });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`flex flex-col w-[300px] shrink-0 ${theme.bg} rounded-[16px] max-h-[calc(100vh-170px)] ${column.completed ? "opacity-80 hover:opacity-100 transition-opacity" : ""} relative`}
      aria-label={column.title}
    >
      <header className="px-4 pt-4 pb-3 flex items-center justify-between group sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 rounded flex items-center justify-center ${theme.iconBg}`}>
            <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
          </div>
          <h3 className={`font-bold text-[14px] tracking-tight ${theme.header}`}>{column.title}</h3>
          <span className="text-[12px] font-semibold text-muted-foreground bg-card/60 px-2 py-0.5 rounded-full shadow-sm ml-1">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1 relative">
          {!disabled && (
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="p-1 text-muted-foreground/60 hover:text-foreground hover:bg-black/5 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Kéo cột: ${column.title}`}
            >
              <GripVertical size={16} />
            </button>
          )}
          <button
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-black/5 rounded transition-colors"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Đổi màu nền"
          >
            <Palette size={14} />
          </button>
          <button
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-black/5 rounded transition-colors"
            onClick={() => onEdit(column)}
            aria-label={`Cài đặt cột: ${column.title}`}
            title="Đổi tên cột"
          >
            <MoreHorizontal size={16} />
          </button>

          {showColorPicker && (
            <div className="absolute top-full right-0 mt-2 bg-card border border-border shadow-xl rounded-xl p-2 z-50 flex gap-2 w-[160px] flex-wrap">
              {Object.keys(PREDEFINED_THEMES).map(k => (
                <button
                  key={k}
                  onClick={() => updateColor(k)}
                  className={`w-6 h-6 rounded-full border border-border/50 ${PREDEFINED_THEMES[k].bg} ${currentColor === k ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  title={k}
                />
              ))}
            </div>
          )}
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar flex flex-col gap-3 min-h-[120px]">
        <SortableContext
          items={tasks.map((t) => `task-${t.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              board={board}
              onOpen={onOpen}
              disabled={disabled}
              theme={theme}
            />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className={`text-center py-8 border border-dashed ${theme.border} rounded-xl text-[13px] text-muted-foreground bg-card/30`}>
            Chưa có công việc
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-1 mt-auto">
        <button 
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:${theme.header} ${theme.hoverBg} hover:shadow-sm rounded-xl transition-all duration-200`}
          onClick={() => onAdd(column.id)}
        >
          <Plus size={16} />
          Thêm công việc
        </button>
      </div>
    </section>
  );
}
