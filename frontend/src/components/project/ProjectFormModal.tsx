import { useState, type FormEvent } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PROJECT_STATUS_OPTIONS, type ProjectStatus } from '../../lib/boardType';
import { PROJECT_COLORS, projectsApi, type PersonLite, type ProjectSummary } from '../../lib/api/projects';

/** Create a project, or edit one when `project` is given. */
export function ProjectFormModal({
  project,
  people = [],
  onClose,
  onSaved,
}: {
  project?: ProjectSummary | null;
  /** People who can be picked as project manager (members of the project's boards). */
  people?: PersonLite[];
  onClose: () => void;
  onSaved: (p: ProjectSummary) => void;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'planning');
  const [start, setStart] = useState(project?.start_date ?? '');
  const [end, setEnd] = useState(project?.end_date ?? '');
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [managerId, setManagerId] = useState<number | ''>(project?.manager?.id ?? '');
  const [saving, setSaving] = useState(false);

  const dateError = start && end && end < start ? 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.' : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || dateError) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      status,
      color,
      start_date: start || null,
      end_date: end || null,
      ...(project ? { manager_id: managerId === '' ? null : managerId } : {}),
    };
    try {
      const saved = project ? await projectsApi.update(project.id, payload) : await projectsApi.create(payload);
      toast.success(project ? 'Đã lưu dự án.' : 'Đã tạo dự án.');
      onSaved(saved);
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      toast.error((errors && (Object.values(errors)[0] as string[])[0]) || err?.response?.data?.message || 'Không lưu được dự án.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        aria-labelledby="project-form-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="project-form-title" className="text-base font-bold text-foreground">{project ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Tên dự án <span className="text-destructive">*</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} required autoFocus placeholder="VD: Ra mắt ứng dụng DANAVA Go" className={`mt-1.5 ${field}`} />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Mô tả
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000} placeholder="Mục tiêu, phạm vi, ghi chú…"
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring resize-y" />
          </label>

          <div>
            <div className="text-sm font-medium text-foreground mb-1.5">Trạng thái</div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Trạng thái dự án">
              {PROJECT_STATUS_OPTIONS.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={status === o.value} onClick={() => setStatus(o.value)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${status === o.value ? 'border-ring bg-ring/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-foreground">
              Ngày bắt đầu
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${field}`} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Hạn hoàn thành
              <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${field}`} aria-describedby={dateError ? 'project-date-error' : undefined} />
            </label>
            {dateError && <p id="project-date-error" className="sm:col-span-2 text-xs text-destructive">{dateError}</p>}
          </div>

          {project && people.length > 0 && (
            <label className="block text-sm font-medium text-foreground">
              Quản lý dự án
              <select value={managerId} onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : '')} className={`mt-1.5 ${field}`}>
                <option value="">Chưa chọn</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}

          <div>
            <div className="text-sm font-medium text-foreground mb-1.5">Màu nhận diện</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Màu dự án">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Màu ${c}`} onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full grid place-items-center ring-offset-2 ring-offset-card transition-transform hover:scale-110"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px var(--tw-ring-offset-color, #fff), 0 0 0 4px ${c}` : undefined }}>
                  {color === c && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">Hủy</button>
          <button type="submit" disabled={saving || !name.trim() || !!dateError}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {project ? 'Lưu thay đổi' : 'Tạo dự án'}
          </button>
        </div>
      </form>
    </div>
  );
}
