import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface WipConfirmModalProps {
  isOpen: boolean;
  columnTitle: string;
  wipLimit: number;
  currentCount: number;
  actionType: 'add' | 'move';
  onConfirm: () => void;
  onCancel: () => void;
}

export function WipConfirmModal({
  isOpen,
  columnTitle,
  wipLimit,
  currentCount,
  actionType,
  onConfirm,
  onCancel,
}: WipConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-amber-500/40 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wip-confirm-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id="wip-confirm-title" className="font-bold text-base text-amber-700 dark:text-amber-300">
                Cảnh báo giới hạn WIP
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cột đã đạt hoặc vượt ngưỡng cho phép
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            Cột <strong className="font-bold text-foreground font-semibold">"{columnTitle}"</strong> hiện có{' '}
            <strong className="font-bold text-amber-600 dark:text-amber-400">{currentCount}/{wipLimit}</strong> công việc (đã đạt hoặc vượt mức giới hạn WIP).
          </div>

          <p className="text-sm text-foreground leading-relaxed">
            Cột đang áp dụng <strong className="font-semibold text-amber-600 dark:text-amber-400">Chế độ Cảnh báo (Warning)</strong>. Bạn có chắc chắn muốn{' '}
            {actionType === 'add' ? 'thêm công việc mới vào' : 'chuyển công việc này sang'} cột này không?
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-end gap-2.5 bg-muted/10">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            Xác nhận tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
