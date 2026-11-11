import { Fragment, type ReactNode } from 'react';

/**
 * Minimal, safe Markdown renderer for assistant replies.
 * Supports ### headings, "- " / "* " bullets, "1. " lists, **bold**, *italic* / _italic_,
 * `code` and paragraphs. Builds React elements only (never innerHTML), so model output
 * cannot inject markup or scripts.
 */
export function MarkdownLite({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(
        <p key={`p${blocks.length}`} className="leading-relaxed">
          {paragraph.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l)}
            </Fragment>
          ))}
        </p>,
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={`l${blocks.length}`} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 marker:text-primary`}>
          {list.items.map((item, i) => (
            <li key={i} className="leading-relaxed pl-0.5">{inline(item)}</li>
          ))}
        </Tag>,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <h4 key={`h${blocks.length}`} className="font-bold text-[0.95rem] text-foreground pt-1">
          {inline(heading[1])}
        </h4>,
      );
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}

/** **bold**, *italic*, _italic_ and `code` inside one line. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${m.index}`;
    if (token.startsWith('**')) out.push(<strong key={key} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) out.push(<code key={key} className="px-1 rounded bg-muted text-[0.85em]">{token.slice(1, -1)}</code>);
    else out.push(<em key={key} className="text-muted-foreground">{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
