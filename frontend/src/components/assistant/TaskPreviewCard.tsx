import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, X, Sparkles, UserPlus, ExternalLink, LayoutGrid } from 'lucide-react';
import { Picker } from './Picker';
import { toast } from 'sonner';
import { assistantApi, type ApplyItem, type ApplyResult, type TaskDraft, type TaskPreview } from '../../lib/api/assistant';

interface Row extends TaskDraft {
  include: boolean;
  /** raw mention -> chosen user id, for mentions the assistant could not resolve */
  resolved: Record<string, number>;
  /** unmatched names the user chose to ignore */
  skipped: string[];
}

const PRIORITY_DOT: Record<string, string> = { 'Thấp': 'bg-slate-400', 'Bình thường': 'bg-sky-500', 'Cao': 'bg-amber-500', 'Khẩn cấp': 'bg-rose-500' };

function Avatar({ name }: { name: string }) {
  const initial = name.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() ?? '?';
  return (
    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold inline-flex items-center justify-center" aria-hidden="true">
      {initial}
    </span>
  );
}

const APPLIED_KEY = 'assistant-applied-previews';

function loadApplied(): Record<string, ApplyResult[]> {
  try {
    return JSON.parse(localStorage.getItem(APPLIED_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveApplied(messageId: number, results: ApplyResult[]) {
  try {
    const all = loadApplied();
    all[messageId] = results;
    localStorage.setItem(APPLIED_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: the preview just shows as not applied after reload */
  }
}

export function TaskPreviewCard({ messageId, preview, onApplied }: { messageId: number; preview: TaskPreview; onApplied?: (created: number) => void }) {
  const [rows, setRows] = useState<Row[]>(() => preview.tasks.map((t) => ({ ...t, include: true, resolved: {}, skipped: [] })));
  const [defaultBoard, setDefaultBoard] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ApplyResult[] | null>(() => loadApplied()[messageId] ?? null);

  const peopleById = useMemo(() => new Map(preview.people.map((p) => [p.id, p])), [preview.people]);
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const boardOptions = useMemo(
    () =>
      preview.boards.map((b) => ({
        value: b.id,
        label: b.name,
        hint: b.project ? `Dự án: ${b.project}` : 'Chưa thuộc dự án',
        icon: <LayoutGrid size={14} className="shrink-0 text-primary" />,
      })),
    [preview.boards],
  );
  const priorityOptions = useMemo(
    () =>
      preview.priorities.map((p) => ({
        value: p,
        label: p,
        icon: <span className={`shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT[p] ?? 'bg-slate-400'}`} />,
        className: p === 'Khẩn cấp' ? 'text-rose-600 font-semibold' : '',
      })),
    [preview.priorities],
  );

  const selected = rows.filter((r) => r.include);
  const missingBoard = selected.filter((r) => !(r.board_id ?? defaultBoard)).length;

  const submit = async () => {
    const items: ApplyItem[] = selected.map((r) => ({
      title: r.title.trim(),
      description: r.description,
      board_id: Number(r.board_id ?? defaultBoard),
      assignee_ids: r.assignee_ids,
      priority: r.priority,
      done: r.done,
      due_date: r.due_date,
      aliases: Object.entries(r.resolved).map(([alias, user_id]) => ({ alias, user_id })),
    }));
    setSubmitting(true);
    try {
      const res = await assistantApi.apply(items);
      setResults(res.results);
      saveApplied(messageId, res.results);
      const ok = res.results.filter((x) => x.ok).length;
      if (ok) toast.success(res.message);
      else toast.error(res.message);
      onApplied?.(ok);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không tạo được công việc.');
    } finally {
      setSubmitting(false);
    }
  };

  if (results) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-background p-3 space-y-1.5">
        <div className="text-xs font-bold text-foreground">Kết quả tạo công việc</div>
        {results.map((r) => (
          <div key={r.index} className="flex items-start gap-2 text-xs">
            {r.ok ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              {r.ok && r.task ? (
                <>
                  <span className="font-semibold text-foreground">{r.task.title}</span>
                  <span className="text-muted-foreground"> → {r.task.board_name} · {r.task.column}</span>
                  <Link to={`/${r.task.board_code}/kanban`} className="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline">
                    Mở <ExternalLink size={11} />
                  </Link>
                  {!!r.skipped_assignees?.length && (
                    <div className="text-amber-600">Chưa giao cho {r.skipped_assignees.map((s) => s.name).join(', ')} (chưa là thành viên bảng)</div>
                  )}
                </>
              ) : (
                <span className="text-rose-600">{r.message}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30 rounded-t-xl">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground whitespace-nowrap">
          <Sparkles size={13} className="text-primary" />
          {preview.engine === 'gemini' ? 'Gemini đã phân tích' : 'Đọc theo quy tắc'}
        </span>
        <div className="w-44 max-w-[60%]" title="Bảng dùng cho các việc chưa xác định được bảng">
          <Picker
            value={defaultBoard === '' ? null : defaultBoard}
            options={boardOptions}
            onChange={(v) => setDefaultBoard(v)}
            placeholder="Bảng mặc định…"
            align="right"
            ariaLabel="Bảng mặc định"
          />
        </div>
      </div>

      {preview.warnings.map((w) => (
        <div key={w} className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border-b border-border">{w}</div>
      ))}

      <ol className="divide-y divide-border">
        {rows.map((r, i) => {
          // Names the assistant could not match are asked one at a time through the "add person" picker.
          const pending = r.mentions.filter((m) => m.status !== 'matched' && !r.resolved[m.raw] && !r.skipped.includes(m.raw));
          const target = pending[0];
          const candidates = target?.status === 'ambiguous' ? target.user_ids : [];
          const peopleOptions = [...preview.people]
            .filter((p) => !r.assignee_ids.includes(p.id))
            .sort((a, b) => Number(candidates.includes(b.id)) - Number(candidates.includes(a.id)))
            .map((p) => ({ value: p.id, label: p.name, hint: p.position, icon: <Avatar name={p.name} /> }));
          const needsBoard = !r.board_id && !defaultBoard && r.include;

          return (
            <li key={i} className={`p-3 space-y-2 ${r.include ? '' : 'opacity-45'}`}>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => update(i, { include: e.target.checked })}
                  className="mt-1.5 accent-primary"
                  aria-label={`Tạo công việc ${i + 1}`}
                />
                <textarea
                  value={r.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  rows={2}
                  className="flex-1 min-w-0 text-sm font-semibold bg-transparent border border-transparent hover:border-border focus:border-primary rounded-lg px-2 py-1 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pl-6">
                <div className="col-span-2">
                  <Picker
                    value={r.board_id}
                    options={boardOptions}
                    onChange={(v) => update(i, { board_id: v, board_reason: null })}
                    placeholder={defaultBoard ? 'Dùng bảng mặc định' : 'Chọn bảng…'}
                    tone={needsBoard ? 'warn' : 'default'}
                    ariaLabel="Bảng"
                  />
                </div>
                <Picker
                  value={r.priority}
                  options={priorityOptions}
                  onChange={(v) => update(i, { priority: v })}
                  placeholder="Ưu tiên"
                  ariaLabel="Độ ưu tiên"
                />
                <input
                  type="date"
                  value={r.due_date ?? ''}
                  onChange={(e) => update(i, { due_date: e.target.value || null })}
                  className="h-8 min-w-0 text-xs px-2.5 rounded-lg border border-border bg-card text-foreground hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Hạn hoàn thành"
                />
              </div>

              <div className="pl-6 flex flex-wrap items-center gap-1.5">
                {r.assignee_ids.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 whitespace-nowrap pl-1 pr-1 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    <Avatar name={peopleById.get(id)?.name ?? '?'} />
                    {peopleById.get(id)?.name ?? `#${id}`}
                    <button type="button" onClick={() => update(i, { assignee_ids: r.assignee_ids.filter((x) => x !== id) })} className="p-0.5 rounded-full hover:bg-primary/20" aria-label="Bỏ người này">
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <Picker
                  value={null}
                  options={peopleOptions}
                  onChange={(id) =>
                    update(i, {
                      assignee_ids: [...new Set([...r.assignee_ids, id])],
                      resolved: target ? { ...r.resolved, [target.raw]: id } : r.resolved,
                    })
                  }
                  placeholder="Thêm người"
                  tone={target ? 'warn' : 'default'}
                  triggerClassName={`!w-auto !h-7 rounded-full ${target ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}
                  trigger={
                    <>
                      <UserPlus size={13} className="shrink-0" />
                      <span className="whitespace-nowrap max-w-[11rem] truncate">{target ? `“${target.raw}” là ai?` : 'Thêm người'}</span>
                    </>
                  }
                  heading={
                    target ? (
                      target.status === 'ambiguous' ? (
                        <>Có nhiều người tên <b>“{target.raw}”</b>, chọn đúng người:</>
                      ) : (
                        <>Em chưa nhận ra <b>“{target.raw}”</b>. Chọn người, em sẽ nhớ cho lần sau:</>
                      )
                    ) : undefined
                  }
                  footer={target ? { label: `Bỏ qua tên “${target.raw}”`, onSelect: () => update(i, { skipped: [...r.skipped, target.raw] }) } : undefined}
                  ariaLabel={target ? `Chọn người cho ${target.raw}` : 'Thêm người phụ trách'}
                />
                <label className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto whitespace-nowrap">
                  <input type="checkbox" checked={r.done} onChange={(e) => update(i, { done: e.target.checked })} className="accent-emerald-600" />
                  Đã xong
                </label>
              </div>
              {Object.keys(r.resolved).length > 0 && (
                <div className="pl-6 text-[11px] text-emerald-700 dark:text-emerald-400">Em sẽ ghi nhớ tên gọi này cho lần sau.</div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-border bg-muted/30 rounded-b-xl">
        <span className="text-xs text-muted-foreground">
          {missingBoard > 0 ? <span className="text-amber-600">{missingBoard} việc chưa chọn bảng</span> : `${selected.length} việc sẽ được tạo`}
        </span>
        <button
          type="button"
          disabled={submitting || selected.length === 0 || missingBoard > 0 || selected.some((r) => !r.title.trim())}
          onClick={submit}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold whitespace-nowrap disabled:opacity-50"
        >
          {submitting && <Loader2 size={13} className="animate-spin" />}
          Tạo {selected.length} công việc
        </button>
      </div>
    </div>
  );
}
