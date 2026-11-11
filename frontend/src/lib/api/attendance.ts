import api from '../axios';

export interface AttendanceSettings {
  timezone: string;
  work_start: string;
  work_end: string;
  late_grace_minutes: number;
  work_days: number[];
  /** 'demo' until the company sets a go-live date; demo records are ignored after go-live. */
  mode: 'demo' | 'live';
  live_since: string | null;
}

export interface AttendanceRecord {
  id: number;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: boolean;
  late_minutes: number;
  is_early_leave: boolean;
  early_minutes: number;
  worked_minutes: number | null;
  missing_checkout: boolean;
  note: string | null;
}

export interface AttendanceSummary {
  working_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  late_minutes: number;
  early_leave_days: number;
  missing_checkout_days: number;
  worked_minutes: number;
}

export interface AttendanceToday {
  today: string;
  server_time: string;
  record: AttendanceRecord | null;
  settings: AttendanceSettings;
  can_view_reports: boolean;
}

export interface AttendanceMonth {
  month: string;
  from: string;
  to: string;
  /** Days before this (feature go-live / account creation) are never absences. */
  tracking_start: string;
  settings: AttendanceSettings;
  records: AttendanceRecord[];
  summary: AttendanceSummary;
  user?: { id: number; name: string; username?: string; avatar?: string | null; position?: string | null };
}

export interface AttendanceReportRow {
  user: {
    id: number;
    name: string;
    username?: string;
    avatar?: string | null;
    position?: string | null;
    departments: { id: number; name: string }[];
  };
  summary: AttendanceSummary;
}

export interface AttendanceReport {
  month: string;
  from: string;
  to: string;
  settings: AttendanceSettings;
  departments: { id: number; name: string; code: string }[];
  rows: AttendanceReportRow[];
}

export const attendanceApi = {
  today: () => api.get<AttendanceToday>('/attendance/today').then((r) => r.data),
  checkIn: () => api.post<{ message: string; record: AttendanceRecord }>('/attendance/check-in').then((r) => r.data),
  checkOut: () => api.post<{ message: string; record: AttendanceRecord }>('/attendance/check-out').then((r) => r.data),
  myMonth: (month: string) => api.get<AttendanceMonth>('/attendance/me', { params: { month } }).then((r) => r.data),
  report: (month: string, departmentId?: string) =>
    api
      .get<AttendanceReport>('/attendance/report', { params: { month, department_id: departmentId || undefined } })
      .then((r) => r.data),
  userMonth: (userId: number, month: string) =>
    api.get<AttendanceMonth>(`/attendance/report/users/${userId}`, { params: { month } }).then((r) => r.data),
};

/** "YYYY-MM" for the current month in Vietnam time. */
export function currentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

/** 545 -> "9 giờ 05 phút"; compact form -> "9g05". */
export function formatMinutes(minutes: number | null | undefined, compact = false): string {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (compact) return `${h}g${String(m).padStart(2, '0')}`;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${String(m).padStart(2, '0')} phút`;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function weekdayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** ISO weekday (1 = Monday ... 7 = Sunday) of a YYYY-MM-DD date. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** Every date of the month (YYYY-MM-DD). */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
