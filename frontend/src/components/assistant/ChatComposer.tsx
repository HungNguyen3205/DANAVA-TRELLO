import { useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent, type RefObject } from 'react';
import { FileSpreadsheet, FileText, FileType2, ImagePlus, Loader2, Mic, Paperclip, Send, Square, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { FILE_ACCEPT, IMAGE_ACCEPT, MAX_RECORD_SECONDS, formatSize, type PendingFile } from './chatFiles';
import { useVoiceRecorder } from './useVoiceRecorder';

const MAX_INPUT_HEIGHT = 168; // about 7 lines, then the box scrolls

const FILE_ICON = { pdf: FileType2, xlsx: FileSpreadsheet, docx: FileText, text: FileText } as const;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  files: PendingFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (key: string) => void;
  /** Send now; `voice` is a recording to include that is not in `files` yet. */
  onSend: (voice?: File) => void;
  sending: boolean;
}

/** Message box: grows with the text, takes pasted/picked images and files, and records voice. */
export function ChatComposer({ inputRef, value, onChange, files, onAddFiles, onRemoveFile, onSend, sending }: Props) {
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sendAfterStop = useRef(false);

  const recorder = useVoiceRecorder(
    (message) => toast.error(message),
    (file) => {
      if (sendAfterStop.current) {
        sendAfterStop.current = false;
        onSend(file);
      } else {
        onAddFiles([file]);
      }
    },
  );

  // Grow with the content up to a limit, then scroll inside.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  }, [value, inputRef, recorder.state]);

  const canSend = !sending && (value.trim() !== '' || files.length > 0);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  // Screenshots and copied images are attached; copied text pastes as usual.
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length && !e.clipboardData.getData('text/plain')) {
      e.preventDefault();
      onAddFiles(pasted);
    }
  };

  const pick = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.value = '';
    input.click();
  };

  if (recorder.state !== 'idle') {
    const processing = recorder.state === 'processing';
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5">
        <button type="button" onClick={recorder.cancel} disabled={processing} className="p-2 rounded-full text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-40" aria-label="Hủy ghi âm" title="Hủy">
          <Trash2 size={17} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="relative flex w-3 h-3 shrink-0">
            {!processing && <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-60" />}
            <span className="relative w-3 h-3 rounded-full bg-rose-500" />
          </span>
          <span className="text-sm font-semibold text-rose-700 dark:text-rose-300 tabular-nums whitespace-nowrap">
            {processing ? 'Đang xử lý…' : `${clock(recorder.seconds)} / ${clock(MAX_RECORD_SECONDS)}`}
          </span>
          {/* Live input level */}
          <span className="flex-1 flex items-center gap-[3px] h-6 overflow-hidden" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-rose-400 transition-[height] duration-100"
                style={{ height: `${Math.max(3, recorder.level * 22 * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + recorder.seconds))))}px` }}
              />
            ))}
          </span>
        </div>
        <button type="button" onClick={recorder.stop} disabled={processing} className="p-2 rounded-full text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-40" aria-label="Dừng và đính kèm" title="Dừng (thêm chữ rồi gửi sau)">
          <Square size={16} fill="currentColor" />
        </button>
        <button
          type="button"
          onClick={() => {
            sendAfterStop.current = true;
            recorder.stop();
          }}
          disabled={processing || sending}
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"
          aria-label="Gửi ghi âm"
          title="Gửi ngay"
        >
          {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-2.5 pt-2.5 pb-1">
          {files.map((f) => {
            const Icon = FILE_ICON[f.kind as keyof typeof FILE_ICON] ?? FileText;
            return (
              <div key={f.key} className="relative shrink-0 group" title={f.file.name}>
                {f.kind === 'image' && f.preview ? (
                  <img src={f.preview} alt={f.file.name} className="w-14 h-14 rounded-xl object-cover border border-border" />
                ) : (
                  <div className="h-14 w-36 rounded-xl border border-border bg-muted/50 flex items-center gap-2 px-2">
                    {f.kind === 'audio' ? <Mic size={18} className="shrink-0 text-primary" /> : <Icon size={18} className="shrink-0 text-primary" />}
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-foreground">{f.kind === 'audio' ? 'Ghi âm' : f.file.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{formatSize(f.file.size)}</span>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveFile(f.key)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background inline-flex items-center justify-center shadow"
                  aria-label={`Bỏ ${f.file.name}`}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        rows={1}
        maxLength={8000}
        placeholder={files.length ? 'Thêm lời nhắn (không bắt buộc)…' : 'Hỏi em, dán ảnh hoặc tin nhắn giao việc…'}
        title="Enter để gửi, Shift+Enter để xuống dòng"
        className="block w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-base sm:text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none focus:ring-0"
      />

      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        <button type="button" onClick={() => pick(imageInput.current)} className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" title="Gửi ảnh (hoặc dán ảnh bằng Ctrl+V)" aria-label="Gửi ảnh">
          <ImagePlus size={18} />
        </button>
        <button type="button" onClick={() => pick(fileInput.current)} className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" title="Đính kèm tệp: PDF, Word, Excel, văn bản" aria-label="Đính kèm tệp">
          <Paperclip size={18} />
        </button>
        <button type="button" onClick={() => void recorder.start()} className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" title="Ghi âm (tối đa 2 phút)" aria-label="Ghi âm">
          <Mic size={18} />
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onSend()}
          disabled={!canSend}
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-40"
          aria-label="Gửi"
        >
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>

      <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => onAddFiles(Array.from(e.target.files ?? []))} />
      <input ref={fileInput} type="file" accept={FILE_ACCEPT} multiple hidden onChange={(e) => onAddFiles(Array.from(e.target.files ?? []))} />
    </div>
  );
}
