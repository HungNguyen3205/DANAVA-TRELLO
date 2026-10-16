import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Shield, User, X, Search, ChevronRight } from 'lucide-react';
import type { User as UserType } from '../../types';
import { getAvatarUrl } from '../../lib/avatar';

interface BoardMembersHeaderProps {
  users: UserType[];
  basePath: string;
}

export function BoardMembersHeader({ users = [], basePath }: BoardMembersHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const maxVisible = 6;
  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = Math.max(0, users.length - maxVisible);

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      (u as any).role?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="relative flex items-center" ref={popoverRef}>
      {/* Avatars Stack Trigger */}
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center -space-x-2 mr-2 cursor-pointer group p-1 -m-1 rounded-full hover:bg-muted/50 transition-colors"
        title="Xem tất cả thành viên trong bảng"
      >
        {visibleUsers.map((u, i) => (
          <div
            key={u.id || i}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-primary border-2 border-background flex items-center justify-center text-[10px] sm:text-[11px] font-bold z-10 relative shadow-sm text-white overflow-hidden transition-transform duration-200 group-hover:scale-105"
            style={{ zIndex: 10 + i }}
            title={`${u.name || 'Thành viên'} (${(u as any).role === 'admin' ? 'Quản trị viên' : 'Thành viên'})`}
          >
            {u.avatar ? (
              <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
            ) : (
              u.initials || (u.name ? u.name.charAt(0).toUpperCase() : 'U')
            )}
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[11px] font-bold z-20 relative shadow-sm text-primary transition-transform duration-200 group-hover:scale-105"
            title={`Còn ${remainingCount} thành viên khác`}
          >
            +{remainingCount}
          </div>
        )}

        {users.length === 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/40">
            <Users size={14} />
            <span>0 thành viên</span>
          </div>
        )}
      </div>

      {/* Quick Invite Button */}
      <Link
        to={`${basePath}/members`}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all shadow-sm"
        title="Mời hoặc quản lý thành viên bảng"
      >
        <UserPlus size={14} />
      </Link>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2.5 w-80 sm:w-88 bg-card border border-border/80 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Users size={15} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Thành viên bảng</h4>
                <p className="text-[11px] text-muted-foreground">{users.length} thành viên tham gia bảng này</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search if more than 3 members */}
          {users.length > 3 && (
            <div className="mt-3 relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm thành viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          )}

          {/* Members List */}
          <div className="mt-3 space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
            {filteredUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Không tìm thấy thành viên phù hợp
              </div>
            ) : (
              filteredUsers.map((u, i) => {
                const isAdmin = (u as any).role === 'admin';
                return (
                  <div
                    key={u.id || i}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-border/40 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden shadow-xs">
                        {u.avatar ? (
                          <img src={getAvatarUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          u.initials || (u.name ? u.name.charAt(0).toUpperCase() : 'U')
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                          {u.name || 'Người dùng'}
                        </p>
                        {u.email && (
                          <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                            {u.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          <Shield size={10} /> Quản trị viên
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          <User size={10} /> Thành viên
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Manage Link */}
          <div className="mt-3 pt-3 border-t border-border/60">
            <Link
              to={`${basePath}/members`}
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all shadow-xs"
            >
              <UserPlus size={14} />
              Quản lý và mời thành viên
              <ChevronRight size={14} className="ml-auto" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
