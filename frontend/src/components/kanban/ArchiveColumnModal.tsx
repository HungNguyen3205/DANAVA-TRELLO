import React, { useState } from 'react';
import { Archive, AlertTriangle, X, Loader2 } from 'lucide-react';
import api from '../../lib/axios';
import { toast } from 'sonner';
import type { Board, Column, Task } from '../../types';
import { useBoardStore } from '../../store/boardStore';

interface ArchiveColumnModalProps {
  isOpen: boolean;
  column: Column;
  tasks: Task[];
  board: Board;
  onClose: () => void;
}

export function ArchiveColumnModal({
  isOpen,
  column,
  tasks,
  board,
  onClose,
}: ArchiveColumnModalProps) {
  const fetchBoard = useBoardStore((state) => state.fetchBoard);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLastColumn = board.columns.length <= 1;

  const handleArchive = async () => {
    if (isLastColumn) {
      setErrorMessage('Không thể lưu trữ cột cuối cùng đang hoạt động của bảng.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.post(`/columns/${column.id}/archive`);
      toast.success(res.data?.message || `Đã lưu trữ cột "${column.title}" thành công`);
      await fetchBoard(board.id, true);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Có lỗi xảy ra khi lưu trữ cột.';
      setErrorMessage(msg);
      toast.error(msg);
      // Do NOT close modal on error
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
        aria-labelledby="archive-column-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Archive size={20} />
            </div>
            <div>
              <h3 id="archive-column-title" className="font-bold text-[16px] text-foreground">
                Lưu trữ cột
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

          {isLastColumn ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 font-medium">
              Đây là cột hoạt động duy nhất trên bảng. Bảng phải có ít nhất 1 cột hoạt động để chứa công việc.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn lưu trữ cột <strong className="text-foreground">"{column.title}"</strong>?{' '}
              {tasks.length > 0 ? (
                <>
                  Cột và <strong className="text-foreground">{tasks.length} công việc</strong> trong cột sẽ tạm thời ẩn khỏi bảng. Bạn có thể khôi phục lại bất kỳ lúc nào từ danh sách cột đã lưu trữ.
                </>
              ) : (
                <>
                  Cột sẽ tạm thời ẩn khỏi bảng và có thể khôi phục lại bất kỳ lúc nào.
                </>
              )}
            </p>
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
            onClick={handleArchive}
            disabled={isSubmitting || isLastColumn}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Đang lưu trữ...
              </>
            ) : (
              'Xác nhận lưu trữ'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
