import React, { useState, useEffect } from 'react';
import { 
  Award, TrendingUp, Clock, Star, Activity, CheckCircle2, AlertTriangle, 
  HelpCircle, Lock, Unlock, Send, RefreshCw, Plus, Eye, ChevronRight,
  ShieldCheck, Calendar, Filter, X, ArrowUpRight, BarChart3, User as UserIcon,
  Building2, Layers
} from 'lucide-react';
import { useBoardRoute } from '../components/layout/BoardRouteContext';
import { 
  getPerformancePeriods, createPerformancePeriod, getPerformancePeriodDetails,
  recalculatePerformancePeriod, publishPerformancePeriod, lockPerformancePeriod,
  unlockPerformancePeriod, getMemberPerformanceLineage,
  type PerformancePeriod, type MemberPerformanceScore, type PeriodDetailResponse
} from '../lib/api/performance';
import { getDepartmentOptions } from '../lib/api/departments';
import { getRankInfo } from '../lib/performanceMath';
import { getAvatarUrl } from '../lib/avatar';
import { toast } from 'sonner';

export const PerformanceDashboardView: React.FC = () => {
  const { boardId, boardCode } = useBoardRoute();

  const [periods, setPeriods] = useState<PerformancePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [periodData, setPeriodData] = useState<PeriodDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  // Modals state
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLineageModal, setShowLineageModal] = useState(false);
  const [selectedMemberLineage, setSelectedMemberLineage] = useState<{ member: any; score: MemberPerformanceScore } | null>(null);
  const [loadingLineage, setLoadingLineage] = useState(false);

  // New period form
  const [newPeriodTitle, setNewPeriodTitle] = useState('');
  const [newPeriodType, setNewPeriodType] = useState<'weekly' | 'monthly' | 'quarterly' | 'custom'>('monthly');
  const [newPeriodStartDate, setNewPeriodStartDate] = useState('');
  const [newPeriodEndDate, setNewPeriodEndDate] = useState('');

  // Search & Department filter
  const [searchMember, setSearchMember] = useState('');
  const [rankFilter, setRankFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [excludeLocked, setExcludeLocked] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<{ id: number; name: string; code: string; color: string }[]>([]);

  // Load department options for filter
  useEffect(() => {
    let isMounted = true;
    async function loadDeptOptions() {
      try {
        const depts = await getDepartmentOptions();
        if (isMounted) setDepartmentOptions(depts);
      } catch (err) {
        console.error('Failed to load department options', err);
      }
    }
    loadDeptOptions();
    return () => { isMounted = false; };
  }, []);

  // Load periods list
  useEffect(() => {
    let isMounted = true;
    async function loadPeriods() {
      try {
        setLoading(true);
        const data = await getPerformancePeriods(boardCode || boardId);
        if (isMounted) {
          setPeriods(data.periods);
          if (data.periods.length > 0) {
            setSelectedPeriodId(data.periods[0].id);
          }
        }
      } catch (err: any) {
        toast.error('Không thể tải danh sách kỳ đánh giá');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPeriods();
    return () => { isMounted = false; };
  }, [boardId, boardCode]);

  // Load selected period detail
  useEffect(() => {
    if (!selectedPeriodId) {
      setPeriodData(null);
      return;
    }

    let isMounted = true;
    async function loadDetail() {
      try {
        setLoading(true);
        const data = await getPerformancePeriodDetails(boardCode || boardId, selectedPeriodId!);
        if (isMounted) {
          setPeriodData(data);
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Không thể tải chi tiết kỳ đánh giá';
        toast.error(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDetail();
    return () => { isMounted = false; };
  }, [selectedPeriodId, boardId, boardCode]);

  // Handle recalculate
  const handleRecalculate = async () => {
    if (!selectedPeriodId) return;
    try {
      setRecalculating(true);
      const res = await recalculatePerformancePeriod(boardCode || boardId, selectedPeriodId);
      toast.success(res.message);
      // Reload details
      const refreshed = await getPerformancePeriodDetails(boardCode || boardId, selectedPeriodId);
      setPeriodData(refreshed);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tính lại điểm');
    } finally {
      setRecalculating(false);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (!selectedPeriodId) return;
    if (!window.confirm('Bạn có chắc chắn muốn công bố kỳ đánh giá này? Toàn bộ thành viên sẽ nhận được thông báo và xem được bảng điểm.')) {
      return;
    }
    try {
      setRecalculating(true);
      const res = await publishPerformancePeriod(boardCode || boardId, selectedPeriodId);
      toast.success(res.message);
      const refreshed = await getPerformancePeriodDetails(boardCode || boardId, selectedPeriodId);
      setPeriodData(refreshed);
      // Update in periods list
      setPeriods(prev => prev.map(p => p.id === selectedPeriodId ? { ...p, status: 'published' } : p));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi công bố');
    } finally {
      setRecalculating(false);
    }
  };

  // Handle lock / unlock
  const handleToggleLock = async () => {
    if (!selectedPeriodId || !periodData) return;
    const isLocked = periodData.period.status === 'locked';

    try {
      setRecalculating(true);
      if (isLocked) {
        const res = await unlockPerformancePeriod(boardCode || boardId, selectedPeriodId);
        toast.success(res.message);
        setPeriodData(prev => prev ? { ...prev, period: { ...prev.period, status: 'published' } } : null);
        setPeriods(prev => prev.map(p => p.id === selectedPeriodId ? { ...p, status: 'published' } : p));
      } else {
        const res = await lockPerformancePeriod(boardCode || boardId, selectedPeriodId);
        toast.success(res.message);
        setPeriodData(prev => prev ? { ...prev, period: { ...prev.period, status: 'locked' } } : null);
        setPeriods(prev => prev.map(p => p.id === selectedPeriodId ? { ...p, status: 'locked' } : p));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Thao tác khóa/mở khóa thất bại');
    } finally {
      setRecalculating(false);
    }
  };

  // Handle create period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodTitle || !newPeriodStartDate || !newPeriodEndDate) {
      toast.error('Vui lòng điền đầy đủ thông tin kỳ đánh giá.');
      return;
    }

    try {
      setLoading(true);
      const res = await createPerformancePeriod(boardCode || boardId, {
        title: newPeriodTitle,
        period_type: newPeriodType,
        start_date: newPeriodStartDate,
        end_date: newPeriodEndDate,
      });
      toast.success(res.message);
      setPeriods(prev => [res.period, ...prev]);
      setSelectedPeriodId(res.period.id);
      setShowCreateModal(false);
      // Reset form
      setNewPeriodTitle('');
      setNewPeriodStartDate('');
      setNewPeriodEndDate('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo kỳ đánh giá');
    } finally {
      setLoading(false);
    }
  };

  // Open lineage modal
  const handleViewLineage = async (userId: number) => {
    if (!selectedPeriodId) return;
    try {
      setLoadingLineage(true);
      setShowLineageModal(true);
      const data = await getMemberPerformanceLineage(boardCode || boardId, selectedPeriodId, userId);
      setSelectedMemberLineage(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xem nguồn gốc điểm');
      setShowLineageModal(false);
    } finally {
      setLoadingLineage(false);
    }
  };

  // Filtered members list
  const filteredScores = (periodData?.scores || []).filter(score => {
    const matchSearch = score.user_name.toLowerCase().includes(searchMember.toLowerCase()) ||
                        score.user_username.toLowerCase().includes(searchMember.toLowerCase());
    if (!matchSearch) return false;
    
    if (rankFilter !== 'ALL') {
      if (rankFilter === 'PROVISIONAL') {
        if (!score.is_provisional) return false;
      } else if (score.rank !== rankFilter) {
        return false;
      }
    }

    if (departmentFilter === 'UNASSIGNED') {
      if (score.department_id) return false;
    } else if (departmentFilter !== 'ALL') {
      if (score.department_id !== Number(departmentFilter)) return false;
    }

    if (excludeLocked) {
      if (score.account_status === 'suspended' || score.account_status === 'locked' || score.account_status === 'inactive') {
        return false;
      }
    }

    return true;
  });

  const selectedPeriod = periodData?.period || periods.find(p => p.id === selectedPeriodId);
  const canManage = periodData?.can_manage ?? false;

  // Department statistics when filtered
  const selectedDeptInfo = departmentOptions.find(d => d.id === Number(departmentFilter));
  const isDeptFiltered = departmentFilter !== 'ALL';
  const validScores = filteredScores.filter(s => !s.is_provisional);
  const deptAverageScore = validScores.length > 0
    ? (validScores.reduce((acc, s) => acc + s.final_score, 0) / validScores.length).toFixed(1)
    : (filteredScores.length > 0 ? (filteredScores.reduce((acc, s) => acc + s.final_score, 0) / filteredScores.length).toFixed(1) : '0.0');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-6">
      {/* Top Banner / Disclaimer */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-indigo-800/90 to-purple-900/90 text-white rounded-2xl p-6 shadow-xl border border-indigo-700/50 backdrop-blur-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs font-semibold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Module Đánh Giá Hiệu Suất Đầu Ra (Output-Driven)
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Bảng Điểm Hiệu Suất Công Việc
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              Hệ thống đánh giá chuẩn 100 điểm dựa trên khối lượng (40đ), đúng hạn (25đ), chất lượng (25đ) và cập nhật tiến độ (10đ).
              <span className="font-semibold text-amber-300 ml-1">
                Tuyệt đối không áp dụng chấm công hành chính, check-in, check-out hay phạt đi muộn.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setShowFormulaModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 transition-all backdrop-blur-sm shadow-sm active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-amber-300" />
              Giải thích công thức
            </button>
            {canManage && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Tạo kỳ đánh giá
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Period Selector & Action Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Kỳ Đánh Giá:
          </span>
          {periods.length === 0 ? (
            <span className="text-sm text-slate-500 italic">Chưa có kỳ đánh giá nào</span>
          ) : (
            <select
              value={selectedPeriodId || ''}
              onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.start_date} ~ {p.end_date}) [{p.status === 'locked' ? 'Đã khóa' : p.status === 'published' ? 'Đã công bố' : 'Bản nháp'}]
                </option>
              ))}
            </select>
          )}

          {selectedPeriod && (
            <div className="flex items-center gap-2 ml-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                selectedPeriod.status === 'locked'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : selectedPeriod.status === 'published'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {selectedPeriod.status === 'locked' ? 'Đã Khóa Snapshot' : selectedPeriod.status === 'published' ? 'Đã Công Bố' : 'Bản Nháp'}
              </span>
            </div>
          )}
        </div>

        {/* Action Controls for Admin/Owner */}
        {canManage && selectedPeriod && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPeriod.status !== 'locked' && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
                title="Tính lại điểm số theo dữ liệu mới nhất trên bảng"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin text-indigo-500' : ''}`} />
                Tính lại điểm
              </button>
            )}

            {selectedPeriod.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={recalculating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Công bố kết quả
              </button>
            )}

            <button
              onClick={handleToggleLock}
              disabled={recalculating}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 border ${
                selectedPeriod.status === 'locked'
                  ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
              }`}
            >
              {selectedPeriod.status === 'locked' ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  Mở khóa kỳ
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Khóa kỳ (Cố định snapshot)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      {periodData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Điểm TB Toàn Bảng
              </span>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {periodData.analytics.board_average}
              </span>
              <span className="text-sm font-semibold text-slate-400">/ 100đ</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Tổng số {periodData.analytics.total_members} thành viên tham gia đánh giá
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Xuất Sắc & Tốt
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {(periodData.analytics.rank_distribution['Xuất sắc'] || 0) + (periodData.analytics.rank_distribution['Tốt'] || 0)}
              </span>
              <span className="text-sm font-semibold text-slate-400">
                / {periodData.analytics.total_members} người
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Đạt điểm chuẩn từ 80.00 điểm trở lên
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Cần Cải Thiện / Chưa Đạt
              </span>
              <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">
                {(periodData.analytics.rank_distribution['Cần cải thiện'] || 0) + (periodData.analytics.rank_distribution['Chưa đạt'] || 0)}
              </span>
              <span className="text-sm font-semibold text-slate-400">người</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Dưới 65 điểm cần hỗ trợ giải quyết vướng mắc
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Điểm Tạm Tính
              </span>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                {periodData.analytics.rank_distribution['Tạm tính'] || 0}
              </span>
              <span className="text-sm font-semibold text-slate-400">thành viên</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Phát sinh dưới 50% trọng số dữ liệu trong kỳ
            </p>
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Bảng Xếp Hạng & Chi Tiết Hiệu Suất Từng Thành Viên
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm thành viên..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="pl-3.5 pr-8 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 w-44"
              />
              {searchMember && (
                <button
                  onClick={() => setSearchMember('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-2.5 py-1 border border-slate-200 dark:border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả phòng ban</option>
                <option value="UNASSIGNED">Chưa phân phòng</option>
                {departmentOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <select
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none"
            >
              <option value="ALL">Tất cả xếp loại</option>
              <option value="Xuất sắc">Xuất sắc (90-100)</option>
              <option value="Tốt">Tốt (80-89.99)</option>
              <option value="Đạt">Đạt (65-79.99)</option>
              <option value="Cần cải thiện">Cần cải thiện (50-64.99)</option>
              <option value="Chưa đạt">Chưa đạt (&lt;50)</option>
              <option value="PROVISIONAL">Tạm tính (&lt;50% DL)</option>
            </select>

            {/* Exclude Locked Accounts Checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={excludeLocked}
                onChange={(e) => setExcludeLocked(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
              />
              Loại trừ tài khoản khóa
            </label>
          </div>
        </div>

        {/* Department Performance Highlight Banner */}
        {isDeptFiltered && (
          <div className="mx-5 mb-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedDeptInfo?.color || '#6366f1' }} />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  {selectedDeptInfo ? `Phòng ban: ${selectedDeptInfo.name} (${selectedDeptInfo.code})` : 'Nhân sự chưa phân phòng'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-indigo-200/50 dark:border-indigo-800">
                  {filteredScores.length} nhân sự tham gia
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kỳ đánh giá: <strong className="text-slate-700 dark:text-slate-300">{selectedPeriod?.title}</strong> ({selectedPeriod?.start_date} ~ {selectedPeriod?.end_date}). 
                Nguồn: tasks & task_assignees. Chuẩn 100đ: 40% Khối lượng, 25% Đúng hạn, 25% Chất lượng, 10% Tiến độ.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-indigo-100 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase">Điểm TB Phòng Ban:</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {deptAverageScore}
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ 100đ</span>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
            Đang tải dữ liệu bảng điểm...
          </div>
        ) : filteredScores.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Không tìm thấy thành viên nào phù hợp với điều kiện tìm kiếm.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">Thành Viên</th>
                  <th className="py-3.5 px-4 text-center">Khối Lượng (40đ)</th>
                  <th className="py-3.5 px-4 text-center">Đúng Hạn (25đ)</th>
                  <th className="py-3.5 px-4 text-center">Chất Lượng (25đ)</th>
                  <th className="py-3.5 px-4 text-center">Tiến Độ (10đ)</th>
                  <th className="py-3.5 px-4 text-center">Tổng Điểm</th>
                  <th className="py-3.5 px-4 text-center">Xếp Loại</th>
                  <th className="py-3.5 px-4 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredScores.map((score, index) => {
                  const rankInfo = getRankInfo(score.final_score, score.available_weight, score.is_provisional);
                  return (
                    <tr 
                      key={score.user_id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-4 font-bold text-slate-400">
                        {index + 1}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(score.user_avatar, score.user_name)}
                            alt={score.user_name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {score.user_name}
                              {score.role === 'owner' || score.role === 'admin' ? (
                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                  {score.role}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-400">@{score.user_username}</div>
                            {score.department_name ? (
                              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{
                                backgroundColor: `${score.department_color || '#6366f1'}15`,
                                color: score.department_color || '#6366f1',
                              }}>
                                <Building2 className="w-3 h-3" />
                                {score.department_name}
                              </div>
                            ) : (
                              <div className="mt-0.5 text-[10px] text-slate-400 italic">Chưa phân phòng</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Workload */}
                      <td className="py-4 px-4 text-center">
                        {score.metrics_breakdown.workload.has_data ? (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {score.workload_score.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-400"> / 40</span>
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, (score.workload_score / 40) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Không có task</span>
                        )}
                      </td>

                      {/* On-Time */}
                      <td className="py-4 px-4 text-center">
                        {score.metrics_breakdown.on_time.has_data ? (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {score.on_time_score.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-400"> / 25</span>
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, (score.on_time_score / 25) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Không có hạn</span>
                        )}
                      </td>

                      {/* Quality */}
                      <td className="py-4 px-4 text-center">
                        {score.metrics_breakdown.quality.has_data ? (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {score.quality_score.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-400"> / 25</span>
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(100, (score.quality_score / 25) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa đánh giá</span>
                        )}
                      </td>

                      {/* Progress */}
                      <td className="py-4 px-4 text-center">
                        {score.metrics_breakdown.progress.has_data ? (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {score.progress_score.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-400"> / 10</span>
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className="h-full bg-sky-500 rounded-full"
                                style={{ width: `${Math.min(100, (score.progress_score / 10) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Không yêu cầu</span>
                        )}
                      </td>

                      {/* Final Score */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-base font-black ${
                            score.final_score >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                            score.final_score >= 80 ? 'text-blue-600 dark:text-blue-400' :
                            score.final_score >= 65 ? 'text-amber-600 dark:text-amber-400' :
                            score.final_score >= 50 ? 'text-orange-600 dark:text-orange-400' :
                            'text-rose-600 dark:text-rose-400'
                          }`}>
                            {score.final_score.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({score.total_points_earned.toFixed(1)} / {score.available_weight.toFixed(0)}đ)
                          </span>
                        </div>
                      </td>

                      {/* Rank Badge */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${rankInfo.badgeClass}`}>
                          {rankInfo.label}
                        </span>
                      </td>

                      {/* Lineage Button */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleViewLineage(score.user_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Nguồn gốc
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: FORMULA EXPLAINER (Giải thích công thức) */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Công Thức Tính Điểm Hiệu Suất (Thang 100)
                  </h3>
                  <p className="text-xs text-slate-500">Quy tắc toán học & phân bổ điểm chuẩn hóa</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFormulaModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-sm">
              {/* Section 1 */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  1. Cấu Trúc Thang Điểm 100
                </h4>
                <ul className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <li className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                    Khối lượng hoàn thành: <span className="text-indigo-600 font-bold">40 điểm</span>
                  </li>
                  <li className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                    Đúng hạn: <span className="text-emerald-600 font-bold">25 điểm</span>
                  </li>
                  <li className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                    Chất lượng (Review 1-5 sao): <span className="text-amber-600 font-bold">25 điểm</span>
                  </li>
                  <li className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                    Cập nhật tiến độ: <span className="text-sky-600 font-bold">10 điểm</span>
                  </li>
                </ul>
              </div>

              {/* Section 2 */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white">2. Thang Đo Độ Phức Tạp Task (Complexity)</h4>
                <p className="text-xs text-slate-500">Mỗi task được gán độ phức tạp chuẩn, không nhân theo mức ưu tiên (priority):</p>
                <div className="flex gap-2 flex-wrap text-xs">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">XS = 1 điểm</span>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">S = 2 điểm</span>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">M = 3 điểm (Mặc định)</span>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">L = 5 điểm</span>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">XL = 8 điểm</span>
                </div>
              </div>

              {/* Section 3 */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white">3. Tỷ Lệ Đóng Góp (Nhiều Assignee) & Task Cha/Con</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  • <strong>Nhiều người phụ trách:</strong> Mỗi người nhận điểm theo <code className="text-indigo-600">contribution_percent</code> (tổng phải bằng 100%). Nếu để trống, tự động chia đều. Tuyệt đối không cộng trọn vẹn điểm cho tất cả mọi người.<br />
                  • <strong>Task Cha/Con:</strong> Task cha có task con thì chỉ tính điểm các task con trực tiếp, không đếm hai lần. Task cha đứng một mình thì tính điểm task cha.
                </p>
              </div>

              {/* Section 4 */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white">4. Xử Lý Khi Thiếu Dữ Liệu & Điểm Tạm Tính</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Nếu một tiêu chí không phát sinh dữ liệu (ví dụ task không có hạn chót, hoặc chưa được review chất lượng), hệ thống không tự động tính 0 mà chuẩn hóa theo tỷ lệ:
                </p>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                  final_score = (tổng điểm đạt được / tổng trọng số có dữ liệu) × 100
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  ⚠️ Nếu tổng trọng số có dữ liệu dưới 50% (ví dụ chỉ có 10 điểm tiến độ): Chỉ hiển thị điểm tạm tính, không xếp loại chính thức.
                </p>
              </div>

              {/* Section 5 */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white">5. Khung Xếp Loại Chuẩn</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold">
                    90 – 100: Xuất sắc
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold">
                    80 – 89.99: Tốt
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 font-bold">
                    65 – 79.99: Đạt
                  </div>
                  <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 font-bold">
                    50 – 64.99: Cần cải thiện
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold">
                    Dưới 50: Chưa đạt
                  </div>
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold">
                    &lt; 50% DL: Tạm tính
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-md hover:opacity-90 transition-all"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE PERIOD */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Tạo Kỳ Đánh Giá Hiệu Suất Mới
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Tên kỳ đánh giá
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Kỳ Đánh Giá Tuần 42 hoặc Tháng 10/2026"
                  value={newPeriodTitle}
                  onChange={(e) => setNewPeriodTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Chu kỳ
                </label>
                <select
                  value={newPeriodType}
                  onChange={(e: any) => setNewPeriodType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                >
                  <option value="weekly">Theo Tuần (Weekly)</option>
                  <option value="monthly">Theo Tháng (Monthly)</option>
                  <option value="quarterly">Theo Quý (Quarterly)</option>
                  <option value="custom">Tùy chỉnh khoảng thời gian</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    required
                    value={newPeriodStartDate}
                    onChange={(e) => setNewPeriodStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    required
                    value={newPeriodEndDate}
                    onChange={(e) => setNewPeriodEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  Tạo kỳ đánh giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SCORE LINEAGE DRILLDOWN */}
      {showLineageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {selectedMemberLineage?.member && (
                  <img
                    src={getAvatarUrl(selectedMemberLineage.member.avatar, selectedMemberLineage.member.name)}
                    alt=""
                    className="w-12 h-12 rounded-full border border-slate-200 object-cover"
                  />
                )}
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Nguồn Gốc Điểm: {selectedMemberLineage?.member?.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    @{selectedMemberLineage?.member?.username} • Kỳ: {selectedPeriod?.title}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowLineageModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingLineage ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
                Đang đối soát nguồn gốc từng điểm số...
              </div>
            ) : selectedMemberLineage?.score ? (
              <div className="space-y-6">
                {/* Score Summary Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Khối lượng (40đ)</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {selectedMemberLineage.score.workload_score.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Đúng hạn (25đ)</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {selectedMemberLineage.score.on_time_score.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Chất lượng (25đ)</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {selectedMemberLineage.score.quality_score.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Tiến độ (10đ)</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {selectedMemberLineage.score.progress_score.toFixed(1)}
                    </div>
                  </div>
                </div>

                {/* Task-Level Details Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center justify-between">
                    <span>Danh Sách Công Việc Được Giao Trong Kỳ</span>
                    <span className="text-xs text-slate-500 font-normal">
                      {selectedMemberLineage.score.task_details?.length || 0} công việc hợp lệ
                    </span>
                  </h4>

                  {(!selectedMemberLineage.score.task_details || selectedMemberLineage.score.task_details.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Không có công việc nào trong kỳ này.</p>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-500 font-bold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Công việc</th>
                            <th className="py-2.5 px-3 text-center">Độ phức tạp</th>
                            <th className="py-2.5 px-3 text-center">Đóng góp %</th>
                            <th className="py-2.5 px-3 text-center">Điểm thực nhận</th>
                            <th className="py-2.5 px-3 text-center">Trạng thái</th>
                            <th className="py-2.5 px-3 text-center">Hạn chót</th>
                            <th className="py-2.5 px-3 text-center">Review sao</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {selectedMemberLineage.score.task_details.map((t, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{t.title}</div>
                                {t.parent_task_id && (
                                  <span className="text-[10px] text-indigo-500 font-bold">Subtask</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold">
                                {t.complexity} ({t.base_points}đ)
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {t.contribution_percent}%
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                                {t.effective_points.toFixed(2)}đ
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {t.is_completed ? (
                                  <span className="text-emerald-600 font-bold">Hoàn thành</span>
                                ) : (
                                  <span className="text-slate-400">Chưa</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {t.due_date ? (
                                  <span className={t.is_on_time ? 'text-emerald-600' : 'text-rose-500 font-bold'}>
                                    {t.due_date} {t.is_completed ? (t.is_on_time ? '(Đúng hạn)' : '(Trễ)') : ''}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-amber-500">
                                {t.quality_rating ? `${t.quality_rating} ★` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Progress Logs */}
                {selectedMemberLineage.score.metrics_breakdown?.progress?.task_logs && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      Nhật Ký Cập Nhật Tiến Độ Công Việc
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedMemberLineage.score.metrics_breakdown.progress.task_logs.map((log, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{log.title}</span>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            log.has_valid_update ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {log.activities_count} hoạt động, {log.comments_count} bình luận
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowLineageModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
