import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FolderKanban,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../lib/axios';

interface DashboardData {
  workspace: { id: number; name: string };
  range_days: number;
  summary: {
    total_boards: number;
    total_members: number;
    total_tasks: number;
    completed_tasks: number;
    active_tasks: number;
    overdue_tasks: number;
    due_soon_tasks: number;
    completion_rate: number;
  };
  activity_trend: Array<{ date: string; label: string; created: number; completed: number }>;
  status_distribution: Array<{ name: string; value: number; color: string }>;
  priority_distribution: Array<{ name: string; value: number; color: string }>;
  board_progress: Array<{
    id: number;
    name: string;
    total: number;
    completed: number;
    progress: number;
    color?: string | null;
  }>;
  workload: Array<{ name: string; tasks: number; overdue: number }>;
  upcoming_deadlines: Array<{
    id: number;
    title: string;
    board: string;
    assignee: string;
    priority: string;
    due_date: string;
    days_left: number;
  }>;
  recent_activity: Array<{
    id: number;
    action: string;
    task_title: string;
    board_name: string;
    user_name?: string | null;
    created_at: string;
  }>;
  sprint_summary: { pending: number; active: number; completed: number };
}

const RANGE_OPTIONS = [7, 14, 30];

export function WorkspaceDashboard() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState(14);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get<DashboardData>(`/workspaces/${workspaceId}/dashboard`, {
          params: { days: range },
          signal: controller.signal,
        });
        setData(response.data);
      } catch (requestError: unknown) {
        if ((requestError as { code?: string }).code !== 'ERR_CANCELED') {
          setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [workspaceId, range, reloadVersion]);

  const totalSprints = useMemo(() => {
    if (!data) return 0;
    return data.sprint_summary.pending + data.sprint_summary.active + data.sprint_summary.completed;
  }, [data]);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <CircleAlert size={30} />
        </div>
        <h2 className="text-xl font-bold text-foreground">Dashboard chưa thể hiển thị</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => setReloadVersion((value) => value + 1)}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
        >
          <RefreshCw size={16} /> Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="workspace-dashboard mx-auto w-full max-w-[1480px] space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card px-6 py-7 shadow-[0_20px_60px_rgba(76,65,145,0.10)] md:px-8">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-violet-100/70 dark:bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-120px] left-[38%] h-60 w-60 rounded-full bg-sky-100/70 dark:bg-sky-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
              <Sparkles size={14} /> Workspace Intelligence
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-foreground md:text-4xl">
              Tổng quan {data.workspace.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Theo dõi sức khỏe dự án, năng suất đội ngũ và các công việc cần ưu tiên trong một màn hình duy nhất.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-xl border border-border bg-accent p-1">
              {RANGE_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRange(days)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    range === days
                      ? 'bg-card text-violet-700 shadow-sm ring-1 ring-slate-200'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {days} ngày
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/w/${workspaceId}`)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-700"
            >
              Xem các bảng <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tổng công việc"
          value={data.summary.total_tasks}
          detail={`${data.summary.active_tasks} việc đang hoạt động`}
          icon={<FolderKanban size={21} />}
          tone="violet"
        />
        <MetricCard
          label="Đã hoàn thành"
          value={data.summary.completed_tasks}
          suffix={`${data.summary.completion_rate}%`}
          detail="Tỷ lệ hoàn thành toàn workspace"
          icon={<CheckCircle2 size={21} />}
          tone="emerald"
        />
        <MetricCard
          label="Sắp đến hạn"
          value={data.summary.due_soon_tasks}
          detail="Trong vòng 7 ngày tới"
          icon={<CalendarClock size={21} />}
          tone="amber"
        />
        <MetricCard
          label="Quá hạn"
          value={data.summary.overdue_tasks}
          detail={data.summary.overdue_tasks ? 'Cần xử lý ngay' : 'Không có công việc tồn đọng'}
          icon={<CircleAlert size={21} />}
          tone="rose"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          title="Nhịp độ công việc"
          description={`Công việc được tạo mới và hoàn thành trong ${range} ngày gần nhất`}
          icon={<TrendingUp size={18} />}
        >
          <div className="h-[310px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.activity_trend} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34B78A" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#34B78A" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF1F6" strokeDasharray="4 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#98A2B3', fontSize: 12 }} dy={8} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#98A2B3', fontSize: 12 }} />
                <Tooltip content={<PremiumTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 18, fontSize: 12 }} />
                <Area type="monotone" dataKey="created" name="Tạo mới" stroke="#7C5CFC" strokeWidth={2.5} fill="url(#createdGradient)" />
                <Area type="monotone" dataKey="completed" name="Hoàn thành" stroke="#34B78A" strokeWidth={2.5} fill="url(#completedGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          className="xl:col-span-4"
          title="Sức khỏe công việc"
          description="Phân bổ theo trạng thái hiện tại"
          icon={<Target size={18} />}
        >
          {data.status_distribution.length ? (
            <div className="relative h-[310px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.status_distribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={105}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.status_distribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PremiumTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-3xl font-black text-foreground">{data.summary.total_tasks}</div>
                <div className="text-xs font-semibold text-muted-foreground">Công việc</div>
              </div>
            </div>
          ) : <EmptyChart label="Chưa có dữ liệu trạng thái" />}
        </ChartCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-7"
          title="Tiến độ theo bảng"
          description="So sánh số lượng công việc và mức độ hoàn thành"
          icon={<BarChart3 size={18} />}
        >
          {data.board_progress.length ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.board_progress.slice(0, 8)} margin={{ top: 18, right: 8, left: -20, bottom: 28 }}>
                  <CartesianGrid vertical={false} stroke="#EEF1F6" strokeDasharray="4 4" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 11 }} angle={-18} textAnchor="end" interval={0} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#98A2B3', fontSize: 12 }} />
                  <Tooltip content={<PremiumTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
                  <Bar dataKey="total" name="Tổng công việc" fill="#D8D1FF" radius={[8, 8, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="completed" name="Đã hoàn thành" fill="#7C5CFC" radius={[8, 8, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="Chưa có bảng công việc" />}
        </ChartCard>

        <ChartCard
          className="xl:col-span-5"
          title="Tải công việc đội ngũ"
          description="Số công việc đang hoạt động theo người phụ trách"
          icon={<Users size={18} />}
        >
          {data.workload.length ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.workload} layout="vertical" margin={{ top: 12, right: 18, left: 18, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#EEF1F6" strokeDasharray="4 4" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#98A2B3', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={104} axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 11 }} />
                  <Tooltip content={<PremiumTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="tasks" name="Đang thực hiện" stackId="work" fill="#6F7DF4" radius={[0, 8, 8, 0]} maxBarSize={18} />
                  <Bar dataKey="overdue" name="Quá hạn" stackId="overdue" fill="#F26B7A" radius={[0, 8, 8, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="Chưa có công việc được phân công" />}
        </ChartCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="Mức độ ưu tiên" description="Cơ cấu ưu tiên của toàn workspace" icon={<Activity size={18} />}>
          {data.priority_distribution.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.priority_distribution} dataKey="value" nameKey="name" cx="50%" cy="46%" outerRadius={86} paddingAngle={3} stroke="none">
                    {data.priority_distribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PremiumTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart label="Chưa có dữ liệu ưu tiên" />}
        </ChartCard>

        <ChartCard title="Deadline sắp tới" description={`${data.summary.due_soon_tasks} công việc cần lưu ý trong 7 ngày`} icon={<Clock3 size={18} />}>
          <div className="space-y-3">
            {data.upcoming_deadlines.length ? data.upcoming_deadlines.map((task) => (
              <div key={task.id} className="group flex items-center gap-3 rounded-2xl border border-border bg-accent/70 p-3 transition hover:border-border hover:bg-violet-50/40">
                <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${deadlineTone(task.days_left)}`}>
                  <span className="text-[10px] font-bold uppercase">Còn</span>
                  <span className="text-sm font-black">{task.days_left}n</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{task.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.board} · {task.assignee}</p>
                </div>
                <span className="rounded-full bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground shadow-sm">{formatDate(task.due_date)}</span>
              </div>
            )) : <EmptyList label="Chưa có deadline sắp tới" />}
          </div>
        </ChartCard>

        <ChartCard title="Hoạt động gần đây" description="Các thay đổi mới nhất trong workspace" icon={<Activity size={18} />}>
          <div className="space-y-1">
            {data.recent_activity.length ? data.recent_activity.map((item, index) => (
              <div key={item.id} className="relative flex gap-3 py-2.5">
                {index < data.recent_activity.length - 1 && <span className="absolute left-[17px] top-10 h-[calc(100%-18px)] w-px bg-muted" />}
                <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-black text-violet-600 dark:text-violet-400 ring-4 ring-background">
                  {(item.user_name || 'Hệ thống').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-muted-foreground">
                    <strong className="text-foreground">{item.user_name || 'Hệ thống'}</strong> {activityLabel(item.action)}
                    {' '}<strong className="text-foreground">{item.task_title}</strong>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.board_name} · {formatRelativeTime(item.created_at)}</p>
                </div>
              </div>
            )) : <EmptyList label="Chưa có hoạt động nào" />}
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SprintCard label="Sprint đang chuẩn bị" value={data.sprint_summary.pending} color="amber" total={totalSprints} />
        <SprintCard label="Sprint đang chạy" value={data.sprint_summary.active} color="violet" total={totalSprints} />
        <SprintCard label="Sprint đã hoàn thành" value={data.sprint_summary.completed} color="emerald" total={totalSprints} />
      </section>
    </div>
  );
}

function MetricCard({ label, value, detail, suffix, icon, tone }: {
  label: string;
  value: number;
  detail: string;
  suffix?: string;
  icon: React.ReactNode;
  tone: 'violet' | 'emerald' | 'amber' | 'rose';
}) {
  const toneClasses = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20',
  };

  return (
    <article className="group rounded-3xl border border-border bg-card p-5 shadow-[0_12px_35px_rgba(44,51,73,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(76,65,145,0.12)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-4xl font-black tracking-[-0.05em] text-foreground">{value}</span>
            {suffix && <span className="mb-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">{suffix}</span>}
          </div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${toneClasses[tone]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function ChartCard({ title, description, icon, children, className = '' }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-3xl border border-border bg-card p-5 shadow-[0_12px_35px_rgba(44,51,73,0.065)] md:p-6 ${className}`}>
      <header className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">{icon}</div>
        <div>
          <h2 className="text-base font-black tracking-[-0.02em] text-foreground">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </article>
  );
}

function SprintCard({ label, value, total, color }: { label: string; value: number; total: number; color: 'amber' | 'violet' | 'emerald' }) {
  const colors = {
    amber: ['bg-amber-500', 'bg-amber-500/10 text-amber-600 dark:text-amber-400'],
    violet: ['bg-violet-600', 'bg-violet-500/10 text-violet-600 dark:text-violet-400'],
    emerald: ['bg-emerald-500', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'],
  };
  const percent = total ? Math.round((value / total) * 100) : 0;

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-[0_10px_30px_rgba(44,51,73,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[color][1]}`}>{percent}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-500 ${colors[color][0]}`} style={{ width: `${percent}%` }} />
      </div>
    </article>
  );
}

function PremiumTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
      {label && <p className="mb-2 text-xs font-bold text-muted-foreground">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}
            </span>
            <strong className="text-foreground">{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-accent/60 text-center">
      <BarChart3 className="mb-3 text-slate-300" size={30} />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyList({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-accent/60 text-center">
      <CheckCircle2 className="mb-3 text-emerald-400" size={28} />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1480px] animate-pulse space-y-6">
      <div className="h-44 rounded-[28px] bg-card" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 rounded-3xl bg-card" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="h-[390px] rounded-3xl bg-card xl:col-span-8" />
        <div className="h-[390px] rounded-3xl bg-card xl:col-span-4" />
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return '';
  const cleanValue = value.includes(' ') ? value.split(' ')[0] : value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(`${cleanValue}T00:00:00`));
}

function formatRelativeTime(value: string) {
  if (!value) return '';
  const safeValue = value.replace(' ', 'T');
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(safeValue).getTime()) / 60000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    updated_status: 'đã đổi trạng thái',
    assigned: 'đã phân công',
    uploaded_file: 'đã thêm tệp vào',
    updated: 'đã cập nhật',
    completed: 'đã hoàn thành',
    commented: 'đã bình luận trong',
  };
  return labels[action] || 'đã cập nhật';
}

function deadlineTone(days: number) {
  if (days <= 1) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
  if (days <= 3) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-violet-500/10 text-violet-600 dark:text-violet-400';
}
