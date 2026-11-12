import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { projectsApi, type ProjectSummary } from '../../lib/api/projects';

export interface NewBoardPayload {
  name: string;
  project_id: number | null;
}

interface NewBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: NewBoardPayload) => Promise<void>;
  /** Pre-select a project (e.g. when creating from a project page). */
  defaultProjectId?: number;
}

/** Create a board inside a project. Every board has the full feature set. */
export function NewBoardModal({ isOpen, onClose, onSubmit, defaultProjectId }: NewBoardModalProps) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<number | ''>(defaultProjectId ?? '');
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), project_id: projectId === '' ? null : projectId });
    } finally {
      setLoading(false);
    }
  };

  const field = 'w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Tạo bảng mới</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          <label className="block text-sm font-medium text-foreground">
            Tên bảng <span className="text-destructive">*</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} autoFocus required
              placeholder="VD: Thiết kế giao diện" className={`mt-1.5 ${field}`} />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Thuộc dự án
            <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} className={`mt-1.5 ${field}`} disabled={projects === null}>
              <option value="">Không thuộc dự án nào</option>
              {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Bảng mới có sẵn 4 cột (Chưa bắt đầu, Đang thực hiện, Chờ duyệt, Hoàn thành) cùng đầy đủ tính năng: thống kê, điểm hiệu suất, nội quy và tổng kết.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">Hủy</button>
            <button type="submit" disabled={loading || !name.trim()} className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
              {loading && <Loader2 size={15} className="animate-spin" />} Tạo bảng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
