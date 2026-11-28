import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Loader2, X, Plus, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/axios';

interface Row {
  title: string;
  done: boolean;
  include: boolean;
}

interface Props {
  taskId: string;
  hasAssignees: boolean;
  onClose: () => void;
  /** Called after subtasks were created so the parent can reload its list. */
  onCreated: () => void;
}

/**
 * "Phân tích AI": the AI proposes subtasks from the task description; the user reviews,
 * edits, removes or adds lines, and only then creates them.
 */
export function AiSubtaskSplitModal({ taskId, hasAssignees, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<'gemini' | 'rules'>('rules');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [copyAssignees, setCopyAssignees] = useState(true);
  const [saving, setSaving] = useState(false);

  const analyse = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/tasks/${taskId}/subtasks/ai-suggest`);
      setEngine(data.engine);
      setWarnings(data.warnings ?? []);
      setRows((data.subtasks ?? []).map((s: { title: string; done: boolean }) => ({ ...s, include: true })));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không phân tích được mô tả, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.include && r.title.trim());

  const create = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/subtasks/bulk`, {
        subtasks: selected.map((r) => ({ title: r.title.trim(), done: r.done })),
        copy_parent_assignees: hasAssignees && copyAssignees,
      });
      toast.success(data?.message || `Đã tạo ${selected.length} việc con`);
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không tạo được việc con.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/70 backdrop-blur-[2px] animate-in fade-in duration-200 p-4"
      onClick={(e) => { e.stopPropagation(); if (!saving) onClose(); }}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col bg-popover rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles size={18} className="text-primary shrink-0" />
              Phân tích AI: chia việc con
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kiểm tra, sửa hoặc bỏ bớt trước khi tạo. Chưa có gì được tạo cho đến khi bạn bấm nút bên dưới.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground shrink-0" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="py-10 flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary" />
              AI đang đọc mô tả và chia việc...
            </div>
          ) : error ? (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <AlertTriangle size={24} className="text-amber-500" />
              <p className="text-sm text-foreground">{error}</p>
              <button type="button" onClick={analyse} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/70 text-sm font-medium">
                <RotateCcw size={14} /> Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-muted-foreground">
                  {engine === 'gemini' ? 'Gemini đề xuất' : 'Tách theo từng dòng của mô tả'} · {rows.length} việc con
                </span>
                <button type="button" onClick={analyse} className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                  <RotateCcw size={12} /> Phân tích lại
                </button>
              </div>
              {warnings.map((w) => (
                <div key={w} className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">{w}</div>
              ))}
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">AI chưa tìm thấy việc con nào. Bạn có thể tự thêm bên dưới.</p>
              )}
              {rows.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 ${r.include ? 'bg-card' : 'bg-muted/30 opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                    className="accent-primary shrink-0"
                    aria-label="Tạo việc con này"
                    title="Tạo việc con này"
                  />
                  <input
                    value={r.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="Tên việc con"
                    className="flex-1 min-w-0 text-sm bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none rounded px-2 py-1"
                  />
                  <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    <input type="checkbox" checked={r.done} onChange={(e) => update(i, { done: e.target.checked })} className="accent-emerald-600" />
                    Xong
                  </label>
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                    className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
                    aria-label="Xóa dòng này"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRows((rs) => [...rs, { title: '', done: false, include: true }])}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              >
                <Plus size={14} /> Thêm việc con
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border bg-muted/20 rounded-b-2xl">
          {hasAssignees ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={copyAssignees} onChange={(e) => setCopyAssignees(e.target.checked)} className="accent-primary" />
              Giao cho người phụ trách của việc cha
            </label>
          ) : <span />}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 hover:bg-accent text-foreground font-medium rounded-lg text-sm">
              Hủy
            </button>
            <button
              type="button"
              onClick={create}
              disabled={loading || saving || selected.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white font-semibold rounded-lg text-sm shadow-sm disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Tạo {selected.length} việc con
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
