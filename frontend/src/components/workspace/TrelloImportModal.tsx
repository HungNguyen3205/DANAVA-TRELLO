import { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, ChevronDown, CircleHelp, Download, ExternalLink, FileJson, KeyRound, Loader2, Search, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { projectsApi, type ProjectSummary } from '../../lib/api/projects';
import { trelloImportApi, type TrelloPreview, type TrelloImportResult } from '../../lib/api/trelloImport';

interface Person { id: number; name: string; username: string }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }).response;
  return Object.values(response?.data?.errors ?? {}).flat()[0]
    ?? response?.data?.message ?? 'Chưa nhận được kết quả. Vui lòng thử lại, hệ thống sẽ kiểm tra để tránh nhập trùng.';
}

function Initial({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
      {name.trim().charAt(0) || '?'}
    </span>
  );
}

/** One Trello member: search an employee to match, with an automatic suggestion for an identical name. */
function MemberMatch({ member, onChange, onError, disabled }: {
  member: TrelloPreview['members'][number];
  onChange: (userId: number | null) => void;
  onError: (message: string) => void;
  disabled: boolean;
}) {
  // The server suggests an employee with the same username or name; the parent pre-fills memberMap with it.
  const [selected, setSelected] = useState<Person | null>(member.suggested_user ?? null);
  const [suggested, setSuggested] = useState(!!member.suggested_user);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    // Short queries show no results (filtered when rendering), so nothing to fetch.
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      api.get<Person[]>('/users/search', { params: { q }, signal: controller.signal })
        .then(({ data }) => setResults(data))
        .catch((failure) => { if (!controller.signal.aborted) onError(errorMessage(failure)); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, onError]);

  const choose = (person: Person | null) => {
    setSelected(person);
    setSuggested(false);
    setQuery('');
    setResults([]);
    onChange(person?.id ?? null);
  };

  return (
    <li className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2 sm:items-start sm:gap-4">
      <div className="flex min-w-0 items-center gap-2.5 sm:pt-1">
        <Initial name={member.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{member.name}</p>
          <p className="truncate text-xs text-muted-foreground">{member.username ? `@${member.username} · Trello` : 'Thành viên Trello'}</p>
        </div>
      </div>
      {selected ? (
        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5">
          <Initial name={selected.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{selected.username}</p>
          </div>
          {suggested && <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Gợi ý</span>}
          <button type="button" disabled={disabled} onClick={() => choose(null)} aria-label={`Bỏ ghép ${member.name}`}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"><X size={15} /></button>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} disabled={disabled} onChange={(e) => setQuery(e.target.value)}
              aria-label={`Tìm nhân viên cho ${member.name}`} placeholder="Gõ tên hoặc tài khoản nhân viên…"
              className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-8 text-sm" />
            {searching && <Loader2 size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="mt-1.5 px-1 text-xs text-muted-foreground">Không tìm thấy nhân viên phù hợp.</p>
          )}
          {query.trim().length >= 2 && results.length > 0 && (
            <ul className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-sm" role="listbox">
              {results.map((person) => (
                <li key={person.id}>
                  <button type="button" role="option" aria-selected={false} onClick={() => choose(person)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent">
                    <Initial name={person.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{person.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length < 2 && <p className="mt-1.5 px-1 text-xs text-muted-foreground">Chưa ghép, giữ tên từ Trello.</p>}
        </div>
      )}
    </li>
  );
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const showError = useCallback((message: string) => setError(message), []);

  useEffect(() => {
    let active = true;
    projectsApi.list().then((rows) => { if (active) setProjects(rows); })
      .catch(() => { if (active) setError('Chưa tải được danh sách dự án. Anh/chị có thể nhập bảng độc lập hoặc mở lại để thử.'); });
    return () => { active = false; };
  }, []);


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
        setMemberMap(Object.fromEntries(response.members
          .filter((member) => member.suggested_user)
          .map((member) => [member.id, member.suggested_user!.id])));
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

  const pickFile = (picked?: File) => {
    if (!picked) return;
    setError('');
    if (!/\.json$/i.test(picked.name) && picked.type !== 'application/json') {
      setError('Chỉ nhận tệp .json xuất từ Trello.');
      return;
    }
    setFile(picked);
  };
  const tooLarge = !!file && file.size > 20 * 1024 * 1024;

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
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Nguồn nhập">
                {(['api', 'json'] as const).map((value) => {
                  const Icon = value === 'api' ? KeyRound : FileJson;
                  const active = source === value;
                  return (
                    <button key={value} type="button" disabled={busy} aria-pressed={active}
                      onClick={() => { setSource(value); setError(''); }}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Icon size={16} />
                      {value === 'api' ? 'Lấy qua API' : 'Tải JSON'}
                    </button>
                  );
                })}
              </div>
              {source === 'api' ? (
                <>
                  <label className="block space-y-1.5 text-sm font-medium">Liên kết bảng Trello
                    <input className={field} value={boardUrl} onChange={(e) => setBoardUrl(e.target.value)} required disabled={busy} placeholder="https://trello.com/b/…" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-sm font-medium">API key
                      <input className={field} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required autoComplete="off" disabled={busy} placeholder="Dán API key" />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">Token quyền đọc
                      <input type="password" className={field} value={apiToken} onChange={(e) => setApiToken(e.target.value)} required autoComplete="off" disabled={busy} placeholder="Dán token" />
                    </label>
                  </div>
                  <details className="group rounded-xl border border-border bg-muted/50 text-sm [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-medium text-primary">
                      <CircleHelp size={16} />
                      Hướng dẫn lấy API key và token
                      <ChevronDown size={16} className="ml-auto transition-transform group-open:rotate-180" />
                    </summary>
                    <ol className="space-y-2.5 border-t border-border px-3 pb-3 pt-3 text-muted-foreground">
                      {[
                        <>Mở bảng Trello cần nhập, sao chép địa chỉ trên thanh trình duyệt (dạng <code className="rounded bg-card px-1 text-xs">trello.com/b/…</code>) và dán vào ô <b>Liên kết bảng Trello</b>.</>,
                        <>Mở trang{' '}<a href="https://trello.com/power-ups/admin" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-2">Trello Power-Ups Admin<ExternalLink size={12} /></a>{' '}(đăng nhập bằng tài khoản có quyền xem bảng). Bấm <b>New</b>, điền tên bất kỳ (ví dụ “DANAVA Import”), chọn Workspace, nhập email rồi bấm <b>Create</b>.</>,
                        <>Trong Power-Up vừa tạo, mở tab <b>API key</b> → bấm <b>Generate a new API key</b>. Sao chép chuỗi <b>API key</b> và dán vào ô API key ở trên.</>,
                        <>Bấm{' '}{apiKey.trim()
                          ? <a className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-2" target="_blank" rel="noreferrer"
                              href={`https://trello.com/1/authorize?expiration=1day&scope=read&response_type=token&name=DANAVA%20Import&key=${encodeURIComponent(apiKey.trim())}`}>Tạo token quyền đọc<ExternalLink size={12} /></a>
                          : <b>Tạo token quyền đọc</b>}{' '}(liên kết hiện ra sau khi nhập API key), chọn <b>Allow</b>, sao chép token và dán vào ô <b>Token quyền đọc</b>.</>,
                      ].map((step, index) => (
                        <li key={index} className="flex gap-2.5 leading-relaxed">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                    Token chỉ có quyền đọc, hết hạn sau 1 ngày, chỉ dùng ở bước xem trước và không lưu vào cơ sở dữ liệu.
                  </p>
                </>
              ) : (
                <>
                  <ol className="space-y-1.5 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    {['Mở bảng Trello, bấm menu ⋯ ở góc phải.', 'Chọn In và xuất → Xuất JSON.', 'Tải tệp vừa xuất lên ô bên dưới.'].map((step, index) => (
                      <li key={step} className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  {file ? (
                    <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileJson size={20} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className={`text-xs ${tooLarge ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {formatSize(file.size)}{tooLarge ? ' · Vượt quá 20 MB' : ''}
                        </p>
                      </div>
                      <button type="button" disabled={busy} onClick={() => setFile(null)} aria-label="Bỏ tệp đã chọn"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"><X size={16} /></button>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
                      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><UploadCloud size={22} /></span>
                      <span className="text-sm font-medium">Kéo thả tệp vào đây hoặc <span className="text-primary underline-offset-2 hover:underline">chọn tệp</span></span>
                      <span className="text-xs text-muted-foreground">Tệp .json, tối đa 20 MB</span>
                      <input type="file" accept=".json,application/json" disabled={busy} className="sr-only" aria-label="Tệp JSON"
                        onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  )}
                </>
              )}
              <div className="-mx-5 flex flex-col-reverse gap-2 border-t border-border px-5 pt-4 sm:flex-row sm:justify-end">
                <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50">Hủy</button>
                <button className={`${button} inline-flex items-center justify-center gap-2`} disabled={busy || (source === 'json' && (!file || tooLarge))} type="submit">
                  {busy ? <><Loader2 size={16} className="animate-spin" />Đang đọc dữ liệu Trello…</> : <>Xem trước dữ liệu<ArrowRight size={16} /></>}
                </button>
              </div>
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
                      <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-semibold">
                        Ghép thành viên
                        <span className="text-xs font-normal text-muted-foreground">
                          Đã ghép {Object.values(memberMap).filter(Boolean).length}/{preview.members.length}
                        </span>
                      </legend>
                      <p className="text-xs text-muted-foreground">Gõ tên để tìm nhân viên tương ứng với từng thành viên Trello. Người trùng tên được gợi ý sẵn. Tài khoản được ghép sẽ vào bảng với quyền thành viên; người chưa ghép được giữ tên từ Trello.</p>
                      <ul className="space-y-2">
                        {preview.members.map((member) => (
                          <MemberMatch key={member.id} member={member} disabled={busy} onError={showError}
                            onChange={(userId) => setMemberMap((previous) => ({ ...previous, [member.id]: userId }))} />
                        ))}
                      </ul>
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
