import React, { useState, useEffect } from 'react';
import { X, PieChart, RefreshCw, AlertCircle, Check, Users } from 'lucide-react';
import type { Task, User } from '../../types';
import api from '../../lib/axios';
import { toast } from 'sonner';
import { getAvatarUrl } from '../../lib/avatar';

interface TaskContributionModalProps {
  task: Task;
  onClose: () => void;
  onUpdated?: (updatedTask: Task) => void;
}

export const TaskContributionModal: React.FC<TaskContributionModalProps> = ({
  task,
  onClose,
  onUpdated,
}) => {
  const assignees = task.assignees || [];
  const [percents, setPercents] = useState<Record<string | number, number>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize percentages
  useEffect(() => {
    if (assignees.length === 0) return;

    const initial: Record<string | number, number> = {};
    let hasCustom = false;

    assignees.forEach(u => {
      const p = (u as any).pivot?.contribution_percent;
      if (p !== undefined && p !== null) {
        initial[u.id] = Number(p);
        hasCustom = true;
      }
    });

    if (!hasCustom) {
      // Split equally
      const count = assignees.length;
      const base = Math.floor((100 / count) * 100) / 100;
      let accum = 0;
      assignees.forEach((u, idx) => {
        if (idx === count - 1) {
          initial[u.id] = Math.round((100 - accum) * 100) / 100;
        } else {
          initial[u.id] = base;
          accum += base;
        }
      });
    }

    setPercents(initial);
  }, [task.id, assignees]);

  const handleEqualSplit = () => {
    if (assignees.length === 0) return;
    const count = assignees.length;
    const base = Math.floor((100 / count) * 100) / 100;
    let accum = 0;
    const updated: Record<string | number, number> = {};

    assignees.forEach((u, idx) => {
      if (idx === count - 1) {
        updated[u.id] = Math.round((100 - accum) * 100) / 100;
      } else {
        updated[u.id] = base;
        accum += base;
      }
    });

    setPercents(updated);
    setErrorMsg(null);
  };

  const handleChange = (userId: string | number, value: number) => {
    const clamped = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
    setPercents(prev => ({
      ...prev,
      [userId]: clamped,
    }));
  };

  const totalSum = Object.values(percents).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  const roundedSum = Math.round(totalSum * 100) / 100;
  const isExact100 = Math.abs(roundedSum - 100.0) < 0.05;

  const handleSave = async () => {
    if (!isExact100) {
      setErrorMsg(`Tổng tỷ lệ hiện tại là ${roundedSum}%. Tổng tỷ lệ đóng góp phải bằng 100%.`);
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload: Record<string | number, number> = {};
      assignees.forEach(u => {
        payload[u.id] = percents[u.id] ?? 0;
      });

      const res = await api.put(`/tasks/${task.id}/contribution-percents`, {
        contribution_percents: payload,
      });

      toast.success('Đã cập nhật tỷ lệ đóng góp thành công');
      if (onUpdated && res.data.task) {
        onUpdated(res.data.task);
      }
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu tỷ lệ đóng góp';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <PieChart size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Phân bổ tỷ lệ đóng góp</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[280px] sm:max-w-[340px]">
                {task.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between bg-accent/30 p-3 rounded-xl border border-border/50">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Users size={14} className="text-primary" />
              Tổng {assignees.length} thành viên tham gia
            </span>
            <button
              type="button"
              onClick={handleEqualSplit}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <RefreshCw size={12} className="text-primary" />
              <span>Chia đều</span>
            </button>
          </div>

          {assignees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Chưa có thành viên nào được giao công việc này.
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
              {assignees.map((u) => {
                const currentVal = percents[u.id] ?? 0;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-3 bg-card border border-border/70 rounded-xl hover:border-primary/40 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 shadow-2xs">
                        {u.avatar ? (
                          <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          u.initials || u.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {u.department?.name || u.position || u.email || 'Thành viên'}
                        </p>
                      </div>
                    </div>

                    {/* Percentage input */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={currentVal}
                          onChange={(e) => handleChange(u.id, parseFloat(e.target.value))}
                          className="w-full pl-3 pr-7 py-1.5 text-right text-xs font-bold bg-background border border-input rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total & Error message */}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Tổng tỷ lệ:</span>
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                isExact100
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 border-red-500/20 animate-pulse'
              }`}
            >
              {isExact100 ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{roundedSum}% / 100%</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-600">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-muted/20 border-t border-border flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving || !isExact100 || assignees.length === 0}
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition-all shadow-sm"
          >
            {saving ? 'Đang lưu...' : 'Lưu tỷ lệ'}
          </button>
        </div>
      </div>
    </div>
  );
};
