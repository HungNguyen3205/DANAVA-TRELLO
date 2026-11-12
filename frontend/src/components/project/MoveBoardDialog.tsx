import { useEffect, useMemo, useState } from 'react';
import { Check, FolderInput, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/axios';
import { projectColor, projectsApi, type ProjectSummary } from '../../lib/api/projects';

/** Move a board to another project (or out of any project). Board admins only — the server checks too. */
export function MoveBoardDialog({
  board,
  onClose,
  onMoved,
}: {
  board: { id: number; name: string; project_id?: number | null };
  onClose: () => void;
  onMoved: (projectId: number | null) => void;
}) {
  const current = board.project_id ?? null;
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [target, setTarget] = useState<number | null>(current);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const save = async () => {
    if (target === current) return onClose();
    setSaving(true);
    try {
      await api.put(`/boards/${board.id}`, { project_id: target });
      const name = projects?.find((p) => p.id === target)?.name;
      toast.success(target ? `Đã chuyển "${board.name}" sang dự án "${name}".` : `Đã đưa "${board.name}" ra khỏi dự án.`);
      onMoved(target);
    } catch (e: any) {
      toast.error(e?.response?.status === 403 ? 'Chỉ quản trị viên của bảng mới chuyển được bảng.' : e?.response?.data?.message || 'Không chuyển được bảng.');
    } finally {
      setSaving(false);
    }
  };

  const option = (id: number | null, label: string, color?: string) => {
    const selected = target === id;
    return (
      <button key={id ?? 'none'} type="button" role="radio" aria-checked={selected} onClick={() => setTarget(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selected ? 'bg-accent' : 'hover:bg-accent/60'}`}>
        <span className="w-7 h-7 shrink-0 rounded-md grid place-items-center text-white text-xs font-bold" style={{ backgroundColor: color ?? 'hsl(var(--muted-foreground))' }} aria-hidden="true">
          {id ? label.trim().charAt(0).toUpperCase() : '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground truncate" title={label}>{label}</span>
          {id === current && <span className="block text-[11px] text-muted-foreground">Dự án hiện tại</span>}
        </span>
        {selected && <Check size={16} className="shrink-0 text-primary" />}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="move-board-title"
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 id="move-board-title" className="text-base font-bold text-foreground flex items-center gap-2"><FolderInput size={18} className="text-primary" /> Chuyển bảng sang dự án khác</h2>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={board.name}>Bảng: <b className="text-foreground">{board.name}</b> · công việc và thành viên giữ nguyên</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Đóng"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative h-10">
            <Search size={16} className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm dự án…" aria-label="Tìm dự án" autoFocus
              className="absolute inset-0 m-0 w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5" role="radiogroup" aria-label="Dự án đích">
          {projects === null && <p className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Đang tải dự án…</p>}
          {projects !== null && !query && option(null, 'Không thuộc dự án nào')}
          {shown.map((p) => option(p.id, p.name, projectColor(p)))}
          {projects !== null && query && shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">Không tìm thấy dự án.</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/30">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">Hủy</button>
          <button type="button" onClick={save} disabled={saving || target === current}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 size={15} className="animate-spin" />} Chuyển bảng
          </button>
        </div>
      </div>
    </div>
  );
}
