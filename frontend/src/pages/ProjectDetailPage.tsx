import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, FolderInput, LayoutGrid, ListTodo, Palette, Paperclip, Pencil, Trash2, UserRound } from 'lucide-react';
import { getAvatarUrl } from '../lib/avatar';
import { ProjectAppearanceModal } from '../components/project/ProjectAppearanceModal';
import { ProjectFilesPanel } from '../components/project/ProjectFilesPanel';
import { toast } from 'sonner';
import api from '../lib/axios';
import { formatDateVi } from '../lib/boardType';
import { projectColor, projectsApi, type ProjectDetail } from '../lib/api/projects';
import { ProjectFormModal } from '../components/project/ProjectFormModal';
import { AvatarStack, ProgressBar, ProjectStatusBadge } from '../components/project/ProjectBits';
import { BoardsBrowser } from './WorkspaceHome';

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [styling, setStyling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then(setProject).catch((e) => setError(e?.response?.status === 403 ? 'Anh/chị không có quyền xem dự án này.' : 'Không tải được dự án.'));
  }, [projectId]);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className="flex-1 grid place-items-center p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-foreground">{error}</p>
          <Link to="/projects" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Về danh sách dự án</Link>
        </div>
      </div>
    );
  }
  if (!project) {
    return <div className="flex-1 p-8" aria-busy="true"><div className="h-40 max-w-5xl mx-auto rounded-xl bg-card border border-border animate-pulse" /></div>;
  }

  const s = project.stats;
  const remove = async () => {
    if (!window.confirm(`Xóa dự án "${project.name}"?\n\nCác bảng bên trong KHÔNG bị xóa, chỉ không còn thuộc dự án này.`)) return;
    try {
      const res = await projectsApi.remove(project.id);
      toast.success(res.message);
      navigate('/projects');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không xóa được dự án.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={15} /> Tất cả dự án
        </Link>

        {/* Overview */}
        <section className="rounded-xl border border-border bg-card overflow-hidden" aria-labelledby="project-title">
          {project.cover_image ? (
            <div className="h-32 sm:h-44 bg-muted relative" style={{ backgroundImage: `url("${getAvatarUrl(project.cover_image)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: projectColor(project) }} />
            </div>
          ) : (
            <div className="h-1.5" style={{ backgroundColor: projectColor(project) }} />
          )}
          <div className="p-5 space-y-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="mt-2 w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: projectColor(project) }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="project-title" className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{project.name}</h1>
                <ProjectStatusBadge status={project.status} />
              </div>
              {project.description && <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl whitespace-pre-line">{project.description}</p>}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                {(project.start_date || project.end_date) && (
                  <span className="inline-flex items-center gap-1.5"><CalendarClock size={15} />
                    {project.start_date ? formatDateVi(project.start_date) : '…'} → {project.end_date ? formatDateVi(project.end_date) : '…'}
                  </span>
                )}
                {project.manager && (
                  <span className="inline-flex items-center gap-1.5"><UserRound size={15} /> Quản lý: <b className="font-semibold text-foreground">{project.manager.name}</b></span>
                )}
              </div>
            </div>
            {project.can_manage && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setStyling(true)} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-accent" title="Đổi màu & ảnh bìa">
                  <Palette size={15} /> <span className="hidden sm:inline">Màu & ảnh bìa</span>
                </button>
                <button type="button" onClick={() => setEditing(true)} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-accent">
                  <Pencil size={15} /> Chỉnh sửa
                </button>
                <button type="button" onClick={remove} className="h-9 w-9 grid place-items-center rounded-lg border border-border text-destructive hover:bg-destructive/10" title="Xóa dự án" aria-label="Xóa dự án">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<LayoutGrid size={16} />} label="Bảng" value={project.boards_count} />
            <Stat icon={<ListTodo size={16} />} label="Công việc" value={s.tasks} />
            <Stat icon={<CheckCircle2 size={16} />} label="Hoàn thành" value={`${s.done} · ${s.progress}%`} tone="success" />
            <Stat icon={<AlertTriangle size={16} />} label="Quá hạn" value={s.overdue} tone={s.overdue ? 'danger' : undefined} />
          </div>
          <ProgressBar value={s.progress} label="Tiến độ dự án" />

          {project.members.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground">Thành viên ({project.members.length})</span>
              <AvatarStack people={project.members} max={10} />
            </div>
          )}
          </div>
        </section>

        {/* Shared documents */}
        <section aria-labelledby="project-files-title" className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 id="project-files-title" className="text-base font-bold text-foreground flex items-center gap-2">
            <Paperclip size={18} className="text-primary" /> Tài liệu dự án
            {!!project.files_count && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold">{project.files_count}</span>}
          </h2>
          <p className="text-xs text-muted-foreground -mt-1">Hồ sơ, kế hoạch, hợp đồng… để mọi người trong dự án cùng nắm rõ.</p>
          <ProjectFilesPanel key={reloadKey} projectId={project.id} />
        </section>

        {/* Boards: the same grid as the "Bảng công việc" page, limited to this project */}
        <section aria-label="Bảng công việc của dự án" className="space-y-3">
          <BoardsBrowser
            key={reloadKey}
            projectId={project.id}
            embedded
            actions={
              <button type="button" onClick={() => setAdding(true)} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-accent">
                <FolderInput size={15} /> Thêm bảng có sẵn
              </button>
            }
          />
          {project.hidden_boards_count > 0 && (
            <p className="text-xs text-muted-foreground">Còn {project.hidden_boards_count} bảng khác trong dự án mà anh/chị chưa được mời tham gia.</p>
          )}
        </section>
      </div>

      {styling && (
        <ProjectAppearanceModal project={project} onClose={() => setStyling(false)} onSaved={(saved) => setProject((p) => (p ? { ...p, color: saved.color, cover_image: saved.cover_image } : p))} />
      )}
      {editing && (
        <ProjectFormModal project={project} people={project.members} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      )}
      {adding && <AddExistingBoard projectId={project.id} existing={project.boards.map((b) => b.id)} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); setReloadKey((k) => k + 1); load(); }} />}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-background px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

/** Pick one of my boards (that I manage) and move it into this project. */
function AddExistingBoard({ projectId, existing, onClose, onAdded }: { projectId: number; existing: number[]; onClose: () => void; onAdded: () => void }) {
  const [boards, setBoards] = useState<{ id: number; public_id: string; name: string; my_role: string; project?: { name: string } | null }[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    api.get('/me/boards').then((r) => setBoards(r.data.filter((b: any) => !existing.includes(b.id)))).catch(() => setBoards([]));
  }, [existing]);

  const add = async (id: number) => {
    setBusy(id);
    try {
      toast.success((await projectsApi.attachBoard(projectId, id)).message);
      onAdded();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không chuyển được bảng.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl" role="dialog" aria-label="Thêm bảng có sẵn">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Thêm bảng có sẵn vào dự án</h2>
          <p className="text-xs text-muted-foreground mt-1">Chỉ chuyển được bảng mà anh/chị là quản trị viên.</p>
        </div>
        <div className="overflow-y-auto p-2">
          {boards === null && <p className="p-4 text-sm text-muted-foreground">Đang tải…</p>}
          {boards?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Không còn bảng nào khác.</p>}
          {boards?.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground truncate">{b.project ? `Đang ở dự án: ${b.project.name}` : 'Chưa thuộc dự án'}</div>
              </div>
              <button type="button" disabled={b.my_role !== 'admin' || busy !== null} onClick={() => add(b.id)}
                title={b.my_role !== 'admin' ? 'Chỉ quản trị viên của bảng mới chuyển được' : undefined}
                className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40">
                {busy === b.id ? 'Đang chuyển…' : 'Chuyển vào'}
              </button>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">Đóng</button>
        </div>
      </div>
    </div>
  );
}
