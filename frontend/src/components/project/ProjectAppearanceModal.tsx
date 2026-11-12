import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Palette, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getAvatarUrl } from '../../lib/avatar';
import { PROJECT_COLORS, projectColor, projectsApi, type ProjectSummary } from '../../lib/api/projects';

const MAX_BYTES = 5 * 1024 * 1024;

/** Pick a project's colour and cover photo, with a live preview of the project card header. */
export function ProjectAppearanceModal({ project, onClose, onSaved }: {
  project: ProjectSummary;
  onClose: () => void;
  onSaved: (p: ProjectSummary) => void;
}) {
  const [color, setColor] = useState(projectColor(project));
  const [cover, setCover] = useState<string | null>(project.cover_image);
  const [busy, setBusy] = useState<'color' | 'upload' | 'remove' | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveColor = async (c: string) => {
    setColor(c);
    setBusy('color');
    try {
      onSaved(await projectsApi.update(project.id, { color: c }));
    } catch {
      toast.error('Không lưu được màu.');
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return void toast.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
    if (file.size > MAX_BYTES) return void toast.error('Ảnh tối đa 5MB.');
    setBusy('upload');
    try {
      const saved = await projectsApi.uploadCover(project.id, file);
      setCover(saved.cover_image);
      onSaved(saved);
      toast.success('Đã cập nhật ảnh bìa.');
    } catch (e: any) {
      toast.error(e?.response?.data?.errors?.image?.[0] || e?.response?.data?.message || 'Không tải được ảnh lên.');
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      const saved = await projectsApi.removeCover(project.id);
      setCover(null);
      onSaved(saved);
    } catch {
      toast.error('Không xóa được ảnh bìa.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="appearance-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="appearance-title" className="text-base font-bold text-foreground flex items-center gap-2"><Palette size={18} className="text-primary" /> Màu & ảnh bìa dự án</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Đóng"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Live preview */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="h-28 relative" style={cover ? { backgroundImage: `url("${getAvatarUrl(cover)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: color }}>
              {cover && <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: color }} />}
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="w-8 h-8 rounded-lg grid place-items-center text-white text-sm font-bold" style={{ backgroundColor: color }}>{project.name.trim().charAt(0).toUpperCase()}</span>
              <span className="text-sm font-semibold text-foreground truncate">{project.name}</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground mb-2">Màu nhận diện</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Màu dự án">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Màu ${c}`} disabled={busy !== null} onClick={() => saveColor(c)}
                  className="w-9 h-9 rounded-full grid place-items-center transition-transform hover:scale-110 disabled:opacity-60"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px hsl(var(--card)), 0 0 0 4px ${c}` : undefined }}>
                  {color === c && (busy === 'color' ? <Loader2 size={14} className="animate-spin text-white" /> : <Check size={15} className="text-white" />)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground mb-2">Ảnh bìa</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => input.current?.click()} disabled={busy !== null}
                className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60">
                {busy === 'upload' ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} {cover ? 'Đổi ảnh bìa' : 'Tải ảnh bìa lên'}
              </button>
              {cover && (
                <button type="button" onClick={remove} disabled={busy !== null}
                  className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-border text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60">
                  {busy === 'remove' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Xóa ảnh
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">JPG, PNG hoặc WebP, tối đa 5MB. Ảnh ngang (khoảng 1200×400) hiển thị đẹp nhất.</p>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-border bg-muted/30">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Xong</button>
        </div>
      </div>
    </div>
  );
}
