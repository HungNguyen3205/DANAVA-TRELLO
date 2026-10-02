import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Circle, Clock, AlertTriangle, PlayCircle, Plus, 
  Search, Briefcase, Calendar, ChevronRight, Activity, Users, Settings, 
  ShieldAlert, User, X
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [focusTab, setFocusTab] = useState<'todo' | 'in_progress' | 'completed'>('todo');

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
      const response = await api.get('/me/dashboard');
      setData(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskCompletion = async (taskId: number, currentStatus: string) => {
    try {
      const isCompleted = currentStatus === 'completed';
      // In a real scenario, this would call an API to toggle completion status.
      // For now we'll just optimistically update the local state.
      await api.put(`/tasks/${taskId}`, { is_completed: !isCompleted });
      await fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
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

  const focusTasks = data?.focus_tasks || [];
  const filteredFocusTasks = focusTasks.filter((t: any) => t.status === focusTab).slice(0, 7);

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
        
        {/* Header Section */}
        <section className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {user?.name || 'bạn'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {format(new Date(), "EEEE, 'ngày' dd 'tháng' MM 'năm' yyyy", { locale: vi })}
            </p>
            <p className="text-sm mt-3 bg-primary/10 text-primary-foreground/80 text-primary px-3 py-1.5 rounded-lg inline-block border border-primary/20">
              {data?.summary?.due_today > 0 || data?.summary?.overdue > 0 ? (
                <>Hôm nay bạn có <strong>{data.summary.due_today}</strong> công việc cần hoàn thành và <strong>{data.summary.overdue}</strong> công việc đang quá hạn.</>
              ) : (
                <>Hôm nay bạn chưa có công việc đến hạn. Đây là thời điểm tốt để lên kế hoạch tiếp theo.</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={openTaskModal} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-orange-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus size={18} />
              <span>Tạo công việc</span>
            </button>
            <button onClick={() => navigate('/my-tasks')} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg font-medium text-foreground hover:bg-accent transition-colors shadow-sm">
              <CheckCircle2 size={18} className="text-primary" />
              <span>Công việc của tôi</span>
            </button>
            {recentWorkspaces.length > 0 && (
              <button onClick={() => navigate(`/w/${recentWorkspaces[0].id}/dashboard`)} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg font-medium text-foreground hover:bg-accent transition-colors shadow-sm hidden sm:flex">
                <Briefcase size={18} className="text-indigo-500" />
                <span>Mở Workspace gần nhất</span>
              </button>
            )}
          </div>
        </section>

        {/* 12-Column Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Main Left Column (8/12) */}
          <div className="xl:col-span-8 space-y-8">
            
            {/* Tập trung hôm nay */}
            <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-5 md:p-6 border-b border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <PlayCircle className="text-primary" size={22} />
                  Tập trung hôm nay
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Những công việc quan trọng nhất bạn cần xử lý.</p>
                
                <div className="flex items-center gap-6 mt-6 border-b border-border">
                  <button onClick={() => setFocusTab('todo')} className={`pb-3 text-sm font-medium transition-colors relative ${focusTab === 'todo' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    Cần làm
                    {focusTab === 'todo' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>}
                  </button>
                  <button onClick={() => setFocusTab('in_progress')} className={`pb-3 text-sm font-medium transition-colors relative ${focusTab === 'in_progress' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    Đang thực hiện {data?.summary?.in_progress > 0 && <span className="ml-1.5 bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded-full text-xs">{data.summary.in_progress}</span>}
                    {focusTab === 'in_progress' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>}
                  </button>
                  <button onClick={() => setFocusTab('completed')} className={`pb-3 text-sm font-medium transition-colors relative ${focusTab === 'completed' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    Đã hoàn thành
                    {focusTab === 'completed' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>}
                  </button>
                </div>
              </div>

              <div className="p-2 md:p-4 bg-background/30">
                {filteredFocusTasks.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center">
                    <CheckCircle2 size={48} className="text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-foreground">Không có công việc nào</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      Bạn chưa có công việc nào trong danh sách này. Hãy tạo công việc đầu tiên hoặc mở một Workspace để bắt đầu.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFocusTasks.map((task: any) => (
                      <div key={task.id} className="group flex items-center justify-between p-3 md:px-4 bg-card hover:bg-accent/50 rounded-xl border border-transparent hover:border-border transition-all cursor-pointer">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <button onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(task.id, task.status); }} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                            {task.status === 'completed' ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} />}
                          </button>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className={`font-medium truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {task.title}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="truncate flex items-center gap-1"><Briefcase size={12}/> {task.workspace_name}</span>
                              <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-border"></span>
                              <span className="truncate flex items-center gap-1 text-indigo-500/80"><LayoutDashboard size={12}/> {task.board_name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 pl-4">
                          {task.due_date && (
                            <div className="hidden md:flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                              <Clock size={12} />
                              {format(new Date(task.due_date.replace(' ', 'T')), 'dd/MM')}
                            </div>
                          )}
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-background">
                            {task.assignee?.name ? task.assignee.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {focusTasks.length > 7 && (
                  <button onClick={() => navigate('/my-tasks')} className="w-full mt-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center justify-center gap-1">
                    Xem tất cả <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </section>

            {/* Tiếp tục công việc */}
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="text-muted-foreground" size={20} />
                Tiếp tục công việc
              </h2>
              {continueItems.length === 0 ? (
                <div className="bg-card border border-border p-6 rounded-2xl text-center text-sm text-muted-foreground shadow-sm">
                  Hoạt động của bạn sẽ xuất hiện tại đây khi bạn tương tác với các Không gian.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {continueItems.map((item, idx) => (
                    <div key={idx} onClick={() => navigate(item.type === 'board' ? `/b/${item.id}` : `/w/${item.id}/dashboard`)} className="bg-card border border-border p-4 rounded-xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group flex flex-col justify-between h-28 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-10 transition-opacity bg-gradient-to-br from-primary to-orange-600"></div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground z-10">
                        {item.type === 'board' ? <LayoutDashboard size={14} className="text-blue-500" /> : <Briefcase size={14} className="text-purple-500" />}
                        {item.type === 'board' ? 'Bảng' : 'Không gian'}
                      </div>
                      <div className="z-10 mt-2">
                        <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">{item.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Workspace & Board gần đây */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Briefcase className="text-muted-foreground" size={20} />
                  Không gian của bạn
                </h2>
                {recentWorkspaces.length === 0 ? (
                  <div className="bg-card border border-border p-6 rounded-2xl text-center text-sm text-muted-foreground">
                    Bạn chưa tham gia Không gian làm việc nào. <br/>
                    Hãy liên hệ Admin hoặc tự <span className="text-primary font-medium cursor-pointer">Tạo Không gian</span>.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentWorkspaces.map((ws: any) => (
                      <div key={ws.id} onClick={() => navigate(`/w/${ws.id}/dashboard`)} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
                            {ws.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{ws.name}</h3>
                            <p className="text-xs text-muted-foreground">{ws.boards_count || 0} Bảng • {ws.members_count || 1} Thành viên</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Activity className="text-muted-foreground" size={20} />
                  Hoạt động gần đây
                </h2>
                {recentActivities.length === 0 ? (
                  <div className="bg-card border border-border p-6 rounded-2xl text-center text-sm text-muted-foreground">
                    Chưa có hoạt động nào được ghi nhận.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivities.slice(0,4).map((act: any) => (
                      <div key={act.id} className="flex gap-3 items-start p-3 bg-card border border-border rounded-xl shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-0.5 shrink-0">
                          <User size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-tight">
                            <span className="font-medium">Bạn</span> {act.action?.toLowerCase() || ''}
                          </p>
                          {act.task_title && <p className="text-sm font-semibold truncate mt-0.5 text-primary">{act.task_title}</p>}
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{act.created_at ? format(new Date(act.created_at.replace(' ', 'T')), 'HH:mm dd/MM') : ''}</span>
                            {act.board_name && <span>• {act.board_name}</span>}
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
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border/50 bg-orange-50/30 dark:bg-orange-950/10">
                <h3 className="font-bold flex items-center gap-2 text-orange-600 dark:text-orange-500">
                  <AlertTriangle size={18} /> Cần tôi chú ý
                </h3>
              </div>
              <div className="p-2">
                {attentionItems.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Tuyệt vời! Không có công việc nào bị trễ hoặc cần xử lý khẩn cấp.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {attentionItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <div className={`mt-0.5 shrink-0 ${item.type === 'overdue' ? 'text-red-500' : item.type === 'urgent' ? 'text-orange-500' : 'text-blue-500'}`}>
                          <AlertTriangle size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: item.type === 'overdue' ? '#ef4444' : item.type === 'urgent' ? '#f97316' : '#3b82f6' }}>
                            {item.message}
                          </p>
                          <p className="text-sm font-medium line-clamp-2">{item.task_title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lịch trình cá nhân */}
            <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <Calendar size={18} className="text-primary" /> Lịch trình hôm nay
              </h3>
              
              {todaySchedule.length === 0 ? (
                <div className="text-center p-4 border border-dashed border-border rounded-xl text-sm text-muted-foreground">
                  Trống lịch hôm nay
                </div>
              ) : (
                <div className="relative border-l-2 border-primary/20 ml-3 pl-4 space-y-6 pb-2 mt-6">
                  {todaySchedule.map((task: any, idx: number) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-card"></div>
                      <div className="text-xs font-bold text-primary mb-1">
                        {task.due_date ? format(new Date(task.due_date.replace(' ', 'T')), 'HH:mm') : ''}
                      </div>
                      <div className="bg-accent/50 p-3 rounded-xl">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{task.board_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System Admin Shortcut */}
            {user?.system_role === 'system_admin' && (
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <ShieldAlert className="absolute -right-4 -bottom-4 text-amber-500/10" size={100} />
                <div className="relative z-10">
                  <h3 className="font-bold text-amber-600 dark:text-amber-500 flex items-center gap-2 mb-2">
                    <ShieldAlert size={18} /> Quản lý hệ thống
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Khu vực dành riêng cho Quản trị viên. Tạo tài khoản nhân viên và phân quyền truy cập dự án.
                  </p>
                  <button onClick={() => navigate('/admin/employees')} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2">
                    <Users size={16} /> Quản lý nhân viên
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

// Temporary icon for layout rendering
function LayoutDashboard({ size, className }: { size: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1"/>
      <rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/>
      <rect width="7" height="5" x="3" y="16" rx="1"/>
    </svg>
  );
}
