import React, { useState, useRef, useEffect } from 'react';
import { User, Check, X, Search, UserPlus } from 'lucide-react';
import type { User as UserType } from '../../types';
import { getAvatarUrl } from '../../lib/avatar';

interface AssigneeSelectProps {
  boardUsers: UserType[];
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}

export const AssigneeSelect: React.FC<AssigneeSelectProps> = ({
  boardUsers,
  selectedUserIds,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUsers = boardUsers.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  const removeUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedUserIds.filter(id => id !== userId));
  };

  const selectedUsers = boardUsers.filter(u => selectedUserIds.includes(String(u.id)));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Selected Users Chips & Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[42px] p-2 bg-background border border-input rounded-xl flex flex-wrap items-center gap-1.5 cursor-pointer transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40 ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        {selectedUsers.length === 0 ? (
          <span className="text-sm text-muted-foreground flex items-center gap-2 px-1">
            <UserPlus size={16} className="text-muted-foreground" />
            Chọn người thực hiện...
          </span>
        ) : (
          selectedUsers.map(user => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold group/chip"
            >
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0">
                {user.avatar ? (
                  <img src={getAvatarUrl(user.avatar)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.initials || user.name?.charAt(0).toUpperCase() || 'U'
                )}
              </span>
              <span className="max-w-[120px] truncate">{user.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeUser(String(user.id), e)}
                  className="text-primary/70 hover:text-red-500 transition-colors rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full sm:w-80 bg-card border border-border/80 rounded-2xl shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="Tìm theo tên hoặc email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 custom-scrollbar pr-1">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">Không tìm thấy thành viên trong bảng</p>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedUserIds.includes(String(user.id));
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(String(user.id))}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground hover:bg-accent/80 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 shadow-xs">
                        {user.avatar ? (
                          <img src={getAvatarUrl(user.avatar)} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user.initials || user.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </span>
                      <div className="truncate">
                        <p className="truncate leading-tight">{user.name}</p>
                        {user.email && (
                          <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
