import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Archive, Trash2, X, Loader2 } from 'lucide-react';
import api from '../../lib/axios';
import { toast } from 'sonner';
import type { Board, Column, Task } from '../../types';
import { useBoardStore } from '../../store/boardStore';

interface DeleteColumnModalProps {
  isOpen: boolean;
  column: Column;
  tasks: Task[];
  board: Board;
  isOwner: boolean;
  onClose: () => void;
}

export function DeleteColumnModal({
  isOpen,
  column,
  tasks,
  board,
  isOwner,
  onClose,
}: DeleteColumnModalProps) {
  const fetchBoard = useBoardStore((state) => state.fetchBoard);
  const otherColumns = board.columns.filter((c) => c.id !== column.id);

  const [action, setAction] = useState<'move_tasks' | 'archive_all' | 'delete_all'>('move_tasks');
  const [targetColumnId, setTargetColumnId] = useState<string>(
    otherColumns.length > 0 ? otherColumns[0].id : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEmpty = tasks.length === 0;

  const handleDelete = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEmpty) {
        // Empty column deletion
        await api.delete(`/columns/${column.id}`);
        toast.success(`Đã xóa cột "${column.title}" thành công`);
        await fetchBoard(board.id, true);
        onClose();
      } else {
        // Non-empty column deletion with action
        const payload: Record<string, any> = { action };
        if (action === 'move_tasks') {
          if (!targetColumnId) {
            setErrorMessage('Vui lòng chọn cột đích để chuyển công việc sang.');
            setIsSubmitting(false);
            return;
          }
          payload.target_column_id = targetColumnId;
        }

        const res = await api.delete(`/columns/${column.id}`, { data: payload });
        toast.success(res.data?.message || 'Đã xử lý và xóa cột thành công');
        await fetchBoard(board.id, true);
        onClose();
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.target_column_id?.[0] ||
        err?.response?.data?.errors?.action?.[0] ||
        'Có lỗi xảy ra khi xóa cột. Vui lòng thử lại.';
      setErrorMessage(msg);
      toast.error(msg);
      // Do NOT close modal on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/80 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-column-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isEmpty ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
              {isEmpty ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h3 id="delete-column-title" className="font-bold text-[16px] text-foreground">
                {isEmpty ? 'Xác nhận xóa cột' : 'Xóa cột & Xử lý công việc'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cột: <span className="font-semibold text-foreground">{column.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 font-medium flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isEmpty ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cột này hiện <strong className="text-foreground">không có công việc nào</strong>. Bạn có chắc chắn muốn xóa cột này khỏi bảng? Cột sẽ được đưa vào thùng rác.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                Cột đang chứa <strong className="font-bold text-amber-700 dark:text-amber-300">{tasks.length} công việc</strong>. Vui lòng chọn cách xử lý các công việc này trước khi xóa cột:
              </div>

              {/* Action Options */}
              <div className="space-y-2.5">
                {/* 1. move_tasks */}
                <label 
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    action === 'move_tasks'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border/70 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="delete_action"
                      value="move_tasks"
                      checked={action === 'move_tasks'}
                      onChange={() => setAction('move_tasks')}
                      className="text-primary focus:ring-primary w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <ArrowRight size={14} className="text-primary" />
                        Chuyển công việc sang cột khác
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Giữ lại toàn bộ {tasks.length} công việc và chuyển sang một cột còn hoạt động.
                      </p>
                    </div>
                  </div>

                  {action === 'move_tasks' && (
                    <div className="mt-3 pl-7">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Chọn cột đích:
                      </label>
                      {otherColumns.length > 0 ? (
                        <select
                          value={targetColumnId}
                          onChange={(e) => setTargetColumnId(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-foreground"
                        >
                          {otherColumns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-red-500 font-medium">
                          Không có cột khác trên bảng để chuyển công việc sang!
                        </p>
                      )}
                    </div>
                  )}
                </label>

                {/* 2. archive_all */}
                <label 
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    action === 'archive_all'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border/70 hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="delete_action"
                    value="archive_all"
                    checked={action === 'archive_all'}
                    onChange={() => setAction('archive_all')}
                    className="text-primary focus:ring-primary w-4 h-4 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Archive size={14} className="text-amber-600" />
                      Lưu trữ cột và tất cả công việc
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cất cột cùng toàn bộ công việc vào kho lưu trữ, có thể khôi phục lại bất kỳ lúc nào.
                    </p>
                  </div>
                </label>

                {/* 3. delete_all (Only Owner) */}
                {isOwner && (
                  <label 
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      action === 'delete_all'
                        ? 'border-red-500 bg-red-500/5 ring-1 ring-red-500/20'
                        : 'border-border/70 hover:bg-red-500/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delete_action"
                      value="delete_all"
                      checked={action === 'delete_all'}
                      onChange={() => setAction('delete_all')}
                      className="text-red-600 focus:ring-red-600 w-4 h-4 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                        <Trash2 size={14} />
                        Xóa toàn bộ cột và công việc (Nguy hiểm)
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Chỉ dành cho Chủ sở hữu. Cột và tất cả {tasks.length} công việc sẽ bị xóa vào thùng rác.
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-end gap-2.5 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting || (!isEmpty && action === 'move_tasks' && !targetColumnId)}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 ${
              action === 'delete_all' || isEmpty
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary hover:bg-[#5B4BD6]'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Đang xử lý...
              </>
            ) : isEmpty ? (
              'Xóa cột'
            ) : action === 'delete_all' ? (
              'Xác nhận xóa toàn bộ'
            ) : action === 'archive_all' ? (
              'Lưu trữ cột'
            ) : (
              'Chuyển task & Xóa cột'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
