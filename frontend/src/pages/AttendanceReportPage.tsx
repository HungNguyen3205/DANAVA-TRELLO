import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, Loader2, Search, X, ArrowLeft, ShieldAlert } from 'lucide-react';
import { DailyTable, MonthPicker, SummaryTiles } from '../components/attendance/AttendanceMonthView';
import {
  attendanceApi,
  currentMonth,
  formatMinutes,
  monthLabel,
  type AttendanceMonth,
  type AttendanceReport,
  type AttendanceReportRow,
} from '../lib/api/attendance';
import { getAvatarUrl } from '../lib/avatar';
import { DemoNotice } from '../components/attendance/CheckInCard';

export function AttendanceReportPage() {
  const [month, setMonth] = useState(currentMonth);
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [selected, setSelected] = useState<AttendanceReportRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await attendanceApi.report(month, departmentId));
    } catch (e: any) {
      setError({ status: e?.response?.status, message: e?.response?.data?.message || 'Không tải được thống kê chấm công.' });
    } finally {
      setLoading(false);
    }
  }, [month, departmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = report?.rows ?? [];
    return q ? all.filter((r) => r.user.name.toLowerCase().includes(q) || (r.user.username ?? '').toLowerCase().includes(q)) : all;
  }, [report, search]);

  const totals = useMemo(
    () => ({
      late: rows.reduce((s, r) => s + r.summary.late_days, 0),
      absent: rows.reduce((s, r) => s + r.summary.absent_days, 0),
      missing: rows.reduce((s, r) => s + r.summary.missing_checkout_days, 0),
    }),
    [rows],
  );

  const exportCsv = () => {
    if (!report) return;
    const header = ['Nhân viên', 'Tài khoản', 'Phòng ban', 'Ngày đi làm', 'Ngày làm việc', 'Tổng giờ làm', 'Số ngày đi trễ', 'Tổng phút trễ', 'Số ngày về sớm', 'Số ngày vắng', 'Quên chấm tan làm'];
    const lines = rows.map((r) => [
      r.user.name,
      r.user.username ?? '',
      r.user.departments.map((d) => d.name).join('; '),
      r.summary.present_days,
      r.summary.working_days,
      (r.summary.worked_minutes / 60).toFixed(2),
      r.summary.late_days,
      r.summary.late_minutes,
      r.summary.early_leave_days,
      r.summary.absent_days,
      r.summary.missing_checkout_days,
    ]);
    const csv = [header, ...lines].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    // BOM so Excel opens Vietnamese text correctly
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cham-cong-${report.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error?.status === 403) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-lg font-bold text-foreground">Bạn không có quyền xem thống kê chấm công</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">Chỉ Quản trị viên hệ thống và Trưởng phòng mới xem được thống kê của nhân viên.</p>
        <Link to="/attendance" className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold">
          <ArrowLeft size={16} /> Về trang chấm công
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background/50">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 pb-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="text-primary" size={26} /> Thống kê chấm công
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {report ? `${monthLabel(report.month)} · Giờ làm ${report.settings.work_start} – ${report.settings.work_end}` : 'Tổng hợp theo tháng'}
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50 whitespace-nowrap self-start md:self-auto"
          >
            <Download size={16} /> Xuất Excel (CSV)
          </button>
        </div>

        {report?.settings.mode === 'demo' && <DemoNotice />}

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <MonthPicker month={month} onChange={setMonth} />
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="py-2 px-3 text-sm bg-card border border-border rounded-xl shadow-xs sm:min-w-[12rem]"
          >
            <option value="">Tất cả phòng ban</option>
            {report?.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div className="relative sm:ml-auto sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm nhân viên..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-xl shadow-xs"
            />
          </div>
        </div>

        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile label="Nhân viên" value={rows.length} />
            <Tile label="Lượt đi trễ" value={totals.late} tone={totals.late ? 'text-amber-600 dark:text-amber-400' : undefined} />
            <Tile label="Ngày vắng" value={totals.absent} tone={totals.absent ? 'text-rose-600 dark:text-rose-400' : undefined} />
            <Tile label="Quên chấm tan làm" value={totals.missing} tone={totals.missing ? 'text-rose-600 dark:text-rose-400' : undefined} />
          </div>
        )}

        {loading && !report ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" /> Đang tải...
          </div>
        ) : error ? (
          <div className="bg-card border border-destructive/30 text-destructive rounded-xl p-6 text-sm">{error.message}</div>
        ) : (
          <div className={`bg-card border border-border rounded-xl shadow-xs overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3 text-center">Ngày đi làm</th>
                  <th className="px-4 py-3 text-center">Tổng giờ</th>
                  <th className="px-4 py-3 text-center">Đi trễ</th>
                  <th className="px-4 py-3 text-center">Về sớm</th>
                  <th className="px-4 py-3 text-center">Vắng</th>
                  <th className="px-4 py-3 text-center">Quên chấm tan làm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Không có nhân viên nào phù hợp.</td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.user.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={r.user.name} avatar={r.user.avatar} />
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">{r.user.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {r.user.departments.map((d) => d.name).join(', ') || 'Chưa phân phòng'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums font-semibold">{r.summary.present_days}/{r.summary.working_days}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{formatMinutes(r.summary.worked_minutes, true)}</td>
                      <Count value={r.summary.late_days} tone="warn" />
                      <Count value={r.summary.early_leave_days} tone="warn" />
                      <Count value={r.summary.absent_days} tone="bad" />
                      <Count value={r.summary.missing_checkout_days} tone="bad" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Bấm vào một nhân viên để xem chi tiết từng ngày.</p>
      </div>

      {selected && <EmployeeDetail row={selected} month={month} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
      <div className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-1 ${tone ?? 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function Count({ value, tone }: { value: number; tone: 'warn' | 'bad' }) {
  const cls = value === 0
    ? 'text-muted-foreground/60'
    : tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400 font-bold'
      : 'text-rose-600 dark:text-rose-400 font-bold';
  return <td className={`px-4 py-3 text-center tabular-nums ${cls}`}>{value}</td>;
}

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  return (
    <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
      {avatar ? <img src={getAvatarUrl(avatar)} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}

function EmployeeDetail({ row, month, onClose }: { row: AttendanceReportRow; month: string; onClose: () => void }) {
  const [data, setData] = useState<AttendanceMonth | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    attendanceApi
      .userMonth(row.user.id, month)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.message || 'Không tải được chi tiết.'));
  }, [row.user.id, month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chấm công của ${row.user.name}`}
        className="bg-background w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={row.user.name} avatar={row.user.avatar} />
            <div className="min-w-0">
              <div className="font-bold text-foreground truncate">{row.user.name}</div>
              <div className="text-xs text-muted-foreground">{monthLabel(month)}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
          {error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : !data ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin" /> Đang tải...
            </div>
          ) : (
            <>
              <SummaryTiles summary={data.summary} />
              <DailyTable data={data} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
