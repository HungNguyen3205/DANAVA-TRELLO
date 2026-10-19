import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, Plus, GripVertical, MoreVertical, 
  Calendar, Trash2, Edit3, AlertCircle, Check, Clock,
  UserPlus, Copy, Users, X, ArrowRight, CornerDownRight
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
import type { Task, Board, TaskGroup } from '../../types';
import api from '../../lib/axios';
import { toast } from 'sonner';
import { getAvatarUrl } from '../../lib/avatar';
import { SubtaskDetailModal } from './SubtaskDetailModal';
import { TaskMemberPicker } from './TaskMemberPicker';

interface SubtaskListProps {
  parentTask: Task;
  board: Board;
  onSubtasksChanged?: () => void;
  isCreateGroupOpen?: boolean;
  onCloseCreateGroup?: () => void;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  parentTask,
  board,
  onSubtasksChanged,
  isCreateGroupOpen = false,
  onCloseCreateGroup,
}) => {
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Group creation state
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [creatingGroupBusy, setCreatingGroupBusy] = useState(false);
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  // Group editing state
  const [editingGroupId, setEditingGroupId] = useState<string | number | null>(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState('');
  const [editingGroupBusy, setEditingGroupBusy] = useState(false);
  const [groupMenuOpenId, setGroupMenuOpenId] = useState<string | number | null>(null);

  // Group deletion modal state
  const [groupToDelete, setGroupToDelete] = useState<TaskGroup | null>(null);
  const [deleteChoice, setDeleteChoice] = useState<'move' | 'trash'>('move');
  const [targetGroupId, setTargetGroupId] = useState<string | number>('');
  const [isDeletingGroupBusy, setIsDeletingGroupBusy] = useState(false);

  // Subtask adding state (per group)
  const [addingSubtaskGroupId, setAddingSubtaskGroupId] = useState<string | number | null>(null);
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string | number, string>>({});
  const [subtaskInputErrors, setSubtaskInputErrors] = useState<Record<string | number, string>>({});
  const [addingSubtaskBusy, setAddingSubtaskBusy] = useState(false);
  const [creationAssigneeMode, setCreationAssigneeMode] = useState<'copy_parent' | 'none' | 'custom'>('copy_parent');
  const [creationCustomUserIds, setCreationCustomUserIds] = useState<(string | number)[]>([]);
  const [isCreationPickerOpen, setIsCreationPickerOpen] = useState(false);

  // Subtask active / menu / delete states
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [pickerForSubtaskId, setPickerForSubtaskId] = useState<string | number | null>(null);

  // Respond to sidebar "Việc cần làm" click
  useEffect(() => {
    if (isCreateGroupOpen) {
      setIsAddingGroup(true);
      setTimeout(() => {
        newGroupInputRef.current?.focus();
        newGroupInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isCreateGroupOpen]);

  // Load task groups from parentTask or API
  const fetchTaskGroups = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tasks/${parentTask.id}/groups`);
      if (Array.isArray(res.data)) {
        setTaskGroups(res.data);
      }
    } catch (err) {
      // Fallback to parentTask data if API error
      const initialGroups = parentTask.task_groups || parentTask.taskGroups;
      if (initialGroups && initialGroups.length > 0) {
        setTaskGroups(initialGroups);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const directGroups = parentTask.task_groups || parentTask.taskGroups;
    if (directGroups && directGroups.length > 0) {
      setTaskGroups(directGroups);
    } else {
      fetchTaskGroups();
    }
  }, [parentTask.id, parentTask.task_groups, parentTask.taskGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Calculate overall stats
  const allSubtasks: Task[] = taskGroups.flatMap(g => g.subtasks || []);
  const totalSubtasksAll = allSubtasks.length;
  const totalCompletedAll = allSubtasks.filter(s => !!s.completed_at || !!s.completedAt).length;
  const overallPercent = totalSubtasksAll > 0 ? Math.round((totalCompletedAll / totalSubtasksAll) * 100) : 0;

  // 1. Group Operations
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupTitle.trim();
    if (!trimmed) return;

    setCreatingGroupBusy(true);
    try {
      const res = await api.post(`/tasks/${parentTask.id}/groups`, {
        title: trimmed,
      });
      const createdGroup: TaskGroup = res.data;
      setTaskGroups(prev => [...prev, createdGroup]);
      setNewGroupTitle('');
      setIsAddingGroup(false);
      onCloseCreateGroup?.();
      toast.success('Đã tạo nhóm việc cần làm');

      // Scroll to new group & open subtask input
      setAddingSubtaskGroupId(createdGroup.id);
      setTimeout(() => {
        const groupEl = document.getElementById(`task-group-${createdGroup.id}`);
        groupEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const inputEl = document.getElementById(`subtask-input-${createdGroup.id}`);
        inputEl?.focus();
      }, 150);

      onSubtasksChanged?.();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Lỗi khi tạo nhóm việc cần làm';
      toast.error(errMsg);
    } finally {
      setCreatingGroupBusy(false);
    }
  };

  const handleUpdateGroupTitle = async (groupId: string | number) => {
    const trimmed = editingGroupTitle.trim();
    if (!trimmed) {
      setEditingGroupId(null);
      return;
    }

    setEditingGroupBusy(true);
    try {
      const res = await api.put(`/tasks/${parentTask.id}/groups/${groupId}`, {
        title: trimmed,
      });
      setTaskGroups(prev => prev.map(g => g.id === groupId ? { ...g, title: res.data.title } : g));
      setEditingGroupId(null);
      toast.success('Đã đổi tên nhóm');
      onSubtasksChanged?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi đổi tên nhóm');
    } finally {
      setEditingGroupBusy(false);
    }
  };

  const handleRequestDeleteGroup = (group: TaskGroup) => {
    setGroupMenuOpenId(null);
    const subtaskCount = group.subtasks?.length || 0;

    if (subtaskCount === 0) {
      if (window.confirm(`Bạn có chắc chắn muốn xóa nhóm "${group.title}" không?`)) {
        executeDeleteGroup(group.id, null);
      }
    } else {
      setGroupToDelete(group);
      const otherGroups = taskGroups.filter(g => g.id !== group.id);
      if (otherGroups.length > 0) {
        setDeleteChoice('move');
        setTargetGroupId(otherGroups[0].id);
      } else {
        setDeleteChoice('trash');
        setTargetGroupId('');
      }
    }
  };

  const executeDeleteGroup = async (
    groupId: string | number, 
    action: 'move' | 'trash' | null, 
    targetId?: string | number
  ) => {
    setIsDeletingGroupBusy(true);
    try {
      let url = `/tasks/${parentTask.id}/groups/${groupId}`;
      const params: any = {};
      if (action) {
        params.action = action;
        if (action === 'move' && targetId) {
          params.target_group_id = targetId;
        }
      }

      const res = await api.delete(url, { params });

      if (action === 'move' && targetId) {
        // Move subtasks to target group locally
        const movingGroup = taskGroups.find(g => g.id === groupId);
        const movingSubtasks = movingGroup?.subtasks || [];
        setTaskGroups(prev =>
          prev
            .filter(g => g.id !== groupId)
            .map(g => g.id === targetId ? { ...g, subtasks: [...(g.subtasks || []), ...movingSubtasks] } : g)
        );
      } else {
        // Remove group from state
        setTaskGroups(prev => prev.filter(g => g.id !== groupId));
      }

      setGroupToDelete(null);
      toast.success(res.data?.message || 'Đã xóa nhóm việc cần làm thành công');
      onSubtasksChanged?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa nhóm việc cần làm');
    } finally {
      setIsDeletingGroupBusy(false);
    }
  };

  // 2. Subtask Operations inside a Group
  const handleCreateSubtaskInGroup = async (groupId: string | number, e: React.FormEvent) => {
    e.preventDefault();
    const titleVal = (newSubtaskTitles[groupId] || '').trim();
    if (!titleVal) return;

    setAddingSubtaskBusy(true);
    setSubtaskInputErrors(prev => ({ ...prev, [groupId]: '' }));

    try {
      const payload: any = {
        title: titleVal,
        task_group_id: groupId,
      };

      if (creationAssigneeMode === 'copy_parent') {
        payload.copy_parent_assignees = true;
      } else if (creationAssigneeMode === 'custom' && creationCustomUserIds.length > 0) {
        payload.assignee_ids = creationCustomUserIds.map(Number);
      }

      const res = await api.post(`/tasks/${parentTask.id}/groups/${groupId}/subtasks`, payload);
      const createdSubtask: Task = res.data;

      // Update group subtasks locally
      setTaskGroups(prev =>
        prev.map(g => {
          if (g.id === groupId) {
            return {
              ...g,
              subtasks: [...(g.subtasks || []), createdSubtask],
            };
          }
          return g;
        })
      );

      // Only clear input upon success!
      setNewSubtaskTitles(prev => ({ ...prev, [groupId]: '' }));
      setSubtaskInputErrors(prev => ({ ...prev, [groupId]: '' }));
      toast.success('Đã thêm Task con');
      onSubtasksChanged?.();
    } catch (err: any) {
      // Keep input intact and show exact backend error message!
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.errors?.title?.[0] ||
        err.response?.data?.errors?.task_group_id?.[0] ||
        'Không thể thêm Task con. Vui lòng kiểm tra lại.';
      setSubtaskInputErrors(prev => ({ ...prev, [groupId]: errorMsg }));
      toast.error(errorMsg);
    } finally {
      setAddingSubtaskBusy(false);
    }
  };

  const handleToggleComplete = async (subtask: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const wasCompleted = !!subtask.completed_at || !!subtask.completedAt;
    const newStatus = !wasCompleted;

    // Optimistic update
    const previousGroups = [...taskGroups];
    setTaskGroups(prev =>
      prev.map(g => ({
        ...g,
        subtasks: (g.subtasks || []).map(s =>
          s.id === subtask.id
            ? { ...s, completed_at: newStatus ? new Date().toISOString() : null, completedAt: newStatus ? new Date().toISOString() : null }
            : s
        ),
      }))
    );

    try {
      await api.patch(`/tasks/subtasks/${subtask.id}`, {
        is_completed: newStatus,
      });
      onSubtasksChanged?.();
    } catch (err: any) {
      setTaskGroups(previousGroups);
      toast.error(err.response?.data?.message || 'Không thể cập nhật trạng thái');
    }
  };

  const handleSubtaskAssigneesApply = async (subtaskId: string | number, selectedIds: (string | number)[]) => {
    try {
      const res = await api.patch(`/tasks/${parentTask.id}/subtasks/${subtaskId}`, {
        assignee_ids: selectedIds.map(Number),
      });
      setTaskGroups(prev =>
        prev.map(g => ({
          ...g,
          subtasks: (g.subtasks || []).map(s => (s.id === subtaskId ? res.data : s)),
        }))
      );
      setPickerForSubtaskId(null);
      toast.success('Đã cập nhật thành viên Task con');
      onSubtasksChanged?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật thành viên');
    }
  };

  const handleDeleteSubtask = async (subtaskId: string | number, groupId: string | number) => {
    const previousGroups = [...taskGroups];
    setTaskGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? { ...g, subtasks: (g.subtasks || []).filter(s => s.id !== subtaskId) }
          : g
      )
    );
    setConfirmDeleteId(null);

    try {
      await api.delete(`/tasks/subtasks/${subtaskId}`);
      toast.success('Đã xóa công việc con');
      onSubtasksChanged?.();
    } catch (err: any) {
      setTaskGroups(previousGroups);
      toast.error(err.response?.data?.message || 'Không thể xóa công việc con');
    }
  };

  const handleDragEnd = async (groupId: string | number, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const group = taskGroups.find(g => g.id === groupId);
    if (!group || !group.subtasks) return;

    const oldIndex = group.subtasks.findIndex(item => String(item.id) === String(active.id));
    const newIndex = group.subtasks.findIndex(item => String(item.id) === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(group.subtasks, oldIndex, newIndex);
    setTaskGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, subtasks: reordered } : g))
    );

    try {
      await api.patch(`/tasks/${parentTask.id}/subtasks/reorder`, {
        subtask_ids: reordered.map(item => Number(item.id)),
      });
      onSubtasksChanged?.();
    } catch (err: any) {
      toast.error('Lỗi khi sắp xếp lại công việc con');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header of "Việc cần làm" */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <CheckSquare className="text-primary" size={22} />
          <h3 className="text-base font-bold text-foreground">Việc cần làm</h3>
          <span className="text-xs font-bold px-2.5 py-0.5 bg-muted rounded-full text-muted-foreground">
            {totalCompletedAll}/{totalSubtasksAll}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {totalSubtasksAll > 0 && (
            <span className="text-xs font-bold text-primary">
              {overallPercent}%
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setIsAddingGroup(true);
              setTimeout(() => newGroupInputRef.current?.focus(), 50);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer shadow-2xs"
            title="Thêm nhóm việc cần làm mới"
          >
            <Plus size={14} />
            <span>Thêm nhóm</span>
          </button>
        </div>
      </div>

      {/* 2. Overall Progress Bar (if tasks exist) */}
      {totalSubtasksAll > 0 && (
        <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden -mt-2">
          <div
            className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      )}

      {/* 3. Add Group Form */}
      {isAddingGroup && (
        <form
          onSubmit={handleCreateGroup}
          className="p-4 bg-primary/5 border border-primary/30 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Tạo nhóm việc cần làm mới
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingGroup(false);
                setNewGroupTitle('');
                onCloseCreateGroup?.();
              }}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
            >
              <X size={14} />
            </button>
          </div>

          <input
            ref={newGroupInputRef}
            type="text"
            disabled={creatingGroupBusy}
            value={newGroupTitle}
            onChange={(e) => setNewGroupTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsAddingGroup(false);
                setNewGroupTitle('');
                onCloseCreateGroup?.();
              }
            }}
            placeholder="Nhập tên nhóm... (VD: Thiết kế giao diện, Backend API)"
            className="w-full bg-background border border-input rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creatingGroupBusy || !newGroupTitle.trim()}
              className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Tạo nhóm
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingGroup(false);
                setNewGroupTitle('');
                onCloseCreateGroup?.();
              }}
              className="px-3.5 py-1.5 text-muted-foreground hover:bg-muted text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* 4. Groups Rendering */}
      {taskGroups.length === 0 && !isAddingGroup ? (
        <div className="text-center py-8 px-4 border border-dashed border-border/80 rounded-2xl bg-muted/5 space-y-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <CheckSquare size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">Chưa có nhóm việc cần làm nào</p>
            <p className="text-xs text-muted-foreground">Tạo nhóm để phân loại và giao việc cho các thành viên phụ trách.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAddingGroup(true);
              setTimeout(() => newGroupInputRef.current?.focus(), 50);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm nhóm việc cần làm</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {taskGroups.map((group) => {
            const groupSubtasks = group.subtasks || [];
            const groupTotal = groupSubtasks.length;
            const groupCompleted = groupSubtasks.filter(s => !!s.completed_at || !!s.completedAt).length;
            const groupPercent = groupTotal > 0 ? Math.round((groupCompleted / groupTotal) * 100) : 0;
            const isGroupAddingSubtask = addingSubtaskGroupId === group.id;

            return (
              <div
                key={group.id}
                id={`task-group-${group.id}`}
                className="p-4 bg-muted/10 border border-border/80 rounded-2xl space-y-3.5 transition-all group/groupcard"
              >
                {/* Group Title, Stats, and Actions */}
                <div className="flex items-center justify-between gap-3">
                  {editingGroupId === group.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        autoFocus
                        disabled={editingGroupBusy}
                        value={editingGroupTitle}
                        onChange={(e) => setEditingGroupTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateGroupTitle(group.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        className="flex-1 bg-background border border-primary/50 rounded-lg px-2.5 py-1 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        disabled={editingGroupBusy || !editingGroupTitle.trim()}
                        onClick={() => handleUpdateGroupTitle(group.id)}
                        className="px-2.5 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingGroupId(null)}
                        className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded-lg"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <h4
                        onDoubleClick={() => {
                          setEditingGroupId(group.id);
                          setEditingGroupTitle(group.title);
                        }}
                        className="text-sm font-extrabold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                        title="Bấm đúp để đổi tên"
                      >
                        {group.title}
                      </h4>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-muted rounded-full text-muted-foreground shrink-0">
                        {groupCompleted}/{groupTotal}
                      </span>
                    </div>
                  )}

                  {/* Group Progress % and Three-Dots Menu */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {groupPercent}%
                    </span>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setGroupMenuOpenId(groupMenuOpenId === group.id ? null : group.id)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        title="Tùy chọn nhóm"
                      >
                        <MoreVertical size={15} />
                      </button>

                      {groupMenuOpenId === group.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-36 bg-card border border-border/80 rounded-xl shadow-xl z-30 py-1 text-xs animate-in fade-in zoom-in-95 duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGroupId(group.id);
                              setEditingGroupTitle(group.title);
                              setGroupMenuOpenId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground font-medium"
                          >
                            <Edit3 size={13} /> Đổi tên nhóm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteGroup(group)}
                            className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-medium"
                          >
                            <Trash2 size={13} /> Xóa nhóm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Group Progress Bar */}
                <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${groupPercent}%` }}
                  />
                </div>

                {/* Subtasks List in Group */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(group.id, e)}
                >
                  <SortableContext
                    items={groupSubtasks.map(s => String(s.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {groupSubtasks.map(item => (
                        <SortableSubtaskItem
                          key={item.id}
                          item={item}
                          board={board}
                          parentTaskAssignees={parentTask.assignees || []}
                          isPickerOpen={pickerForSubtaskId === item.id}
                          onOpenMemberPicker={() =>
                            setPickerForSubtaskId(pickerForSubtaskId === item.id ? null : item.id)
                          }
                          onCloseMemberPicker={() => setPickerForSubtaskId(null)}
                          onApplyMembers={(ids) => handleSubtaskAssigneesApply(item.id, ids)}
                          onOpenModal={() => setActiveSubtaskId(item.id)}
                          onToggleComplete={(e) => handleToggleComplete(item, e)}
                          menuOpen={menuOpenId === item.id}
                          onToggleMenu={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === item.id ? null : item.id);
                          }}
                          isDeleting={confirmDeleteId === item.id}
                          onConfirmDelete={() => handleDeleteSubtask(item.id, group.id)}
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

                {/* Add Subtask in Group Form / Button */}
                {isGroupAddingSubtask ? (
                  <form
                    onSubmit={(e) => handleCreateSubtaskInGroup(group.id, e)}
                    className="p-3 bg-card border border-primary/40 rounded-xl space-y-3 animate-in fade-in duration-150 shadow-sm"
                  >
                    <div className="space-y-1">
                      <input
                        id={`subtask-input-${group.id}`}
                        type="text"
                        autoFocus
                        disabled={addingSubtaskBusy}
                        value={newSubtaskTitles[group.id] || ''}
                        onChange={(e) => {
                          setNewSubtaskTitles(prev => ({ ...prev, [group.id]: e.target.value }));
                          setSubtaskInputErrors(prev => ({ ...prev, [group.id]: '' }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setAddingSubtaskGroupId(null);
                            setIsCreationPickerOpen(false);
                          }
                        }}
                        placeholder="Nhập tiêu đề công việc con và ấn Enter..."
                        className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />

                      {/* Display explicit backend error if occurred */}
                      {subtaskInputErrors[group.id] && (
                        <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold pt-1">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>{subtaskInputErrors[group.id]}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Assignee Mode Selector */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] font-semibold text-muted-foreground mr-1">Giao việc:</span>

                      <button
                        type="button"
                        onClick={() => {
                          setCreationAssigneeMode('copy_parent');
                          setIsCreationPickerOpen(false);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          creationAssigneeMode === 'copy_parent'
                            ? 'bg-primary/10 text-primary border-primary/30 shadow-2xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border/70'
                        }`}
                        title="Sao chép toàn bộ thành viên đang phụ trách Task cha"
                      >
                        <Copy size={12} />
                        <span>Sao chép từ Task cha ({parentTask.assignees?.length || 0})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCreationAssigneeMode('none');
                          setIsCreationPickerOpen(false);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          creationAssigneeMode === 'none'
                            ? 'bg-primary/10 text-primary border-primary/30 shadow-2xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border/70'
                        }`}
                      >
                        <span>Chưa gán</span>
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setCreationAssigneeMode('custom');
                            setIsCreationPickerOpen(!isCreationPickerOpen);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            creationAssigneeMode === 'custom'
                              ? 'bg-primary/10 text-primary border-primary/30 shadow-2xs'
                              : 'bg-background hover:bg-muted text-muted-foreground border-border/70'
                          }`}
                        >
                          <UserPlus size={12} />
                          <span>
                            Tự chọn {creationCustomUserIds.length > 0 ? `(${creationCustomUserIds.length})` : '...'}
                          </span>
                        </button>

                        {isCreationPickerOpen && (
                          <div className="absolute left-0 top-full mt-1.5 z-40">
                            <TaskMemberPicker
                              boardUsers={board.users || []}
                              initialSelectedUserIds={creationCustomUserIds}
                              isSubtask={true}
                              parentTaskAssignees={parentTask.assignees || []}
                              onApply={(selectedIds) => {
                                setCreationCustomUserIds(selectedIds);
                                setCreationAssigneeMode('custom');
                                setIsCreationPickerOpen(false);
                              }}
                              onCancel={() => setIsCreationPickerOpen(false)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={addingSubtaskBusy || !(newSubtaskTitles[group.id] || '').trim()}
                        className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {addingSubtaskBusy ? 'Đang thêm...' : 'Thêm Task con (Enter)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingSubtaskGroupId(null);
                          setIsCreationPickerOpen(false);
                        }}
                        className="px-3 py-1.5 text-muted-foreground hover:bg-muted text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSubtaskGroupId(group.id);
                      setTimeout(() => {
                        document.getElementById(`subtask-input-${group.id}`)?.focus();
                      }, 50);
                    }}
                    className="w-full py-2 px-3 border border-dashed border-border/80 hover:border-primary/50 bg-background/50 hover:bg-background text-muted-foreground hover:text-foreground rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer group"
                  >
                    <Plus size={14} className="group-hover:scale-110 transition-transform text-primary" />
                    <span>+ Thêm Task con</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Delete Group Modal (when group has subtasks) */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-red-500">
                <AlertCircle size={22} className="shrink-0" />
                <h3 className="text-base font-bold text-foreground">
                  Xóa nhóm "{groupToDelete.title}"
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-bold">
                Nhóm này đang chứa {groupToDelete.subtasks?.length || 0} công việc con.
              </p>
              <p>Vui lòng chọn phương án xử lý công việc con trước khi xóa nhóm:</p>
            </div>

            {/* Radio Options */}
            <div className="space-y-3">
              {/* Option 1: Move subtasks to another group */}
              <label
                className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                  deleteChoice === 'move'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/70 hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="deleteChoice"
                  value="move"
                  checked={deleteChoice === 'move'}
                  onChange={() => setDeleteChoice('move')}
                  className="mt-1 text-primary focus:ring-primary/40"
                  disabled={taskGroups.filter(g => g.id !== groupToDelete.id).length === 0}
                />
                <div className="space-y-2 flex-1">
                  <div className="text-xs font-bold text-foreground">
                    Chuyển công việc con sang nhóm khác
                  </div>

                  {deleteChoice === 'move' && (
                    <div className="pt-1">
                      {taskGroups.filter(g => g.id !== groupToDelete.id).length > 0 ? (
                        <select
                          value={targetGroupId}
                          onChange={(e) => setTargetGroupId(e.target.value)}
                          className="w-full bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                        >
                          {taskGroups
                            .filter(g => g.id !== groupToDelete.id)
                            .map(g => (
                              <option key={g.id} value={g.id}>
                                {g.title} ({g.subtasks?.length || 0} việc con)
                              </option>
                            ))}
                        </select>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          Chưa có nhóm việc khác để chuyển sang.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </label>

              {/* Option 2: Trash group and subtasks */}
              <label
                className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                  deleteChoice === 'trash'
                    ? 'border-red-500/50 bg-red-500/5'
                    : 'border-border/70 hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="deleteChoice"
                  value="trash"
                  checked={deleteChoice === 'trash'}
                  onChange={() => setDeleteChoice('trash')}
                  className="mt-1 text-red-500 focus:ring-red-400"
                />
                <div className="space-y-1 flex-1">
                  <div className="text-xs font-bold text-red-600 dark:text-red-400">
                    Đưa cả nhóm và công việc con vào thùng rác
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Các công việc con sẽ bị ẩn và chuyển vào thùng rác (có thể khôi phục sau).
                  </p>
                </div>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeletingGroupBusy || (deleteChoice === 'move' && !targetGroupId)}
                onClick={() => executeDeleteGroup(groupToDelete.id, deleteChoice, targetGroupId)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isDeletingGroupBusy ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Subtask Full Detail Modal */}
      {activeSubtaskId && (
        <SubtaskDetailModal
          subtaskId={activeSubtaskId}
          board={board}
          parentTaskTitle={parentTask.title}
          onClose={() => setActiveSubtaskId(null)}
          onUpdated={(updated) => {
            setTaskGroups(prev =>
              prev.map(g => ({
                ...g,
                subtasks: (g.subtasks || []).map(s => (s.id === updated.id ? updated : s)),
              }))
            );
            onSubtasksChanged?.();
          }}
          onDeleted={(deletedId) => {
            setTaskGroups(prev =>
              prev.map(g => ({
                ...g,
                subtasks: (g.subtasks || []).filter(s => s.id !== deletedId),
              }))
            );
            onSubtasksChanged?.();
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
  parentTaskAssignees: any[];
  isPickerOpen: boolean;
  onOpenMemberPicker: () => void;
  onCloseMemberPicker: () => void;
  onApplyMembers: (ids: (string | number)[]) => void;
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
  parentTaskAssignees,
  isPickerOpen,
  onOpenMemberPicker,
  onCloseMemberPicker,
  onApplyMembers,
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
  const isOverdue =
    item.due_date &&
    !isCompleted &&
    new Date(item.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

  // Determine assignees
  const assignees =
    item.assignees ||
    (item.assigneeId ? board.users?.filter(u => String(u.id) === String(item.assigneeId)) : []);

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
        <div className="relative">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenMemberPicker();
            }}
            className="flex -space-x-1.5 overflow-hidden cursor-pointer p-0.5 rounded-full hover:bg-muted transition-colors"
            title="Bấm để phân công thành viên"
          >
            {assignees && assignees.length > 0 ? (
              <>
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
              </>
            ) : (
              <span className="w-6 h-6 rounded-full border border-dashed border-border/80 hover:border-primary flex items-center justify-center text-muted-foreground/60 hover:text-primary transition-colors">
                <UserPlus size={12} />
              </span>
            )}
          </div>

          {isPickerOpen && (
            <div className="absolute right-0 top-full mt-2 z-50">
              <TaskMemberPicker
                boardUsers={board.users || []}
                initialSelectedUserIds={assignees.map(u => String(u.id))}
                isSubtask={true}
                parentTaskAssignees={parentTaskAssignees}
                onApply={onApplyMembers}
                onCancel={onCloseMemberPicker}
              />
            </div>
          )}
        </div>

        {/* Delete Confirmation or Actions Menu */}
        {isDeleting ? (
          <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded-lg border border-red-200 dark:border-red-900/50">
            <span className="text-[10px] text-red-500 font-semibold">Xóa?</span>
            <button
              type="button"
              onClick={onConfirmDelete}
              className="text-[10px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded hover:bg-red-700 transition-colors cursor-pointer"
            >
              Xác nhận
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Hủy
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={onToggleMenu}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
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
                  className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground font-medium cursor-pointer"
                >
                  <Edit3 size={13} /> Sửa chi tiết
                </button>
                <button
                  type="button"
                  onClick={onRequestDelete}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-medium cursor-pointer"
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
