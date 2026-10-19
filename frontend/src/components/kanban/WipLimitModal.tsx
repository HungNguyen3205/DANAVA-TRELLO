import React, { useState } from 'react';
import { Gauge, ShieldAlert, AlertTriangle, X, Check, Loader2, Info } from 'lucide-react';
import api from '../../lib/axios';
import { toast } from 'sonner';
import type { Column } from '../../types';
import { useBoardStore } from '../../store/boardStore';

interface WipLimitModalProps {
  isOpen: boolean;
  column: Column;
  currentWipCount: number;
  boardId: string;
  onClose: () => void;
}

export function WipLimitModal({
  isOpen,
  column,
  currentWipCount,
  boardId,
  onClose,
}: WipLimitModalProps) {
  const fetchBoard = useBoardStore((state) => state.fetchBoard);

  const [hasLimit, setHasLimit] = useState<boolean>(Boolean(column.wip_limit && column.wip_limit > 0));
  const [limitValue, setLimitValue] = useState<number | string>(column.wip_limit || 5);
  const [enforcement, setEnforcement] = useState<'warning' | 'strict'>(
    column.wip_enforcement === 'strict' ? 'strict' : 'warning'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const parsedLimit = hasLimit ? Math.max(1, Number(limitValue) || 1) : null;

    try {
      await api.put(`/columns/${column.id}`, {
        wip_limit: parsedLimit,
        wip_enforcement: enforcement,
      });

      toast.success(
        parsedLimit
          ? `Đã cài đặt WIP Limit cho cột "${column.title}" là ${parsedLimit} (${enforcement === 'strict' ? 'Nghiêm ngặt' : 'Cảnh báo'})`
          : `Đã hủy giới hạn WIP cho cột "${column.title}"`
      );

      await fetchBoard(boardId, true);
      onClose();
    } catch (err: any) {
      console.error('WIP limit config error', err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu cấu hình WIP Limit.';
      setErrorMessage(msg);
      toast.error(msg);
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
        aria-labelledby="wip-limit-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Gauge size={20} />
            </div>
            <div>
              <h3 id="wip-limit-title" className="font-bold text-base text-foreground">
                Cấu hình WIP Limit
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cột: <span className="font-semibold text-foreground">{column.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col">
          <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 font-medium flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Current WIP status info */}
            <div className="p-3 bg-muted/50 rounded-xl flex items-center justify-between text-xs border border-border/50">
              <span className="text-muted-foreground">Số công việc hiện tại trong cột:</span>
              <span className="font-bold text-foreground text-sm px-2 py-0.5 bg-background rounded-lg border border-border/80">
                {currentWipCount} task
              </span>
            </div>

            {/* Toggle Enable/Disable WIP limit */}
            <div className="space-y-2">
              <label className="flex flex-row items-center gap-2.5 cursor-pointer select-none !mb-0">
                <input
                  type="checkbox"
                  checked={hasLimit}
                  onChange={(e) => setHasLimit(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background shrink-0"
                />
                <span className="text-sm font-semibold text-foreground">
                  Bật giới hạn WIP cho cột này
                </span>
              </label>
              <p className="text-xs text-muted-foreground pl-6.5">
                Kiểm soát số lượng công việc tối đa được phép tồn tại trong cột tại một thời điểm.
              </p>
            </div>

            {hasLimit && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                {/* WIP Limit Value */}
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Số task tối đa (WIP Limit):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    placeholder="Ví dụ: 5"
                    required={hasLimit}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-semibold text-foreground"
                  />
                </div>

                {/* Enforcement Mode */}
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    Chế độ thực thi:
                  </label>
                  <div className="space-y-2.5">
                    {/* Warning mode */}
                    <label 
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        enforcement === 'warning'
                          ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20'
                          : 'border-border/70 hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="wip_enforcement"
                        value="warning"
                        checked={enforcement === 'warning'}
                        onChange={() => setEnforcement('warning')}
                        className="text-amber-500 focus:ring-amber-500 w-4 h-4 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          Cảnh báo (Warning)
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          Đổi màu header sang cảnh báo (vàng/cam). Vẫn cho phép thêm hoặc chuyển task sau khi người dùng xác nhận.
                        </p>
                      </div>
                    </label>

                    {/* Strict mode */}
                    <label 
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        enforcement === 'strict'
                          ? 'border-red-500/60 bg-red-500/5 ring-1 ring-red-500/20'
                          : 'border-border/70 hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="wip_enforcement"
                        value="strict"
                        checked={enforcement === 'strict'}
                        onChange={() => setEnforcement('strict')}
                        className="text-red-500 focus:ring-red-500 w-4 h-4 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                          <ShieldAlert size={14} />
                          Nghiêm ngặt (Strict)
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          Chặn tuyệt đối thêm mới hoặc kéo/thả công việc vào cột khi đã đạt giới hạn tối đa.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Explanatory notes (Requirements 6 & 7) */}
            <div className="p-3 bg-muted/40 border border-border/50 rounded-xl space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Info size={14} className="text-primary shrink-0" />
                <span>Quy tắc tính toán WIP:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                <li>Chỉ tính các <strong>công việc chính</strong> trong cột.</li>
                <li><strong>Task con (Subtask)</strong> không làm tăng WIP vì thuộc task cha.</li>
                <li>Không tính các công việc đã lưu trữ hoặc đã xóa vào thùng rác.</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-end gap-2.5 bg-muted/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (hasLimit && (!limitValue || Number(limitValue) < 1))}
              className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-[#5B4BD6] rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu cấu hình'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
