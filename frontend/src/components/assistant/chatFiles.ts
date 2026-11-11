import type { AttachmentKind } from '../../lib/api/assistant';

export const MAX_FILES = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_RECORD_SECONDS = 120;

const KINDS: Record<string, AttachmentKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', heic: 'image', heif: 'image',
  pdf: 'pdf',
  wav: 'audio', mp3: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio', webm: 'audio',
  txt: 'text', csv: 'text', md: 'text', json: 'text',
  docx: 'docx', xlsx: 'xlsx',
};

export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif';
export const FILE_ACCEPT = Object.keys(KINDS).map((e) => `.${e}`).join(',');

export function kindOf(name: string): AttachmentKind | null {
  return KINDS[name.split('.').pop()?.toLowerCase() ?? ''] ?? null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export interface PendingFile {
  key: string;
  file: File;
  kind: AttachmentKind;
  /** Object URL for image/audio previews. */
  preview: string | null;
}

/** Shrink large photos (phone pictures are often 4–8 MB) before upload. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Check and prepare files picked, pasted or dropped. Returns accepted files and error messages. */
export async function prepareFiles(files: File[], existing: number): Promise<{ added: PendingFile[]; errors: string[] }> {
  const added: PendingFile[] = [];
  const errors: string[] = [];
  for (const original of files) {
    if (existing + added.length >= MAX_FILES) {
      errors.push(`Mỗi lần gửi tối đa ${MAX_FILES} tệp.`);
      break;
    }
    // Pasted screenshots arrive as "image.png" or without a name.
    const named = original.name ? original : new File([original], `anh-dan-${Date.now()}.png`, { type: original.type });
    const kind = kindOf(named.name);
    if (!kind) {
      errors.push(`"${named.name}" chưa được hỗ trợ. Em nhận ảnh, ghi âm, PDF, Word, Excel và tệp văn bản.`);
      continue;
    }
    const file = kind === 'image' ? await shrinkImage(named) : named;
    if (file.size > MAX_BYTES) {
      errors.push(`"${file.name}" lớn hơn 10MB.`);
      continue;
    }
    added.push({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      kind,
      preview: kind === 'image' || kind === 'audio' ? URL.createObjectURL(file) : null,
    });
  }
  return { added, errors };
}

export function releaseFiles(files: PendingFile[]) {
  files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
}

/**
 * Convert a browser recording (webm/opus, mp4…) to 16 kHz mono WAV, a format Gemini reads everywhere.
 * A two-minute recording is about 3.8 MB.
 */
export async function toWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
