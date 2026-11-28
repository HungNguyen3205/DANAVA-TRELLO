import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, ChevronUp, Loader2, Trash2, X, CheckSquare } from 'lucide-react';
import type { Column } from '../../types';

/** Compact bar for selected Kanban cards: move to a column, delete, or clear. */
export function KanbanSelectionBar({
  count,
  columns,
  busy,
  onMove,
  onDelete,
  onClear,
}: {
  count: number;
  columns: Column[];
  busy: boolean;
  onMove: (columnId: string) => void;
  onDelete: () => Promise<void>;
  onClear: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the column menu on an outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100%-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center gap-1 rounded-full border border-border bg-popover/95 backdrop-blur pl-4 pr-1.5 py-1.5 shadow-2xl">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground whitespace-nowrap pr-2" title="Kéo một thẻ đang chọn để chuyển cả nhóm. Esc để bỏ chọn.">
            <CheckSquare size={15} className="text-primary" />
            {count} đã chọn
          </span>
          <span className="w-px h-5 bg-border" />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMenuOpen((v) => !v)}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium text-foreground hover:bg-accent disabled:opacity-50 whitespace-nowrap"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
              <span className="hidden sm:inline">Chuyển sang</span>
              <ChevronUp size={14} className={`transition-transform ${menuOpen ? '' : 'rotate-180'}`} />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 min-w-52 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Chuyển {count} việc sang</div>
                {columns.map((c) => (
                  <button
                    key={c.id}
                    role="menuitem"
                    type="button"
                    onClick={() => { setMenuOpen(false); onMove(c.id); }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-[13px] text-foreground hover:bg-accent truncate"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-50 whitespace-nowrap"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Xóa</span>
          </button>

          <span className="w-px h-5 bg-border" />
          <button
            type="button"
            onClick={onClear}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Bỏ chọn (Esc)"
            aria-label="Bỏ chọn"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {confirmOpen && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/70 backdrop-blur-[2px] animate-in fade-in duration-200 p-4"
          onClick={() => !deleting && setConfirmOpen(false)}
        >
          <div className="w-full max-w-sm bg-popover rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2 text-foreground">Xóa {count} công việc?</h3>
            <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
              Các công việc đã chọn sẽ được chuyển vào Thùng rác. Bạn có thể khôi phục lại trong Thùng rác.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmOpen(false)} disabled={deleting} className="px-4 py-2 hover:bg-accent text-foreground font-medium rounded-lg text-sm transition-colors">
                Hủy
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white font-medium rounded-lg text-sm hover:bg-red-600 transition-colors shadow-sm disabled:opacity-60">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Xóa
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
