import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Trash2, Check, AlignLeft, CheckSquare, 
  MessageSquare, UserPlus, Tag, Paperclip, 
  CalendarDays, CreditCard, Clock, Send, Eye, Share2,
  PieChart
} from 'lucide-react';
import type { Task, Board } from '../../types';
import api from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';
import { useBoardStore } from '../../store/boardStore';
import { toast } from 'sonner';
import { getAvatarUrl } from '../../lib/avatar';
import { copyToClipboard } from '../../lib/clipboard';
import { PrioritySelect } from '../ui/PrioritySelect';
import { StatusSelect } from '../ui/StatusSelect';
import { TaskDatesModal } from './TaskDatesModal';
import { SubtaskList } from './SubtaskList';
import { SafeLinkifiedText } from '../common/SafeLinkifiedText';
import { AssigneeSelect } from './AssigneeSelect';
import { TaskMemberPicker } from './TaskMemberPicker';
import { TaskContributionModal } from './TaskContributionModal';
import { RemoveAssigneeWarningModal } from './RemoveAssigneeWarningModal';

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split(' ')[0].split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

interface TaskDetailModalProps {
  task: Task;
  board: Board;
  onClose: () => void;
}

export function TaskDetailModal({ task, board, onClose }: TaskDetailModalProps) {
  const currentUser = useAuthStore(state => state.user);
  const [draft, setDraft] = useState<Task>(structuredClone(task));
  const [isEditingDesc, setIsEditingDesc] = useState(!task.description);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isLabelsVisible, setIsLabelsVisible] = useState(false);
  const [isMembersVisible, setIsMembersVisible] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [memberToRemoveWarning, setMemberToRemoveWarning] = useState<{ user: any; affectedSubtasks: Task[] } | null>(null);
  const [pendingAssigneeIds, setPendingAssigneeIds] = useState<(string | number)[] | null>(null);
  const [isDatesVisible, setIsDatesVisible] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const canManageBoard = currentUser?.system_role === 'admin' ||
    (board as any).role === 'admin' ||
    (board as any).role === 'owner' ||
    (board.owner_id && currentUser?.id && String(board.owner_id) === String(currentUser.id));

  const executeAssigneeUpdate = async (selectedIds: (string | number)[], applyToSubtasks = false) => {
    try {
      setBusy(true);
      const res = await api.put(`/tasks/${task.id}/assignees`, {
        assignee_ids: selectedIds.map(Number),
        apply_to_subtasks: applyToSubtasks,
      });

      const updatedTask = res.data.task;
      if (updatedTask) {
        update({
          assignees: updatedTask.assignees,
          assigneeId: updatedTask.assignees?.[0]?.id ? String(updatedTask.assignees[0].id) : '',
          subtasks: updatedTask.subtasks || draft.subtasks,
        });

        useBoardStore.getState().setBoard(b => {
          if (!b) return b;
          return {
            ...b,
            tasks: b.tasks.map(t => t.id === task.id ? { ...t, assignees: updatedTask.assignees } : t),
          };
        });
      }
      setIsMembersVisible(false);
      toast.success('Đã cập nhật thành viên thành công');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật thành viên');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyAssignees = async (selectedIds: (string | number)[], applyToSubtasks?: boolean) => {
    const currentAssignees = draft.assignees || [];
    const removedUsers = currentAssignees.filter(u => !selectedIds.map(String).includes(String(u.id)));

    // Check if any removed user is in subtasks
    if (removedUsers.length > 0 && draft.subtasks && draft.subtasks.length > 0) {
      for (const removedUser of removedUsers) {
        const affected = draft.subtasks.filter(sub => 
          sub.assignees?.some(a => String(a.id) === String(removedUser.id)) ||
          String(sub.assigneeId) === String(removedUser.id)
        );
        if (affected.length > 0) {
          setPendingAssigneeIds(selectedIds);
          setMemberToRemoveWarning({ user: removedUser, affectedSubtasks: affected });
          return;
        }
      }
    }

    await executeAssigneeUpdate(selectedIds, applyToSubtasks);
  };

  const handleConfirmRemoveFromSubtasks = async (subtaskIds: (string | number)[]) => {
    if (!memberToRemoveWarning) return;
    try {
      setBusy(true);
      await api.delete(`/tasks/${task.id}/assignees/${memberToRemoveWarning.user.id}`, {
        data: {
          remove_from_subtasks: true,
          subtask_ids: subtaskIds.map(Number),
        }
      });
      const res = await api.get(`/tasks/${task.id}`);
      update(res.data);
      useBoardStore.getState().setBoard(b => {
        if (!b) return b;
        return {
          ...b,
          tasks: b.tasks.map(t => t.id === task.id ? { ...t, assignees: res.data.assignees } : t),
        };
      });
      setMemberToRemoveWarning(null);
      setIsMembersVisible(false);
      toast.success(`Đã xóa ${memberToRemoveWarning.user.name} khỏi Task cha và các Task con`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveQualityReview = async (rating: number, note: string) => {
    try {
      await api.post(`/tasks/${task.id}/review`, { rating, summary: note });
      update({ qualityRating: rating, qualityReviewNote: note });
      toast.success('Đã lưu đánh giá chất lượng');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu đánh giá');
    }
  };

  const newCommentRef = useRef<HTMLTextAreaElement | null>(null);
  const editCommentRef = useRef<HTMLTextAreaElement | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null, maxHeight = 260) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    adjustTextareaHeight(newCommentRef.current, 260);
  }, [newComment]);

  useEffect(() => {
    adjustTextareaHeight(editCommentRef.current, 260);
  }, [editingCommentText, editingCommentId]);

  useEffect(() => {
    if (isEditingDesc) {
      adjustTextareaHeight(descRef.current, 500);
    }
  }, [draft.description, isEditingDesc]);
  
  // Label states
  const [labelSearch, setLabelSearch] = useState("");
  const [editingLabel, setEditingLabel] = useState<any>(null);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [labelDraftName, setLabelDraftName] = useState("");
  const [labelDraftColor, setLabelDraftColor] = useState("");

  const update = (value: Partial<Task>) => {
    setDraft(d => ({ ...d, ...value }));
  };

  React.useEffect(() => {
    let mounted = true;
    api.get(`/tasks/${task.id}`).then(res => {
      if (!mounted) return;
      const t = res.data;
      const fullTask: Task = {
        ...draft,
        subtasks: t.subtasks || [],
        assignees: t.assignees || [],
        assigneeId: t.assignee_id ? String(t.assignee_id) : (t.assignees?.[0]?.id ? String(t.assignees[0].id) : ''),
        complexity: t.complexity || 'M',
        qualityRating: t.quality_rating,
        qualityReviewNote: t.quality_review_note,
        checklists: (t.checklists || []).map((cl: any) => ({
          id: String(cl.id),
          title: cl.title,
          items: (cl.items || []).map((i: any) => ({
            id: String(i.id),
            text: i.content,
            done: !!i.is_completed
          }))
        })),
        attachments: (t.attachments || []).map((a: any) => ({
          id: String(a.id),
          fileName: a.file_name,
          filePath: a.file_path,
          mimeType: a.mime_type,
          size: a.size,
          userId: String(a.user_id),
          createdAt: a.created_at
        })),
        comments: t.comments || [],
        labels: t.labels ? t.labels.map((l: any) => ({ id: String(l.id), name: l.name, color: l.color })) : []
      };
      setDraft(fullTask);
      
      // We also update the main board store silently to cache these details
      useBoardStore.getState().setBoard(b => {
        if (!b) return b;
        return {
          ...b,
          tasks: b.tasks.map(bt => bt.id === task.id ? fullTask : bt)
        };
      });
    }).catch(console.error);
    return () => { mounted = false; };
  }, [task.id]);

  const save = async (immediateUpdate?: Partial<Task>) => {
    setBusy(true);
    const payload = immediateUpdate ? { ...draft, ...immediateUpdate } : draft;
    const selectedUserIds = payload.assignees?.map(u => Number(u.id)) || 
      (payload.assigneeId ? [Number(payload.assigneeId)] : []);

    try {
      await api.put(`/tasks/${task.id}`, {
        title: payload.title,
        description: payload.description,
        column_id: payload.columnId,
        priority: payload.priority,
        complexity: payload.complexity || 'M',
        assignee_id: selectedUserIds[0] || null,
        assignee_ids: selectedUserIds,
        start_date: payload.startDate || null,
        due_date: payload.dueDate || null,
        completed_at: payload.completedAt || null,
      });
      // Do not close the modal here, so user can continue editing.
      // BoardView will refresh the board when the modal is finally closed.
      toast.success('Đã lưu thay đổi');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Có lỗi xảy ra khi lưu');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success('Đã xóa công việc');
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể xóa công việc');
    } finally {
      setBusy(false);
    }
  };
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { content: newComment });
      update({ comments: [res.data, ...draft.comments] });
      setNewComment("");
      toast.success('Đã gửi bình luận');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể gửi bình luận');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEditComment = async (commentId: string | number) => {
    if (!editingCommentText.trim()) return;
    setBusy(true);
    try {
      const res = await api.put(`/comments/${commentId}`, { content: editingCommentText });
      update({
        comments: draft.comments.map(c => c.id === commentId ? res.data : c)
      });
      setEditingCommentId(null);
      setEditingCommentText("");
      toast.success('Đã cập nhật bình luận');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể cập nhật bình luận');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteComment = async (commentId: string | number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    setBusy(true);
    try {
      await api.delete(`/comments/${commentId}`);
      update({
        comments: draft.comments.filter(c => c.id !== commentId)
      });
      toast.success('Đã xóa bình luận');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể xóa bình luận');
    } finally {
      setBusy(false);
    }
  };

  const currentColumn = board.columns.find(c => c.id === draft.columnId);
  const assignedUser = board.users?.find(u => u.id === draft.assigneeId);

  const handleShareTask = async () => {
    const publicCode = board.publicId || board.id;
    const taskUrl = `${window.location.origin}/${publicCode}/kanban?task=${task.id}`;
    const success = await copyToClipboard(taskUrl);
    if (success) {
      toast.success('Đã sao chép liên kết');
    } else {
      toast.error('Không thể sao chép liên kết. Vui lòng sao chép thủ công.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200 overflow-y-auto py-6 px-3 md:py-10 md:px-4" onClick={onClose}>
      <div 
        className="w-full max-w-5xl bg-card rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-border flex flex-col relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <header className="px-6 lg:px-8 pt-8 pb-5 flex items-start justify-between bg-card shrink-0 border-b border-border/50">
          <div className="flex gap-4 items-start w-full pr-28">
            <CreditCard className="text-muted-foreground mt-1.5 shrink-0" size={24} />
            <div className="w-full">
              <div className="flex items-center text-[13px] text-muted-foreground font-medium mb-1.5 gap-2">
                <span>{board.title}</span>
                <span className="text-border text-xs">/</span>
                <span className="text-foreground underline decoration-muted-foreground/30 underline-offset-4">{currentColumn?.title}</span>
              </div>
              <input 
                className="w-full text-[22px] font-bold text-foreground bg-transparent border border-transparent hover:border-border focus:bg-input focus:border-primary focus:ring-1 focus:ring-primary/50 px-3 py-1.5 -ml-3 rounded-md transition-colors leading-tight"
                value={draft.title} 
                onChange={e => update({ title: e.target.value })}
                onBlur={() => save()}
              />
            </div>
          </div>
          
          <div className="absolute right-5 top-5 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={handleShareTask}
              title="Chia sẻ liên kết công việc"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors border border-border/60 shadow-2xs"
            >
              <Share2 size={13} className="text-primary" />
              <span>Chia sẻ</span>
            </button>
            <button 
              onClick={onClose} 
              title="Đóng"
              className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:bg-accent hover:text-foreground rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex flex-col md:flex-row bg-card">
          {/* Main Content Area (Left) */}
          <div className="flex-1 p-6 lg:p-8 border-r border-border min-h-[500px]">
            
            {/* Metadata row (if labels/members/dates exist) */}
            {(draft.labels.length > 0 || draft.assigneeId || draft.dueDate || draft.startDate) && (
              <div className="flex flex-wrap gap-8 mb-8 ml-10">
                {((draft.assignees && draft.assignees.length > 0) || draft.assigneeId) && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thành viên</h3>
                      <button
                        type="button"
                        onClick={() => setIsContributionModalOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-bold transition-colors"
                        title="Xem và điều chỉnh tỷ lệ đóng góp"
                      >
                        <PieChart size={12} />
                        <span>Phân bổ đóng góp</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        onClick={() => setIsMembersVisible(true)}
                        className="flex items-center -space-x-2 cursor-pointer p-1 rounded-full hover:bg-accent/60 transition-colors"
                        title="Bấm để chỉnh sửa phân công thành viên"
                      >
                        {(draft.assignees && draft.assignees.length > 0 
                          ? draft.assignees 
                          : (assignedUser ? [assignedUser] : [])
                        ).slice(0, 4).map(u => (
                          <div key={u.id} className="relative group/avatar">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-card overflow-hidden shadow-2xs block">
                              {u.avatar ? (
                                <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                u.initials || u.name?.charAt(0).toUpperCase() || 'U'
                              )}
                            </span>

                            {/* Hover Tooltip */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/avatar:flex flex-col items-center z-50 pointer-events-none">
                              <div className="bg-popover text-popover-foreground border border-border shadow-xl px-2.5 py-1.5 rounded-xl text-[11px] whitespace-nowrap min-w-[120px] text-center">
                                <p className="font-bold">{u.name}</p>
                                {u.department?.name && (
                                  <p className="text-[10px] text-muted-foreground">{u.department.name}</p>
                                )}
                                <p className="text-[10px] text-primary font-semibold">
                                  {(u as any).pivot?.contribution_percent !== undefined
                                    ? `Đóng góp: ${(u as any).pivot.contribution_percent}%`
                                    : (u.role || 'Thành viên')}
                                </p>
                              </div>
                              <div className="w-2 h-2 bg-popover border-b border-r border-border rotate-45 -mt-1" />
                            </div>
                          </div>
                        ))}

                        {(draft.assignees && draft.assignees.length > 4) && (
                          <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold ring-2 ring-card shadow-2xs">
                            +{draft.assignees.length - 4}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsMembersVisible(true)}
                        className="w-8 h-8 rounded-full border border-dashed border-border/80 hover:border-primary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                        title="Thêm thành viên"
                      >
                        <UserPlus size={15} />
                      </button>
                    </div>
                  </div>
                )}
                {draft.labels.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nhãn</h3>
                    <div className="flex flex-wrap gap-2">
                      {draft.labels.map(l => (
                        <span 
                          key={l.id} 
                          className="px-3 py-1 text-white text-sm font-semibold rounded shadow-sm"
                          style={{ backgroundColor: l.color }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {draft.dueDate && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hạn hoàn thành</h3>
                    <button
                      type="button"
                      onClick={() => setIsDatesVisible(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/70 hover:bg-accent text-foreground text-xs font-semibold rounded-xl transition-all border border-border/80 shadow-xs hover:border-primary/50 group cursor-pointer"
                    >
                      <CalendarDays size={14} className="text-primary group-hover:scale-110 transition-transform" />
                      <span>
                        {formatDateDisplay(draft.dueDate)}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className="flex gap-4 items-start mb-10">
              <AlignLeft className="text-muted-foreground shrink-0 mt-1" size={24} />
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-foreground">Mô tả</h3>
                  {!isEditingDesc && (
                    <button 
                      onClick={() => setIsEditingDesc(true)}
                      className="px-3 py-1.5 bg-accent/50 hover:bg-accent text-sm font-medium rounded-md transition-colors"
                    >
                      Chỉnh sửa
                    </button>
                  )}
                </div>
                
                {isEditingDesc ? (
                  <div className="space-y-3">
                    <textarea 
                      ref={descRef}
                      rows={3}
                      placeholder="Thêm mô tả chi tiết hơn..."
                      className="w-full p-3 rounded-lg bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm resize-none shadow-sm min-h-[90px] max-h-[500px] leading-relaxed transition-[height] duration-75"
                      value={draft.description} 
                      onChange={e => update({ description: e.target.value })}
                      onInput={e => adjustTextareaHeight(e.currentTarget, 500)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsEditingDesc(false); save(); }}
                        className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors"
                      >
                        Lưu
                      </button>
                      <button 
                        onClick={() => setIsEditingDesc(false)}
                        className="px-4 py-1.5 hover:bg-accent text-muted-foreground text-sm font-medium rounded-md transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => {
                      if (!draft.description) {
                        setIsEditingDesc(true);
                      }
                    }}
                    onDoubleClick={() => setIsEditingDesc(true)}
                    className="p-4 bg-accent/20 hover:bg-accent/30 border border-border/40 rounded-xl text-sm min-h-[60px] transition-colors"
                  >
                    {draft.description ? (
                      <SafeLinkifiedText text={draft.description} />
                    ) : (
                      <span 
                        onClick={() => setIsEditingDesc(true)} 
                        className="text-muted-foreground italic cursor-pointer block"
                      >
                        Thêm mô tả chi tiết hơn... (Liên kết URL sẽ tự động nhận diện)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Unified Việc cần làm (Task Groups & Subtasks) */}
            <div className="mb-8">
              <SubtaskList 
                parentTask={draft} 
                board={board} 
                isCreateGroupOpen={isCreateGroupOpen}
                onCloseCreateGroup={() => setIsCreateGroupOpen(false)}
                onSubtasksChanged={() => {
                  api.get(`/tasks/${task.id}`).then(res => {
                    if (res.data) {
                      const updated = {
                        ...draft,
                        subtasks: res.data.subtasks || [],
                        task_groups: res.data.taskGroups || res.data.task_groups || [],
                        totalSubtasksCount: res.data.subtasks?.length || 0,
                        doneSubtasksCount: res.data.subtasks?.filter((s: any) => s.completed_at).length || 0
                      };
                      setDraft(updated);
                      useBoardStore.getState().setBoard(b => {
                        if (!b) return b;
                        return {
                          ...b,
                          tasks: b.tasks.map(bt => bt.id === task.id ? updated : bt)
                        };
                      });
                    }
                  });
                }}
              />
            </div>

            {/* Attachments */}
            {draft.attachments && draft.attachments.length > 0 && (
              <div className="flex gap-4 items-start mb-10">
                <Paperclip className="text-muted-foreground shrink-0 mt-1" size={24} />
                <div className="w-full">
                  <h3 className="text-lg font-bold text-foreground mb-3">Đính kèm</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {draft.attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 p-3 bg-accent/30 hover:bg-accent/50 rounded-lg group/att transition-colors">
                        <div className="w-10 h-10 shrink-0 bg-accent rounded flex items-center justify-center text-muted-foreground font-bold text-xs uppercase">
                          {att.fileName.split('.').pop()?.substring(0, 3)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{att.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(att.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <a href={getAvatarUrl(`/storage/${att.filePath}`)} target="_blank" rel="noreferrer" className="p-2 hover:bg-accent rounded text-muted-foreground transition-colors">
                          Mở
                        </a>
                        <button 
                          onClick={async () => {
                            try {
                              await api.delete(`/attachments/${att.id}`);
                              update({ attachments: draft.attachments.filter(a => a.id !== att.id) });
                            } catch(e) {}
                          }}
                          className="p-2 hover:bg-accent rounded text-red-400 opacity-0 group-hover/att:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Activity / Comments */}
            <div className="flex gap-4 items-start">
              <MessageSquare className="text-muted-foreground shrink-0 mt-1" size={24} />
              <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">Hoạt động</h3>
                </div>
                
                <div className="flex gap-3 mb-8">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 overflow-hidden">
                    {currentUser?.avatar ? (
                      <img src={getAvatarUrl(currentUser.avatar)} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <textarea 
                      ref={newCommentRef}
                      rows={1}
                      placeholder="Viết bình luận... (Enter để gửi, Shift + Enter để xuống dòng)"
                      className="w-full p-3 pr-10 rounded-lg bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm resize-none shadow-sm min-h-[44px] max-h-[260px] leading-relaxed transition-[height] duration-75"
                      value={newComment} 
                      onChange={e => setNewComment(e.target.value)}
                      onInput={e => adjustTextareaHeight(e.currentTarget)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          if ((e.nativeEvent as any).isComposing) return;
                          e.preventDefault();
                          if (!busy && newComment.trim()) {
                            handleAddComment();
                          }
                        }
                      }}
                    />
                    <button 
                      className="absolute right-2 bottom-2 p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                      onClick={handleAddComment}
                      disabled={busy || !newComment.trim()}
                      title="Gửi (Enter)"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {draft.comments.length > 0 ? (
                    draft.comments.map(c => {
                      const isAuthor = currentUser && (String(currentUser.id) === String(c.user_id) || String(currentUser.id) === String(c.user?.id));
                      const isEditing = editingCommentId === c.id;

                      return (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden shadow-xs ring-1 ring-border/50">
                            {c.user?.avatar ? (
                              <img src={getAvatarUrl(c.user.avatar)} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              c.user?.name?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="font-bold text-sm text-foreground">{c.user?.name || 'Người dùng'}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.created_at ? new Date(c.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                              </span>
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 mt-1">
                                <textarea
                                  ref={editCommentRef}
                                  rows={1}
                                  className="w-full p-2.5 rounded-lg bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm resize-none shadow-sm min-h-[42px] max-h-[260px] leading-relaxed transition-[height] duration-75"
                                  value={editingCommentText}
                                  onChange={e => setEditingCommentText(e.target.value)}
                                  onInput={e => adjustTextareaHeight(e.currentTarget)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      if ((e.nativeEvent as any).isComposing) return;
                                      e.preventDefault();
                                      if (!busy && editingCommentText.trim()) {
                                        handleSaveEditComment(c.id);
                                      }
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditComment(c.id)}
                                    disabled={busy || !editingCommentText.trim()}
                                    className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentText("");
                                    }}
                                    className="px-3 py-1 bg-accent hover:bg-border text-foreground text-xs font-semibold rounded-md transition-colors cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-card border border-border/50 p-3 rounded-lg rounded-tl-none text-sm shadow-sm leading-relaxed text-foreground">
                                <SafeLinkifiedText text={c.content} />
                              </div>
                            )}

                            {isAuthor && !isEditing && (
                              <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditingCommentText(c.content);
                                  }}
                                  className="hover:text-foreground hover:underline cursor-pointer"
                                >
                                  Chỉnh sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="hover:text-rose-500 hover:underline cursor-pointer"
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg bg-card/20">
                      Chưa có bình luận nào
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Sidebar Area (Right) */}
          <aside className="w-full md:w-[32%] lg:w-[30%] p-6 lg:p-8 bg-muted/20 shrink-0 flex flex-col gap-8 border-l border-border/50">
            
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Trạng thái</h4>
              <StatusSelect
                value={draft.columnId}
                columns={board.columns}
                onChange={(colId) => {
                  update({ columnId: colId });
                  save({ columnId: colId });
                }}
              />
            </div>

            {/* Complexity (Độ phức tạp) */}
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Độ phức tạp (Điểm)</h4>
              <select
                value={draft.complexity || 'M'}
                onChange={(e) => {
                  const val = e.target.value as any;
                  update({ complexity: val });
                  save({ complexity: val });
                }}
                className="w-full bg-card border border-border/80 rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/40 shadow-xs cursor-pointer"
              >
                <option value="XS">XS (1 điểm - Rất nhỏ)</option>
                <option value="S">S (2 điểm - Nhỏ)</option>
                <option value="M">M (3 điểm - Tiêu chuẩn)</option>
                <option value="L">L (5 điểm - Lớn)</option>
                <option value="XL">XL (8 điểm - Rất lớn)</option>
              </select>
            </div>

            {/* Quality Review (Owner/Admin only) */}
            {canManageBoard && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Đánh giá chất lượng
                  </h4>
                  {draft.qualityRating && (
                    <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400">
                      {draft.qualityRating}/5 ★
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleSaveQualityReview(star, draft.qualityReviewNote || '')}
                      className={`text-lg transition-transform hover:scale-125 cursor-pointer ${
                        (draft.qualityRating || 0) >= star ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'
                      }`}
                      title={`Đánh giá ${star} sao`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {draft.qualityReviewNote && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                    "{draft.qualityReviewNote}"
                  </p>
                )}
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Thêm vào thẻ</h4>
              <div className="space-y-2">
                <SidebarButton icon={<UserPlus size={16} />} label="Thành viên" onClick={() => setIsMembersVisible(!isMembersVisible)} />
                <SidebarButton icon={<Tag size={16} />} label="Nhãn" onClick={() => setIsLabelsVisible(!isLabelsVisible)} />
                <SidebarButton icon={<CheckSquare size={16} />} label="Việc cần làm" onClick={() => setIsCreateGroupOpen(true)} />
                {/* <SidebarButton icon={<CalendarDays size={16} />} label="Ngày" onClick={() => setIsDatesVisible(!isDatesVisible)} /> */}
                <label className="block w-full !mb-0 cursor-pointer">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await api.post(`/tasks/${task.id}/attachments`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        const newAtt = {
                          id: String(res.data.id),
                          fileName: res.data.file_name,
                          filePath: res.data.file_path,
                          mimeType: res.data.mime_type,
                          size: res.data.size,
                          userId: String(res.data.user_id),
                          createdAt: res.data.created_at
                        };
                        update({ attachments: [newAtt, ...(draft.attachments || [])] });
                        toast.success('Đã tải tệp lên');
                      } catch(err) {
                        toast.error('Lỗi khi tải tệp lên');
                      }
                    }}
                  />
                  <div className="w-full flex items-center gap-3 px-3 py-2 bg-card hover:bg-accent text-foreground/90 rounded-xl font-semibold text-[13px] transition-all text-left border border-border/80 shadow-sm hover:shadow hover:-translate-y-px cursor-pointer">
                    <span className="text-muted-foreground"><Paperclip size={16} /></span>
                    <span>Đính kèm</span>
                  </div>
                </label>
              </div>



              {isMembersVisible && (
                <div className="mt-2">
                  <TaskMemberPicker
                    boardUsers={board.users || []}
                    initialSelectedUserIds={
                      draft.assignees && draft.assignees.length > 0
                        ? draft.assignees.map(u => String(u.id))
                        : (draft.assigneeId ? [String(draft.assigneeId)] : [])
                    }
                    isParentTask={true}
                    onApply={handleApplyAssignees}
                    onCancel={() => setIsMembersVisible(false)}
                    canManageBoard={canManageBoard}
                  />
                </div>
              )}

              {isLabelsVisible && (
                <div className="mt-2 p-4 bg-card border border-border/80 rounded-2xl shadow-xl animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-bold text-foreground mb-3 flex justify-between items-center">
                    Nhãn
                    <button onClick={() => {
                      setIsLabelsVisible(false);
                      setIsCreatingLabel(false);
                      setEditingLabel(null);
                    }} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <X size={14} />
                    </button>
                  </h4>

                  {isCreatingLabel || editingLabel ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                          {editingLabel ? 'Chỉnh sửa nhãn' : 'Tạo nhãn mới'}
                        </label>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Tên nhãn..."
                          value={labelDraftName}
                          onChange={e => setLabelDraftName(e.target.value)}
                          className="w-full bg-background border border-input rounded py-1.5 px-2 text-sm text-foreground focus:border-primary/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Màu sắc</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#64748b'].map(color => (
                            <button
                              key={color}
                              onClick={() => setLabelDraftColor(color)}
                              className={`w-7 h-7 rounded flex items-center justify-center transition-transform hover:scale-110 ${labelDraftColor === color ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''}`}
                              style={{ backgroundColor: color }}
                            >
                              {labelDraftColor === color && <Check size={14} className="text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={async () => {
                            if (!labelDraftName.trim() || !labelDraftColor) return;
                            setBusy(true);
                            try {
                              if (editingLabel) {
                                const res = await api.put(`/labels/${editingLabel.id}`, { name: labelDraftName, color: labelDraftColor });
                                // Update board labels locally (not fully persistent across refresh unless boardStore is updated, but good enough for this view)
                                const updatedLabels = board.labels?.map(l => l.id === editingLabel.id ? res.data : l) || [];
                                board.labels = updatedLabels;
                                // Update draft tasks
                                update({ labels: draft.labels.map(l => l.id === editingLabel.id ? res.data : l) });
                                setEditingLabel(null);
                                toast.success('Đã cập nhật nhãn');
                              } else {
                                const res = await api.post(`/boards/${board.id}/labels`, { name: labelDraftName, color: labelDraftColor });
                                board.labels = [...(board.labels || []), res.data];
                                setIsCreatingLabel(false);
                                toast.success('Đã tạo nhãn');
                              }
                            } catch (e: any) {
                              toast.error(e.response?.data?.message || 'Có lỗi xảy ra');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          disabled={busy}
                          className="flex-1 bg-primary text-white text-xs font-semibold py-2 rounded hover:bg-orange-600 transition-colors"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatingLabel(false);
                            setEditingLabel(null);
                          }}
                          className="px-3 py-2 bg-accent hover:bg-border text-foreground text-xs font-semibold rounded transition-colors"
                        >
                          Hủy
                        </button>
                      </div>
                      {editingLabel && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Bạn có chắc chắn muốn xóa nhãn "${editingLabel.name}"? Nhãn sẽ bị gỡ khỏi tất cả nhiệm vụ đang dùng.`)) return;
                            setBusy(true);
                            try {
                              await api.delete(`/labels/${editingLabel.id}`);
                              board.labels = board.labels?.filter(l => l.id !== editingLabel.id);
                              update({ labels: draft.labels.filter(l => l.id !== editingLabel.id) });
                              setEditingLabel(null);
                              toast.success('Đã xóa nhãn');
                            } catch (e: any) {
                              toast.error('Lỗi khi xóa nhãn');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          disabled={busy}
                          className="w-full mt-2 bg-red-500/10 text-red-500 text-xs font-semibold py-2 rounded hover:bg-red-500 hover:text-white transition-colors"
                        >
                          Xóa nhãn
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <input 
                        type="text" 
                        placeholder="Tìm nhãn..." 
                        className="w-full mb-3 bg-background border border-input rounded py-1.5 px-2 text-sm text-foreground focus:border-primary/50 outline-none"
                        value={labelSearch}
                        onChange={e => setLabelSearch(e.target.value)}
                      />
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {board?.labels?.filter(l => l.name.toLowerCase().includes(labelSearch.toLowerCase())).map(label => {
                          const isSelected = draft.labels.some(l => String(l.id) === String(label.id));
                          return (
                            <div key={label.id} className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  const newLabels = isSelected 
                                    ? draft.labels.filter(l => String(l.id) !== String(label.id)) 
                                    : [...draft.labels, label];
                                  update({ labels: newLabels });
                                  try {
                                    await api.post(`/tasks/${task.id}/labels`, { label_ids: newLabels.map(l => l.id) });
                                  } catch(e) {
                                    update({ labels: draft.labels }); // revert
                                    toast.error('Lỗi khi gắn nhãn');
                                  }
                                }}
                                className="flex-1 text-left px-2 py-1.5 rounded text-[13px] font-semibold text-white flex items-center justify-between transition-opacity hover:opacity-80"
                                style={{ backgroundColor: label.color }}
                              >
                                <span className="truncate pr-2">{label.name}</span>
                                {isSelected && <CheckSquare size={14} className="shrink-0 text-white" />}
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingLabel(label);
                                  setLabelDraftName(label.name);
                                  setLabelDraftColor(label.color);
                                }}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                        {(!board?.labels || board.labels.length === 0) && (
                          <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground mb-2">Bảng này chưa có nhãn nào.</p>
                            <button
                              onClick={() => {
                                setIsCreatingLabel(true);
                                setLabelDraftName("");
                                setLabelDraftColor("#3b82f6");
                              }}
                              className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded hover:bg-primary/20 transition-colors"
                            >
                              Tạo nhãn đầu tiên
                            </button>
                          </div>
                        )}
                      </div>
                      {board?.labels && board.labels.length > 0 && (
                        <button
                          onClick={() => {
                            setIsCreatingLabel(true);
                            setLabelDraftName("");
                            setLabelDraftColor("#3b82f6");
                          }}
                          className="w-full mt-3 py-1.5 bg-accent text-foreground text-xs font-semibold rounded hover:bg-border transition-colors"
                        >
                          Tạo nhãn mới
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Chi tiết</h4>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-foreground/90">Mức ưu tiên</span>
                  <PrioritySelect
                    value={draft.priority}
                    onChange={(val) => {
                      update({ priority: val });
                      save({ priority: val });
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-foreground/90">Hạn hoàn thành</span>
                  <div
                    onClick={() => setIsDatesVisible(true)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border/80 text-[13px] font-semibold text-foreground shadow-xs transition-all cursor-pointer hover:border-primary/50 hover:bg-accent/30 ${
                      !draft.dueDate ? 'text-muted-foreground' : ''
                    }`}
                    title="Nhấp để chọn hoặc đổi hạn hoàn thành"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CalendarDays size={16} className={`shrink-0 ${draft.dueDate ? 'text-primary' : 'text-muted-foreground/60'}`} />
                      <span className={`truncate ${draft.dueDate ? 'text-foreground font-semibold' : 'text-muted-foreground font-normal'}`}>
                        {draft.dueDate ? formatDateDisplay(draft.dueDate) : 'Chưa có hạn hoàn thành'}
                      </span>
                    </div>
                    {draft.dueDate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          update({ dueDate: '', startDate: '' });
                          save({ dueDate: '', startDate: '' });
                          toast.success('Đã xóa hạn hoàn thành');
                        }}
                        className="p-1 hover:bg-accent/80 rounded-md text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                        title="Xóa hạn hoàn thành"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Hành động</h4>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleShareTask}
                  className="w-full flex items-center gap-2.5 px-3 py-2 bg-card hover:bg-accent text-foreground/90 rounded-xl font-semibold text-[13px] transition-all text-left border border-border/80 shadow-xs hover:shadow hover:-translate-y-px"
                >
                  <Share2 size={15} className="text-primary" />
                  <span>Chia sẻ công việc</span>
                </button>
                <button 
                  onClick={() => setConfirmDelete(true)} 
                  disabled={busy} 
                  className="w-full flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-semibold text-[13px] transition-all text-left border border-red-500/20 group"
                >
                  <Trash2 size={15} className="text-red-400 group-hover:text-white transition-colors" /> Xóa công việc
                </button>
              </div>
            </div>

          </aside>
        </div>
      </div>

      {/* Centered Task Dates Modal */}
      <TaskDatesModal
        isOpen={isDatesVisible}
        onClose={() => setIsDatesVisible(false)}
        startDate={draft.startDate}
        dueDate={draft.dueDate}
        onSave={({ startDate, dueDate }) => {
          update({ startDate, dueDate });
          save({ startDate, dueDate });
          toast.success('Đã cập nhật thời hạn công việc');
        }}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/70 backdrop-blur-[2px] animate-in fade-in duration-200 p-4">
          <div className="w-full max-w-sm bg-popover rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-border">
            <h3 className="text-lg font-bold mb-2 text-foreground">Xóa công việc?</h3>
            <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">Công việc này sẽ bị xóa vĩnh viễn khỏi bảng và không thể khôi phục.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 hover:bg-accent text-foreground font-medium rounded-lg text-sm transition-colors border border-transparent hover:border-border">Hủy</button>
              <button onClick={remove} disabled={busy} className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg text-sm hover:bg-red-600 transition-colors shadow-sm">Xóa vĩnh viễn</button>
            </div>
          </div>
        </div>
      )}

      {isContributionModalOpen && (
        <TaskContributionModal
          task={draft}
          onClose={() => setIsContributionModalOpen(false)}
          onUpdated={(updatedTask) => {
            update({ assignees: updatedTask.assignees });
            useBoardStore.getState().setBoard(b => {
              if (!b) return b;
              return {
                ...b,
                tasks: b.tasks.map(t => t.id === task.id ? { ...t, assignees: updatedTask.assignees } : t),
              };
            });
          }}
        />
      )}

      {memberToRemoveWarning && (
        <RemoveAssigneeWarningModal
          user={memberToRemoveWarning.user}
          parentTask={draft}
          affectedSubtasks={memberToRemoveWarning.affectedSubtasks}
          onCancel={() => {
            setMemberToRemoveWarning(null);
            setPendingAssigneeIds(null);
          }}
          onRemoveOnlyParent={() => {
            if (pendingAssigneeIds) {
              executeAssigneeUpdate(pendingAssigneeIds, false);
            }
            setMemberToRemoveWarning(null);
            setPendingAssigneeIds(null);
          }}
          onConfirm={handleConfirmRemoveFromSubtasks}
        />
      )}
    </div>
  );
}

function SidebarButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 bg-card hover:bg-accent text-foreground/90 rounded-xl font-semibold text-[13px] transition-all text-left border border-border/80 shadow-sm hover:shadow hover:-translate-y-px"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
