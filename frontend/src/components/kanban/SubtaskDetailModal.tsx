import React, { useState, useEffect } from 'react';
import { 
  X, Trash2, Check, AlignLeft, CalendarDays, 
  Clock, User, Tag, History, CheckSquare, AlertCircle, Save 
} from 'lucide-react';
import type { Task, Board, User as UserType, Priority } from '../../types';
import api from '../../lib/axios';
import { toast } from 'sonner';
import { getAvatarUrl } from '../../lib/avatar';
import { PrioritySelect } from '../ui/PrioritySelect';
import { AssigneeSelect } from './AssigneeSelect';
import { SafeLinkifiedText } from '../common/SafeLinkifiedText';

interface SubtaskDetailModalProps {
  subtaskId: string | number;
  board: Board;
  parentTaskTitle?: string;
  onClose: () => void;
  onUpdated: (updatedSubtask: Task) => void;
  onDeleted: (deletedSubtaskId: string | number) => void;
}

export const SubtaskDetailModal: React.FC<SubtaskDetailModalProps> = ({
  subtaskId,
  board,
  parentTaskTitle,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const [subtask, setSubtask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form draft state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('Bình thường');
  const [isCompleted, setIsCompleted] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.get(`/tasks/subtasks/${subtaskId}`)
      .then(res => {
        if (!isMounted) return;
        const data = res.data;
        setSubtask(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setPriority(data.priority || 'Bình thường');
        setIsCompleted(!data.completed_at ? false : true);
        setStartDate(data.start_date || '');
        setDueDate(data.due_date || '');
        
        const assignees = data.assignees?.map((u: any) => String(u.id)) || 
          (data.assignee_id ? [String(data.assignee_id)] : []);
        setSelectedUserIds(assignees);
      })
      .catch((err) => {
        toast.error('Không thể tải chi tiết công việc con');
        onClose();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [subtaskId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingDesc) {
          setIsEditingDesc(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingDesc, onClose]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!title.trim()) {
      setValidationErrors({ title: 'Tiêu đề không được để trống.' });
      return;
    }

    setValidationErrors({});
    setBusy(true);

    try {
      const payload: any = {
        title: title.trim(),
        description: description,
        priority: priority,
        is_completed: isCompleted,
        start_date: startDate || null,
        due_date: dueDate || null,
        assignee_ids: selectedUserIds.map(Number),
      };

      const res = await api.patch(`/tasks/subtasks/${subtaskId}`, payload);
      setSubtask(res.data);
      setIsEditingDesc(false);
      toast.success('Đã lưu công việc con');
      onUpdated(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu công việc con.';
      const errors = err.response?.data?.errors;
      if (errors) {
        const formatted: Record<string, string> = {};
        for (const k in errors) {
          formatted[k] = errors[k][0];
        }
        setValidationErrors(formatted);
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/tasks/subtasks/${subtaskId}`);
      toast.success('Đã xóa công việc con');
      onDeleted(subtaskId);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa công việc con');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs">
        <div className="w-full max-w-2xl bg-card border border-border p-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
          <p className="text-sm text-muted-foreground font-medium">Đang tải chi tiết công việc con...</p>
        </div>
      </div>
    );
  }

  const isOverdue = dueDate && !isCompleted && new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col relative my-auto animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium min-w-0 pr-8">
            <CheckSquare size={16} className="text-primary shrink-0" />
            <span className="truncate">Công việc con</span>
            {parentTaskTitle && (
              <>
                <span>/</span>
                <span className="text-foreground font-semibold truncate">{parentTaskTitle}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Title & Status */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="mt-1.5 w-5 h-5 rounded-md border-border text-primary focus:ring-primary/50 cursor-pointer"
                title="Đánh dấu hoàn thành"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tiêu đề công việc con..."
                  className={`w-full text-lg font-bold text-foreground bg-transparent border border-transparent hover:border-input focus:bg-background focus:border-primary rounded-lg px-2.5 py-1 -ml-2.5 transition-colors outline-none ${
                    isCompleted ? 'line-through text-muted-foreground' : ''
                  }`}
                />
                {validationErrors.title && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {validationErrors.title}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 border border-border/50 rounded-xl">
            {/* Priority */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Mức độ ưu tiên
              </label>
              <PrioritySelect
                value={priority}
                onChange={(p) => setPriority(p)}
                disabled={busy}
              />
            </div>

            {/* Assignees */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Người thực hiện
              </label>
              <AssigneeSelect
                boardUsers={board.users || []}
                selectedUserIds={selectedUserIds}
                onChange={setSelectedUserIds}
                disabled={busy}
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Ngày bắt đầu
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Hạn hoàn thành {isOverdue && <span className="text-red-500 text-[11px] font-bold">(Quá hạn)</span>}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`w-full bg-background border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 ${
                    isOverdue ? 'border-red-400 bg-red-50/10 text-red-500 font-medium' : 'border-input'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlignLeft size={16} className="text-muted-foreground" />
                Mô tả chi tiết
              </label>
              {!isEditingDesc && (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Chỉnh sửa
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Thêm mô tả chi tiết cho công việc con (hỗ trợ tự động gắn link an toàn)..."
                  className="w-full p-3 bg-background border border-input focus:ring-2 focus:ring-primary/40 rounded-xl text-sm leading-relaxed resize-y outline-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(false)}
                    className="px-3 py-1.5 hover:bg-muted text-muted-foreground text-xs font-semibold rounded-lg transition-colors"
                  >
                    Thu gọn
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingDesc(true)}
                className="p-3.5 bg-muted/20 hover:bg-muted/40 border border-transparent rounded-xl text-sm min-h-[64px] cursor-pointer transition-colors"
              >
                {description ? (
                  <SafeLinkifiedText text={description} />
                ) : (
                  <span className="text-xs text-muted-foreground italic">Nhấp để thêm mô tả cho công việc con...</span>
                )}
              </div>
            )}
          </div>

          {/* Creator & Timestamps Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              {subtask?.creator && (
                <span className="flex items-center gap-1.5">
                  <User size={14} />
                  Tạo bởi: <strong className="text-foreground">{subtask.creator.name}</strong>
                </span>
              )}
              {subtask?.created_at && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  Thời gian tạo: {new Date(subtask.created_at).toLocaleString('vi-VN')}
                </span>
              )}
            </div>

            {subtask?.completed_at && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Check size={14} /> Hoàn thành lúc: {new Date(subtask.completed_at).toLocaleString('vi-VN')}
              </span>
            )}
          </div>

          {/* Activity Logs (if any) */}
          {subtask?.activity_logs && subtask.activity_logs.length > 0 && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <History size={14} className="text-muted-foreground" />
                Lịch sử cập nhật
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {subtask.activity_logs.map((log: any) => (
                  <div key={log.id} className="text-[11px] text-muted-foreground flex items-center justify-between p-2 rounded-lg bg-muted/20">
                    <div>
                      <span className="font-semibold text-foreground">{log.user?.name || 'Hệ thống'}</span>{' '}
                      <span>{log.action}</span>
                      {log.new_value && <span className="font-medium text-foreground"> "{log.new_value}"</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground/80 shrink-0 ml-2">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString('vi-VN') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                disabled={busy}
              >
                <Trash2 size={14} /> Xóa công việc con
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500 font-medium">Bạn có chắc muốn xóa?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="px-2.5 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors"
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-muted-foreground hover:bg-muted rounded text-xs font-medium"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 hover:bg-muted text-foreground text-xs font-semibold rounded-xl transition-colors"
              disabled={busy}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {busy ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={14} /> Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
