import React, { useState } from 'react';
import { X, Loader2, Columns, Briefcase, Check } from 'lucide-react';
import type { BoardType } from '../../lib/boardType';

export interface NewBoardPayload {
  name: string;
  type: BoardType;
  start_date?: string;
  end_date?: string;
}

interface NewBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: NewBoardPayload) => Promise<void>;
}

const TYPE_OPTIONS: { value: BoardType; title: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'task',
    title: 'Bảng công việc',
    description: 'Đơn giản, dễ dùng. Phù hợp để giao việc và theo dõi việc hằng ngày.',
    icon: <Columns size={20} />,
  },
  {
    value: 'project',
    title: 'Dự án',
    description: 'Có thời hạn, trạng thái, người quản lý, ngân sách, chấm điểm hiệu suất và tổng kết.',
    icon: <Briefcase size={20} />,
  },
];

export function NewBoardModal({ isOpen, onClose, onSubmit }: NewBoardModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<BoardType>('task');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Parent mounts this only while open, so every open starts with a fresh form.
  if (!isOpen) return null;

  const dateError = type === 'project' && startDate && endDate && endDate < startDate
    ? 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || dateError) return;

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        type,
        ...(type === 'project' && startDate ? { start_date: startDate } : {}),
        ...(type === 'project' && endDate ? { end_date: endDate } : {}),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h3 className="text-lg font-bold text-foreground">Tạo mới</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5 overflow-y-auto">
          <div>
            <div className="block text-sm font-medium text-foreground/90 mb-2">Bạn muốn tạo gì?</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_OPTIONS.map((opt) => {
                const selected = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    aria-pressed={selected}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-accent/40'
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                        <Check size={12} />
                      </span>
                    )}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${selected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                      {opt.icon}
                    </div>
                    <div className="font-semibold text-sm text-foreground">{opt.title}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="new-board-name" className="block text-sm font-medium text-foreground/90 mb-1.5">
              {type === 'project' ? 'Tên dự án' : 'Tên bảng'} <span className="text-destructive">*</span>
            </label>
            <input
              id="new-board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              placeholder={type === 'project' ? 'VD: Triển khai phần mềm kho' : 'VD: Việc phòng hành chính'}
              autoFocus
              required
            />
          </div>

          {type === 'project' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-board-start" className="block text-sm font-medium text-foreground/90 mb-1.5">Ngày bắt đầu</label>
                <input
                  id="new-board-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                />
              </div>
              <div>
                <label htmlFor="new-board-end" className="block text-sm font-medium text-foreground/90 mb-1.5">Hạn hoàn thành</label>
                <input
                  id="new-board-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                />
              </div>
              {dateError && <p className="sm:col-span-2 text-xs text-destructive">{dateError}</p>}
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Có thể bỏ trống và bổ sung sau trong phần Cài đặt dự án.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !!dateError}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {type === 'project' ? 'Tạo dự án' : 'Tạo bảng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
