import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, BarChart3, Loader2 } from 'lucide-react';
import { CheckInCard, DemoNotice } from '../components/attendance/CheckInCard';
import { DailyTable, MonthPicker, SummaryTiles } from '../components/attendance/AttendanceMonthView';
import { attendanceApi, currentMonth, type AttendanceMonth } from '../lib/api/attendance';

export function AttendancePage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<AttendanceMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canViewReports, setCanViewReports] = useState(false);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError('');
    try {
      setData(await attendanceApi.myMonth(m));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không tải được lịch sử chấm công.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [month, load]);

  useEffect(() => {
    attendanceApi.today().then((t) => setCanViewReports(t.can_view_reports)).catch(() => {});
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-background/50">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarClock className="text-primary" size={26} /> Chấm công
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Bấm xác nhận khi bắt đầu và khi kết thúc ngày làm việc.</p>
          </div>
          {canViewReports && (
            <Link
              to="/attendance/report"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-accent whitespace-nowrap self-start sm:self-auto"
            >
              <BarChart3 size={16} /> Thống kê nhân viên
            </Link>
          )}
        </div>

        {data?.settings.mode === 'demo' && <DemoNotice />}

        <CheckInCard onChange={() => { if (month === currentMonth()) void load(month); }} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <h2 className="text-lg font-bold text-foreground">Lịch sử chấm công</h2>
          <MonthPicker month={month} onChange={setMonth} />
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" /> Đang tải...
          </div>
        ) : error ? (
          <div className="bg-card border border-destructive/30 text-destructive rounded-xl p-6 text-sm">{error}</div>
        ) : data ? (
          <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <SummaryTiles summary={data.summary} />
            <DailyTable data={data} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
