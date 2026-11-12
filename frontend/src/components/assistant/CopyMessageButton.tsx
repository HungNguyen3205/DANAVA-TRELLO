import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

/** Turns the assistant's Markdown into clean text for pasting into chats, emails, documents. */
function markdownToPlain(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^(\s*)[-*]\s+/, '$1• ')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2')
        .replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, '$1$2')
        .replace(/`([^`]+)`/g, '$1'),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for plain-http hosts where the async clipboard API is unavailable.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('copy failed');
}

export function CopyMessageButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await writeClipboard(markdownToPlain(markdown));
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Không sao chép được, vui lòng thử lại.');
    }
  };

  return (
    <div className="flex justify-end mt-1.5 -mb-1 -mr-1.5">
      <button
        type="button"
        onClick={() => void copy()}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
          copied ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Sao chép tin nhắn"
        aria-label="Sao chép tin nhắn"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Đã sao chép' : 'Sao chép'}
      </button>
    </div>
  );
}
