import { useEffect, useMemo, useState } from 'react';
import {
  Award, Bell, Bot, ChevronDown, Clock, Compass, FolderKanban, LayoutGrid, LifeBuoy, ListTodo, MessageCircleQuestion, MoveRight, Search, Settings, Users,
} from 'lucide-react';
import api from '../lib/axios';
import { MarkdownLite } from '../components/assistant/MarkdownLite';
import { askAssistant } from '../components/assistant/askAssistant';

interface GuideSection {
  id: string;
  icon: string;
  title: string;
  summary: string;
  steps: string[];
}

const ICONS: Record<string, typeof Compass> = {
  compass: Compass, folder: FolderKanban, board: LayoutGrid, task: ListTodo, move: MoveRight, users: Users,
  bot: Bot, clock: Clock, award: Award, bell: Bell, settings: Settings,
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();


/** Short how-to guide. The same content (from the server) is what the assistant answers with. */
export function HelpPage() {
  const [sections, setSections] = useState<GuideSection[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>('bat-dau');

  useEffect(() => {
    api.get<{ sections: GuideSection[] }>('/guide').then((r) => setSections(r.data.sections)).catch(() => setSections([]));
  }, []);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return sections ?? [];
    return (sections ?? []).filter((s) => fold(`${s.title} ${s.summary} ${s.steps.join(' ')}`).includes(q));
  }, [sections, query]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center"><LifeBuoy size={20} /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Hướng dẫn sử dụng</h1>
            <p className="text-sm text-muted-foreground mt-1">Ngắn gọn từng bước. Chỗ nào chưa rõ, bấm <b>Hỏi trợ lý</b> hoặc hỏi robot ở góc dưới.</p>
          </div>
        </div>

        <div className="relative h-11">
          <Search size={17} className="absolute z-10 left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm: tạo dự án, mời thành viên, chấm công…" aria-label="Tìm trong hướng dẫn"
            className="absolute inset-0 m-0 w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring" />
        </div>

        {sections === null ? (
          <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Không tìm thấy mục phù hợp.{' '}
            <button type="button" onClick={() => askAssistant(query)} className="font-semibold text-primary hover:underline">Hỏi trợ lý: “{query}”</button>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map((s) => {
              const Icon = ICONS[s.icon] ?? Compass;
              const isOpen = open === s.id || !!query.trim();
              return (
                <section key={s.id} id={s.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button type="button" onClick={() => setOpen(isOpen && !query ? null : s.id)} aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/50 transition-colors">
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-accent text-primary grid place-items-center"><Icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">{s.title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{s.summary}</span>
                    </span>
                    <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pl-[4.25rem] space-y-3">
                      <ol className="space-y-1.5 list-decimal pl-4 text-sm text-foreground marker:text-muted-foreground marker:font-semibold">
                        {s.steps.map((step, i) => <li key={i} className="pl-1 leading-relaxed"><MarkdownLite text={step} /></li>)}
                      </ol>
                      <button type="button" onClick={() => askAssistant(`Hướng dẫn chi tiết hơn: ${s.title}`)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-semibold text-primary hover:bg-accent">
                        <MessageCircleQuestion size={14} /> Hỏi trợ lý về mục này
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
