import React, { useState, useMemo } from 'react';
import { 
  Search, Check, X, UserPlus, Copy, Trash2, 
  AlertCircle, ShieldCheck, UserCheck, Sparkles 
} from 'lucide-react';
import type { User as UserType } from '../../types';
import { getAvatarUrl } from '../../lib/avatar';

export interface TaskMemberPickerProps {
  boardUsers: UserType[];
  initialSelectedUserIds: (string | number)[];
  isParentTask?: boolean;
  isSubtask?: boolean;
  parentTaskAssignees?: UserType[];
  onApply: (selectedUserIds: (string | number)[], applyToSubtasks?: boolean) => void;
  onCancel: () => void;
  canManageBoard?: boolean;
  onAddOutsiderToBoard?: (user: UserType) => Promise<boolean>;
}

export const TaskMemberPicker: React.FC<TaskMemberPickerProps> = ({
  boardUsers,
  initialSelectedUserIds,
  isParentTask = false,
  isSubtask = false,
  parentTaskAssignees = [],
  onApply,
  onCancel,
  canManageBoard = false,
  onAddOutsiderToBoard,
}) => {
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(
    initialSelectedUserIds.map(id => String(id))
  );
  const [search, setSearch] = useState('');
  const [applyToSubtasks, setApplyToSubtasks] = useState(false);

  // Search filter across name, username, email, department
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boardUsers;

    return boardUsers.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const dept = (u.department?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || username.includes(q) || dept.includes(q);
    });
  }, [boardUsers, search]);

  const toggleUser = (userId: string | number) => {
    const strId = String(userId);
    if (selectedIds.includes(strId)) {
      setSelectedIds(selectedIds.filter(id => id !== strId));
    } else {
      setSelectedIds([...selectedIds, strId]);
    }
  };

  const handleCopyFromParent = () => {
    const parentIds = parentTaskAssignees.map(u => String(u.id));
    // Union / merge with existing
    const merged = Array.from(new Set([...selectedIds, ...parentIds]));
    setSelectedIds(merged);
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleApply = () => {
    onApply(selectedIds, applyToSubtasks);
  };

  return (
    <div
      className="p-4 bg-card border border-border/80 rounded-2xl shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150 w-full sm:w-96 text-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Phân công thành viên
          </h4>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Quick Action Toolbar for Subtasks */}
      {isSubtask && (
        <div className="flex items-center gap-2 pt-0.5">
          {parentTaskAssignees.length > 0 && (
            <button
              type="button"
              onClick={handleCopyFromParent}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-semibold transition-colors"
            >
              <Copy size={13} />
              <span>Sao chép từ Task cha</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 border border-border/70 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
            <span>Xóa tất cả</span>
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          autoFocus
          placeholder="Tìm theo tên, email, phòng ban..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8.5 pr-3 py-2 bg-background border border-input rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Members List */}
      <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
        {filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
            <p>Không tìm thấy thành viên trong Bảng.</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = selectedIds.includes(String(user.id));
            const deptName = user.department?.name;

            return (
              <div
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer select-none border ${
                  isSelected
                    ? 'bg-primary/10 border-primary/30 text-foreground'
                    : 'bg-card border-transparent hover:bg-accent/70 hover:border-border/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 shadow-2xs">
                    {user.avatar ? (
                      <img src={getAvatarUrl(user.avatar)} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.initials || user.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 truncate">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-foreground truncate leading-tight">{user.name}</p>
                      {user.role === 'admin' && (
                        <span className="text-[10px] text-amber-500 font-bold" title="Quản trị viên">★</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      {deptName && (
                        <span className="px-1.5 py-0.2 bg-muted text-muted-foreground rounded text-[10px] font-medium truncate max-w-[110px]">
                          {deptName}
                        </span>
                      )}
                      {user.email && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Checkbox indicator */}
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                    isSelected
                      ? 'bg-primary border-primary text-white shadow-2xs'
                      : 'border-muted-foreground/30 bg-background'
                  }`}
                >
                  {isSelected && <Check size={13} strokeWidth={3} />}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Option for Parent Tasks */}
      {isParentTask && (
        <div className="pt-2 border-t border-border/60">
          <label className="flex flex-row items-center gap-2.5 p-2 bg-muted/20 hover:bg-muted/40 rounded-xl cursor-pointer transition-colors text-xs select-none !mb-0">
            <input
              type="checkbox"
              checked={applyToSubtasks}
              onChange={(e) => setApplyToSubtasks(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer shrink-0"
            />
            <span className="font-medium text-foreground">
              Áp dụng thành viên mới cho các Task con
            </span>
          </label>
        </div>
      )}

      {/* Footer Actions */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-semibold px-1">
          Đã chọn: <strong className="text-foreground">{selectedIds.length}</strong>
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-2xs"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
};
