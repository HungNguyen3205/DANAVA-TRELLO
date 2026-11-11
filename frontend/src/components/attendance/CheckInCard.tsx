import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, CheckCircle2, Clock, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { attendanceApi, formatMinutes, type AttendanceRecord, type AttendanceToday } from '../../lib/api/attendance';

const TZ = 'Asia/Ho_Chi_Minh';

function useVietnamClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return {
    time: new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now),
    hhmm: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
    date: new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now),
  };
}

interface CheckInCardProps {
  /** Smaller layout for the home page, with a link to the full attendance page. */
  compact?: boolean;
  onChange?: (record: AttendanceRecord) => void;
}

export function CheckInCard({ compact = false, onChange }: CheckInCardProps) {
  const clock = useVietnamClock();
  const [data, setData] = useState<AttendanceToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await attendanceApi.today());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const record = data?.record ?? null;
  const settings = data?.settings;
  const checkedIn = !!record?.check_in_time;
  const checkedOut = !!record?.check_out_time;

  const act = async (kind: 'in' | 'out') => {
    if (kind === 'out' && settings && clock.hhmm < settings.work_end) {
      const ok = window.confirm(
        `Chưa đến giờ tan làm (${settings.work_end}).\nBạn có chắc muốn xác nhận tan làm lúc ${clock.hhmm} không?\n\nMỗi ngày chỉ xác nhận tan làm được một lần.`
      );
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const res = kind === 'in' ? await attendanceApi.checkIn() : await attendanceApi.checkOut();
      toast.success(res.message);
      setData((prev) => (prev ? { ...prev, record: res.record } : prev));
      onChange?.(res.record);
    } catch (e: any) {
      const msg = e?.response?.data?.errors?.attendance?.[0] || e?.response?.data?.message || 'Không thể chấm công, vui lòng thử lại.';
      toast.error(msg);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 size={18} className="animate-spin" /> Đang tải thông tin chấm công...
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Không tải được thông tin chấm công.</span>
        <button type="button" onClick={() => { setLoading(true); void load(); }} className="text-primary font-semibold whitespace-nowrap">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className={`flex flex-col ${compact ? 'sm:flex-row sm:items-center' : 'md:flex-row md:items-center'} gap-5 p-5 sm:p-6`}>
        {/* Clock */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-2 whitespace-nowrap"><Clock size={14} /> Chấm công hôm nay</span>
            {settings?.mode === 'demo' && <DemoBadge />}
          </div>
          <div className={`${compact ? 'text-3xl' : 'text-4xl sm:text-5xl'} font-extrabold tabular-nums text-foreground mt-1`}>
            {clock.time}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5 first-letter:uppercase">{clock.date}</div>
          {settings && (
            <div className="text-xs text-muted-foreground mt-1">
              Giờ làm việc: <span className="font-semibold text-foreground">{settings.work_start} – {settings.work_end}</span>
            </div>
          )}
        </div>

        {/* Status + action */}
        <div className={`flex flex-col gap-3 ${compact ? 'sm:w-72' : 'md:w-80'} shrink-0`}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <StatusPill
              label="Đi làm"
              value={record?.check_in_time}
              warn={record?.is_late ? `Trễ ${formatMinutes(record.late_minutes)}` : undefined}
            />
            <StatusPill
              label="Tan làm"
              value={record?.check_out_time}
              warn={record?.is_early_leave ? `Sớm ${formatMinutes(record.early_minutes)}` : undefined}
            />
          </div>

          {!checkedIn && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => act('in')}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-md transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
              Xác nhận đi làm
            </button>
          )}

          {checkedIn && !checkedOut && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => act('out')}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-base font-bold shadow-md transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
              Xác nhận tan làm
            </button>
          )}

          {checkedIn && checkedOut && (
            <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
              <CheckCircle2 size={18} />
              <span>Đã hoàn thành hôm nay · {formatMinutes(record?.worked_minutes)}</span>
            </div>
          )}

          {compact && (
            <Link to="/attendance" className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:underline">
              Xem lịch sử chấm công <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function DemoBadge() {
  return (
    <span
      title="Chấm công đang chạy thử. Dữ liệu hiện tại sẽ không được tính khi công ty áp dụng chính thức."
      className="whitespace-nowrap normal-case tracking-normal px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400"
    >
      Bản dùng thử
    </span>
  );
}

/** Banner for the attendance pages while the feature is in demo mode. */
export function DemoNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>
        <strong>Chấm công đang chạy thử.</strong> Bạn có thể dùng thoải mái; dữ liệu hiện tại sẽ không được tính vào thống kê khi công ty áp dụng chính thức.
      </span>
    </div>
  );
}

function StatusPill({ label, value, warn }: { label: string; value?: string | null; warn?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${value ? 'text-foreground' : 'text-muted-foreground/60'}`}>{value || '--:--'}</div>
      {warn && (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
          <AlertTriangle size={11} /> {warn}
        </div>
      )}
    </div>
  );
}
