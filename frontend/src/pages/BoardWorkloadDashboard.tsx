import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Users,
  Search,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Calendar,
  Filter,
  X,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../lib/axios';
import { getAvatarUrl } from '../lib/avatar';
import { useBoardRoute } from '../components/layout/BoardRouteContext';
import type { BoardMemberWorkloadResponse, MemberWorkloadItem } from '../types';

const STATUS_COLORS = {
  completed: '#10b981', // Emerald
  incomplete: '#6366f1', // Indigo / Violet
  overdue: '#ef4444', // Rose
};

const PIE_COLORS = ['#10b981', '#6366f1', '#ef4444'];

export function BoardWorkloadDashboard() {
  const navigate = useNavigate();
  const { boardId, boardCode, basePath } = useBoardRoute();
  const rawBoardId = boardId ? boardId.replace('board-', '') : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BoardMemberWorkloadResponse | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'completed' | 'incomplete' | 'overdue'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>('all');
  const [includeParentTasks, setIncludeParentTasks] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Expandable row state in member table
  const [expandedMemberId, setExpandedMemberId] = useState<string | number | null>(null);

  const fetchWorkloadData = useCallback(async (isRefresh = false) => {
    if (!rawBoardId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params: Record<string, string | boolean> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedMember) params.member_id = selectedMember;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedPriority !== 'all') params.priority = selectedPriority;
      if (includeParentTasks) params.include_parent_tasks = true;

      const res = await api.get<BoardMemberWorkloadResponse>(
        `/boards/${rawBoardId}/dashboard/member-workload`,
        { params }
      );
      setData(res.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Bạn không có quyền xem thống kê khối lượng công việc của bảng này.');
      } else {
        setError(err.response?.data?.message || 'Không thể tải thống kê bảng công việc.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rawBoardId, startDate, endDate, selectedMember, selectedStatus, selectedPriority, includeParentTasks]);

  useEffect(() => {
    fetchWorkloadData();
  }, [fetchWorkloadData]);

  // Reset all filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedMember('');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setIncludeParentTasks(false);
  };

  const hasActiveFilters = Boolean(
    startDate || endDate || selectedMember || selectedStatus !== 'all' || selectedPriority !== 'all' || includeParentTasks
  );

  const members = data?.members;
  const summaryData = data?.summary;

  // Filtered members for table search
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!memberSearchQuery.trim()) return members;
    const q = memberSearchQuery.toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, memberSearchQuery]);

  // Chart data for Recharts Stacked Bar
  const chartData = useMemo(() => {
    if (!members) return [];
    return members
      .filter((m) => m.assigned > 0 || !hasActiveFilters)
      .slice(0, 12) // Top 12 members
      .map((m) => ({
        name: m.name.length > 14 ? m.name.substring(0, 12) + '...' : m.name,
        fullName: m.name,
        'Đã xong': m.completed,
        'Đang làm': m.incomplete,
        'Quá hạn': m.overdue,
        total: m.assigned,
        completionRate: m.completion_rate,
      }));
  }, [members, hasActiveFilters]);

  // Donut chart data for overall status distribution
  const pieData = useMemo(() => {
    if (!summaryData) return [];
    return [
      { name: 'Đã hoàn thành', value: summaryData.completed_tasks, color: STATUS_COLORS.completed },
      { name: 'Đang làm', value: summaryData.incomplete_tasks, color: STATUS_COLORS.incomplete },
      { name: 'Quá hạn', value: summaryData.overdue_tasks, color: STATUS_COLORS.overdue },
    ].filter((item) => item.value > 0);
  }, [summaryData]);

  const toggleExpandMember = (id: string | number) => {
    setExpandedMemberId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return <DashboardSkeleton basePath={basePath} />;
  }

  if (error || !data) {
    return (
      <div className="flex-1 h-full w-full flex items-center justify-center p-6 bg-background">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center rounded-3xl border border-border bg-card p-8 shadow-xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 ring-8 ring-rose-500/5">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Không thể tải thống kê</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Đã có lỗi xảy ra khi nạp dữ liệu thống kê khối lượng công việc.'}</p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              to={`${basePath}/kanban`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition"
            >
              <ArrowLeft size={16} /> Về bảng Kanban
            </Link>
            <button
              type="button"
              onClick={() => fetchWorkloadData()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
            >
              <RefreshCw size={16} /> Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-background/50 custom-scrollbar p-4 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-16 animate-in fade-in duration-300">

        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
              <Link to={`${basePath}/kanban`} className="hover:text-primary transition-colors flex items-center gap-1">
                <ArrowLeft size={14} /> Bảng Kanban
              </Link>
              <span>/</span>
              <span className="text-foreground">Thống kê khối lượng công việc</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BarChart3 size={22} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Khối lượng công việc thành viên
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Phân tích phân bổ nhiệm vụ, tiến độ hoàn thành và công việc quá hạn của từng thành viên
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => fetchWorkloadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent transition disabled:opacity-50"
              title="Làm mới số liệu"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-primary' : ''} />
              <span>{refreshing ? 'Đang cập nhật...' : 'Làm mới'}</span>
            </button>
            <Link
              to={`${basePath}/kanban`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition"
            >
              Xem Kanban
            </Link>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Filter size={16} className="text-primary" />
              <span>Bộ lọc thống kê</span>
              {hasActiveFilters && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  Đang lọc
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-rose-500 transition-colors"
              >
                <X size={14} /> Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Từ ngày tạo
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Đến ngày tạo
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Member Filter */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Thành viên
              </label>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Tất cả thành viên ({data.members.length})</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.assigned} việc)
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Trạng thái
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="incomplete">Đang thực hiện (Chưa xong)</option>
                <option value="overdue">Quá hạn</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Độ ưu tiên
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="all">Tất cả mức độ</option>
                <option value="urgent">Khẩn cấp (Urgent)</option>
                <option value="high">Cao (High)</option>
                <option value="medium">Trung bình (Medium)</option>
                <option value="low">Thấp (Low)</option>
              </select>
            </div>
          </div>

          {/* Include parent tasks checkbox with explanation */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between flex-wrap gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={includeParentTasks}
                onChange={(e) => setIncludeParentTasks(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="font-medium text-foreground">Bao gồm công việc cha đã phân việc con</span>
              <span className="text-muted-foreground hidden sm:inline">
                (Mặc định đã loại trừ để tránh tính trùng 2 lần khối lượng)
              </span>
            </label>
            <div className="text-[11px] text-muted-foreground">
              Cập nhật tự động theo thời gian thực
            </div>
          </div>
        </div>

        {/* KPI Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Total Tasks */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase tracking-wider">Tổng công việc</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Layers size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-foreground">{summary.total_tasks}</span>
              <span className="text-xs text-muted-foreground">nhiệm vụ</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Đang tính trên bảng này</p>
          </div>

          {/* Completed */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase tracking-wider">Đã hoàn thành</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {summary.completed_tasks}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {summary.completion_rate}%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Đã chốt kết quả</p>
          </div>

          {/* Incomplete */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase tracking-wider">Đang thực hiện</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                <Clock3 size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-violet-600 dark:text-violet-400">
                {summary.incomplete_tasks}
              </span>
              <span className="text-xs text-muted-foreground">chưa xong</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Cần tiếp tục theo dõi</p>
          </div>

          {/* Overdue */}
          <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition hover:shadow-md ${
            summary.overdue_tasks > 0
              ? 'border-rose-500/30 bg-rose-500/5'
              : 'border-border bg-card'
          }`}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase tracking-wider">Quá hạn</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                summary.overdue_tasks > 0
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black ${
                summary.overdue_tasks > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}>
                {summary.overdue_tasks}
              </span>
              <span className="text-xs text-muted-foreground">trễ hạn</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.overdue_tasks > 0 ? 'Cần xử lý ưu tiên ngay' : 'Tiến độ đúng cam kết'}
            </p>
          </div>

          {/* Completion Rate */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase tracking-wider">Tỷ lệ hoàn thành</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-foreground">{summary.completion_rate}%</span>
            </div>
            <div className="mt-2 w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, summary.completion_rate))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Visual Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member Workload Bar Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Phân bổ công việc theo thành viên</h3>
                <p className="text-xs text-muted-foreground">So sánh tỷ lệ Hoàn thành, Đang làm và Quá hạn</p>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Users size={32} className="mb-2 opacity-40" />
                <p className="text-sm font-medium">Chưa có dữ liệu thành viên phù hợp với bộ lọc</p>
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const item = chartData.find((d) => d.name === label);
                          return (
                            <div className="rounded-xl border border-border bg-card p-3 shadow-xl text-xs space-y-1.5">
                              <p className="font-bold text-foreground">{item?.fullName || label}</p>
                              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span>Đã xong: {payload[0]?.value}</span>
                              </div>
                              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                <span>Đang làm: {payload[1]?.value}</span>
                              </div>
                              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                <span>Quá hạn: {payload[2]?.value}</span>
                              </div>
                              <div className="pt-1 border-t border-border flex justify-between font-semibold text-foreground">
                                <span>Tổng: {item?.total} việc</span>
                                <span>Tỷ lệ: {item?.completionRate}%</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="Đã xong" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Đang làm" stackId="a" fill={STATUS_COLORS.incomplete} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Quá hạn" stackId="a" fill={STATUS_COLORS.overdue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Overall Health Donut Chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col">
            <div>
              <h3 className="text-base font-bold text-foreground">Tình trạng bảng hiện tại</h3>
              <p className="text-xs text-muted-foreground">Tỷ lệ phân chia theo trạng thái nhiệm vụ</p>
            </div>

            {pieData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                <BarChart3 size={32} className="mb-2 opacity-40" />
                <p className="text-sm font-medium">Chưa có công việc nào</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center relative">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0];
                            return (
                              <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-xs font-semibold text-foreground">
                                <span>{p.name}: {p.value} việc</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list */}
                <div className="w-full space-y-2 mt-2 pt-2 border-t border-border">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-bold text-foreground">
                        {item.value} ({summary.total_tasks > 0 ? Math.round((item.value / summary.total_tasks) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Member Workload Detail Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Bảng chi tiết khối lượng thành viên</h3>
              <p className="text-xs text-muted-foreground">
                Hiển thị {filteredMembers.length} thành viên tham gia bảng
              </p>
            </div>

            {/* Quick search inside table */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm theo tên, email..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Thành viên</th>
                  <th className="py-3 px-4 text-center">Vai trò</th>
                  <th className="py-3 px-4 text-right">Tổng việc</th>
                  <th className="py-3 px-4 text-right">Đã xong</th>
                  <th className="py-3 px-4 text-right">Đang làm</th>
                  <th className="py-3 px-4 text-right">Quá hạn</th>
                  <th className="py-3 px-4 text-center min-w-[140px]">Tỷ lệ hoàn thành</th>
                  <th className="py-3 px-4 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      Không tìm thấy thành viên nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const isExpanded = expandedMemberId === member.id;
                    const tasks = member.tasks || [];

                    return (
                      <tbody key={member.id} className="contents">
                        <tr
                          onClick={() => toggleExpandMember(member.id)}
                          className="hover:bg-accent/40 cursor-pointer transition-colors"
                        >
                          {/* Member info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={getAvatarUrl(member.avatar, member.name)}
                                alt={member.name}
                                className="h-8 w-8 rounded-full object-cover border border-border shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-foreground truncate">{member.name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{member.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role badge */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                member.role === 'admin' || member.role === 'owner'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {(member.role === 'admin' || member.role === 'owner') && <ShieldCheck size={10} />}
                              {member.role === 'admin' || member.role === 'owner' ? 'Quản trị' : 'Thành viên'}
                            </span>
                          </td>

                          {/* Total Assigned */}
                          <td className="py-3 px-4 text-right font-bold text-foreground">
                            {member.assigned}
                          </td>

                          {/* Completed */}
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {member.completed}
                          </td>

                          {/* Incomplete */}
                          <td className="py-3 px-4 text-right font-medium text-violet-600 dark:text-violet-400">
                            {member.incomplete}
                          </td>

                          {/* Overdue */}
                          <td className="py-3 px-4 text-right font-bold">
                            {member.overdue > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                {member.overdue}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>

                          {/* Completion rate & bar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${Math.min(100, Math.max(0, member.completion_rate))}%` }}
                                />
                              </div>
                              <span className="font-bold text-foreground w-11 text-right">
                                {member.completion_rate}%
                              </span>
                            </div>
                          </td>

                          {/* Expand action */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Task List for Member */}
                        {isExpanded && (
                          <tr className="bg-muted/20 border-b border-border">
                            <td colSpan={8} className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-2">
                                  <span>Danh sách công việc của {member.name} ({tasks.length})</span>
                                  <span className="text-[11px] font-normal">
                                    Click vào tên việc để chuyển đến bảng Kanban
                                  </span>
                                </div>

                                {tasks.length === 0 ? (
                                  <div className="text-center py-4 text-xs text-muted-foreground">
                                    Không có công việc nào được giao trong tiêu chí lọc hiện tại
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {tasks.map((task) => (
                                      <div
                                        key={task.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`${basePath}/kanban?task=${task.parent_task_id || task.id}`);
                                        }}
                                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer transition text-xs"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                          {task.is_completed ? (
                                            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                                          ) : task.is_overdue ? (
                                            <AlertCircle size={15} className="text-rose-500 shrink-0" />
                                          ) : (
                                            <Clock3 size={15} className="text-muted-foreground shrink-0" />
                                          )}
                                          <div className="truncate">
                                            <span className="font-medium text-foreground hover:text-primary transition-colors">
                                              {task.title}
                                            </span>
                                            {task.parent_task_id && (
                                              <span className="ml-1.5 text-[10px] font-semibold text-primary/80 bg-primary/10 px-1 py-0.5 rounded">
                                                Task con
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          {task.priority && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                              task.priority === 'urgent'
                                                ? 'bg-rose-500/10 text-rose-600'
                                                : task.priority === 'high'
                                                ? 'bg-amber-500/10 text-amber-600'
                                                : 'bg-muted text-muted-foreground'
                                            }`}>
                                              {task.priority}
                                            </span>
                                          )}
                                          {task.due_date && (
                                            <span className={`text-[11px] ${
                                              task.is_overdue ? 'text-rose-600 font-bold' : 'text-muted-foreground'
                                            }`}>
                                              {new Date(task.due_date).toLocaleDateString('vi-VN')}
                                            </span>
                                          )}
                                          <ExternalLink size={12} className="text-muted-foreground opacity-60" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

function DashboardSkeleton({ basePath }: { basePath: string }) {
  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-background/50 custom-scrollbar p-4 sm:p-6 md:p-8 animate-pulse">
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-8 w-72 bg-muted rounded-xl" />
          </div>
          <div className="h-9 w-24 bg-muted rounded-xl" />
        </div>

        {/* Filters skeleton */}
        <div className="h-28 bg-card rounded-2xl border border-border" />

        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-card rounded-2xl border border-border p-4" />
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-card rounded-2xl border border-border" />
          <div className="h-80 bg-card rounded-2xl border border-border" />
        </div>

        {/* Table skeleton */}
        <div className="h-64 bg-card rounded-2xl border border-border" />
      </div>
    </div>
  );
}
