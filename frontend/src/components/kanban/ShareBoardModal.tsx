import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Copy, 
  Check, 
  Lock, 
  X, 
  Search, 
  UserPlus, 
  Shield, 
  User as UserIcon, 
  Loader2 
} from 'lucide-react';
import api from '../../lib/axios';
import { toast } from 'sonner';
import type { Board, User } from '../../types';
import { useBoardStore } from '../../store/boardStore';
import { copyToClipboard } from '../../lib/clipboard';
import { getAvatarUrl } from '../../lib/avatar';

interface ShareBoardModalProps {
  isOpen: boolean;
  board: Board;
  canManage: boolean;
  onClose: () => void;
}

export function ShareBoardModal({
  isOpen,
  board,
  canManage,
  onClose,
}: ShareBoardModalProps) {
  const fetchBoard = useBoardStore((state) => state.fetchBoard);
  const [copied, setCopied] = useState(false);

  // Search user state (for adding members)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin'>('member');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Canonical URL
  const publicCode = board.publicId || board.id;
  const canonicalPath = `/${publicCode}/kanban`;
  const canonicalUrl = `${window.location.origin}${canonicalPath}`;

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setCopied(false);
    }
  }, [isOpen]);

  // Debounced user search
  useEffect(() => {
    if (!canManage) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
        // Filter out users who are already in the board
        const existingMemberIds = new Set(board.users.map((u) => String(u.id)));
        const filtered = (res.data || []).filter(
          (u: any) => !existingMemberIds.has(String(u.id))
        );
        setSearchResults(filtered);
      } catch (e) {
        console.error('Failed to search users', e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, canManage, board.users]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(canonicalUrl);
    if (success) {
      setCopied(true);
      toast.success('Đã sao chép liên kết');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Không thể sao chép liên kết. Vui lòng sao chép thủ công.');
    }
  };

  const handleAddMember = async (userToAdd: User) => {
    setAddingUserId(String(userToAdd.id));
    try {
      const res = await api.post(`/boards/${board.id}/members`, {
        user_id: userToAdd.id,
        role: selectedRole,
      });

      toast.success(res.data?.message || `Đã thêm ${userToAdd.name} vào bảng`);
      // Clear from search results
      setSearchResults((prev) => prev.filter((u) => String(u.id) !== String(userToAdd.id)));
      // Refresh board in background so members list updates everywhere
      await fetchBoard(board.id, true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Có lỗi xảy ra khi thêm thành viên';
      toast.error(msg);
    } finally {
      setAddingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/80 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-board-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Share2 size={20} />
            </div>
            <div>
              <h3 id="share-board-title" className="font-bold text-[16px] text-foreground">
                Chia sẻ bảng công việc
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">
                {board.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* 1. Canonical Link & Copy */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Liên kết bảng (Canonical URL)
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono text-foreground overflow-hidden shadow-2xs">
                <Lock size={14} className="text-amber-500 shrink-0" />
                <span className="truncate select-all">{canonicalUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-[#5B4BD6] transition-all flex items-center gap-1.5 shadow-xs shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-white" />
                    Đã sao chép
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Sao chép link
                  </>
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
              <Lock size={12} className="text-amber-600 shrink-0" />
              <span>Chỉ thành viên thuộc bảng mới có quyền truy cập liên kết này.</span>
            </div>
          </div>

          {/* 2. Add Member Section (Admin / Owner Only) */}
          {canManage && (
            <div className="pt-2 border-t border-border/60">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Thêm thành viên vào bảng
              </label>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên, username hoặc email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
                  />
                  {isSearching && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>

                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'member' | 'admin')}
                  className="px-2.5 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-foreground cursor-pointer shadow-2xs"
                >
                  <option value="member">Thành viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>

              {/* Search results list */}
              {searchQuery.trim() && (
                <div className="bg-background border border-border rounded-xl p-2 max-h-44 overflow-y-auto custom-scrollbar space-y-1 shadow-inner">
                  {searchResults.length === 0 && !isSearching ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Không tìm thấy nhân viên phù hợp hoặc đã là thành viên.
                    </p>
                  ) : (
                    searchResults.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {u.avatar ? (
                              <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              u.name?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{u.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              @{u.username || u.email}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddMember(u)}
                          disabled={addingUserId === String(u.id)}
                          className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
                        >
                          {addingUserId === String(u.id) ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <UserPlus size={13} />
                          )}
                          Thêm
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Existing Members List */}
          <div className="pt-2 border-t border-border/60">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Thành viên hiện tại ({board.users?.length || 0})
            </label>

            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {(board.users || []).map((member) => {
                const isBoardOwner = String(board.owner_id) === String(member.id);
                const roleLabel = isBoardOwner 
                  ? 'Chủ sở hữu' 
                  : (member as any).role === 'admin' 
                    ? 'Quản trị viên' 
                    : 'Thành viên';

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-background border border-border/70 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {member.avatar ? (
                          <img src={getAvatarUrl(member.avatar)} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          member.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{member.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {member.email || (member.username ? `@${member.username}` : '')}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 flex items-center gap-1 ${
                        isBoardOwner
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : (member as any).role === 'admin'
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isBoardOwner ? <Shield size={11} /> : <UserIcon size={11} />}
                      {roleLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-end bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
