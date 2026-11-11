export type BoardType = 'task' | 'project';

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string; className: string }[] = [
  { value: 'planning', label: 'Lên kế hoạch', className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
  { value: 'in_progress', label: 'Đang thực hiện', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { value: 'on_hold', label: 'Tạm dừng', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { value: 'completed', label: 'Hoàn thành', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { value: 'cancelled', label: 'Đã hủy', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
];

export function projectStatusLabel(status?: string | null): string {
  return PROJECT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Chưa đặt';
}

export function isProjectBoard(board?: { type?: string | null } | null): boolean {
  return board?.type === 'project';
}

/** Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY. */
export function formatDateVi(value?: string | null): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
}

export function formatMoneyVi(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('vi-VN')} ₫` : '';
}
