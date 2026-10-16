import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Clock, AlertTriangle, Plus, 
  Briefcase, Calendar, ChevronRight, Activity, Users, 
  ShieldAlert, User, X, LayoutDashboard, ArrowUpRight, Sparkles,
  MessageSquare, CheckSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import api from '../lib/axios';
import { getPersonalDashboard } from '../lib/personalDashboard';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', workspaceId: '', boardId: '', columnId: '' });
  const [workspacesList, setWorkspacesList] = useState<any[]>([]);
  const [boardsList, setBoardsList] = useState<any[]>([]);
  const [columnsList, setColumnsList] = useState<any[]>([]);
  const [submittingTask, setSubmittingTask] = useState(false);

  useEffect(() => {
    fetchDashboardData();
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
      const res = await api.get('/workspaces');
      setWorkspacesList(res.data);
    } catch (e) {
      toast.error('Không thể tải dữ liệu Không gian làm việc');
    }
  };

  useEffect(() => {
    if (taskForm.workspaceId) {
      setBoardsList([]);
      setColumnsList([]);
      setTaskForm(prev => ({ ...prev, boardId: '', columnId: '' }));
      api.get(`/workspaces/${taskForm.workspaceId}/boards`).then(res => setBoardsList(res.data)).catch(console.error);
    }
  }, [taskForm.workspaceId]);

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
  const recentWorkspaces = data?.recent_workspaces || [];
  const recentBoards = data?.recent_boards || [];
  const recentActivities = data?.recent_activities || [];

  const continueItems = [
    ...recentBoards.map((b: any) => ({ type: 'board', ...b })),
    ...recentWorkspaces.map((w: any) => ({ type: 'workspace', ...w }))
  ].slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar">
      <div className="max-w-[1440px] mx-auto p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
        
        {/* Modern Welcome Hero Card */}
        <section className="relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.04] border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* Subtle background glow decoration */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                <Sparkles size={13} />
                <span>Không gian làm việc cá nhân</span>
              </div>
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
                className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#5B4BD6] text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
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
                onClick={() => navigate('/workspaces')} 
                className="flex items-center gap-2 px-4 py-2.5 bg-background hover:bg-accent text-muted-foreground hover:text-foreground border border-border rounded-xl text-sm font-medium shadow-xs transition-all"
              >
                <Briefcase size={16} className="text-indigo-500" />
                <span>Không gian</span>
              </button>
            </div>
          </div>
        </section>

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
                <div className="bg-card border border-border p-8 rounded-2xl text-center text-sm text-muted-foreground shadow-xs">
                  Hoạt động của bạn sẽ xuất hiện tại đây khi bạn tương tác với các Không gian hoặc Bảng.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {continueItems.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => navigate(item.type === 'board' ? (item.public_id ? `/${item.public_id}/kanban` : `/b/${item.id}`) : '/workspaces')} 
                      className="group bg-card hover:bg-accent/40 border border-border hover:border-primary/40 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden"
                    >
                      {/* Top accent line */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div className="flex items-center justify-between z-10">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                          item.type === 'board' 
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}>
                          {item.type === 'board' ? <LayoutDashboard size={12} /> : <Briefcase size={12} />}
                          {item.type === 'board' ? 'Bảng' : 'Không gian'}
                        </span>
                        <ArrowUpRight size={15} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>

                      <div className="z-10 mt-2">
                        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {item.type === 'board' ? 'Bấm để mở bảng' : 'Bấm để vào không gian'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Workspace & Hoạt động gần đây */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Không gian của bạn */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Briefcase className="text-indigo-500" size={18} />
                    Không gian của bạn
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold">
                      {recentWorkspaces.length}
                    </span>
                  </h2>
                  <Link to="/workspaces" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    Xem tất cả <ChevronRight size={14} />
                  </Link>
                </div>

                {recentWorkspaces.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    Chưa có Không gian nào.
                  </div>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {recentWorkspaces.slice(0, 5).map((ws: any) => (
                      <div 
                        key={ws.id} 
                        onClick={() => navigate('/workspaces')} 
                        className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-border hover:bg-accent/60 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                            {ws.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                              {ws.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <span>{ws.boards_count || 0} Bảng</span>
                              <span>•</span>
                              <span>{ws.members_count || 1} Thành viên</span>
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                      </div>
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
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Mới nhất
                  </span>
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
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300">
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
                  <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
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
                        {task.due_date ? format(new Date(task.due_date.replace(' ', 'T')), 'HH:mm') : ''}
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
            {user?.system_role === 'system_admin' && (
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
                <label className="block text-sm font-medium text-foreground mb-1.5">Không gian làm việc <span className="text-destructive">*</span></label>
                <select 
                  value={taskForm.workspaceId}
                  onChange={e => setTaskForm(prev => ({ ...prev, workspaceId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                >
                  <option value="">-- Chọn không gian --</option>
                  {workspacesList.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {taskForm.workspaceId && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Bảng (Board) <span className="text-destructive">*</span></label>
                  <select 
                    value={taskForm.boardId}
                    onChange={e => setTaskForm(prev => ({ ...prev, boardId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  >
                    <option value="">-- Chọn Bảng --</option>
                    {boardsList.map(b => (
                      <option key={b.id} value={b.id}>{b.name || b.title}</option>
                    ))}
                  </select>
                </div>
              )}

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
