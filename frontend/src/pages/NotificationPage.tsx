import React, { useState, useEffect } from 'react';
import { Bell, Check, Clock, AlertCircle, UserPlus, Filter } from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead } from '../lib/api/notifications';
import type { AppNotification } from '../lib/api/notifications';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export const NotificationPage = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'assigned' | 'due' | 'overdue'>('all');
  const navigate = useNavigate();

  const fetchNotifications = async (p = 1, append = false) => {
    try {
      const isUnreadOnly = filter === 'unread';
      const data = await getNotifications(p, isUnreadOnly);
      
      let filteredData = data.notifications.data;
      if (filter === 'assigned') filteredData = filteredData.filter(n => n.data.type === 'assigned');
      if (filter === 'due') filteredData = filteredData.filter(n => n.data.type === 'due_today' || n.data.type === 'approaching_due');
      if (filter === 'overdue') filteredData = filteredData.filter(n => n.data.type === 'overdue');

      if (append) {
        setNotifications(prev => [...prev, ...filteredData]);
      } else {
        setNotifications(filteredData);
      }
      setUnreadCount(data.unread_count);
      setHasMore(data.notifications.next_page_url !== null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications(1, false);
    setPage(1);
  }, [filter]);

  const loadMore = () => {
    setPage(p => p + 1);
    fetchNotifications(page + 1, true);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read_at) {
      try {
        await markAsRead(n.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item));
      } catch (e) {
        console.error(e);
      }
    }
    
    // In this MVP we just need the board id to navigate to kanban board.
    // Assuming workspace structure requires fetching board first or redirect directly to legacy redirect
    // Let's use the legacy redirect we saw in App.tsx: /b/:boardId
    // We will append ?task=:taskId
    if (n.data.board_id) {
      const url = `/b/${n.data.board_id}/kanban${n.data.task_id ? `?task=${n.data.task_id}` : ''}`;
      navigate(url);
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
            let Icon = Bell;
            let iconBg = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
            
            if (n.data.type === 'assigned') {
              Icon = UserPlus;
              iconBg = 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
            } else if (n.data.type === 'due_today' || n.data.type === 'approaching_due') {
              Icon = Clock;
              iconBg = 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
            } else if (n.data.type === 'overdue') {
              Icon = AlertCircle;
              iconBg = 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
            }

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
                        {n.data.board_title}
                      </span>
                      {n.data.actor_name && (
                        <>
                          <span>•</span>
                          <span>Bởi: {n.data.actor_name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}</span>
                    </div>
                  </div>
                </div>
                {isUnread && (
                  <div className="hidden md:flex shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
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
            <p className="text-muted-foreground">Cập nhật những hoạt động mới nhất về công việc của bạn.</p>
          </div>
          
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-2 transition-colors px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg"
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
            { id: 'unread', label: 'Chưa đọc' },
            { id: 'assigned', label: 'Được giao việc' },
            { id: 'due', label: 'Sắp/đến hạn' },
            { id: 'overdue', label: 'Quá hạn' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f.id ? 'bg-foreground text-background shadow-sm' : 'bg-card text-muted-foreground border border-border hover:bg-muted'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {notifications.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={32} className="text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Không có thông báo nào</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">Bạn đã xem hết tất cả thông báo mới. Khi có cập nhật mới, chúng sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div>
            {renderGroup('Hôm nay', today)}
            {renderGroup('Hôm qua', yesterday)}
            {renderGroup('Trước đó', older)}

            {hasMore && (
              <div className="text-center mt-8">
                <button 
                  onClick={loadMore}
                  className="px-6 py-2.5 bg-card border border-border hover:bg-muted text-foreground font-medium rounded-xl transition-colors shadow-sm"
                >
                  Tải thêm thông báo
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
