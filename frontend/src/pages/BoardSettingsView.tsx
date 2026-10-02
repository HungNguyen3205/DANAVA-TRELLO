import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBoardStore } from '../store/boardStore';
import { Settings, Info, Shield, Trash2, Users, Palette, Save } from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';

export function BoardSettingsView() {
  const { workspaceId, boardId } = useParams();
  const navigate = useNavigate();
  const { board, fetchBoard, loading } = useBoardStore();
  const user = useAuthStore(state => state.user);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: ''
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
        color: board.color || 'bg-gradient-to-br from-blue-500 to-cyan-400'
      });
    }
  }, [board]);

  // Determine if the current user has admin rights
  // The board's workspace.members holds all workspace members. We can check the current user's role.
  const isWorkspaceAdmin = board?.workspace?.members?.find((m: any) => m.id === user?.id)?.pivot?.role === 'admin';
  const canEdit = isWorkspaceAdmin;

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

    setIsSaving(true);
    try {
      await api.put(`/boards/${boardId}`, formData);
      toast.success('Lưu cài đặt thành công');
      fetchBoard(boardId as string); // Refresh data
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
      navigate(`/w/${workspaceId}/boards`);
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
            <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-semibold uppercase tracking-wider">
              Chỉ xem
            </span>
          )}
        </div>

        {/* Info Card */}
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
              <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center gap-2">
                <Palette size={16} className="text-muted-foreground" />
                Màu / Nền của bảng
              </label>
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

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Thuộc không gian: <Link to={`/w/${workspaceId}/dashboard`} className="font-semibold text-primary hover:underline">{board.workspace?.name || 'Đang tải...'}</Link>
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

        {/* Access Rights */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-foreground">Quyền truy cập</h2>
            </div>
            <Link to={`/w/${workspaceId}/b/${boardId}/members`} className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors">
              <Users size={16} /> Quản lý thành viên
            </Link>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Bảng này đang tuân theo phân quyền của <strong>Không gian làm việc</strong>. Chỉ Quản trị viên của Không gian làm việc mới có quyền thay đổi các cài đặt này. 
              Thành viên được mời vào bảng sẽ chỉ thấy bảng này và không tự động có quyền tạo/xem bảng khác.
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

        {/* Admin Actions */}
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

      </div>
    </div>
  );
}
