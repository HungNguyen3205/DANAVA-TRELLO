import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Grid, ChevronDown, LogOut, Sun, Moon, Briefcase, Clock, Star, Plus, User, Settings, LayoutTemplate, LayoutDashboard, Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import api from '../../lib/axios';
import { getPersonalDashboard } from '../../lib/personalDashboard';

export function AppLayout() {
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);
  
  const toggleMobileSidebar = useUIStore(state => state.toggleMobileSidebar);
  const isDarkMode = useUIStore(state => state.isDarkMode);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  
  const navigate = useNavigate();

  // Dropdown states
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [searchOpenMobile, setSearchOpenMobile] = useState(false);

  // Data for workspaces
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [starredBoards, setStarredBoards] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for click outside
  const wsRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await getPersonalDashboard();
      if (data) {
        setWorkspaces(data.recent_workspaces || []);
        setBoards(data.recent_boards || []);
        setStarredBoards(data.starred_boards || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wsRef.current && !wsRef.current.contains(event.target as Node)) setWsDropdownOpen(false);
      if (createRef.current && !createRef.current.contains(event.target as Node)) setCreateDropdownOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) setAvatarMenuOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setWsDropdownOpen(false);
        setCreateDropdownOpen(false);
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const filteredWorkspaces = workspaces.filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredBoards = boards.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredStarredBoards = starredBoards.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Top Navigation */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-3 md:px-4 z-[50] shrink-0 shadow-sm relative">
        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          <button 
            className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors shrink-0 md:hidden"
            onClick={toggleMobileSidebar}
          >
            <Menu size={18} />
          </button>
          <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors shrink-0 hidden md:block">
            <Grid size={18} />
          </button>
          
          <Link to="/home" className="flex items-center gap-2 cursor-pointer shrink-0 mr-1 md:mr-3">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold shrink-0 text-sm">
              D
            </div>
            <h1 className="text-base md:text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent whitespace-nowrap hidden sm:block">
              DANAVA WORK
            </h1>
          </Link>

          {/* Workspaces Dropdown */}
          <div className="relative" ref={wsRef}>
            <button 
              onClick={() => {
                if (!wsDropdownOpen) fetchData(); // Refresh when opening
                setWsDropdownOpen(!wsDropdownOpen);
              }}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap text-sm font-medium ${wsDropdownOpen ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              Không gian <span className="hidden md:inline">làm việc</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${wsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {wsDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 md:w-80 bg-card border border-border rounded-xl shadow-xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 max-h-[80vh] flex flex-col">
                <div className="p-3 border-b border-border/50">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Tìm không gian, bảng..." 
                      className="w-full h-8 pl-8 pr-3 text-sm bg-accent/50 rounded-md border-transparent focus:border-primary/50 focus:bg-background transition-all outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar p-2 flex-1">
                  {/* My Workspaces */}
                  <div className="mb-4">
                    <h3 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Briefcase size={12} /> Không gian của tôi
                    </h3>
                    {filteredWorkspaces.length > 0 ? (
                      <div className="space-y-0.5">
                        {filteredWorkspaces.map(ws => (
                          <button key={ws.id} onClick={() => { navigate(`/w/${ws.id}/dashboard`); setWsDropdownOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-accent rounded-lg text-left group">
                            <div className="w-7 h-7 rounded bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {ws.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium truncate flex-1 group-hover:text-primary transition-colors">{ws.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : <div className="px-2 py-1 text-xs text-muted-foreground">Không tìm thấy</div>}
                  </div>

                  {/* Recent Boards */}
                  <div className="mb-4">
                    <h3 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock size={12} /> Bảng gần đây
                    </h3>
                    {filteredBoards.length > 0 ? (
                      <div className="space-y-0.5">
                        {filteredBoards.map(b => (
                          <button key={b.id} onClick={() => { navigate(`/b/${b.id}`); setWsDropdownOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-accent rounded-lg text-left group">
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-white text-xs shrink-0 ${b.color || 'bg-blue-500'}`}>
                              <LayoutDashboard size={14} />
                            </div>
                            <span className="text-sm font-medium truncate flex-1 group-hover:text-primary transition-colors">{b.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : <div className="px-2 py-1 text-xs text-muted-foreground">Không có bảng nào</div>}
                  </div>
                  
                  {/* Starred */}
                  <div>
                    <h3 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Star size={12} /> Đã đánh dấu sao
                    </h3>
                    {filteredStarredBoards.length > 0 ? (
                      <div className="space-y-0.5">
                        {filteredStarredBoards.map(b => (
                          <button key={b.id} onClick={() => { navigate(`/b/${b.id}`); setWsDropdownOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-accent rounded-lg text-left group">
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-white text-xs shrink-0 ${b.color || 'bg-blue-500'}`}>
                              <LayoutDashboard size={14} />
                            </div>
                            <span className="text-sm font-medium truncate flex-1 group-hover:text-primary transition-colors">{b.name}</span>
                            <Star size={14} className="text-yellow-400 fill-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-xs text-muted-foreground italic text-center bg-accent/30 rounded-lg border border-dashed border-border/50">
                        Chưa có mục nào được gắn sao
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-2 border-t border-border/50">
                  <button onClick={() => { navigate('/workspaces'); setWsDropdownOpen(false); }} className="w-full text-center text-sm text-primary hover:bg-primary/10 py-1.5 rounded-md font-medium transition-colors">
                    Xem tất cả không gian
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Global Search - Hidden on mobile unless toggled */}
          <div className="relative hidden md:block w-48 lg:w-64 ml-1">
            <Search className="absolute left-2.5 top-[7px] h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  setSearchQuery('');
                  setSearchOpenMobile(false);
                }
              }}
              className="h-[30px] w-full rounded-md border border-input bg-background/50 pl-8 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>

          {/* Create New Dropdown */}
          <div className="relative ml-1" ref={createRef}>
            <button 
              onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
              className="bg-primary/10 text-primary hover:bg-primary/20 px-2 md:px-3 py-1.5 rounded-md transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">Tạo mới</span>
              <Plus size={16} className="sm:hidden" />
              <ChevronDown size={14} className={`hidden sm:block transition-transform duration-200 ${createDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {createDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 py-1.5">
                <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left group">
                  <LayoutDashboard size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Tạo bảng mới</div>
                    <div className="text-[11px] text-muted-foreground">Bảng trắng với các cột tùy chỉnh</div>
                  </div>
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left group">
                  <LayoutTemplate size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Tạo từ mẫu</div>
                    <div className="text-[11px] text-muted-foreground">Bắt đầu nhanh với mẫu có sẵn</div>
                  </div>
                </button>
                <div className="my-1 h-px bg-border/50" />
                <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left group">
                  <Briefcase size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Tạo Không gian</div>
                    <div className="text-[11px] text-muted-foreground">Nhóm các bảng và thành viên</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0 relative">
          <button 
            onClick={() => setSearchOpenMobile(!searchOpenMobile)}
            className="md:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors"
          >
            <Search size={18} />
          </button>

          {/* Mobile Search Input Overlay */}
          {searchOpenMobile && (
            <div className="absolute top-[48px] right-0 w-64 p-2 bg-card border border-border rounded-xl shadow-xl z-50 md:hidden">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery('');
                    setSearchOpenMobile(false);
                  }
                }}
                autoFocus
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          )}
          
          <NotificationBell />

          {/* Avatar Dropdown Menu */}
          <div className="relative flex items-center" ref={avatarRef}>
            <button 
              onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-primary flex items-center justify-center text-primary-foreground font-medium text-sm shadow-sm border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-transform hover:scale-105 overflow-hidden"
            >
              {user?.avatar ? (
                <img src={user.avatar.startsWith('http') ? user.avatar : `http://localhost:8000${user.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name ? user.name.charAt(0).toUpperCase() : 'U'
              )}
            </button>

            {avatarMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-200 py-2 overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                <div className="px-4 py-3 border-b border-border/50 mb-1 flex items-center gap-3 bg-accent/30">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-primary flex items-center justify-center text-primary-foreground font-medium text-lg shadow-inner shrink-0 overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar.startsWith('http') ? user.avatar : `http://localhost:8000${user.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user?.name ? user.name.charAt(0).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{user?.name || 'Người dùng'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email || 'email@example.com'}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setAvatarMenuOpen(false); navigate('/profile'); }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-accent/80 text-left text-sm text-foreground transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center group-hover:bg-background transition-colors shrink-0">
                    <User size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="font-medium group-hover:text-primary transition-colors">Thông tin cá nhân</span>
                </button>
                
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-accent/80 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center group-hover:bg-background transition-colors shrink-0">
                      {isDarkMode ? <Moon size={15} className="text-muted-foreground group-hover:text-primary transition-colors" /> : <Sun size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />}
                    </div>
                    <span className="font-medium group-hover:text-primary transition-colors">Giao diện</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                </div>
                
                <div className="my-1.5 mx-3 h-px bg-border/80" />
                
                <button 
                  onClick={() => { setAvatarMenuOpen(false); logout(); }} 
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-destructive/10 text-left text-sm text-destructive transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                    <LogOut size={15} className="group-hover:text-destructive text-destructive/70 transition-colors" />
                  </div>
                  <span className="font-medium">Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden bg-background relative flex flex-col z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
