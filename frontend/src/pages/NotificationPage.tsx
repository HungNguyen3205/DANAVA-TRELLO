import React, { useState, useEffect } from 'react';
import { 
  Bell, Check, Clock, AlertCircle, UserPlus, UserMinus, Filter, Layout, 
  MessageSquare, AtSign, CheckCircle2, RefreshCw, Calendar, Star, Award, 
  ArrowRightCircle, Loader2, AlertTriangle, RefreshCcw, Building2
} from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead } from '../lib/api/notifications';
import type { AppNotification } from '../lib/api/notifications';
import { updateTabNotification, notifyNotificationsUpdated } from '../lib/tabNotification';
import { useNavigate } from 'react-router-dom';
import { isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

type FilterType = 'all' | 'assigned' | 'comments' | 'deadlines' | 'completed';

export const NotificationPage = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchNotifications = async (p = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await getNotifications(p, false, filter);
      const items = data.notifications.data;

      if (append) {
        setNotifications(prev => [...prev, ...items]);
      } else {
        setNotifications(items);
      }
      setUnreadCount(data.unread_count);
      updateTabNotification(data.unread_count);
      notifyNotificationsUpdated(data.unread_count);
      setHasMore(data.notifications.next_page_url !== null);
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || 'Không thể tải thông báo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1, false);
    setPage(1);
  }, [filter]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
      updateTabNotification(0);
      notifyNotificationsUpdated(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read_at) {
      try {
        await markAsRead(n.id);
        setUnreadCount(prev => {
          const next = Math.max(0, prev - 1);
          updateTabNotification(next);
          notifyNotificationsUpdated(next);
          return next;
        });
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item));
      } catch (e) {
        console.error(e);
      }
    }
    
    if (n.data.action_url) {
      navigate(n.data.action_url);
    } else if (n.data.board_id) {
      const url = `/b/${n.data.board_id}${n.data.task_id ? `?task=${n.data.task_id}` : ''}`;
      navigate(url);
    }
  };

  const getNotificationIconInfo = (type: string) => {
    switch (type) {
      case 'board_invited':
        return {
          Icon: Layout,
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        };
      case 'assigned':
        return {
          Icon: UserPlus,
          iconBg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
        };
      case 'unassigned':
        return {
          Icon: UserMinus,
          iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
        };
      case 'due_date_changed':
        return {
          Icon: Calendar,
          iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        };
      case 'due_soon':
      case 'due_today':
        return {
          Icon: Clock,
          iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
        };
      case 'overdue':
        return {
          Icon: AlertCircle,
          iconBg: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        };
      case 'column_moved':
        return {
          Icon: ArrowRightCircle,
          iconBg: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
        };
      case 'task_completed':
        return {
          Icon: CheckCircle2,
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        };
      case 'task_reopened':
        return {
          Icon: RefreshCw,
          iconBg: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
        };
      case 'comment_added':
        return {
          Icon: MessageSquare,
          iconBg: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
        };
      case 'mention':
        return {
          Icon: AtSign,
          iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400'
        };
      case 'quality_review':
        return {
          Icon: Star,
          iconBg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
        };
      case 'evaluation_published':
        return {
          Icon: Award,
          iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
        };
      case 'department_transferred':
        return {
          Icon: Building2,
          iconBg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
        };
      case 'department_manager_assigned':
        return {
          Icon: Award,
          iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
        };
      default:
        return {
          Icon: Bell,
          iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        };
    }
  };

  const renderGroup = (title: string, list: AppNotification[]) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">{title}</h4>
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm divide-y divide-border/50">
          {list.map(n => {
            const isUnread = !n.read_at;
            const { Icon, iconBg } = getNotificationIconInfo(n.data.type);

            return (
              <div 
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center gap-4 ${isUnread ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className={`text-[15px] ${isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {n.data.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground font-medium">
                        {n.data.board_name || n.data.board_title || 'Bảng công việc'}
                      </span>
                      {(n.data.inviter_name || n.data.actor_name) && (
                        <>
                          <span>•</span>
                          <span>Bởi: {n.data.inviter_name || n.data.actor_name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}</span>
                    </div>
                  </div>
                </div>
                {isUnread && (
                  <div className="hidden md:flex shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" title="Chưa đọc"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const older: AppNotification[] = [];

  notifications.forEach(n => {
    const date = new Date(n.created_at);
    if (isToday(date)) today.push(n);
    else if (isYesterday(date)) yesterday.push(n);
    else older.push(n);
  });

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground">Thông báo</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <p className="text-muted-foreground">Cập nhật toàn bộ hoạt động trong vòng đời công việc của bạn.</p>
          </div>
          
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-2 transition-colors px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg cursor-pointer"
            >
              <Check size={16} />
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
          <Filter size={16} className="text-muted-foreground mr-2 shrink-0" />
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'assigned', label: 'Được giao' },
            { id: 'comments', label: 'Bình luận' },
            { id: 'deadlines', label: 'Deadline' },
            { id: 'completed', label: 'Hoàn thành' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as FilterType)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${filter === f.id ? 'bg-foreground text-background shadow-sm' : 'bg-card text-muted-foreground border border-border hover:bg-muted'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-card border border-border rounded-xl">
            <Loader2 size={36} className="text-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Đang tải thông báo...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="text-center py-16 bg-card border border-destructive/30 rounded-xl p-6">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Đã có lỗi xảy ra</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">{error}</p>
            <button
              onClick={() => fetchNotifications(1, false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCcw size={16} />
              Thử lại
            </button>
          </div>
        ) : notifications.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={32} className="text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Không có thông báo nào</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {filter === 'all' 
                ? 'Bạn đã xem hết tất cả thông báo mới. Khi có cập nhật mới, chúng sẽ xuất hiện tại đây.'
                : 'Không tìm thấy thông báo nào phù hợp với bộ lọc hiện tại.'}
            </p>
          </div>
        ) : (
          /* Notifications List */
          <div>
            {renderGroup('Hôm nay', today)}
            {renderGroup('Hôm qua', yesterday)}
            {renderGroup('Trước đó', older)}

            {hasMore && (
              <div className="text-center mt-8">
                <button 
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-card border border-border hover:bg-muted text-foreground font-medium rounded-xl transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingMore && <Loader2 size={16} className="animate-spin" />}
                  {loadingMore ? 'Đang tải thêm...' : 'Tải thêm thông báo'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

