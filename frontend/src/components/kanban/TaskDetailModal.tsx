import React, { useState } from 'react';
import { X, Trash2, Check, Plus } from 'lucide-react';
import type { Task, Board } from '../../types';
import api from '../../lib/axios';

interface TaskDetailModalProps {
  task: Task;
  board: Board;
  onClose: () => void;
}

export function TaskDetailModal({ task, board, onClose }: TaskDetailModalProps) {
  const [draft, setDraft] = useState<Task>(structuredClone(task));
  const [labelsText, setLabelsText] = useState(task.labels?.join(", ") || '');
  const [item, setItem] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (value: Partial<Task>) => setDraft(d => ({ ...d, ...value }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/tasks/${task.id}`, {
        title: draft.title,
        description: draft.description,
        column_id: draft.columnId,
        priority: draft.priority,
        assignee_id: draft.assigneeId,
        due_date: draft.dueDate
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-2xl max-h-[90vh] bg-card rounded-xl shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 border border-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 flex items-start justify-between border-b border-border bg-card shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground leading-tight">Chi tiết công việc</h2>
            <p className="text-sm text-muted-foreground mt-1">Thông tin, người phụ trách và tiến độ</p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-full transition-colors">
            <X size={20} />
          </button>
        </header>

        <form className="p-6 space-y-6 bg-background/30 flex-1 overflow-y-auto" onSubmit={(e) => { e.preventDefault(); save(); }}>
          
          <label className="flex flex-col gap-2 font-medium text-sm">
            Tên công việc
            <input 
              autoFocus required maxLength={180}
              className="w-full p-2.5 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm font-normal"
              value={draft.title} onChange={e => update({ title: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-2 font-medium text-sm">
            Mô tả
            <textarea 
              rows={3} maxLength={5000}
              className="w-full p-2.5 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm font-normal resize-y"
              value={draft.description} onChange={e => update({ description: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2 font-medium text-sm">
              Trạng thái
              <select className="w-full p-2.5 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm font-normal" value={draft.columnId} onChange={e => update({ columnId: e.target.value })}>
                {board.columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            
            <label className="flex flex-col gap-2 font-medium text-sm">
              Mức ưu tiên
              <select className="w-full p-2.5 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm font-normal" value={draft.priority} onChange={e => update({ priority: e.target.value as Task['priority'] })}>
                {["Thấp", "Bình thường", "Cao", "Khẩn cấp"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2 font-medium text-sm">
              Phụ trách chính
              <select className="w-full p-2.5 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm font-normal" value={draft.assigneeId} onChange={e => update({ assigneeId: e.target.value })}>
                <option value="">Chưa phân công</option>
                {/* Fallback for mocked users or API users if available */}
                {board.users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                {!board.users?.length && draft.assigneeId && <option value={draft.assigneeId}>User ID: {draft.assigneeId}</option>}
                {!board.users?.length && ['1','2','3','4','5'].filter(id => id !== draft.assigneeId).map(id => <option key={id} value={id}>User ID: {id}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2 font-medium text-sm">
              Hạn hoàn thành
              <input type="date" className="w-full p-2.5 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm font-normal" value={draft.dueDate} onChange={e => update({ dueDate: e.target.value })} />
            </label>
          </div>

          <label className="flex flex-col gap-2 font-medium text-sm">
            Nhãn (ngăn cách bằng dấu phẩy)
            <input className="w-full p-2.5 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm font-normal" value={labelsText} onChange={e => setLabelsText(e.target.value)} placeholder="Marketing, Kỹ thuật" />
          </label>

          <div className="border-t border-border pt-6 flex items-center justify-between">
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 font-medium rounded-md text-sm transition-colors">
              <Trash2 size={16} /> Xóa
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-accent text-muted-foreground font-medium rounded-md text-sm transition-colors">
                Đóng
              </button>
              <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md text-sm hover:bg-primary/90 transition-colors shadow-sm">
                <Check size={16} /> {busy ? 'Đang lưu...' : 'Lưu công việc'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-card rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-border">
            <h3 className="text-lg font-bold mb-2 text-foreground">Xóa công việc?</h3>
            <p className="text-sm text-muted-foreground mb-6">Công việc sẽ bị xóa khỏi bảng.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 hover:bg-accent text-muted-foreground font-medium rounded-md text-sm transition-colors">Giữ lại</button>
              <button onClick={remove} disabled={busy} className="px-4 py-2 bg-red-500 text-white font-medium rounded-md text-sm hover:bg-red-600 transition-colors shadow-sm">Xóa công việc</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
