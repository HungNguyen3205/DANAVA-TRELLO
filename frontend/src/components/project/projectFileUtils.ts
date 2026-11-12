import { toast } from 'sonner';
import { PROJECT_FILE_ACCEPT, PROJECT_FILE_MAX_BYTES } from '../../lib/api/projects';

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

export const fileExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

const allowed = new Set(PROJECT_FILE_ACCEPT.split(',').map((x) => x.slice(1)));

/** Checks picked files; returns the ones to upload and explains why others were skipped. */
export function checkProjectFiles(files: File[]): File[] {
  const ok: File[] = [];
  for (const f of files) {
    if (!allowed.has(fileExt(f.name))) toast.error(`"${f.name}" chưa được hỗ trợ (chỉ nhận tài liệu, ảnh, video và tệp nén).`);
    else if (f.size > PROJECT_FILE_MAX_BYTES) toast.error(`"${f.name}" lớn hơn 20MB.`);
    else ok.push(f);
  }
  return ok;
}
