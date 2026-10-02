import React, { useState, useEffect } from 'react';
import { Search, LayoutDashboard, CheckSquare, Briefcase, Filter, ChevronRight, Clock, User, AlertCircle } from 'lucide-react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/axios';
import { format, isPast, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';

interface TaskResult {
  id: number;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  status: string;
  workspace: { id: number; name: string } | null;
  board: { id: number; title: string } | null;
  assignee: { id: number; name: string; avatar: string } | null;
}

interface BoardResult {
  id: number;
  title: string;
  description: string;
  workspace_id: number;
}

interface WorkspaceResult {
  id: number;
  name: string;
  description: string;
}

export const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialType = searchParams.get('type') || 'all';

  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [boards, setBoards] = useState<BoardResult[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceResult[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Sync URL params to local state if they change externally
    setQuery(searchParams.get('q') || '');
    setType(searchParams.get('type') || 'all');
  }, [searchParams]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length > 0) {
        performSearch(query, type);
      } else {
        setTasks([]);
        setBoards([]);
        setWorkspaces([]);
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query, type]);

  const performSearch = async (q: string, t: string) => {
    setLoading(true);
    setHasSearched(true);
    
    // Update URL without reloading
    const newParams = new URLSearchParams(searchParams);
    newParams.set('q', q);
    if (t !== 'all') newParams.set('type', t);
    else newParams.delete('type');
    setSearchParams(newParams, { replace: true });

    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q)}&type=${t}`);
      setTasks(res.data.tasks || []);
      setBoards(res.data.boards || []);
      setWorkspaces(res.data.workspaces || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to highlight matching text
  const highlightText = (text: string | null | undefined, highlight: string) => {
    if (!text) return null;
    if (!highlight.trim()) return <span>{text}</span>;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? 
            <span key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-200 font-medium px-0.5 rounded">{part}</span> : 
            part
        )}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-background flex flex-col">
      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 flex-1 flex flex-col">
        
        {/* Header & Search Input */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">Tìm kiếm</h1>
          
          <div className="relative w-full max-w-2xl group">
            <Search size={22} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${loading ? 'text-primary animate-pulse' : 'text-muted-foreground group-focus-within:text-primary'}`} />
            <input 
              type="text" 
              placeholder="Nhập từ khóa để tìm nhiệm vụ, bảng, không gian..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-base bg-card border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
              autoFocus
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        {query.trim().length > 0 && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar shrink-0">
            <Filter size={16} className="text-muted-foreground mr-2 shrink-0" />
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'tasks', label: 'Nhiệm vụ' },
              { id: 'boards', label: 'Bảng (Boards)' },
              { id: 'workspaces', label: 'Không gian (Workspaces)' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setType(f.id)}
                className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                  type === f.id 
                    ? 'bg-foreground text-background shadow-sm' 
                    : 'bg-card text-muted-foreground border border-border hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          {!hasSearched && query.trim().length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-2xl shadow-sm text-center mt-12">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                <Search size={32} className="text-primary opacity-60" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Bạn đang tìm gì?</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                Gõ từ khóa vào ô bên trên để tìm kiếm nhanh chóng. Chúng tôi hỗ trợ tìm theo tên hoặc mô tả của <b>Nhiệm vụ</b>, <b>Bảng (Board)</b> và <b>Không gian làm việc (Workspace)</b>.
              </p>
              <div className="flex items-center gap-6 mt-8 opacity-50">
                <div className="flex flex-col items-center gap-2"><CheckSquare size={24} /> <span className="text-xs font-medium">Nhiệm vụ</span></div>
                <div className="flex flex-col items-center gap-2"><LayoutDashboard size={24} /> <span className="text-xs font-medium">Bảng</span></div>
                <div className="flex flex-col items-center gap-2"><Briefcase size={24} /> <span className="text-xs font-medium">Không gian</span></div>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              
              {/* Tasks Results */}
              {(type === 'all' || type === 'tasks') && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center justify-between">
                    <span>Nhiệm vụ ({tasks.length})</span>
                  </h3>
                  {tasks.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground bg-card/50 border border-dashed border-border rounded-xl text-sm">
                      Không tìm thấy nhiệm vụ nào khớp với từ khóa "{query}"
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {tasks.map(task => {
                        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !task.completed_at;
                        const isCompleted = !!task.completed_at;

                        return (
                          <div 
                            key={task.id}
                            onClick={() => {
                              if (task.workspace && task.board) {
                                navigate(`/w/${task.workspace.id}/b/${task.board.id}/kanban?task=${task.id}`);
                              } else if (task.board) {
                                navigate(`/b/${task.board.id}?task=${task.id}`);
                              }
                            }}
                            className="group bg-card hover:bg-accent border border-border rounded-2xl p-4 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col sm:flex-row gap-4"
                          >
                            <div className="mt-1 shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                              <CheckSquare size={16} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-base font-semibold text-foreground mb-1.5 ${isCompleted ? 'line-through text-muted-foreground opacity-70' : ''}`}>
                                {highlightText(task.title, query)}
                              </h4>
                              
                              {task.description && (
                                <p className="text-[13px] text-muted-foreground mb-2.5 line-clamp-1 italic">
                                  {highlightText(task.description, query)}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                                {task.board && (
                                  <div className="flex items-center gap-1.5 font-medium text-foreground bg-muted px-2 py-0.5 rounded-md">
                                    <LayoutDashboard size={12} className="opacity-70" />
                                    <span className="truncate max-w-[150px]">{highlightText(task.board.title, query)}</span>
                                  </div>
                                )}
                                
                                {task.status && (
                                  <>
                                    <span className="hidden sm:inline opacity-50">•</span>
                                    <span className="truncate max-w-[100px]">{task.status}</span>
                                  </>
                                )}
                                
                                {task.due_date && (
                                  <>
                                    <span className="hidden sm:inline opacity-50">•</span>
                                    <div className={`flex items-center gap-1 font-medium ${
                                      isCompleted ? 'text-green-600' :
                                      isOverdue ? 'text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded' : ''
                                    }`}>
                                      <Clock size={12} />
                                      <span>{format(new Date(task.due_date), 'dd/MM/yyyy HH:mm')}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {task.assignee && (
                              <div className="flex items-center gap-2 shrink-0 sm:ml-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-border/50">
                                <span className="text-[11px] font-medium text-muted-foreground">Người nhận:</span>
                                <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg">
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-[9px] font-bold overflow-hidden shrink-0">
                                    {task.assignee.avatar ? (
                                      <img src={task.assignee.avatar.startsWith('http') ? task.assignee.avatar : `http://localhost:8000${task.assignee.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                      task.assignee.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <span className="text-xs font-medium text-foreground max-w-[80px] truncate">{task.assignee.name}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Boards Results */}
              {(type === 'all' || type === 'boards') && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center justify-between">
                    <span>Bảng ({boards.length})</span>
                  </h3>
                  {boards.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground bg-card/50 border border-dashed border-border rounded-xl text-sm">
                      Không tìm thấy Bảng nào khớp với từ khóa "{query}"
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {boards.map(board => (
                        <div 
                          key={board.id}
                          onClick={() => navigate(`/w/${board.workspace_id}/b/${board.id}/kanban`)}
                          className="group bg-card hover:bg-accent border border-border rounded-xl p-4 transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center gap-4"
                        >
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/10">
                            <LayoutDashboard size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-semibold text-foreground truncate">{highlightText(board.title, query)}</h4>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                              Đi tới Bảng <ChevronRight size={12} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Workspaces Results */}
              {(type === 'all' || type === 'workspaces') && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center justify-between">
                    <span>Không gian làm việc ({workspaces.length})</span>
                  </h3>
                  {workspaces.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground bg-card/50 border border-dashed border-border rounded-xl text-sm">
                      Không tìm thấy Không gian làm việc nào khớp với từ khóa "{query}"
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {workspaces.map(workspace => (
                        <div 
                          key={workspace.id}
                          onClick={() => navigate(`/w/${workspace.id}/dashboard`)}
                          className="group bg-card hover:bg-accent border border-border rounded-xl p-4 transition-all cursor-pointer shadow-sm hover:shadow-md flex items-start gap-4"
                        >
                          <div className="mt-1 w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/10">
                            <Briefcase size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-semibold text-foreground truncate">{highlightText(workspace.name, query)}</h4>
                            {workspace.description && (
                              <p className="text-[13px] text-muted-foreground mt-1.5 line-clamp-2">
                                {highlightText(workspace.description, query)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State when there is a search but 0 results across all */}
              {type === 'all' && tasks.length === 0 && boards.length === 0 && workspaces.length === 0 && (
                <div className="text-center p-12 bg-card border border-dashed border-border rounded-2xl">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={28} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Không tìm thấy kết quả nào</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    Chúng tôi không thể tìm thấy bất kỳ nội dung nào khớp với "{query}". Vui lòng kiểm tra lại lỗi chính tả hoặc thử một từ khóa khác.
                  </p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
