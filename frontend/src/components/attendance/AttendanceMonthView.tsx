import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  daysOfMonth,
  formatMinutes,
  isoWeekday,
  monthLabel,
  shiftMonth,
  currentMonth,
  weekdayLabel,
  type AttendanceMonth,
  type AttendanceRecord,
  type AttendanceSummary,
} from '../../lib/api/attendance';

function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const isCurrent = month >= currentMonth();
  return (
    <div className="inline-flex items-center gap-1 bg-card border border-border rounded-xl p-1 shadow-xs">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Tháng trước">
        <ChevronLeft size={18} />
      </button>
      <span className="px-2 text-sm font-bold text-foreground whitespace-nowrap min-w-[7.5rem] text-center">{monthLabel(month)}</span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrent}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Tháng sau"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function SummaryTiles({ summary }: { summary: AttendanceSummary }) {
  const tiles = [
    { label: 'Ngày đi làm', value: `${summary.present_days}/${summary.working_days}`, tone: 'text-foreground' },
    { label: 'Tổng giờ làm', value: formatMinutes(summary.worked_minutes, true), tone: 'text-foreground' },
    { label: 'Đi trễ', value: `${summary.late_days} ngày`, tone: summary.late_days ? 'text-amber-600 dark:text-amber-400' : 'text-foreground' },
    { label: 'Về sớm', value: `${summary.early_leave_days} ngày`, tone: summary.early_leave_days ? 'text-amber-600 dark:text-amber-400' : 'text-foreground' },
    { label: 'Vắng', value: `${summary.absent_days} ngày`, tone: summary.absent_days ? 'text-rose-600 dark:text-rose-400' : 'text-foreground' },
    { label: 'Quên chấm tan làm', value: `${summary.missing_checkout_days} ngày`, tone: summary.missing_checkout_days ? 'text-rose-600 dark:text-rose-400' : 'text-foreground' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="bg-card border border-border rounded-xl p-3.5 shadow-xs min-w-0">
          <div className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{t.label}</div>
          <div className={`text-xl font-extrabold tabular-nums mt-1 ${t.tone}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

type Chip = { text: string; className: string };

const CHIP = {
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  muted: 'bg-muted text-muted-foreground',
};

function dayChips(date: string, record: AttendanceRecord | undefined, workDays: number[], today: string, trackingStart: string): Chip[] {
  const working = workDays.includes(isoWeekday(date));
  if (!record || !record.check_in_time) {
    if (date > today) return [];
    if (!working) return [{ text: 'Ngày nghỉ', className: CHIP.muted }];
    if (date < trackingStart) return [{ text: 'Chưa áp dụng chấm công', className: CHIP.muted }];
    if (date === today) return [{ text: 'Chưa chấm công', className: CHIP.muted }];
    return [{ text: 'Vắng', className: CHIP.bad }];
  }
  const chips: Chip[] = [];
  if (record.is_late) chips.push({ text: `Trễ ${formatMinutes(record.late_minutes)}`, className: CHIP.warn });
  if (record.is_early_leave) chips.push({ text: `Về sớm ${formatMinutes(record.early_minutes)}`, className: CHIP.warn });
  if (record.missing_checkout) chips.push({ text: 'Quên chấm tan làm', className: CHIP.bad });
  if (!record.check_out_time && date === today) chips.push({ text: 'Đang làm việc', className: CHIP.info });
  if (!chips.length) chips.push({ text: 'Đúng giờ', className: CHIP.ok });
  return chips;
}

export function DailyTable({ data }: { data: AttendanceMonth }) {
  const today = todayVN();
  const byDate = new Map(data.records.map((r) => [r.work_date, r]));
  const days = daysOfMonth(data.month).filter((d) => d <= today || byDate.has(d));

  if (!days.length) {
    return <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">Tháng này chưa bắt đầu.</div>;
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">Ngày</th>
            <th className="px-4 py-3">Đi làm</th>
            <th className="px-4 py-3">Tan làm</th>
            <th className="px-4 py-3">Giờ làm</th>
            <th className="px-4 py-3">Tình trạng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[...days].reverse().map((date) => {
            const record = byDate.get(date);
            const working = data.settings.work_days.includes(isoWeekday(date));
            return (
              <tr key={date} className={working ? '' : 'bg-muted/20'}>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="inline-block w-7 text-xs font-bold text-muted-foreground">{weekdayLabel(date)}</span>
                  <span className="font-semibold text-foreground">{date.slice(8)}/{date.slice(5, 7)}</span>
                </td>
                <td className="px-4 py-2.5 tabular-nums font-semibold">{record?.check_in_time ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className="px-4 py-2.5 tabular-nums font-semibold">{record?.check_out_time ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{record?.worked_minutes != null ? formatMinutes(record.worked_minutes, true) : <span className="text-muted-foreground/50">—</span>}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {dayChips(date, record, data.settings.work_days, today, data.tracking_start).map((c) => (
                      <span key={c.text} className={`whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-semibold ${c.className}`}>{c.text}</span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
