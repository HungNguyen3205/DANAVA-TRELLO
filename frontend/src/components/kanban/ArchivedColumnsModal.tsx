import React, { useState, useEffect } from 'react';
import { Archive, RotateCcw, X, Loader2, Calendar, User as UserIcon } from 'lucide-react';
import api from '../../lib/axios';
import { toast } from 'sonner';
import type { Board } from '../../types';
import { useBoardStore } from '../../store/boardStore';

interface ArchivedColumnItem {
  id: number | string;
  board_id: number | string;
  title: string;
  color?: string;
  archived_at: string;
  archived_by?: {
    id: number | string;
    name: string;
    username?: string;
  };
  tasks_count: number;
}

interface ArchivedColumnsModalProps {
  isOpen: boolean;
  board: Board;
  canManage: boolean;
  onClose: () => void;
}

export function ArchivedColumnsModal({
  isOpen,
  board,
  canManage,
  onClose,
}: ArchivedColumnsModalProps) {
  const fetchBoard = useBoardStore((state) => state.fetchBoard);
  const [columns, setColumns] = useState<ArchivedColumnItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | string | null>(null);

  const loadArchivedColumns = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/boards/${board.id}/columns/archived`);
      setColumns(res.data || []);
    } catch (e: any) {
      toast.error('Không thể tải danh sách cột lưu trữ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadArchivedColumns();
    }
  }, [isOpen, board.id]);

  if (!isOpen) return null;

  const handleRestore = async (columnId: number | string, columnTitle: string) => {
    setRestoringId(columnId);
    try {
      const res = await api.post(`/columns/${columnId}/restore`);
      toast.success(res.data?.message || `Đã khôi phục cột "${columnTitle}" thành công`);
      // Remove restored column from list
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      // Refresh board in background
      await fetchBoard(board.id, true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Có lỗi xảy ra khi khôi phục cột.';
      toast.error(msg);
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/80 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archived-columns-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Archive size={20} />
            </div>
            <div>
              <h3 id="archived-columns-title" className="font-bold text-[16px] text-foreground">
                Cột đã lưu trữ
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Danh sách các cột đang được lưu trữ của bảng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* List Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-xs font-medium">Đang tải danh sách cột lưu trữ...</p>
            </div>
          ) : columns.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground/60">
                <Archive size={24} />
              </div>
              <p className="text-sm font-semibold text-foreground">Chưa có cột nào được lưu trữ</p>
              <p className="text-xs text-muted-foreground mt-1">
                Các cột bạn lưu trữ trên bảng sẽ xuất hiện ở đây để bạn có thể khôi phục lại.
              </p>
            </div>
          ) : (
            columns.map((col) => (
              <div
                key={col.id}
                className="p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/70 shrink-0" />
                    <h4 className="font-semibold text-sm text-foreground truncate">
                      {col.title}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground shrink-0">
                      {col.tasks_count} công việc
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="opacity-70" />
                      {formatDate(col.archived_at)}
                    </span>
                    {col.archived_by && (
                      <span className="flex items-center gap-1">
                        <UserIcon size={13} className="opacity-70" />
                        {col.archived_by.name}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <button
                    onClick={() => handleRestore(col.id, col.title)}
                    disabled={restoringId === col.id}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {restoringId === col.id ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Đang khôi phục...
                      </>
                    ) : (
                      <>
                        <RotateCcw size={13} />
                        Khôi phục
                      </>
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-end bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
