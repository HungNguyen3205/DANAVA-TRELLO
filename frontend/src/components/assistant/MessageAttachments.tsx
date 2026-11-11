import { FileSpreadsheet, FileText, FileType2, Mic } from 'lucide-react';
import type { ChatAttachment } from '../../lib/api/assistant';
import { getAvatarUrl } from '../../lib/avatar';
import { formatSize } from './chatFiles';

/** Server links are relative to the API host; blob: previews are used as they are. */
const attachmentUrl = (url: string) => (url.startsWith('blob:') ? url : getAvatarUrl(url));

const FILE_ICON = { pdf: FileType2, xlsx: FileSpreadsheet, docx: FileText, text: FileText } as const;

/** Images, voice notes and files sent with a chat message. */
export function MessageAttachments({ items, mine, onMediaLoad }: { items: ChatAttachment[]; mine: boolean; onMediaLoad?: () => void }) {
  const images = items.filter((a) => a.kind === 'image');
  const audios = items.filter((a) => a.kind === 'audio');
  const files = items.filter((a) => a.kind !== 'image' && a.kind !== 'audio');

  return (
    <div className="space-y-1.5">
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {images.map((a) => (
            <a key={a.id} href={attachmentUrl(a.url)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-black/5" title={a.name}>
              <img
                src={attachmentUrl(a.url)}
                alt={a.name}
                onLoad={onMediaLoad}
                className={`w-full object-cover ${images.length > 1 ? 'h-28' : 'max-h-56'}`}
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      {audios.map((a) => (
        <div key={a.id} className={`flex items-center gap-1.5 rounded-xl px-1.5 py-1 ${mine ? 'bg-white/15' : 'bg-muted'}`}>
          <Mic size={14} className="shrink-0 ml-1 opacity-80" />
          <audio controls preload="metadata" src={attachmentUrl(a.url)} className="asst-audio h-8 min-w-0 flex-1" />
        </div>
      ))}
      {files.map((a) => {
        const Icon = FILE_ICON[a.kind as keyof typeof FILE_ICON] ?? FileText;
        return (
          <a
            key={a.id}
            href={attachmentUrl(a.url)}
            target="_blank"
            rel="noopener noreferrer"
            download={a.kind === 'pdf' ? undefined : a.name}
            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-muted hover:bg-muted/70'}`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{a.name}</span>
              <span className="block text-[10.5px] opacity-75">{formatSize(a.size)}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
