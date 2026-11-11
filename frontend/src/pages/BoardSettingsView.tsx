import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useBoardStore } from '../store/boardStore';
import { Settings, Info, Shield, Trash2, Users, Palette, Save, Send, Briefcase, Columns } from 'lucide-react';
import { PROJECT_STATUS_OPTIONS, type BoardType } from '../lib/boardType';
import api from '../lib/axios';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { useBoardRoute } from '../components/layout/BoardRouteContext';
import { BoardTelegramSettings } from '../components/board/BoardTelegramSettings';
import { BoardBackgroundUploader } from '../components/board/BoardBackgroundUploader';

const BOARD_TYPE_OPTIONS: { value: BoardType; title: string; desc: string }[] = [
  { value: 'task', title: 'Bảng công việc', desc: 'Giao diện đơn giản, chỉ gồm các tính năng cơ bản.' },
  { value: 'project', title: 'Dự án', desc: 'Thêm thời hạn, trạng thái, người quản lý, ngân sách, chấm điểm hiệu suất và tổng kết.' },
];

export function BoardSettingsView() {
  const { boardId, basePath, setBoardType } = useBoardRoute();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { board, fetchBoard, loading } = useBoardStore();
  const user = useAuthStore(state => state.user);

  const activeTab = searchParams.get('tab') || 'general';
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '',
    type: 'task' as BoardType,
    project_status: 'planning',
    start_date: '',
    end_date: '',
    manager_id: '',
    budget: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (boardId) {
      fetchBoard(boardId);
    }
  }, [boardId, fetchBoard]);

  useEffect(() => {
    if (board) {
      setFormData({
        name: board.name || '',
        description: board.description || '',
        color: board.color || 'bg-gradient-to-br from-blue-500 to-cyan-400',
        type: board.type === 'project' ? 'project' : 'task',
        project_status: board.project_status || 'planning',
        start_date: board.start_date || '',
        end_date: board.end_date || '',
        manager_id: board.manager_id || '',
        budget: board.budget !== null && board.budget !== undefined ? String(Number(board.budget)) : '',
      });
    }
  }, [board]);

  // Board-first permission: Owner or Board Admin
  const isBoardOwner = !!(board?.owner_id && user?.id && String(board.owner_id) === String(user.id));
  const isBoardAdmin = !!(board as any)?.members?.find((m: any) => String(m.id) === String(user?.id))?.pivot?.role === 'admin';
  const isWorkspaceAdmin = !!board?.workspace?.members?.find((m: any) => m.id === user?.id)?.pivot?.role === 'admin';
  const canEdit = isBoardOwner || isBoardAdmin || isWorkspaceAdmin;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('Bạn không có quyền chỉnh sửa cài đặt bảng này');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Tên bảng không được để trống');
      return;
    }

    const isProject = formData.type === 'project';
    if (isProject && formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      toast.error('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu');
      return;
    }

    if (board?.type === 'project' && !isProject && !window.confirm(
      'Chuyển về Bảng công việc sẽ ẩn các mục Điểm hiệu suất, Nội quy hiệu suất và Tổng kết dự án. Dữ liệu vẫn được giữ lại và sẽ hiện lại nếu bạn chuyển về Dự án. Tiếp tục?'
    )) {
      return;
    }

    const payload: Record<string, unknown> = {
      name: formData.name,
      description: formData.description,
      color: formData.color,
      type: formData.type,
    };
    if (isProject) {
      payload.project_status = formData.project_status || null;
      payload.start_date = formData.start_date || null;
      payload.end_date = formData.end_date || null;
      payload.manager_id = formData.manager_id ? Number(formData.manager_id) : null;
      payload.budget = formData.budget !== '' ? Number(formData.budget) : null;
    }

    setIsSaving(true);
    try {
      await api.put(`/boards/${boardId}`, payload);
      toast.success('Lưu cài đặt thành công');
      setBoardType(formData.type);
      fetchBoard(boardId as string, true); // Refresh data
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Lỗi khi lưu cài đặt bảng');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) {
      toast.error('Bạn không có quyền xóa bảng này');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa bảng này không? Hành động này không thể hoàn tác!')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/boards/${boardId}`);
      toast.success('Xóa bảng thành công');
      navigate('/boards');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Lỗi khi xóa bảng');
      setIsDeleting(false);
    }
  };

  if (loading || !board) {
    return <div className="flex-1 flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const colorOptions = [
    { value: 'bg-gradient-to-br from-blue-500 to-cyan-400', label: 'Blue Cyan' },
    { value: 'bg-gradient-to-br from-indigo-500 to-purple-500', label: 'Indigo Purple' },
    { value: 'bg-gradient-to-br from-rose-400 to-red-500', label: 'Rose Red' },
    { value: 'bg-gradient-to-br from-emerald-400 to-teal-500', label: 'Emerald Teal' },
    { value: 'bg-gradient-to-br from-amber-400 to-orange-500', label: 'Amber Orange' },
    { value: 'bg-gradient-to-br from-slate-700 to-slate-900', label: 'Dark Slate' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background/50">
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8 pb-20 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Settings className="text-primary" size={24} />
              Cài đặt bảng: {board.name}
            </h1>
            <p className="text-muted-foreground mt-1">Quản lý các cấu hình và quyền hạn của bảng này.</p>
          </div>
          {!canEdit && (
            <span className="whitespace-nowrap px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-semibold uppercase tracking-wider">
              Chỉ xem
            </span>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'general'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Info size={15} />
            <span>Cài đặt chung</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'telegram'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Send size={15} />
            <span>Tích hợp Telegram</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'access'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Shield size={15} />
            <span>Quyền truy cập</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-muted text-foreground font-extrabold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <span>Xem tất cả</span>
          </button>
        </div>

        {/* 1. Info Card (General) */}
        {(activeTab === 'general' || activeTab === 'all') && (
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2 bg-muted/30">
              <Info size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-foreground">Thông tin bảng</h2>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Tên bảng <span className="text-destructive">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!canEdit}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60"
                  placeholder="Nhập tên bảng..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Mô tả ngắn</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60 resize-none"
                  placeholder="Thêm mô tả để các thành viên hiểu mục tiêu của bảng này..."
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-foreground mb-2">Loại bảng</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BOARD_TYPE_OPTIONS.map((opt) => {
                    const selected = formData.type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={selected}
                        onClick={() => setFormData(prev => ({ ...prev, type: opt.value }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60 ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                          <span className={selected ? 'text-primary' : 'text-muted-foreground'}>
                            {opt.value === 'project' ? <Briefcase size={18} /> : <Columns size={18} />}
                          </span>
                          {opt.title}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.type === 'project' && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Briefcase size={16} className="text-primary" /> Thông tin dự án
                  </div>
                  <div>
                    <label htmlFor="project-status" className="block text-xs font-semibold text-muted-foreground mb-1">Trạng thái</label>
                    <select
                      id="project-status"
                      value={formData.project_status}
                      disabled={!canEdit}
                      onChange={(e) => setFormData(prev => ({ ...prev, project_status: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm disabled:opacity-60"
                    >
                      {PROJECT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="project-manager" className="block text-xs font-semibold text-muted-foreground mb-1">Người quản lý dự án</label>
                    <select
                      id="project-manager"
                      value={formData.manager_id}
                      disabled={!canEdit}
                      onChange={(e) => setFormData(prev => ({ ...prev, manager_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm disabled:opacity-60"
                    >
                      <option value="">— Chưa chọn —</option>
                      {board.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="project-start" className="block text-xs font-semibold text-muted-foreground mb-1">Ngày bắt đầu</label>
                    <input
                      id="project-start"
                      type="date"
                      value={formData.start_date}
                      disabled={!canEdit}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label htmlFor="project-end" className="block text-xs font-semibold text-muted-foreground mb-1">Hạn hoàn thành</label>
                    <input
                      id="project-end"
                      type="date"
                      value={formData.end_date}
                      min={formData.start_date || undefined}
                      disabled={!canEdit}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="project-budget" className="block text-xs font-semibold text-muted-foreground mb-1">Ngân sách dự kiến (VNĐ)</label>
                    <input
                      id="project-budget"
                      type="number"
                      min={0}
                      step={1000}
                      inputMode="numeric"
                      value={formData.budget}
                      disabled={!canEdit}
                      onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                      placeholder="Không bắt buộc"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-semibold text-foreground mb-2 flex flex-row items-center gap-2">
                  <Palette size={16} className="text-muted-foreground" />
                  Màu / Nền của bảng
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setFormData(prev => ({ ...prev, color: opt.value }))}
                      className={`h-16 rounded-xl border-2 transition-all flex items-center justify-center ${opt.value} ${formData.color === opt.value ? 'border-foreground shadow-md scale-[1.02]' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-[1.02] disabled:hover:scale-100 disabled:hover:opacity-80'}`}
                    >
                      {formData.color === opt.value && (
                        <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                          <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <BoardBackgroundUploader
                boardId={board.id}
                image={board.background_image}
                canEdit={canEdit}
                onChange={() => fetchBoard(boardId as string, true)}
              />

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Chủ sở hữu bảng: <span className="font-semibold text-foreground">{board.owner?.name || 'Quản trị viên'}</span>
                </div>
                
                {canEdit && (
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-70 shadow-sm"
                  >
                    {isSaving ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> : <Save size={18} />}
                    Lưu thay đổi
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* 2. Telegram Integration Card */}
        {(activeTab === 'telegram' || activeTab === 'all') && (
          <BoardTelegramSettings
            boardId={board.id}
            boardName={board.name}
          />
        )}

        {/* 3. Access Rights & Danger Zone */}
        {(activeTab === 'access' || activeTab === 'all') && (
          <>
            <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Quyền truy cập</h2>
                </div>
                <Link to={`${basePath}/members`} className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors">
                  <Users size={16} /> Quản lý thành viên
                </Link>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Bảng này hoạt động theo mô hình độc lập. Chỉ những thành viên được mời trực tiếp vào bảng mới có quyền truy cập. 
                  Quản trị viên bảng có toàn quyền thay đổi cài đặt và quản lý thành viên.
                </p>
                
                <div className="p-4 bg-muted/30 rounded-xl border border-border">
                  <h4 className="font-semibold text-sm mb-1">Cấp quyền hiện tại:</h4>
                  <ul className="text-sm space-y-2 mt-3 text-muted-foreground list-disc list-inside">
                    <li><strong>Quản trị viên:</strong> Có quyền thay đổi tên, màu sắc, xóa bảng, và thêm/xóa thành viên.</li>
                    <li><strong>Thành viên:</strong> Có thể tạo, sửa, xóa, và di chuyển nhiệm vụ trong bảng.</li>
                  </ul>
                </div>
              </div>
            </section>

            {canEdit && (
              <section className="bg-card rounded-2xl border border-destructive/20 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-destructive/10 flex items-center gap-2 bg-destructive/5">
                  <Trash2 size={18} className="text-destructive" />
                  <h2 className="text-lg font-bold text-destructive">Khu vực nguy hiểm</h2>
                </div>
                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Các hành động dưới đây không thể hoàn tác. Vui lòng cân nhắc kỹ trước khi thực hiện.
                  </p>
                  
                  <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">Xóa bảng vĩnh viễn</h4>
                      <p className="text-xs text-muted-foreground mt-1">Xóa toàn bộ nhiệm vụ, cột và dữ liệu liên quan. Hành động này không thể phục hồi.</p>
                    </div>
                    <button 
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? 'Đang xóa...' : 'Xóa bảng'}
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

      </div>
    </div>
  );
}
