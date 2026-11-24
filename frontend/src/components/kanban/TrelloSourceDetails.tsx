export interface TrelloSource {
  id: string;
  name?: string;
  url?: string;
  start?: string | null;
  due?: string | null;
  due_complete?: boolean;
  members?: { id: string; fullName?: string; username?: string }[];
  attachments?: { id?: string; name: string; url: string }[];
  custom_fields?: { name: string; value: string }[];
}

function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function TrelloSourceDetails({ source }: { source: TrelloSource | null }) {
  if (!source) return null;

  return (
    <details className="mb-8 rounded-xl border border-border bg-accent/20 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Nguồn Trello{source.attachments?.length ? ` · ${source.attachments.length} liên kết tệp` : ''}</summary>
      <div className="mt-3 space-y-3 break-words text-sm">
        {source.name && <p>{source.name}</p>}
        {source.url && safeUrl(source.url) && <a className="block text-primary underline" href={safeUrl(source.url)} target="_blank" rel="noreferrer">Mở thẻ gốc trên Trello</a>}
        {source.members && source.members.length > 0 && <p>Người phụ trách gốc · {source.members.filter(Boolean).map((member) => member.fullName ?? member.username ?? member.id).join(', ')}</p>}
        {source.start && <p>Bắt đầu gốc · {source.start}</p>}
        {source.due && <p>Hạn chót gốc · {source.due}</p>}
        {source.due_complete && <p>Đã đánh dấu hoàn thành trên Trello. Thời điểm hoàn thành trong DANAVA được ước tính theo hoạt động cuối.</p>}
        {source.custom_fields?.map((field, index) => <p key={index}>{field.name} · {field.value}</p>)}
        {!!source.attachments?.length && (
          <>
            <p className="text-xs text-muted-foreground">Tệp nằm ở nguồn gốc, có thể cần tài khoản Trello để truy cập.</p>
            <ul className="space-y-2">
              {source.attachments.map((attachment, index) => <li key={attachment.id ?? index}>
                {safeUrl(attachment.url) ? <a className="text-primary underline" href={safeUrl(attachment.url)} target="_blank" rel="noreferrer">{attachment.name}</a> : attachment.name}
              </li>)}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
