import React, { useState } from 'react';
import { AlertTriangle, X, CheckSquare } from 'lucide-react';
import type { Task, User } from '../../types';
import { getAvatarUrl } from '../../lib/avatar';

interface RemoveAssigneeWarningModalProps {
  user: User;
  parentTask: Task;
  affectedSubtasks: Task[];
  onCancel: () => void;
  onConfirm: (removeFromSubtaskIds: (string | number)[]) => void;
  onRemoveOnlyParent: () => void;
}

export const RemoveAssigneeWarningModal: React.FC<RemoveAssigneeWarningModalProps> = ({
  user,
  parentTask,
  affectedSubtasks,
  onCancel,
  onConfirm,
  onRemoveOnlyParent,
}) => {
  const [selectedSubtaskIds, setSelectedSubtaskIds] = useState<(string | number)[]>(
    affectedSubtasks.map(s => s.id)
  );

  const toggleSubtask = (id: string | number) => {
    if (selectedSubtaskIds.includes(id)) {
      setSelectedSubtaskIds(selectedSubtaskIds.filter(i => i !== id));
    } else {
      setSelectedSubtaskIds([...selectedSubtaskIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedSubtaskIds(affectedSubtasks.map(s => s.id));
  };

  const deselectAll = () => {
    setSelectedSubtaskIds([]);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-amber-500/10">
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={20} className="shrink-0" />
            <h3 className="text-sm font-bold">Cảnh báo phân công công việc</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/60">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 shadow-2xs">
              {user.avatar ? (
                <img src={getAvatarUrl(user.avatar)} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.initials || user.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Đang phụ trách {affectedSubtasks.length} Task con trong công việc này.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Bạn có muốn xóa thành viên <strong className="text-foreground">{user.name}</strong> khỏi các Task con liên quan không?
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1">
              <span>Danh sách Task con ({selectedSubtaskIds.length}/{affectedSubtasks.length})</span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="hover:text-primary transition-colors text-[10px]"
                >
                  Chọn tất cả
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="hover:text-primary transition-colors text-[10px]"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 border border-border/80 rounded-xl p-2 bg-background/50 custom-scrollbar">
              {affectedSubtasks.map(sub => {
                const checked = selectedSubtaskIds.includes(sub.id);
                return (
                  <label
                    key={sub.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 cursor-pointer text-xs transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubtask(sub.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                    />
                    <span className="truncate text-foreground font-medium flex-1">
                      {sub.title}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-muted/20 border-t border-border flex flex-col gap-2">
          {selectedSubtaskIds.length > 0 && (
            <button
              type="button"
              onClick={() => onConfirm(selectedSubtaskIds)}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-2xs"
            >
              Xóa khỏi Task cha và {selectedSubtaskIds.length} Task con đã chọn
            </button>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onRemoveOnlyParent}
              className="px-3.5 py-1.5 text-xs font-bold text-foreground bg-accent hover:bg-accent/80 border border-border rounded-xl transition-colors"
            >
              Chỉ xóa khỏi Task cha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
