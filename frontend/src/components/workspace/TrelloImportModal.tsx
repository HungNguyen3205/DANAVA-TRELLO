import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { projectsApi, type ProjectSummary } from '../../lib/api/projects';
import { trelloImportApi, type TrelloPreview, type TrelloImportResult } from '../../lib/api/trelloImport';

interface Person { id: number; name: string; username: string }

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }).response;
  return Object.values(response?.data?.errors ?? {}).flat()[0]
    ?? response?.data?.message ?? 'Chưa nhận được kết quả. Vui lòng thử lại, hệ thống sẽ kiểm tra để tránh nhập trùng.';
}

export function TrelloImportModal({ onClose, onImported, defaultProjectId }: {
  onClose: () => void;
  onImported: () => void;
  defaultProjectId?: number;
}) {
  const navigate = useNavigate();
  const [source, setSource] = useState<'api' | 'json'>('api');
  const [boardUrl, setBoardUrl] = useState('https://trello.com/b/bhpZYZbw/danava-dev-bug');
  const [apiKey, setApiKey] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TrelloPreview | null>(null);
  const [result, setResult] = useState<TrelloImportResult | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, number | null>>({});
  const [projectId, setProjectId] = useState<number | ''>(defaultProjectId ?? '');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let active = true;
    projectsApi.list().then((rows) => { if (active) setProjects(rows); })
      .catch(() => { if (active) setError('Chưa tải được danh sách dự án. Anh/chị có thể nhập bảng độc lập hoặc mở lại để thử.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (search.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.get<Person[]>('/users/search', { params: { q: search.trim() }, signal: controller.signal })
        .then(({ data }) => setPeople((previous) => [...new Map([...previous, ...data].map((p) => [p.id, p])).values()]))
        .catch((failure) => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);

  const loadPreview = async () => {
    setBusy(true);
    setError('');
    try {
      let body: FormData | { source: 'api'; board_url: string; api_key: string; api_token: string };
      if (source === 'json') {
        if (!file || file.size > 20 * 1024 * 1024) throw new Error('Chọn tệp JSON không quá 20 MB.');
        body = new FormData();
        body.append('source', 'json');
        body.append('file', file);
      } else {
        body = { source: 'api', board_url: boardUrl.trim(), api_key: apiKey.trim(), api_token: apiToken.trim() };
      }
      const response = await trelloImportApi.preview(body);
      setApiToken('');
      if ('existing' in response) {
        setResult(response.existing);
      } else {
        setPreview(response);
        setMemberMap({});
        setAcknowledged(false);
      }
    } catch (failure) {
      setError(failure instanceof Error && !('response' in failure) ? failure.message : errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      setResult(await trelloImportApi.confirm(preview.preview_token, memberMap, projectId === '' ? null : projectId));
      onImported();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-lg border border-input bg-background p-2.5 text-sm';
  const button = 'rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50';
  const warnings = result?.warnings ?? preview?.warnings;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-bold">Nhập từ Trello</Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Đóng" className="rounded-lg p-2 hover:bg-accent disabled:opacity-40"><X size={18} /></Dialog.Close>
          </div>
          <Dialog.Description className="mb-5 text-sm text-muted-foreground">
            Tạo bảng từ dữ liệu Trello, giữ thứ tự cột và công việc. Mỗi bảng nguồn được nhập một lần cho tài khoản của bạn.
          </Dialog.Description>

          {!preview && !result && (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void loadPreview(); }}>
              <div className="flex gap-2" role="group" aria-label="Nguồn nhập">
                {(['api', 'json'] as const).map((value) => (
                  <button key={value} type="button" disabled={busy} aria-pressed={source === value}
                    onClick={() => { setSource(value); setError(''); }}
                    className={`rounded-lg px-4 py-2 text-sm ${source === value ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}>
                    {value === 'api' ? 'Lấy qua API' : 'Tải JSON'}
                  </button>
                ))}
              </div>
              {source === 'api' ? (
                <>
                  <label className="block space-y-1 text-sm">Liên kết bảng Trello
                    <input className={field} value={boardUrl} onChange={(e) => setBoardUrl(e.target.value)} required disabled={busy} />
                  </label>
                  <label className="block space-y-1 text-sm">API key
                    <input className={field} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required autoComplete="off" disabled={busy} />
                  </label>
                  <label className="block space-y-1 text-sm">Token quyền đọc
                    <input type="password" className={field} value={apiToken} onChange={(e) => setApiToken(e.target.value)} required autoComplete="off" disabled={busy} />
                  </label>
                  <p className="text-xs leading-relaxed text-muted-foreground">Lấy API key tại{' '}
                    <a href="https://trello.com/apps/admin" target="_blank" rel="noreferrer" className="underline">Trello Power-Ups</a>.
                    {apiKey && <>{' '}<a className="underline" target="_blank" rel="noreferrer"
                      href={`https://trello.com/1/authorize?expiration=1day&scope=read&response_type=token&key=${encodeURIComponent(apiKey.trim())}`}>Tạo token quyền đọc trong 1 ngày</a>.</>}
                    {' '}Token chỉ dùng để đọc dữ liệu ở bước xem trước và không lưu vào cơ sở dữ liệu.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Trong bảng Trello, mở menu → In và xuất → Xuất JSON. Tải tệp bảng vừa xuất lên đây.</p>
                  <label className="block space-y-1 text-sm">Tệp JSON, tối đa 20 MB
                    <input type="file" accept=".json,application/json" required disabled={busy} className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                </>
              )}
              <button className={button} disabled={busy} type="submit">{busy ? 'Đang đọc dữ liệu Trello…' : 'Xem trước dữ liệu'}</button>
            </form>
          )}

          {(preview || result) && (
            <div className="space-y-4">
              <p className="font-semibold">{result ? `Bảng đã nhập · ${result.name}` : preview?.summary.name}</p>
              <dl className="grid grid-cols-2 gap-2 rounded-xl bg-accent/40 p-3 text-sm sm:grid-cols-3">
                {Object.entries({
                  'Cột': (result ?? preview)!.summary.lists, 'Công việc': (result ?? preview)!.summary.cards,
                  'Thẻ lưu trữ': (result ?? preview)!.summary.archived_cards, 'Việc trong checklist': (result ?? preview)!.summary.check_items,
                  'Bình luận': (result ?? preview)!.summary.comments, 'Liên kết tệp': (result ?? preview)!.summary.attachments,
                }).map(([name, value]) => <div key={name}><dt className="text-muted-foreground">{name}</dt><dd className="font-bold">{value}</dd></div>)}
              </dl>
              {preview && !result && (
                <>
                  <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                    {preview.columns.map((column, index) => <li key={index}>{column.name} · {column.cards} thẻ{column.archived ? ' · Đã lưu trữ' : ''}</li>)}
                  </ul>
                  <label className="block space-y-1 text-sm">Thuộc dự án
                    <select className={field} value={projectId} disabled={busy} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Bảng độc lập</option>
                      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select>
                  </label>
                  {preview.members.length > 0 && (
                    <fieldset disabled={busy} className="space-y-3">
                      <legend className="mb-2 text-sm font-semibold">Ghép thành viên</legend>
                      <p className="text-xs text-muted-foreground">Tài khoản được ghép sẽ được thêm vào bảng với quyền thành viên. Thành viên bỏ qua được giữ tên trong nguồn Trello.</p>
                      <input className={field} aria-label="Tìm nhân viên" placeholder="Tìm nhân viên bằng tên hoặc tài khoản, từ 2 ký tự" value={search} onChange={(e) => setSearch(e.target.value)} />
                      {preview.members.map((member) => (
                        <label key={member.id} className="grid gap-1 text-sm sm:grid-cols-2 sm:items-center">
                          <span>{member.name}{member.username ? ` (@${member.username})` : ''}</span>
                          <select className={field} value={memberMap[member.id] ?? ''} onChange={(e) => setMemberMap((previous) => ({ ...previous, [member.id]: e.target.value ? Number(e.target.value) : null }))}>
                            <option value="">Bỏ qua ghép tài khoản</option>
                            {people.map((person) => <option key={person.id} value={person.id}>{person.name} (@{person.username})</option>)}
                          </select>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </>
              )}
              <ul className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed">
                {warnings?.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
              {result ? (
                <div className="flex flex-wrap gap-2">
                  <button className={button} onClick={() => { onClose(); navigate(`/${result.public_id}/kanban`); }}>Mở bảng đã nhập</button>
                  <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm" onClick={() => trelloImportApi.downloadSnapshot(result.snapshot_token).catch((failure) => setError(errorMessage(failure)))}><Download size={15} />Tải dữ liệu nguồn JSON</button>
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />Tôi đã kiểm tra dữ liệu và các lưu ý phía trên.</label>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-border px-3 py-2 text-sm" disabled={busy} onClick={() => setPreview(null)}>Chọn lại nguồn</button>
                    <button className={button} disabled={busy || !acknowledged} onClick={() => void confirm()}>{busy ? 'Đang nhập dữ liệu…' : 'Nhập vào DANAVA'}</button>
                  </div>
                </>
              )}
            </div>
          )}
          {busy && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Vui lòng giữ cửa sổ này đến khi có kết quả.</p>}
          {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
