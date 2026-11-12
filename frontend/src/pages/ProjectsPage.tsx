import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, FolderKanban, LayoutGrid, Palette, Plus, Search } from 'lucide-react';
import { getAvatarUrl } from '../lib/avatar';
import { ProjectAppearanceModal } from '../components/project/ProjectAppearanceModal';
import { toast } from 'sonner';
import { projectColor, projectsApi, type ProjectSummary } from '../lib/api/projects';
import { PROJECT_STATUS_OPTIONS, formatDateVi } from '../lib/boardType';
import { ProjectFormModal } from '../components/project/ProjectFormModal';
import { ProjectsTabs } from '../components/project/ProjectsTabs';
import { AvatarStack, ProgressBar, ProjectStatusBadge } from '../components/project/ProjectBits';

type Filter = 'all' | ProjectSummary['status'];

/** All projects the user can see, as cards: status, progress over their boards, deadline, people. */
export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [styling, setStyling] = useState<ProjectSummary | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => {
      setProjects([]);
      toast.error('Không tải được danh sách dự án.');
    });
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => (filter === 'all' || p.status === filter) && (!q || p.name.toLowerCase().includes(q)));
  }, [projects, query, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects?.length ?? 0 };
    (projects ?? []).forEach((p) => (c[p.status] = (c[p.status] ?? 0) + 1));
    return c;
  }, [projects]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <ProjectsTabs />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dự án</h1>
            <p className="text-sm text-muted-foreground mt-1">Mỗi dự án gồm nhiều bảng; mỗi bảng có các cột và công việc.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)}
            className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:brightness-95 transition">
            <Plus size={17} /> Tạo dự án
          </button>
        </div>

        <div className="flex flex-col-reverse lg:flex-row lg:items-center gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
            <div className="inline-flex items-center gap-1 h-10 p-1 rounded-lg border border-border bg-card" role="tablist" aria-label="Lọc theo trạng thái">
              {[{ value: 'all' as Filter, label: 'Tất cả' }, ...PROJECT_STATUS_OPTIONS].map((o) => {
                const active = filter === o.value;
                return (
                  <button key={o.value} type="button" role="tab" aria-selected={active} onClick={() => setFilter(o.value)}
                    className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                    {o.label}
                    {!!counts[o.value] && (
                      <span className={`min-w-5 h-5 px-1.5 inline-grid place-items-center rounded-full text-[11px] tabular-nums ${active ? 'bg-white/20' : 'bg-muted text-foreground'}`}>{counts[o.value]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative h-10 w-full lg:w-72 shrink-0">
            <Search size={16} className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm dự án…" aria-label="Tìm dự án" type="search"
              className="absolute inset-0 m-0 w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring" />
          </div>
        </div>

        {projects === null ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-xl border border-border bg-card animate-pulse" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center">
            <FolderKanban className="mx-auto text-muted-foreground" size={32} />
            <p className="mt-3 text-sm font-semibold text-foreground">{projects.length ? 'Không có dự án phù hợp.' : 'Chưa có dự án nào.'}</p>
            {!projects.length && (
              <button type="button" onClick={() => setCreating(true)} className="mt-3 text-sm font-semibold text-primary hover:underline">Tạo dự án đầu tiên</button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
            {shown.map((p) => <ProjectCard key={p.id} project={p} today={today} onOpen={() => navigate(`/projects/${p.id}`)} onStyle={p.can_manage ? () => setStyling(p) : undefined} />)}
          </div>
        )}
      </div>

      {styling && (
        <ProjectAppearanceModal
          project={styling}
          onClose={() => setStyling(null)}
          onSaved={(saved) => setProjects((list) => list?.map((x) => (x.id === saved.id ? { ...x, ...saved, stats: x.stats, members: x.members } : x)) ?? null)}
        />
      )}
      {creating && (
        <ProjectFormModal
          onClose={() => setCreating(false)}
          onSaved={(p) => {
            setCreating(false);
            navigate(`/projects/${p.id}`);
          }}
        />
      )}
    </div>
  );
}

function ProjectCard({ project: p, today, onOpen, onStyle }: { project: ProjectSummary; today: string; onOpen: () => void; onStyle?: () => void }) {
  const s = p.stats ?? { tasks: 0, done: 0, overdue: 0, progress: 0 };
  const late = !!p.end_date && p.status !== 'completed' && p.status !== 'cancelled' && p.end_date < today;
  const color = projectColor(p);

  return (
    <div className="group/card relative h-full">
    <button type="button" onClick={onOpen} title={p.name}
      className="group relative h-full w-full text-left rounded-xl border border-border bg-card overflow-hidden flex flex-col transition-[border-color,box-shadow,transform] hover:border-ring/40 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {p.cover_image ? (
        // Cover photo with the project colour as a thin underline
        <div className="relative h-24 shrink-0 bg-muted" style={{ backgroundImage: `url("${getAvatarUrl(p.cover_image)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} aria-hidden="true">
          <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: color }} />
        </div>
      ) : (
        // Project colour as a top accent
        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} aria-hidden="true" />
      )}

      <div className={`flex flex-col gap-3 p-4 flex-1 ${p.cover_image ? '' : 'pt-5'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 shrink-0 rounded-lg grid place-items-center text-white text-sm font-bold" style={{ backgroundColor: color }} aria-hidden="true">
              {p.name.trim().charAt(0).toUpperCase()}
            </span>
            <ProjectStatusBadge status={p.status} />
          </span>
          {p.end_date && (
            <span className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${late ? 'text-destructive font-semibold' : 'text-muted-foreground'}`} title={late ? 'Đã quá hạn dự án' : 'Hạn dự án'}>
              <CalendarClock size={13} /> {formatDateVi(p.end_date)}
            </span>
          )}
        </div>

        <div className="min-h-[4.25rem]">
          <h2 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2 break-words group-hover:text-primary transition-colors">{p.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-1">{p.description || 'Chưa có mô tả'}</p>
        </div>

        <div className="space-y-1.5 mt-auto">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Tiến độ</span>
            <span className="tabular-nums"><b className="font-semibold text-foreground">{s.progress}%</b> <span className="text-muted-foreground">· {s.done}/{s.tasks} việc</span></span>
          </div>
          <ProgressBar value={s.progress} label={`Tiến độ ${p.name}`} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border bg-muted/40 text-xs text-muted-foreground">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><LayoutGrid size={13} /> {p.boards_count} bảng</span>
          {s.overdue > 0 && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-destructive font-semibold"><AlertTriangle size={13} /> {s.overdue} quá hạn</span>
          )}
        </div>
        {!!p.members?.length && <AvatarStack people={p.members} max={4} size={24} />}
      </div>
    </button>
    {onStyle && (
      <button type="button" onClick={onStyle} title="Đổi màu & ảnh bìa" aria-label={`Đổi màu và ảnh bìa của ${p.name}`}
        className="absolute top-2.5 right-2.5 w-8 h-8 grid place-items-center rounded-full bg-card/90 border border-border text-muted-foreground shadow-sm hover:text-primary opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 focus-visible:opacity-100 transition-opacity">
        <Palette size={15} />
      </button>
    )}
    </div>
  );
}
