import { useState, useRef, useEffect } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Plus, Palette, X, Edit2, Archive, Trash2, Gauge, AlertTriangle, ShieldAlert } from "lucide-react";
import type { Board, Column, Task } from "../../types";
import { TaskCard } from "./TaskCard";
import api from "../../lib/axios";
import { toast } from "sonner";
import { useBoardStore } from "../../store/boardStore";
import { useAuthStore } from "../../store/authStore";
import { DeleteColumnModal } from "./DeleteColumnModal";
import { ArchiveColumnModal } from "./ArchiveColumnModal";
import { WipLimitModal } from "./WipLimitModal";
import { WipConfirmModal } from "./WipConfirmModal";

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
  onAdd: _onAdd,
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

  const currentUser = useAuthStore((state) => state.user);

  // Permission checks
  const canManage = Boolean(
    board.is_owner ||
    board.my_role === 'owner' ||
    board.my_role === 'admin' ||
    (currentUser && board.owner_id && String(board.owner_id) === String(currentUser.id)) ||
    (currentUser && board.users?.some(u => String(u.id) === String(currentUser.id) && (u.role === 'admin' || u.role === 'owner')))
  );

  const isOwner = Boolean(
    board.is_owner ||
    board.my_role === 'owner' ||
    (currentUser && board.owner_id && String(board.owner_id) === String(currentUser.id)) ||
    (currentUser && board.users?.some(u => String(u.id) === String(currentUser.id) && u.role === 'owner'))
  );

  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showWipModal, setShowWipModal] = useState(false);
  const [showWipConfirmAdd, setShowWipConfirmAdd] = useState(false);

  const [currentColor, setCurrentColor] = useState(column.color || "");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fetchBoard = useBoardStore((state) => state.fetchBoard);

  // WIP calculations: Only parent/root tasks count towards WIP limit
  const rootTasks = tasks.filter((t) => !t.parentTaskId);
  const currentWipCount = rootTasks.length;
  const hasWipLimit = Boolean(column.wip_limit && column.wip_limit > 0);
  const isLimitReached = hasWipLimit && currentWipCount >= (column.wip_limit || 0);
  const isStrict = column.wip_enforcement === 'strict';

  useEffect(() => {
    if (isAddingTask) {
      inputRef.current?.focus();
    }
  }, [isAddingTask]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    };
    if (showMenu || showColorPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu, showColorPicker]);

  const executeCreateTask = async (title: string) => {
    setIsSubmitting(true);
    try {
      await api.post(`/columns/${column.id}/tasks`, { title });
      toast.success('Đã thêm thẻ mới');
      setTaskTitle("");
      setIsAddingTask(false);
      setShowWipConfirmAdd(false);
      fetchBoard(board.id, true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Lỗi khi thêm thẻ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTask = async () => {
    const trimmed = taskTitle.trim();
    if (!trimmed || isSubmitting) return;

    if (hasWipLimit && currentWipCount >= (column.wip_limit || 0)) {
      if (isStrict) {
        toast.error(`Cột "${column.title}" đã đạt giới hạn WIP tối đa (${column.wip_limit} công việc). Chế độ Nghiêm ngặt không cho phép thêm thẻ mới.`);
        return;
      } else {
        setShowWipConfirmAdd(true);
        return;
      }
    }

    await executeCreateTask(trimmed);
  };

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
    setShowMenu(false);
    try {
      await api.put(`/columns/${column.id}`, { color: colorKey });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <section
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
        }}
        className={`flex flex-col w-[85vw] sm:w-[300px] max-w-[340px] h-full min-h-0 overflow-hidden shrink-0 ${theme.bg} rounded-[16px] snap-center ${column.completed ? "opacity-80 hover:opacity-100 transition-opacity" : ""} relative`}
        aria-label={column.title}
      >
        <header className={`px-4 pt-4 pb-3 flex items-center justify-between group sticky top-0 z-10 transition-colors ${
          isLimitReached 
            ? isStrict 
              ? 'border-b border-red-500/40 bg-red-500/10' 
              : 'border-b border-amber-500/40 bg-amber-500/10'
            : ''
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
              isLimitReached
                ? isStrict
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : theme.iconBg
            }`}>
              {isLimitReached ? (
                isStrict ? <ShieldAlert size={14} /> : <AlertTriangle size={14} />
              ) : (
                <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
              )}
            </div>
            <h3 className={`font-bold text-[14px] tracking-tight truncate ${theme.header}`} title={column.title}>
              {column.title}
            </h3>

            {/* WIP Limit / Task Count Badge */}
            <span
              className={`text-[12px] font-semibold px-2 py-0.5 rounded-full shadow-sm ml-1 shrink-0 cursor-help transition-all ${
                hasWipLimit
                  ? isLimitReached
                    ? isStrict
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 ring-1 ring-red-500/20 font-bold'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 ring-1 ring-amber-500/20 font-bold'
                    : 'bg-card/70 text-foreground/80 border border-border/60'
                  : 'text-muted-foreground bg-card/60'
              }`}
              title={
                hasWipLimit
                  ? `Giới hạn WIP: ${currentWipCount}/${column.wip_limit} công việc (${
                      isStrict
                        ? 'Chế độ Nghiêm ngặt: Chặn thêm/chuyển khi đạt giới hạn'
                        : 'Chế độ Cảnh báo: Yêu cầu xác nhận khi thêm/chuyển'
                    }). Không tính task con và task đã lưu trữ/xóa.`
                  : `Tổng số công việc: ${tasks.length}`
              }
            >
              {hasWipLimit ? `${currentWipCount}/${column.wip_limit}` : tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-1 relative" ref={menuRef}>
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

            {/* Three Dots Menu Button */}
            <button
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-black/5 rounded transition-colors"
              onClick={() => {
                setShowMenu(!showMenu);
                setShowColorPicker(false);
              }}
              aria-label={`Tùy chọn cột: ${column.title}`}
              title="Tùy chọn cột"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute top-full right-0 mt-1 bg-card border border-border shadow-xl rounded-xl p-1.5 z-50 min-w-[190px] animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md">
                {/* Rename */}
                {canManage && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(column);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent rounded-lg transition-colors text-left"
                  >
                    <Edit2 size={14} className="text-muted-foreground" />
                    Đổi tên cột
                  </button>
                )}

                {/* Change Color */}
                {canManage && (
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-accent rounded-lg transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Palette size={14} className="text-muted-foreground" />
                      Đổi màu nền
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full border border-border/80" style={{ backgroundColor: currentColor ? (PREDEFINED_THEMES[currentColor]?.dot || '#a78bfa') : '#a78bfa' }} />
                  </button>
                )}

                {/* Color sub-palette */}
                {showColorPicker && (
                  <div className="p-2 my-1 bg-muted/40 rounded-lg flex items-center justify-between gap-1.5 border border-border/50">
                    {Object.keys(PREDEFINED_THEMES).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => updateColor(k)}
                        className={`w-5 h-5 rounded-full border border-border/60 ${PREDEFINED_THEMES[k].bg} ${currentColor === k ? 'ring-2 ring-primary ring-offset-1' : ''} hover:scale-115 transition-transform`}
                        title={k}
                      />
                    ))}
                  </div>
                )}

                {/* Cấu hình WIP Limit (Chỉ Owner/Admin) */}
                {canManage && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowWipModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent rounded-lg transition-colors text-left"
                  >
                    <Gauge size={14} className="text-muted-foreground" />
                    Cấu hình WIP Limit
                  </button>
                )}

                {/* Archive & Delete (Only for Admin / Owner) */}
                {canManage && (
                  <>
                    <div className="my-1 border-t border-border/60" />

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowArchiveModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors text-left"
                    >
                      <Archive size={14} />
                      Lưu trữ cột
                    </button>

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                    >
                      <Trash2 size={14} />
                      Xóa cột
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>
      
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 custom-scrollbar flex flex-col gap-3 [scrollbar-gutter:stable]">
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
        
        {tasks.length === 0 && !isAddingTask && (
          <div className={`text-center py-8 border border-dashed ${theme.border} rounded-xl text-[13px] text-muted-foreground bg-card/30`}>
            Chưa có công việc
          </div>
        )}

        {/* Inline Task Creation Form */}
        {isAddingTask && (
          <div className="bg-card rounded-xl p-3 border border-primary/40 shadow-md animate-in fade-in duration-150">
            <textarea
              ref={inputRef}
              rows={2}
              className="w-full bg-transparent resize-none text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-0 p-0 border-none"
              placeholder="Nhập tiêu đề cho thẻ này..."
              value={taskTitle}
              disabled={isSubmitting}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateTask();
                } else if (e.key === 'Escape') {
                  setIsAddingTask(false);
                  setTaskTitle("");
                }
              }}
            />
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={isSubmitting || !taskTitle.trim()}
                className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? 'Đang thêm...' : 'Thêm thẻ'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setTaskTitle("");
                }}
                disabled={isSubmitting}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                title="Hủy"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-1 mt-auto">
        {!isAddingTask ? (
          <button 
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:${theme.header} ${theme.hoverBg} hover:shadow-sm rounded-xl transition-all duration-200`}
            onClick={() => setIsAddingTask(true)}
          >
            <Plus size={16} />
            Thêm công việc
          </button>
        ) : null}
      </div>
    </section>

    {showDeleteModal && (
      <DeleteColumnModal
        isOpen={showDeleteModal}
        column={column}
        tasks={tasks}
        board={board}
        isOwner={isOwner}
        onClose={() => setShowDeleteModal(false)}
      />
    )}

    {showArchiveModal && (
      <ArchiveColumnModal
        isOpen={showArchiveModal}
        column={column}
        tasks={tasks}
        board={board}
        onClose={() => setShowArchiveModal(false)}
      />
    )}

    {showWipModal && (
      <WipLimitModal
        isOpen={showWipModal}
        column={column}
        currentWipCount={currentWipCount}
        boardId={board.id}
        onClose={() => setShowWipModal(false)}
      />
    )}

    {showWipConfirmAdd && (
      <WipConfirmModal
        isOpen={showWipConfirmAdd}
        columnTitle={column.title}
        wipLimit={column.wip_limit || 0}
        currentCount={currentWipCount}
        actionType="add"
        onConfirm={() => executeCreateTask(taskTitle.trim())}
        onCancel={() => setShowWipConfirmAdd(false)}
      />
    )}
  </>
  );
}

