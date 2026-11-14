import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, History, Loader2, RefreshCw, Search } from 'lucide-react';
import { assistantActionLogApi, formatDateTimeVN, type AssistantActionLogEntry, type AssistantActionLogPage } from '../../lib/api/assistant';

const TOOL_LABELS: Record<string, string> = {
  find_tasks: 'Tìm công việc',
  find_people: 'Tìm nhân viên',
  list_boards: 'Xem danh sách bảng',
  list_departments: 'Xem phòng ban',
  create_task: 'Tạo công việc',
  update_task: 'Sửa công việc',
  delete_task: 'Xóa công việc',
  comment_task: 'Bình luận công việc',
  create_account: 'Tạo tài khoản',
  update_employee: 'Sửa nhân viên',
  set_account_status: 'Khóa / mở khóa tài khoản',
  reset_password: 'Đặt lại mật khẩu',
  delete_employee: 'Xóa tài khoản',
};

const STATUS: Record<AssistantActionLogEntry['status'], { label: string; cls: string }> = {
  success: { label: 'Thành công', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  failed: { label: 'Lỗi', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  denied: { label: 'Bị từ chối', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' },
  needs_confirmation: { label: 'Chờ xác nhận', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
};

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Có' : 'Không') : String(v));

function Row({ log }: { log: AssistantActionLogEntry }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[log.status] ?? STATUS.failed;
  const changes = log.changes ? Object.entries(log.changes) : [];

  return (
    <li className="border border-border rounded-xl">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left p-3 flex items-start gap-2 hover:bg-muted/40 rounded-xl">
        {open
          ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          : <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold">{log.user?.name ?? 'Người dùng đã xóa'}</span>
            <span className="text-muted-foreground">·</span>
            <span>{TOOL_LABELS[log.tool] ?? log.tool}</span>
            {log.target_label && <span className="font-medium truncate max-w-[16rem]">“{log.target_label}”</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{formatDateTimeVN(log.created_at)}</div>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pl-9 space-y-2 text-sm">
          {log.request_text && (
            <div><span className="text-muted-foreground">Yêu cầu: </span><span className="whitespace-pre-wrap break-words">{log.request_text}</span></div>
          )}
          {log.message && <div><span className="text-muted-foreground">Kết quả: </span>{log.message}</div>}
          {changes.length > 0 && (
            <ul className="space-y-1">
              {changes.map(([field, c]) => (
                <li key={field} className="break-words">
                  <span className="text-muted-foreground">{field.replace(/_/g, ' ')}: </span>
                  <span className="line-through opacity-70">{show(c.truoc)}</span> → <span className="font-medium">{show(c.sau)}</span>
                </li>
              ))}
            </ul>
          )}
          {log.arguments && Object.keys(log.arguments).length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">Dữ liệu trợ lý gửi</summary>
              <pre className="mt-1 text-xs bg-muted/50 rounded-lg p-2 overflow-x-auto">{JSON.stringify(log.arguments, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

/** Admin-only journal of everything the assistant did, or refused to do, for each person. */
export function AssistantActionLogPanel() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [includeReads, setIncludeReads] = useState(false);
  const [data, setData] = useState<AssistantActionLogPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    assistantActionLogApi.list({ page, status, q: search, include_reads: includeReads })
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [page, status, search, includeReads]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3 pt-5 mt-5 border-t border-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <History size={16} className="text-primary" /> Nhật ký thao tác của trợ lý
          {data && <span className="font-normal text-muted-foreground">({data.total.toLocaleString('vi-VN')})</span>}
        </div>
        <button type="button" onClick={load} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Tải lại">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo công việc, nhân viên, nội dung yêu cầu…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background"
          />
        </form>
        <select
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          className="py-2 px-2 text-sm rounded-lg border border-border bg-background"
        >
          <option value="">Mọi kết quả</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={includeReads} onChange={(e) => { setPage(1); setIncludeReads(e.target.checked); }} />
        Hiện cả các lần tra cứu (tìm việc, tìm người…)
      </label>

      {failed ? (
        <div className="text-sm text-destructive">Không tải được nhật ký.</div>
      ) : !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Đang tải…</div>
      ) : data.data.length === 0 ? (
        <div className="text-sm text-muted-foreground">Chưa có thao tác nào.</div>
      ) : (
        <ul className="space-y-2">{data.data.map((log) => <Row key={log.id} log={log} />)}</ul>
      )}

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40">Trước</button>
          <span className="text-muted-foreground">Trang {data.current_page}/{data.last_page}</span>
          <button type="button" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40">Sau</button>
        </div>
      )}
    </div>
  );
}
