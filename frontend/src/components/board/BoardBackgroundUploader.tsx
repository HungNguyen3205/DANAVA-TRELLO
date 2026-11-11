import { useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/axios';
import { getAvatarUrl } from '../../lib/avatar';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  boardId: string;
  image?: string | null;
  canEdit: boolean;
  onChange: () => void;
}

/** Upload / replace / remove a custom background photo for a board (board admins). */
export function BoardBackgroundUploader({ boardId, image, canEdit, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = async (file: File) => {
    if (!ACCEPT.includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Ảnh tối đa 5MB. Anh/chị chọn ảnh nhỏ hơn giúp em nhé.');
      return;
    }
    const form = new FormData();
    form.append('image', file);
    setBusy(true);
    try {
      await api.post(`/boards/${boardId}/background`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Đã cập nhật ảnh nền bảng.');
      onChange();
    } catch (e: any) {
      toast.error(e?.response?.data?.errors?.image?.[0] || e?.response?.data?.message || 'Không tải được ảnh lên.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    if (!window.confirm('Gỡ ảnh nền và dùng lại màu nền?')) return;
    setBusy(true);
    try {
      await api.delete(`/boards/${boardId}/background`);
      toast.success('Đã gỡ ảnh nền.');
      onChange();
    } catch {
      toast.error('Không gỡ được ảnh nền.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && canEdit) void upload(file);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ImagePlus size={16} className="text-muted-foreground" /> Ảnh nền của bạn
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (canEdit) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative h-36 rounded-xl border-2 border-dashed overflow-hidden transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        {image ? (
          <img src={getAvatarUrl(image)} alt="Ảnh nền bảng" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground text-sm">
            <Upload size={22} />
            <span>{canEdit ? 'Kéo thả ảnh vào đây hoặc bấm “Tải ảnh lên”' : 'Chưa có ảnh nền'}</span>
            <span className="text-xs">JPG, PNG, WebP · tối đa 5MB · nên dùng ảnh ngang</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
            <Loader2 size={22} className="animate-spin" />
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={ACCEPT.join(',')}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-accent disabled:opacity-60 whitespace-nowrap"
          >
            <Upload size={15} /> {image ? 'Đổi ảnh khác' : 'Tải ảnh lên'}
          </button>
          {image && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 whitespace-nowrap"
            >
              <Trash2 size={15} /> Gỡ ảnh
            </button>
          )}
        </div>
      )}
      {image && <p className="text-xs text-muted-foreground">Khi có ảnh nền, ảnh sẽ được dùng thay cho màu nền ở trên.</p>}
    </div>
  );
}
