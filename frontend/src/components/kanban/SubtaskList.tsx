import React, { useState } from 'react';
import { 
  CheckSquare, Plus, GripVertical, MoreVertical, 
  Calendar, Trash2, Edit3, AlertCircle, Check, Clock 
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Board, Priority } from '../../types';
import api from '../../lib/axios';
import { toast } from 'sonner';
import { getAvatarUrl } from '../../lib/avatar';
import { SubtaskDetailModal } from './SubtaskDetailModal';

interface SubtaskListProps {
  parentTask: Task;
  board: Board;
  onSubtasksChanged?: () => void;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  parentTask,
  board,
  onSubtasksChanged,
}) => {
  const [subtasks, setSubtasks] = useState<Task[]>(parentTask.subtasks || []);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addingBusy, setAddingBusy] = useState(false);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);

  // Sync state if parentTask changes
  React.useEffect(() => {
    if (parentTask.subtasks) {
      setSubtasks(parentTask.subtasks);
    }
  }, [parentTask.subtasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalCount = subtasks.length;
  const completedCount = subtasks.filter(s => !!s.completed_at || s.completedAt).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggleComplete = async (subtask: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const wasCompleted = !!subtask.completed_at || !!subtask.completedAt;
    const newStatus = !wasCompleted;

    // Optimistic update
    const previousSubtasks = [...subtasks];
    setSubtasks(prev =>
      prev.map(s =>
        s.id === subtask.id
          ? { ...s, completed_at: newStatus ? new Date().toISOString() : null, completedAt: newStatus ? new Date().toISOString() : null }
          : s
      )
    );

    try {
      await api.patch(`/tasks/subtasks/${subtask.id}`, {
        is_completed: newStatus,
      });
      if (onSubtasksChanged) onSubtasksChanged();
    } catch (err: any) {
      setSubtasks(previousSubtasks);
      toast.error('Không thể cập nhật trạng thái công việc con');
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }

    setAddingBusy(true);
    try {
      const res = await api.post(`/tasks/${parentTask.id}/subtasks`, {
        title: trimmed,
      });

      const created = res.data;
      setSubtasks(prev => [...prev, created]);
      setNewTitle('');
      setIsAdding(false);
      toast.success('Đã thêm công việc con');
      if (onSubtasksChanged) onSubtasksChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi thêm công việc con');
    } finally {
      setAddingBusy(false);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string | number) => {
    const previousSubtasks = [...subtasks];
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    setConfirmDeleteId(null);

    try {
      await api.delete(`/tasks/subtasks/${subtaskId}`);
      toast.success('Đã xóa công việc con');
      if (onSubtasksChanged) onSubtasksChanged();
    } catch (err: any) {
      setSubtasks(previousSubtasks);
      toast.error('Không thể xóa công việc con');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subtasks.findIndex(item => String(item.id) === String(active.id));
    const newIndex = subtasks.findIndex(item => String(item.id) === String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(subtasks, oldIndex, newIndex);
    setSubtasks(reordered);

    try {
      await api.patch(`/tasks/${parentTask.id}/subtasks/reorder`, {
        subtask_ids: reordered.map(item => Number(item.id)),
      });
      if (onSubtasksChanged) onSubtasksChanged();
    } catch (err: any) {
      toast.error('Lỗi khi sắp xếp lại công việc con');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header & Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="text-primary" size={20} />
            <h3 className="text-base font-bold text-foreground">Công việc con</h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
          </div>

          <span className="text-xs font-bold text-primary">
            {progressPercent}%
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Sortable Subtasks List */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={subtasks.map(s => String(s.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {subtasks.map(item => (
              <SortableSubtaskItem
                key={item.id}
                item={item}
                board={board}
                onOpenModal={() => setActiveSubtaskId(item.id)}
                onToggleComplete={(e) => handleToggleComplete(item, e)}
                menuOpen={menuOpenId === item.id}
                onToggleMenu={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === item.id ? null : item.id);
                }}
                isDeleting={confirmDeleteId === item.id}
                onConfirmDelete={() => handleDeleteSubtask(item.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onRequestDelete={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(item.id);
                  setMenuOpenId(null);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Subtask Form */}
      {isAdding ? (
        <form onSubmit={handleCreateSubtask} className="p-3 bg-muted/20 border border-input rounded-xl space-y-2.5 animate-in fade-in duration-150">
          <input
            type="text"
            autoFocus
            disabled={addingBusy}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsAdding(false);
                setNewTitle('');
              }
            }}
            placeholder="Nhập tiêu đề công việc con và ấn Enter..."
            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={addingBusy || !newTitle.trim()}
              className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Thêm công việc con
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewTitle('');
              }}
              className="px-3 py-1.5 text-muted-foreground hover:bg-muted text-xs font-semibold rounded-lg transition-colors"
            >
              Hủy (Esc)
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full py-2.5 px-3 border border-dashed border-border/80 hover:border-primary/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer group"
        >
          <Plus size={16} className="group-hover:scale-110 transition-transform text-primary" />
          <span>Thêm công việc con</span>
        </button>
      )}

      {/* Subtask Full Detail Modal */}
      {activeSubtaskId && (
        <SubtaskDetailModal
          subtaskId={activeSubtaskId}
          board={board}
          parentTaskTitle={parentTask.title}
          onClose={() => setActiveSubtaskId(null)}
          onUpdated={(updated) => {
            setSubtasks(prev => prev.map(s => s.id === updated.id ? updated : s));
            if (onSubtasksChanged) onSubtasksChanged();
          }}
          onDeleted={(deletedId) => {
            setSubtasks(prev => prev.filter(s => s.id !== deletedId));
            if (onSubtasksChanged) onSubtasksChanged();
          }}
        />
      )}
    </div>
  );
};

// Sortable Subtask Row Item
interface SortableSubtaskItemProps {
  item: Task;
  board: Board;
  onOpenModal: () => void;
  onToggleComplete: (e: React.MouseEvent) => void;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  isDeleting: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onRequestDelete: (e: React.MouseEvent) => void;
}

const SortableSubtaskItem: React.FC<SortableSubtaskItemProps> = ({
  item,
  board,
  onOpenModal,
  onToggleComplete,
  menuOpen,
  onToggleMenu,
  isDeleting,
  onConfirmDelete,
  onCancelDelete,
  onRequestDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(item.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isCompleted = !!item.completed_at || !!item.completedAt;
  const isOverdue = item.due_date && !isCompleted && new Date(item.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

  // Determine assignees
  const assignees = item.assignees || (item.assigneeId ? board.users?.filter(u => String(u.id) === String(item.assigneeId)) : []);

  // Priority color
  const priorityBadge = {
    'Khẩn cấp': 'bg-red-500/10 text-red-500 border-red-200/40 dark:border-red-900/40',
    'Cao': 'bg-orange-500/10 text-orange-500 border-orange-200/40 dark:border-orange-900/40',
    'Bình thường': 'bg-blue-500/10 text-blue-500 border-blue-200/40 dark:border-blue-900/40',
    'Thấp': 'bg-slate-500/10 text-slate-500 border-slate-200/40 dark:border-slate-800/40',
  }[item.priority || 'Bình thường'] || 'bg-muted text-muted-foreground';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/subtask relative flex items-center justify-between gap-3 p-3 bg-card hover:bg-muted/30 border border-border/70 rounded-xl transition-all shadow-2xs ${
        isCompleted ? 'bg-muted/10 opacity-75' : ''
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors touch-none"
          title="Kéo để sắp xếp thứ tự"
        >
          <GripVertical size={16} />
        </button>

        {/* Completion checkbox */}
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={() => {}}
          onClick={onToggleComplete}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer shrink-0"
        />

        {/* Title */}
        <div
          onClick={onOpenModal}
          className={`text-xs font-semibold truncate cursor-pointer hover:text-primary transition-colors flex-1 ${
            isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}
        >
          {item.title}
        </div>
      </div>

      {/* Meta indicators: Priority, Due Date, Assignees, Action */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Priority Badge */}
        {item.priority && item.priority !== 'Bình thường' && (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityBadge}`}>
            {item.priority}
          </span>
        )}

        {/* Due Date Indicator */}
        {item.due_date && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium border ${
              isOverdue
                ? 'bg-red-500/10 text-red-500 border-red-300/40'
                : 'bg-muted/50 text-muted-foreground border-border/50'
            }`}
          >
            <Clock size={11} />
            {item.due_date.split('T')[0]}
          </span>
        )}

        {/* Assignees Avatars */}
        {assignees && assignees.length > 0 && (
          <div className="flex -space-x-1.5 overflow-hidden">
            {assignees.slice(0, 3).map(u => (
              <span
                key={u.id}
                title={u.name}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-card overflow-hidden shrink-0 shadow-2xs"
              >
                {u.avatar ? (
                  <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                ) : (
                  u.initials || u.name?.charAt(0).toUpperCase() || 'U'
                )}
              </span>
            ))}
            {assignees.length > 3 && (
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-bold ring-2 ring-card">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Delete Confirmation or Actions Menu */}
        {isDeleting ? (
          <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded-lg border border-red-200 dark:border-red-900/50">
            <span className="text-[10px] text-red-500 font-semibold">Xóa?</span>
            <button
              type="button"
              onClick={onConfirmDelete}
              className="text-[10px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded hover:bg-red-700 transition-colors"
            >
              Xác nhận
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Hủy
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={onToggleMenu}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-32 bg-card border border-border/80 rounded-xl shadow-xl z-30 py-1 text-xs animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenModal();
                    onToggleMenu({} as any);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground font-medium"
                >
                  <Edit3 size={13} /> Sửa chi tiết
                </button>
                <button
                  type="button"
                  onClick={onRequestDelete}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-medium"
                >
                  <Trash2 size={13} /> Xóa
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
