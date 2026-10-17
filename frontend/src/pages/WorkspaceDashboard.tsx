import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FolderKanban,
  Kanban,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  User,
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
import { getAvatarUrl } from '../lib/avatar';

interface DashboardData {
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
    public_id?: string;
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
    board_id: number;
    board: string;
    board_public_id?: string;
    assignee: string;
    assignee_avatar?: string | null;
    priority: string;
    due_date: string;
    days_left: number;
  }>;
  recent_activity: Array<{
    id: string | number;
    action: string;
    task_id?: number;
    task_title: string;
    board_id?: number;
    board_public_id?: string;
    board_name: string;
    user_name?: string | null;
    user_avatar?: string | null;
    created_at: string;
  }>;
  sprint_summary?: { pending: number; active: number; completed: number };
}

const RANGE_OPTIONS = [7, 14, 30];

export function WorkspaceDashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState(14);
  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      if (reloadVersion === 0 && !data) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');
      try {
        const response = await api.get<DashboardData>('/analytics/overview', {
          params: { days: range, scope },
          signal: controller.signal,
        });
        setData(response.data);
      } catch (requestError: unknown) {
        if ((requestError as { code?: string }).code !== 'ERR_CANCELED') {
          setError('Không thể tải dữ liệu Tổng quan. Vui lòng thử lại.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [range, scope, reloadVersion]);

  const handleRefresh = () => {
    setReloadVersion((v) => v + 1);
  };

  const handleGoToBoard = (boardId: number, publicId?: string) => {
    navigate(publicId ? `/${publicId}/kanban` : `/b/${boardId}`);
  };

  const handleGoToTask = (boardId: number, taskId: number, publicId?: string) => {
    navigate(publicId ? `/${publicId}/kanban?task=${taskId}` : `/b/${boardId}?task=${taskId}`);
  };

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex-1 h-full w-full flex items-center justify-center p-6 bg-background">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center rounded-3xl border border-border bg-card p-8 shadow-xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 ring-8 ring-rose-500/5">
            <CircleAlert size={32} />
          </div>
          <h2 className="text-xl font-black text-foreground">Tổng quan chưa thể hiển thị</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Đã có lỗi xảy ra khi nạp số liệu thống kê.'}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90"
          >
            <RefreshCw size={16} /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-background/50 custom-scrollbar p-4 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-7 pb-12 animate-in fade-in duration-300">
        
        {/* Executive Header Banner */}
        <section className="relative overflow-hidden rounded-[32px] border border-border/80 bg-gradient-to-br from-card via-card to-accent/40 p-6 shadow-[0_20px_50px_rgba(79,70,229,0.06)] md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-100px] left-[35%] h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                <Sparkles size={14} className="text-violet-500" />
                <span>{scope === 'personal' ? 'Không gian công việc của tôi' : 'Executive Intelligence'}</span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                Tổng quan {scope === 'personal' ? 'công việc cá nhân' : 'dự án & đội ngũ'}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {scope === 'personal' 
                  ? 'Báo cáo thống kê số liệu, tiến độ hoàn thành và hạn chót được phân công riêng cho bạn.'
                  : 'Báo cáo tổng hợp số liệu, tiến độ thực hiện và nhịp độ công việc trên tất cả các bảng làm việc của cả đội.'}
              </p>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Scope Selector: Cá nhân vs Toàn đội */}
              <div className="inline-flex items-center rounded-2xl border border-border bg-card p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setScope('personal')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    scope === 'personal'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <User size={14} />
                  <span>Của tôi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('team')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    scope === 'team'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users size={14} />
                  <span>Toàn đội</span>
                </button>
              </div>

              {/* Range Selector */}
              <div className="inline-flex items-center rounded-2xl border border-border bg-card p-1 shadow-xs">
                {RANGE_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setRange(days)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      range === days
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {days} ngày
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={handleRefresh}
                title="Làm mới số liệu"
                disabled={refreshing}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-xs transition hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin text-primary' : ''} />
              </button>

              {/* View Boards Button */}
              <button
                type="button"
                onClick={() => navigate('/workspaces')}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90"
              >
                <FolderKanban size={16} />
                <span>Xem tất cả bảng</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* 4 Primary Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Tổng công việc"
            value={data.summary.total_tasks}
            detail={`${data.summary.active_tasks} việc đang thực hiện`}
            icon={<FolderKanban size={22} />}
            tone="violet"
          />
          <MetricCard
            label="Đã hoàn thành"
            value={data.summary.completed_tasks}
            suffix={`${data.summary.completion_rate}%`}
            detail={`${data.summary.completed_tasks}/${data.summary.total_tasks} công việc đã đạt chuẩn`}
            icon={<CheckCircle2 size={22} />}
            tone="emerald"
            progress={data.summary.completion_rate}
          />
          <MetricCard
            label="Sắp đến hạn"
            value={data.summary.due_soon_tasks}
            detail="Cần lưu ý trong 7 ngày tới"
            icon={<CalendarClock size={22} />}
            tone="amber"
          />
          <MetricCard
            label="Quá hạn"
            value={data.summary.overdue_tasks}
            detail={data.summary.overdue_tasks > 0 ? 'Cần giải quyết ngay lập tức' : 'Không có công việc tồn đọng'}
            icon={<CircleAlert size={22} />}
            tone="rose"
          />
        </section>

        {/* Chart Row 1: Nhịp độ tiến độ & Phân bổ trạng thái */}
        <section className="grid gap-5 xl:grid-cols-12">
          {/* Velocity / Activity Trend */}
          <ChartCard
            className="xl:col-span-8"
            title="Nhịp độ hoàn thành công việc"
            description={`Công việc tạo mới và hoàn thành qua từng ngày trong ${range} ngày gần nhất`}
            icon={<TrendingUp size={18} />}
          >
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.activity_trend} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" opacity={0.6} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={8} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                  <Tooltip content={<PremiumTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="created"
                    name="Tạo mới"
                    stroke="#7C5CFC"
                    strokeWidth={2.5}
                    fill="url(#createdGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Hoàn thành"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#completedGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Status Distribution */}
          <ChartCard
            className="xl:col-span-4"
            title="Cơ cấu trạng thái"
            description="Tỷ lệ phân bổ trạng thái trên các cột"
            icon={<Target size={18} />}
          >
            {data.status_distribution.length ? (
              <div className="relative h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.status_distribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={72}
                      outerRadius={104}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {data.status_distribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PremiumTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 text-center">
                  <div className="text-3xl font-black text-foreground">{data.summary.total_tasks}</div>
                  <div className="text-xs font-semibold text-muted-foreground">Công việc</div>
                </div>
              </div>
            ) : (
              <EmptyChart label="Chưa có dữ liệu trạng thái" />
            )}
          </ChartCard>
        </section>

        {/* Chart Row 2: Tiến độ từng Bảng & Tải công việc Nhân sự */}
        <section className="grid gap-5 xl:grid-cols-12">
          {/* Board Progress List & Cards */}
          <ChartCard
            className="xl:col-span-7"
            title="Tiến độ từng bảng công việc"
            description="Mức độ hoàn thành công việc cụ thể theo từng dự án"
            icon={<Kanban size={18} />}
          >
            {data.board_progress.length ? (
              <div className="space-y-3 pt-2">
                {data.board_progress.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => handleGoToBoard(board.id, board.public_id)}
                    className="group relative flex flex-col gap-2.5 rounded-2xl border border-border bg-accent/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm">
                          {board.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                            {board.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {board.completed} / {board.total} công việc đã hoàn thành
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-black text-foreground">
                          {board.progress}%
                        </span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
                          <ArrowUpRight size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(board.progress, 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart label="Chưa có bảng công việc nào" />
            )}
          </ChartCard>

          {/* Team / Personal Workload */}
          <ChartCard
            className="xl:col-span-5"
            title={scope === 'personal' ? 'Phân bổ theo bảng dự án' : 'Tải công việc đội ngũ'}
            description={scope === 'personal' ? 'Số lượng công việc bạn đang phụ trách trên từng bảng' : 'Số lượng công việc đang xử lý theo người phụ trách'}
            icon={scope === 'personal' ? <FolderKanban size={18} /> : <Users size={18} />}
          >
            {data.workload.length ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.workload} layout="vertical" margin={{ top: 12, right: 18, left: 16, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip content={<PremiumTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="tasks" name="Đang thực hiện" stackId="work" fill="#6F7DF4" radius={[0, 6, 6, 0]} maxBarSize={18} />
                    <Bar dataKey="overdue" name="Quá hạn" stackId="overdue" fill="#F26B7A" radius={[0, 6, 6, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="Chưa có công việc được phân công" />
            )}
          </ChartCard>
        </section>

        {/* 3-Column Bottom Section: Priority, Deadlines, Live Stream */}
        <section className="grid gap-5 lg:grid-cols-3">
          {/* Priority Distribution */}
          <ChartCard
            title="Mức độ ưu tiên"
            description="Phân bổ công việc theo mức độ khẩn thiết"
            icon={<Activity size={18} />}
          >
            {data.priority_distribution.length ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.priority_distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="46%"
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {data.priority_distribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PremiumTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="Chưa có dữ liệu ưu tiên" />
            )}
          </ChartCard>

          {/* Upcoming Deadlines */}
          <ChartCard
            title={scope === 'personal' ? 'Hạn chót công việc của bạn' : 'Thời hạn quan trọng'}
            description={scope === 'personal' ? `${data.summary.due_soon_tasks} công việc của bạn cần hoàn thành sớm` : `${data.summary.due_soon_tasks} công việc cần giải quyết trong 7 ngày`}
            icon={<Clock3 size={18} />}
          >
            <div className="space-y-2.5">
              {data.upcoming_deadlines.length ? (
                data.upcoming_deadlines.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleGoToTask(task.board_id, task.id, task.board_public_id)}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-accent/40 p-3 transition-all hover:border-primary/40 hover:bg-card hover:shadow-sm cursor-pointer"
                  >
                    <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${deadlineTone(task.days_left)}`}>
                      <span className="text-[10px] uppercase">{task.days_left === 0 ? 'HÔM' : 'CÒN'}</span>
                      <span className="text-xs font-black">{task.days_left === 0 ? 'NAY' : `${task.days_left}n`}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {task.board} · {task.assignee}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-muted-foreground shadow-xs border border-border/60">
                      {formatDate(task.due_date)}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyList label="Không có thời hạn nào trong 7 ngày tới" />
              )}
            </div>
          </ChartCard>

          {/* Live Activity Stream */}
          <ChartCard
            title="Nhật ký hoạt động"
            description="Các tương tác và cập nhật mới nhất"
            icon={<Layers size={18} />}
          >
            <div className="space-y-1">
              {data.recent_activity.length ? (
                data.recent_activity.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => item.task_id && handleGoToTask(item.board_id || 1, item.task_id, item.board_public_id)}
                    className={`relative flex gap-3 py-2.5 ${item.task_id ? 'cursor-pointer group hover:bg-accent/40 rounded-xl px-2 -mx-2 transition-colors' : ''}`}
                  >
                    {index < data.recent_activity.length - 1 && (
                      <span className="absolute left-[17px] top-10 h-[calc(100%-16px)] w-px bg-border" />
                    )}
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary ring-4 ring-card overflow-hidden">
                      {item.user_avatar ? (
                        <img src={getAvatarUrl(item.user_avatar)} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        (item.user_name || 'H').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-muted-foreground">
                        <strong className="text-foreground font-semibold">{item.user_name || 'Hệ thống'}</strong>{' '}
                        {activityLabel(item.action)}{' '}
                        <strong className="text-foreground font-semibold group-hover:text-primary transition-colors">
                          {item.task_title}
                        </strong>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                        {item.board_name} · {formatRelativeTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyList label="Chưa có hoạt động nào được ghi nhận" />
              )}
            </div>
          </ChartCard>
        </section>

      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  suffix,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: number;
  detail: string;
  suffix?: string;
  icon: React.ReactNode;
  tone: 'violet' | 'emerald' | 'amber' | 'rose';
  progress?: number;
}) {
  const toneClasses = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20',
  };

  return (
    <article className="group relative rounded-3xl border border-border bg-card p-5 shadow-[0_12px_35px_rgba(44,51,73,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(76,65,145,0.1)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tight text-foreground">{value}</span>
            {suffix && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {suffix}
              </span>
            )}
          </div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${toneClasses[tone]}`}>
          {icon}
        </div>
      </div>

      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function ChartCard({
  title,
  description,
  icon,
  children,
  className = '',
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-3xl border border-border bg-card p-5 shadow-[0_12px_35px_rgba(44,51,73,0.05)] md:p-6 ${className}`}>
      <header className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-black tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </article>
  );
}

function PremiumTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md">
      {label && <p className="mb-2 text-xs font-bold text-muted-foreground">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <strong className="text-foreground font-black">{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-accent/30 text-center p-6">
      <BarChart3 className="mb-3 text-muted-foreground/40" size={32} />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyList({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-accent/30 text-center p-6">
      <CheckCircle2 className="mb-3 text-emerald-500/50" size={28} />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex-1 h-full w-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[1440px] animate-pulse space-y-6">
        <div className="h-44 rounded-[32px] bg-card border border-border" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-36 rounded-3xl bg-card border border-border" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="h-[390px] rounded-3xl bg-card border border-border xl:col-span-8" />
          <div className="h-[390px] rounded-3xl bg-card border border-border xl:col-span-4" />
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return '';
  const cleanValue = value.includes(' ') ? value.split(' ')[0] : value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${cleanValue}T00:00:00`)
  );
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
  if (days <= 0) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20';
  if (days <= 2) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20';
  return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20';
}
