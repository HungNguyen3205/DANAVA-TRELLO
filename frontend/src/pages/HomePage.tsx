import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Clock, AlertTriangle, Plus, 
  Calendar, ChevronRight, Activity, Users, 
  ShieldAlert, X, ArrowUpRight,
  MessageSquare, CheckSquare, Columns, FolderKanban, LayoutGrid
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import api from '../lib/axios';
import { getPersonalDashboard } from '../lib/personalDashboard';
import { CheckInCard } from '../components/attendance/CheckInCard';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { BoardCard } from '../components/board/BoardCard';
import { projectColor, projectsApi, type ProjectSummary } from '../lib/api/projects';
import { ProgressBar } from '../components/project/ProjectBits';
import { PROJECT_STATUS_OPTIONS } from '../lib/boardType';

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  // Same data as the "Tất cả bảng" page (role, members, star), most recently updated first.
  const [myBoards, setMyBoards] = useState<any[] | null>(null);

  // Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', workspaceId: '', boardId: '', columnId: '' });
  const [boardsList, setBoardsList] = useState<any[]>([]);
  const [columnsList, setColumnsList] = useState<any[]>([]);
  const [submittingTask, setSubmittingTask] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
    api.get('/me/boards').then((r) => setMyBoards(Array.isArray(r?.data) ? r.data : [])).catch(() => setMyBoards([]));
  }, []);

  const fetchDashboardData = async () => {
    try {
      const dashboard = await getPersonalDashboard();
      setData(dashboard);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffMins < 2) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return format(date, 'HH:mm dd/MM');
    } catch {
      return dateStr;
    }
  };

  const openTaskModal = async () => {
    setShowTaskModal(true);
    try {
      const res = await api.get('/boards');
      setBoardsList(res.data || []);
      if (res.data?.length > 0) {
        setTaskForm(prev => ({ ...prev, boardId: res.data[0].id.toString() }));
      }
    } catch (e) {
      toast.error('Không thể tải danh sách bảng công việc');
    }
  };

  useEffect(() => {
    if (taskForm.boardId) {
      setColumnsList([]);
      setTaskForm(prev => ({ ...prev, columnId: '' }));
      api.get(`/boards/${taskForm.boardId}`).then(res => {
        setColumnsList(res.data.columns || []);
        if (res.data.columns?.length > 0) {
          setTaskForm(prev => ({ ...prev, columnId: res.data.columns[0].id.toString() }));
        }
      }).catch(console.error);
    }
  }, [taskForm.boardId]);

  const submitGlobalTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !taskForm.columnId) return;
    setSubmittingTask(true);
    try {
      await api.post(`/columns/${taskForm.columnId}/tasks`, {
        title: taskForm.title.trim()
      });
      toast.success('Đã tạo công việc mới thành công');
      setShowTaskModal(false);
      setTaskForm({ title: '', workspaceId: '', boardId: '', columnId: '' });
      fetchDashboardData();
    } catch (err) {
      toast.error('Lỗi khi tạo công việc');
    } finally {
      setSubmittingTask(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-medium flex flex-col items-center gap-2">
          <Activity size={32} className="animate-spin text-primary/50" />
          <span>Đang tải không gian cá nhân...</span>
        </div>
      </div>
    );
  }

  const attentionItems = data?.attention_items || [];
  const todaySchedule = data?.today_schedule || [];
  const recentBoards = data?.recent_boards || [];
  const recentActivities = data?.recent_activities || [];

  // VI.B: Chỉ hiển thị Bảng công việc trong mục "Tiếp tục công việc", không fallback sang Workspace
  const continueItems: any[] = (myBoards ?? recentBoards ?? []).slice(0, 4);

  const toggleStar = async (e: React.MouseEvent, board: any) => {
    e.stopPropagation();
    setMyBoards((list) => list?.map((b) => (b.id === board.id ? { ...b, is_starred: !b.is_starred } : b)) ?? null);
    try {
      await api.post(`/boards/${board.id}/toggle-star`);
    } catch {
      setMyBoards((list) => list?.map((b) => (b.id === board.id ? { ...b, is_starred: board.is_starred } : b)) ?? null);
      toast.error('Không gắn sao được bảng.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar">
      <div className="max-w-[1440px] mx-auto p-6 md:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 space-y-8 animate-in fade-in duration-500">
        
        {/* Modern Welcome Hero Card */}
        <section className="relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.04] border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* Subtle background glow decoration */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {getGreeting()}, <span className="bg-gradient-to-r from-primary via-indigo-600 to-purple-600 bg-clip-text text-transparent">{user?.name || user?.username || 'bạn'}</span>
              </h1>
              <p className="text-muted-foreground text-sm flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground/70" />
                <span>{format(new Date(), "EEEE, 'ngày' dd 'tháng' MM 'năm' yyyy", { locale: vi })}</span>
              </p>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background/80 border border-border text-xs font-medium shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-muted-foreground">Hôm nay:</span>
                  <strong className="text-foreground">{data?.summary?.due_today || 0} việc cần làm</strong>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background/80 border border-border text-xs font-medium shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-muted-foreground">Đang xử lý:</span>
                  <strong className="text-foreground">{data?.summary?.in_progress || 0} việc</strong>
                </div>

                {data?.summary?.overdue > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-600 dark:text-rose-400 shadow-xs">
                    <AlertTriangle size={13} className="shrink-0 text-rose-600 dark:text-rose-400" />
                    <span><strong>{data.summary.overdue}</strong> việc quá hạn</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Button Group */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button 
                onClick={openTaskModal} 
                className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:brightness-95 text-brand-foreground rounded-xl text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <Plus size={16} />
                <span>Tạo công việc</span>
              </button>

              <button 
                onClick={() => navigate('/my-tasks')} 
                className="flex items-center gap-2 px-4 py-2.5 bg-background hover:bg-accent text-foreground border border-border rounded-xl text-sm font-semibold shadow-xs hover:shadow-sm transition-all"
              >
                <CheckCircle2 size={16} className="text-primary" />
                <span>Công việc của tôi</span>
              </button>

              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-2 px-4 py-2.5 bg-background hover:bg-accent text-foreground border border-border rounded-xl text-sm font-semibold shadow-xs transition-all"
              >
                <FolderKanban size={16} className="text-primary" />
                <span>Dự án</span>
              </button>
            </div>
          </div>
        </section>

        {/* Quick check-in / check-out */}
        <CheckInCard compact />

        {/* 12-Column Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Main Left Column (8/12) */}
          <div className="xl:col-span-8 space-y-8">
            
            {/* Tiếp tục công việc */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2.5 text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Clock size={16} />
                  </div>
                  Tiếp tục công việc
                </h2>
                <span className="text-xs text-muted-foreground font-medium">Truy cập nhanh gần đây</span>
              </div>

              {continueItems.length === 0 ? (
                <div className="bg-card border border-dashed border-border p-8 rounded-2xl text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Columns size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Bạn chưa có Bảng công việc nào</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      Hãy tạo bảng công việc đầu tiên để bắt đầu quản lý dự án cá nhân hoặc cộng tác với thành viên trong nhóm.
                    </p>
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={() => navigate('/projects')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Plus size={14} />
                      <span>Tạo Bảng công việc</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 auto-rows-fr">
                  {continueItems.map((board: any) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      onClick={() => navigate(board.public_id ? `/${board.public_id}/kanban` : `/b/${board.id}`)}
                      onToggleStar={(e) => toggleStar(e, board)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Workspace & Hoạt động gần đây */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Dự án của bạn */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <FolderKanban className="text-primary" size={18} />
                    Dự án của bạn
                    {!!projects?.length && (
                      <span className="whitespace-nowrap text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold">{projects.length}</span>
                    )}
                  </h2>
                  <Link to="/projects" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    Xem tất cả <ChevronRight size={14} />
                  </Link>
                </div>

                {projects === null ? (
                  <div className="space-y-2.5" aria-busy="true">
                    {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    Chưa có dự án nào. <Link to="/projects" className="font-semibold text-primary hover:underline">Tạo dự án</Link>
                  </div>
                ) : (
                  <div className="space-y-1.5 flex-1">
                    {projects.slice(0, 5).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => navigate(`/projects/${p.id}`)}
                        title={p.name}
                        className="group w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-border hover:bg-accent/60 transition-all"
                      >
                        <span className="w-9 h-9 rounded-lg grid place-items-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: projectColor(p) }}>
                          {p.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 space-y-1.5">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">{p.name}</span>
                            <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">{p.stats?.progress ?? 0}%</span>
                          </span>
                          <ProgressBar value={p.stats?.progress ?? 0} label={`Tiến độ ${p.name}`} />
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="truncate">{PROJECT_STATUS_OPTIONS.find((o) => o.value === p.status)?.label}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 whitespace-nowrap"><LayoutGrid size={11} /> {p.boards_count} bảng</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hoạt động gần đây */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Activity className="text-emerald-500" size={18} />
                    Hoạt động gần đây
                  </h2>
                  {recentActivities.length > 0 && (
                  <span className="whitespace-nowrap flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Mới nhất
                  </span>
                  )}
                </div>

                {recentActivities.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    Chưa có hoạt động nào được ghi nhận.
                  </div>
                ) : (
                  <div className="space-y-3 flex-1">
                    {recentActivities.slice(0, 5).map((act: any) => (
                      <div 
                        key={act.id} 
                        onClick={() => {
                          if (act.board_id && act.task_id) {
                            navigate(`/b/${act.board_id}?task=${act.task_id}`);
                          } else if (act.board_id) {
                            navigate(`/b/${act.board_id}`);
                          }
                        }}
                        className="group flex gap-3 items-start p-2.5 rounded-xl hover:bg-accent/60 transition-all cursor-pointer border border-transparent hover:border-border/60"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                          {act.id?.startsWith('comment') ? (
                            <MessageSquare size={14} className="text-indigo-500" />
                          ) : (
                            <CheckSquare size={14} className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-tight">
                            <span className="font-bold">Bạn</span> {act.action}
                          </p>
                          {act.task_title && (
                            <p className="text-xs font-semibold text-primary truncate mt-1 group-hover:underline">
                              {act.task_title}
                            </p>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{formatRelativeTime(act.created_at)}</span>
                            {act.board_name && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[120px] text-muted-foreground/80">{act.board_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            
          </div>

          {/* Side Right Column (4/12) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Cần tôi chú ý */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border/50 bg-gradient-to-r from-orange-500/10 to-amber-500/5 flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertTriangle size={16} /> Cần tôi chú ý
                </h3>
                {attentionItems.length > 0 && (
                  <span className="whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300">
                    {attentionItems.length}
                  </span>
                )}
              </div>
              <div className="p-3">
                {attentionItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Tuyệt vời! Không có công việc nào quá hạn hoặc cần xử lý khẩn cấp.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attentionItems.map((item: any, idx: number) => {
                      const isOverdue = item.type === 'overdue';
                      const isUrgent = item.type === 'urgent';
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (item.board_id) navigate(`/b/${item.board_id}?task=${item.id}`);
                            else navigate('/my-tasks');
                          }}
                          className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                            isOverdue 
                              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 hover:border-rose-400' 
                              : isUrgent 
                              ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 hover:border-orange-400'
                              : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 hover:border-blue-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isOverdue 
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' 
                                : isUrgent 
                                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                                : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            }`}>
                              {item.message}
                            </span>
                            <ArrowUpRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                            {item.task_title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Lịch trình hôm nay */}
            <div className="bg-card border border-border rounded-2xl shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                  <Calendar size={16} className="text-primary" /> Lịch trình hôm nay
                </h3>
                {todaySchedule.length > 0 && (
                  <span className="whitespace-nowrap text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                    {todaySchedule.length}
                  </span>
                )}
              </div>
              
              {todaySchedule.length === 0 ? (
                <div className="text-center p-5 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                  Trống lịch hôm nay
                </div>
              ) : (
                <div className="relative border-l-2 border-primary/20 ml-2.5 pl-3.5 space-y-4 py-1">
                  {todaySchedule.map((task: any, idx: number) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (task.board_id) navigate(`/b/${task.board_id}?task=${task.id}`);
                        else navigate('/my-tasks');
                      }}
                      className="relative cursor-pointer group"
                    >
                      <div className="absolute -left-[20.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-card group-hover:scale-125 transition-transform"></div>
                      <div className="text-[11px] font-bold text-primary mb-0.5">
                        {(() => {
                          // Most deadlines are a date only; show a time only when one was actually set.
                          const t = task.due_date ? format(new Date(task.due_date.replace(' ', 'T')), 'HH:mm') : '';
                          return t && t !== '00:00' ? t : 'Hạn hôm nay';
                        })()}
                      </div>
                      <div className="bg-muted/40 group-hover:bg-accent/80 p-2.5 rounded-xl border border-transparent group-hover:border-border transition-all">
                        <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">{task.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{task.board_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System Admin Shortcut */}
            {(user?.system_role === 'system_admin' || user?.system_role === 'admin') && (
              <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                <ShieldAlert className="absolute -right-3 -bottom-3 text-amber-500/10" size={88} />
                <div className="relative z-10">
                  <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-1.5">
                    <ShieldAlert size={16} /> Quản lý hệ thống
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    Khu vực dành riêng cho Quản trị viên. Tạo tài khoản nhân viên và phân quyền truy cập dự án.
                  </p>
                  <button onClick={() => navigate('/admin/employees')} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2">
                    <Users size={14} /> Quản lý nhân viên
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Global Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Tạo công việc mới</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={submitGlobalTask} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tên công việc <span className="text-destructive">*</span></label>
                <input 
                  type="text" 
                  value={taskForm.title}
                  onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Nhập tên công việc..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Bảng công việc <span className="text-destructive">*</span></label>
                <select 
                  value={taskForm.boardId}
                  onChange={e => setTaskForm(prev => ({ ...prev, boardId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                >
                  <option value="">-- Chọn Bảng --</option>
                  {boardsList.map(b => (
                    <option key={b.id} value={b.id}>{b.name || b.title}{b.project?.name ? ` — ${b.project.name}` : ''}</option>
                  ))}
                </select>
              </div>

              {taskForm.boardId && columnsList.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Cột (Trạng thái) <span className="text-destructive">*</span></label>
                  <select 
                    value={taskForm.columnId}
                    onChange={e => setTaskForm(prev => ({ ...prev, columnId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  >
                    {columnsList.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {taskForm.boardId && columnsList.length === 0 && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  Bảng này hiện chưa có cột nào để chứa công việc. Vui lòng chọn bảng khác hoặc tạo cột trước.
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-border mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={submittingTask || !taskForm.title.trim() || !taskForm.columnId}
                  className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingTask ? (
                    <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> Đang tạo...</>
                  ) : (
                    <>Tạo công việc</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
