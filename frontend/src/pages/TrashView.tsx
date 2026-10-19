import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Trash2, RotateCcw, AlertTriangle, Search, ArrowLeft, 
  Paperclip, Columns, CheckSquare, RefreshCw, X, Loader2, 
  FolderKanban, CornerDownRight, Clock, User, ShieldAlert,
  Info, CheckCircle2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  getTrashItems, restoreTrashItem, forceDeleteTrashItem, 
  type TrashItem, type TrashCounts, type ActiveColumn, type TrashItemType 
} from '../lib/api/trash';
import { useAuthStore } from '../store/authStore';

export function TrashView() {
  const { boardCode } = useParams<{ boardCode?: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);

  const [items, setItems] = useState<TrashItem[]>([]);
  const [counts, setCounts] = useState<TrashCounts>({
    all: 0,
    board: 0,
    column: 0,
    task: 0,
    attachment: 0,
  });
  const [availableColumns, setAvailableColumns] = useState<ActiveColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'board' | 'column' | 'task' | 'attachment'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [forceDeleteItem, setForceDeleteItem] = useState<TrashItem | null>(null);
  const [restoreTaskModalItem, setRestoreTaskModalItem] = useState<{
    item: TrashItem;
    columns: ActiveColumn[];
  } | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch trash items
  const loadTrash = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const params: { board_id?: string; type?: string; search?: string } = {};
      if (boardCode) {
        params.board_id = boardCode;
      }
      if (activeTab !== 'all') {
        params.type = activeTab;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await getTrashItems(params);
      setItems(res.data);
      setCounts(res.counts);
      setAvailableColumns(res.available_columns || []);
    } catch (err: any) {
      console.error('Failed to load trash items', err);
      const msg = err.response?.data?.message || 'Không thể tải danh sách thùng rác.';
      setError(msg);
      if (err.response?.status === 403) {
        toast.error('Bạn không có quyền quản trị để truy cập thùng rác.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [boardCode, activeTab, searchQuery]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  // Handle Restore
  const handleRestore = async (item: TrashItem, targetColumnId?: number) => {
    // If it's a task and its original column is deleted, prompt target column modal if not provided
    if (item.type === 'task' && item.is_column_deleted && !targetColumnId) {
      setRestoreTaskModalItem({
        item,
        columns: availableColumns,
      });
      return;
    }

    const actionKey = `restore-${item.type}-${item.id}`;
    setActionLoadingId(actionKey);

    try {
      const res = await restoreTrashItem(item.type, item.id, targetColumnId);

      if (res.require_target_column) {
        // Backend indicated target column is mandatory
        setRestoreTaskModalItem({
          item,
          columns: res.available_columns || availableColumns,
        });
        return;
      }

      toast.success(res.message || `Đã khôi phục ${getTypeLabel(item.type)} thành công.`);
      setRestoreTaskModalItem(null);
      await loadTrash(true);
    } catch (err: any) {
      console.error('Restore error', err);
      if (err.response?.data?.require_target_column) {
        setRestoreTaskModalItem({
          item,
          columns: err.response.data.available_columns || availableColumns,
        });
      } else {
        const msg = err.response?.data?.message || 'Không thể khôi phục đối tượng.';
        toast.error(msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Force Delete
  const handleForceDeleteConfirm = async (confirmName: string) => {
    if (!forceDeleteItem) return;

    const actionKey = `force-${forceDeleteItem.type}-${forceDeleteItem.id}`;
    setActionLoadingId(actionKey);

    try {
      const res = await forceDeleteTrashItem(forceDeleteItem.type, forceDeleteItem.id, confirmName);
      toast.success(res.message || 'Đã xóa vĩnh viễn đối tượng.');
      setForceDeleteItem(null);
      await loadTrash(true);
    } catch (err: any) {
      console.error('Force delete error', err);
      const msg = err.response?.data?.message || 'Lỗi khi xóa vĩnh viễn.';
      toast.error(msg);
      throw err; // allow modal to show error
    } finally {
      setActionLoadingId(null);
    }
  };

  const getTypeLabel = (type: TrashItemType) => {
    switch (type) {
      case 'board': return 'Bảng';
      case 'column': return 'Cột';
      case 'task': return 'Công việc';
      case 'attachment': return 'Tệp đính kèm';
      default: return 'Đối tượng';
    }
  };

  const formatDeletedDate = (isoString: string | null) => {
    if (!isoString) return 'Chưa rõ';
    try {
      const date = new Date(isoString);
      const relative = formatDistanceToNow(date, { addSuffix: true, locale: vi });
      const full = format(date, 'dd/MM/yyyy HH:mm');
      return { relative, full };
    } catch {
      return { relative: isoString, full: isoString };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Header */}
      <div className="border-b border-border bg-card/60 backdrop-blur-md px-6 py-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {boardCode ? (
                <Link
                  to={`/${boardCode}/kanban`}
                  className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft size={16} /> Quay lại bảng
                </Link>
              ) : (
                <Link
                  to="/boards"
                  className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft size={16} /> Danh sách bảng
                </Link>
              )}
              <span>/</span>
              <span className="font-semibold text-foreground">Thùng rác</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                <Trash2 size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Thùng rác {boardCode ? 'của Bảng' : 'hệ thống'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Khôi phục hoặc xóa vĩnh viễn các đối tượng đã xóa. Dữ liệu sẽ tự động dọn dẹp sau 30 ngày.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 text-muted-foreground rounded-lg text-xs font-medium border border-border/50">
              <Info size={14} className="text-primary shrink-0" />
              <span>Chỉ Owner & Admin được quản lý</span>
            </div>

            <button
              onClick={() => loadTrash(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 text-xs font-semibold text-foreground transition-all disabled:opacity-50 shadow-xs"
              title="Làm mới"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            <TabButton
              active={activeTab === 'all'}
              label="Tất cả"
              count={counts.all}
              onClick={() => setActiveTab('all')}
            />
            <TabButton
              active={activeTab === 'task'}
              label="Công việc"
              count={counts.task}
              onClick={() => setActiveTab('task')}
            />
            <TabButton
              active={activeTab === 'column'}
              label="Cột"
              count={counts.column}
              onClick={() => setActiveTab('column')}
            />
            {!boardCode && (
              <TabButton
                active={activeTab === 'board'}
                label="Bảng"
                count={counts.board}
                onClick={() => setActiveTab('board')}
              />
            )}
            <TabButton
              active={activeTab === 'attachment'}
              label="Tệp đính kèm"
              count={counts.attachment}
              onClick={() => setActiveTab('attachment')}
            />
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc người xóa..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Đang tải danh sách thùng rác...</p>
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-card border border-red-500/30 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <ShieldAlert size={26} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Không thể truy cập thùng rác</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => loadTrash()}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Thử lại
              </button>
              {boardCode && (
                <button
                  onClick={() => navigate(`/${boardCode}/kanban`)}
                  className="px-4 py-2 bg-muted text-foreground text-xs font-semibold rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Quay lại bảng
                </button>
              )}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center text-muted-foreground mb-4">
              <Trash2 size={28} className="opacity-60" />
            </div>
            <h3 className="text-base font-bold text-foreground">Thùng rác trống</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {searchQuery
                ? 'Không tìm thấy đối tượng nào khớp với từ khóa tìm kiếm.'
                : 'Không có đối tượng nào trong thùng rác. Khi xóa bảng, cột hoặc công việc, chúng sẽ xuất hiện ở đây.'}
            </p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-3 pb-16">
            <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between px-1">
              <span>Danh sách đối tượng ({items.length})</span>
              <span>Sắp xếp: Mới xóa nhất</span>
            </div>

            <div className="grid gap-2.5">
              {items.map((item) => {
                const dates = formatDeletedDate(item.deleted_at);
                const isItemRestoring = actionLoadingId === `restore-${item.type}-${item.id}`;
                const isItemDeleting = actionLoadingId === `force-${item.type}-${item.id}`;

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-4 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Type badge & details */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        <ItemTypeIcon type={item.type} isSubtask={item.is_subtask} />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <ItemTypeBadge type={item.type} isSubtask={item.is_subtask} />

                          <h4 className="font-semibold text-sm text-foreground truncate max-w-md" title={item.title}>
                            {item.title}
                          </h4>

                          {item.extra?.priority && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
                              {item.extra.priority}
                            </span>
                          )}
                        </div>

                        {/* Breadcrumb info: Board, column, parent task */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {item.board_name && (
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                              <FolderKanban size={13} className="text-muted-foreground" />
                              {item.board_name}
                            </span>
                          )}

                          {item.column_title && (
                            <span className={`flex items-center gap-1 ${
                              item.is_column_deleted 
                                ? 'text-amber-600 dark:text-amber-400 font-semibold' 
                                : 'text-muted-foreground'
                            }`}>
                              <Columns size={13} />
                              {item.is_column_deleted ? (
                                <span>Cột đã bị xóa ({item.column_title})</span>
                              ) : (
                                <span>Cột: {item.column_title}</span>
                              )}
                            </span>
                          )}

                          {item.is_subtask && item.parent_title && (
                            <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400 font-medium">
                              <CornerDownRight size={13} />
                              Công việc cha: {item.parent_title}
                            </span>
                          )}

                          {item.type === 'attachment' && item.parent_title && (
                            <span className="flex items-center gap-1">
                              <CheckSquare size={13} />
                              Task: {item.parent_title}
                            </span>
                          )}
                        </div>

                        {/* Deletion metadata: deleted_by and deleted_at */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
                          <div className="flex items-center gap-1.5" title={`Xóa lúc ${typeof dates === 'object' ? dates.full : dates}`}>
                            <Clock size={12} className="text-muted-foreground/80" />
                            <span>Đã xóa: {typeof dates === 'object' ? dates.relative : dates}</span>
                          </div>

                          {item.deleted_by && (
                            <div className="flex items-center gap-1.5">
                              <User size={12} className="text-muted-foreground/80" />
                              <span>Người xóa:</span>
                              <span className="font-semibold text-foreground/90">
                                {item.deleted_by.name || item.deleted_by.username}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={isItemRestoring || isItemDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all disabled:opacity-50"
                        title="Khôi phục về trạng thái ban đầu"
                      >
                        {isItemRestoring ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        <span>Khôi phục</span>
                      </button>

                      <button
                        onClick={() => setForceDeleteItem(item)}
                        disabled={isItemRestoring || isItemDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold transition-all disabled:opacity-50"
                        title="Xóa vĩnh viễn khỏi cơ sở dữ liệu"
                      >
                        {isItemDeleting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        <span>Xóa vĩnh viễn</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Target Column Selection Modal */}
      {restoreTaskModalItem && (
        <TargetColumnPickerModal
          isOpen={true}
          item={restoreTaskModalItem.item}
          availableColumns={restoreTaskModalItem.columns}
          onClose={() => setRestoreTaskModalItem(null)}
          onConfirm={(colId) => handleRestore(restoreTaskModalItem.item, colId)}
          isLoading={actionLoadingId === `restore-${restoreTaskModalItem.item.type}-${restoreTaskModalItem.item.id}`}
        />
      )}

      {/* 2-Step Force Delete Confirmation Modal */}
      {forceDeleteItem && (
        <ForceDeleteConfirmationModal
          isOpen={true}
          item={forceDeleteItem}
          onClose={() => setForceDeleteItem(null)}
          onConfirm={handleForceDeleteConfirm}
          isLoading={actionLoadingId === `force-${forceDeleteItem.type}-${forceDeleteItem.id}`}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENTS
// -------------------------------------------------------------

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
        active
          ? 'bg-primary text-primary-foreground shadow-xs'
          : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
      }`}
    >
      <span>{label}</span>
      <span
        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
          active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ItemTypeIcon({ type, isSubtask }: { type: TrashItemType; isSubtask?: boolean }) {
  if (isSubtask) {
    return (
      <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
        <CornerDownRight size={16} />
      </div>
    );
  }

  switch (type) {
    case 'board':
      return (
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <FolderKanban size={16} />
        </div>
      );
    case 'column':
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Columns size={16} />
        </div>
      );
    case 'task':
      return (
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
          <CheckSquare size={16} />
        </div>
      );
    case 'attachment':
      return (
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Paperclip size={16} />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
          <Trash2 size={16} />
        </div>
      );
  }
}

function ItemTypeBadge({ type, isSubtask }: { type: TrashItemType; isSubtask?: boolean }) {
  if (isSubtask) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-600 dark:text-violet-400">
        Task con
      </span>
    );
  }

  switch (type) {
    case 'board':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
          Bảng
        </span>
      );
    case 'column':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          Cột
        </span>
      );
    case 'task':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-600 dark:text-sky-400">
          Công việc
        </span>
      );
    case 'attachment':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400">
          Tệp đính kèm
        </span>
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------
// TARGET COLUMN PICKER MODAL
// -------------------------------------------------------------

interface TargetColumnPickerModalProps {
  isOpen: boolean;
  item: TrashItem;
  availableColumns: ActiveColumn[];
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (columnId: number) => void;
}

function TargetColumnPickerModal({
  isOpen,
  item,
  availableColumns,
  isLoading,
  onClose,
  onConfirm,
}: TargetColumnPickerModalProps) {
  const [selectedColId, setSelectedColId] = useState<number>(
    availableColumns[0]?.id || 0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/80 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-col-modal-title"
      >
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id="target-col-modal-title" className="font-bold text-base text-foreground">
                Chọn cột để khôi phục công việc
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cột ban đầu đã bị xóa hoặc không còn tồn tại
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-muted/60 rounded-xl text-xs space-y-1">
            <div className="text-muted-foreground">Công việc cần khôi phục:</div>
            <div className="font-semibold text-foreground text-sm">{item.title}</div>
            {item.column_title && (
              <div className="text-amber-600 dark:text-amber-400 text-[11px] font-medium pt-1">
                Cột trước đây: {item.column_title} (Đã bị xóa)
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Chọn cột đích trên bảng:
            </label>

            {availableColumns.length > 0 ? (
              <select
                value={selectedColId}
                onChange={(e) => setSelectedColId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-foreground"
              >
                {availableColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-red-500 font-medium">
                Bảng hiện không có cột nào đang hoạt động. Vui lòng tạo một cột trước khi khôi phục công việc.
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-end gap-2.5 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedColId)}
            disabled={isLoading || availableColumns.length === 0}
            className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-[#5B4BD6] rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Đang khôi phục...
              </>
            ) : (
              'Khôi phục vào cột này'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2-STEP FORCE DELETE CONFIRMATION MODAL
// -------------------------------------------------------------

interface ForceDeleteConfirmationModalProps {
  isOpen: boolean;
  item: TrashItem;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (confirmName: string) => Promise<void>;
}

function ForceDeleteConfirmationModal({
  isOpen,
  item,
  isLoading,
  onClose,
  onConfirm,
}: ForceDeleteConfirmationModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMatched = confirmName.trim().toLowerCase() === item.title.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched) {
      setErrorMessage('Tên xác nhận không khớp với tên của đối tượng.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm(confirmName.trim());
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Có lỗi xảy ra khi xóa vĩnh viễn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeName = (type: TrashItemType) => {
    switch (type) {
      case 'board': return 'Bảng';
      case 'column': return 'Cột';
      case 'task': return 'Công việc';
      case 'attachment': return 'Tệp đính kèm';
      default: return 'Đối tượng';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-delete-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-red-500/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id="force-delete-title" className="font-bold text-base text-red-600 dark:text-red-400">
                Xác nhận xóa vĩnh viễn
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bước xác thực bảo mật 2 bước
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting || isLoading}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-700 dark:text-red-300 leading-relaxed">
              <strong>CẢNH BÁO NGUY HIỂM:</strong> Hành động này sẽ <strong>xóa vĩnh viễn</strong> {getTypeName(item.type)} này khỏi hệ thống. Toàn bộ dữ liệu liên quan sẽ biến mất hoàn toàn và <strong>không thể phục hồi</strong>.
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">
                Để xác nhận, vui lòng nhập chính xác tên dưới đây:
              </div>
              <div className="p-2.5 bg-muted rounded-lg border border-border/80 font-mono text-xs font-bold text-foreground select-all break-all">
                {item.title}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                Nhập lại tên đối tượng:
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={item.title}
                autoFocus
                disabled={isSubmitting || isLoading}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none transition-all font-medium text-foreground"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-end gap-2.5 bg-muted/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!isMatched || isSubmitting || isLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Đang xóa vĩnh viễn...
                </>
              ) : (
                'Tôi hiểu rủi ro, Xóa vĩnh viễn'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TrashView;
