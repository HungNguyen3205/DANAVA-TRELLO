import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  Download, Eye, File as FileIcon, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2, Paperclip, Presentation, Trash2, UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAvatarUrl } from '../../lib/avatar';
import { formatDateTimeVN } from '../../lib/api/assistant';
import { PROJECT_FILE_ACCEPT, projectFilesApi, type ProjectFile } from '../../lib/api/projects';

import { checkProjectFiles, fileExt as ext, formatBytes } from './projectFileUtils';

function TypeIcon({ name }: { name: string }) {
  const e = ext(name);
  const [Icon, cls] =
    ['pdf'].includes(e) ? [FileText, 'text-rose-600 bg-rose-500/10']
    : ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(e) ? [FileText, 'text-blue-600 bg-blue-500/10']
    : ['xls', 'xlsx', 'ods', 'csv'].includes(e) ? [FileSpreadsheet, 'text-emerald-600 bg-emerald-500/10']
    : ['ppt', 'pptx', 'odp'].includes(e) ? [Presentation, 'text-orange-600 bg-orange-500/10']
    : ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'svg', 'psd', 'ai', 'fig'].includes(e) ? [FileImage, 'text-violet-600 bg-violet-500/10']
    : ['zip', 'rar', '7z'].includes(e) ? [FileArchive, 'text-amber-700 bg-amber-500/10']
    : ['mp4', 'mov', 'mp3', 'wav'].includes(e) ? [FileVideo, 'text-sky-600 bg-sky-500/10']
    : [FileIcon, 'text-muted-foreground bg-muted'];
  return <span className={`w-9 h-9 shrink-0 rounded-lg grid place-items-center ${cls}`}><Icon size={18} /></span>;
}

/** Drop zone + "choose files" button. */
export function FileDropZone({ onFiles, busy, progress }: { onFiles: (files: File[]) => void; busy?: boolean; progress?: number | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!busy) onFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      onClick={() => !busy && input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && input.current?.click()}
      className={`rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${over ? 'border-ring bg-accent' : 'border-border hover:border-ring/50 hover:bg-accent/40'}`}
    >
      {busy ? (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"><Loader2 size={16} className="animate-spin" /> Đang tải lên… {progress != null ? `${progress}%` : ''}</div>
          {progress != null && <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>}
        </div>
      ) : (
        <>
          <UploadCloud className="mx-auto text-primary" size={26} />
          <p className="mt-1.5 text-sm font-semibold text-foreground">Kéo thả tài liệu vào đây hoặc bấm để chọn</p>
          <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, Excel, PowerPoint, ảnh, video, tệp nén · tối đa 20MB mỗi tệp, 10 tệp mỗi lần</p>
        </>
      )}
      <input ref={input} type="file" multiple hidden accept={PROJECT_FILE_ACCEPT}
        onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </div>
  );
}

/** Project documents: list, open, download, upload and delete. */
export function ProjectFilesPanel({ projectId, onCountChange }: { projectId: number; onCountChange?: (n: number) => void }) {
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    projectFilesApi.list(projectId).then((f) => { setFiles(f); onCountChange?.(f.length); }).catch(() => setFiles([]));
  }, [projectId, onCountChange]);
  useEffect(load, [load]);

  const upload = async (picked: File[]) => {
    const ok = checkProjectFiles(picked).slice(0, 10);
    if (!ok.length) return;
    setBusy(true);
    setProgress(0);
    try {
      const res = await projectFilesApi.upload(projectId, ok, setProgress);
      toast.success(res.message);
      load();
    } catch (e: any) {
      const errs = e?.response?.data?.errors;
      toast.error((errs && (Object.values(errs)[0] as string[])[0]) || e?.response?.data?.message || 'Không tải được tệp lên.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const remove = async (f: ProjectFile) => {
    if (!window.confirm(`Xóa tệp "${f.name}"? Mọi người trong dự án sẽ không xem được nữa.`)) return;
    try {
      await projectFilesApi.remove(projectId, f.id);
      toast.success('Đã xóa tệp.');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không xóa được tệp.');
    }
  };

  const canPreview = (f: ProjectFile) => /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(f.mime ?? '');

  return (
    <div className="space-y-3">
      <FileDropZone onFiles={upload} busy={busy} progress={progress} />

      {files === null ? (
        <div className="space-y-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2 flex items-center justify-center gap-1.5"><Paperclip size={14} /> Chưa có tài liệu nào.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <TypeIcon name={f.name} />
              <div className="min-w-0 flex-1">
                <a href={getAvatarUrl(canPreview(f) ? f.view_url : f.download_url)} target="_blank" rel="noopener noreferrer"
                  className="block text-sm font-semibold text-foreground hover:text-primary truncate" title={f.name}>{f.name}</a>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 min-w-0">
                  <span className="whitespace-nowrap">{formatBytes(f.size)}</span>
                  <span aria-hidden="true">·</span>
                  {f.uploaded_by?.avatar && <img src={getAvatarUrl(f.uploaded_by.avatar)} alt="" className="w-4 h-4 rounded-full object-cover" />}
                  <span className="truncate">{f.uploaded_by?.name ?? 'Không rõ'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">{formatDateTimeVN(f.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {canPreview(f) && (
                  <a href={getAvatarUrl(f.view_url)} target="_blank" rel="noopener noreferrer" title="Xem" aria-label={`Xem ${f.name}`}
                    className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"><Eye size={16} /></a>
                )}
                <a href={getAvatarUrl(f.download_url)} title="Tải xuống" aria-label={`Tải xuống ${f.name}`}
                  className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"><Download size={16} /></a>
                {f.can_delete && (
                  <button type="button" onClick={() => remove(f)} title="Xóa" aria-label={`Xóa ${f.name}`}
                    className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
