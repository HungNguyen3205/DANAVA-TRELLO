import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Users, Search, Filter, Shield, ShieldAlert,
  MoreVertical, UserMinus, Eye, LayoutDashboard, ChevronRight, UserPlus
} from 'lucide-react';
import api from '../lib/axios';
import { toast } from 'sonner';
import type { Board } from '../types';

export function BoardMembersView() {
  const { workspaceId, boardId } = useParams();
  const [members, setMembers] = useState<any[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const bId = boardId?.replace('board-', '') || '1';
      const [boardRes, membersRes] = await Promise.all([
        api.get(`/boards/${bId}`),
        api.get(`/workspaces/${workspaceId}/boards/${bId}/members`)
      ]);
      setBoard(boardRes.data);
      setMembers(membersRes.data);
    } catch (e) {
      toast.error('Lỗi khi tải thành viên bảng');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, boardId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleUpdateRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const bId = boardId?.replace('board-', '') || '1';
    
    // Optimistic update
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m));
    
    try {
      await api.patch(`/workspaces/${workspaceId}/boards/${bId}/members/${userId}`, { role: newRole });
      toast.success('Đã cập nhật vai trò');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi cập nhật vai trò');
      fetchMembers(); // rollback
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn gỡ thành viên này khỏi bảng?')) return;
    
    const bId = boardId?.replace('board-', '') || '1';
    try {
      await api.delete(`/workspaces/${workspaceId}/boards/${bId}/members/${userId}`);
      toast.success('Đã gỡ thành viên khỏi bảng');
      fetchMembers();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi khi gỡ thành viên');
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-hidden h-full flex flex-col relative bg-background">
      <header className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between shrink-0 bg-transparent relative z-10 border-b border-border/50 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium mb-1">
            <Link to={`/w/${workspaceId}/boards`} className="hover:text-primary transition-colors flex items-center gap-1.5">
              <LayoutDashboard size={14} /> Không gian làm việc
            </Link>
            <ChevronRight size={14} className="opacity-50" />
            <Link to={`/w/${workspaceId}/b/${boardId}/kanban`} className="hover:text-primary transition-colors">
              {board?.title || board?.name || 'Bảng'}
            </Link>
            <ChevronRight size={14} className="opacity-50" />
            <span className="text-foreground font-semibold">Thành viên bảng</span>
          </div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users size={24} className="text-primary" /> Thành viên bảng
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý những thành viên có quyền truy cập và làm việc trong bảng này.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Tìm kiếm thành viên..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9 pr-3 py-2 text-[13px] bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-[#5B4BD6] rounded-xl transition-all shadow-sm"
          >
            <UserPlus size={16} />
            Thêm thành viên vào bảng
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 bg-background">
        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground animate-pulse">Đang tải...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-xl border border-border shadow-sm">
            <Users size={48} className="mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Chưa có thành viên trong bảng</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Hãy thêm thành viên từ Không gian làm việc để bắt đầu phân công công việc.
            </p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary hover:bg-[#5B4BD6] rounded-xl transition-all shadow-sm"
            >
              <UserPlus size={16} /> Thêm thành viên
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-6 py-3">Thành viên</th>
                  <th className="px-6 py-3">Vai trò</th>
                  <th className="px-6 py-3">Ngày tham gia</th>
                  <th className="px-6 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden">
                        {member.avatar ? <img src={member.avatar.startsWith('http') ? member.avatar : `http://localhost:8000${member.avatar}`} alt="avatar" className="w-full h-full object-cover" /> : member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{member.name}</div>
                        <div className="text-xs text-muted-foreground">@{member.username}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${member.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                        {member.role === 'admin' ? <ShieldAlert size={12} /> : <Shield size={12} />}
                        {member.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(member.joined_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleUpdateRole(member.id, member.role)}
                          className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"
                          title="Đổi vai trò"
                        >
                          <Shield size={16} />
                        </button>
                        <button 
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Gỡ khỏi bảng"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddBoardMemberModal 
          workspaceId={workspaceId!}
          boardId={boardId!}
          onClose={() => setShowAddModal(false)}
          onAdded={fetchMembers}
        />
      )}
    </div>
  );
}

function AddBoardMemberModal({ workspaceId, boardId, onClose, onAdded }: { workspaceId: string, boardId: string, onClose: () => void, onAdded: () => void }) {
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/workspaces/${workspaceId}/members`)
      .then(res => setWorkspaceMembers(res.data))
      .finally(() => setIsLoading(false));
  }, [workspaceId]);

  const handleAdd = async (userId: string) => {
    setIsSubmitting(true);
    try {
      const bId = boardId?.replace('board-', '') || '1';
      await api.post(`/workspaces/${workspaceId}/boards/${bId}/members`, {
        user_id: userId,
        role: selectedRole
      });
      toast.success("Đã thêm thành viên");
      onAdded();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Lỗi khi thêm thành viên");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = workspaceMembers.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Thêm thành viên vào bảng</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-md">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Tìm kiếm thành viên Không gian..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <select 
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="py-2 px-3 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="member">Thành viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center p-4 text-sm text-muted-foreground">Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center p-4 text-sm text-muted-foreground">
                Không tìm thấy thành viên Workspace nào khớp.
              </div>
            ) : (
              filtered.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-muted/20 border border-transparent hover:border-border rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">@{m.username}</div>
                    </div>
                  </div>
                  <button 
                    disabled={isSubmitting}
                    onClick={() => handleAdd(m.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                  >
                    Thêm
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
