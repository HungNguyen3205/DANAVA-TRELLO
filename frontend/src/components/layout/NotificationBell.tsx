import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Check, Clock, AlertCircle, UserPlus, UserMinus, CheckCircle2, Layout,
  MessageSquare, AtSign, RefreshCw, Calendar, Star, Award, ArrowRightCircle, Building2
} from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead } from '../../lib/api/notifications';
import type { AppNotification } from '../../lib/api/notifications';
import { updateTabNotification } from '../../lib/tabNotification';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications(1);
      setNotifications(data.notifications.data.slice(0, 8)); // Top 8 notifications for dropdown
      setUnreadCount(data.unread_count);
    } catch (e) {
      console.error(e);
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

  useEffect(() => {
    updateTabNotification(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    
    // Auto refresh when user focuses or returns to the window
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    const handleUpdated = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setUnreadCount(e.detail.count);
      } else {
        fetchNotifications();
      }
    };
    window.addEventListener('notifications_updated', handleUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('notifications_updated', handleUpdated);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAllAsRead();
      await fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    setIsOpen(false);
    if (!n.read_at) {
      try {
        await markAsRead(n.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item));
      } catch (e) {
        console.error(e);
      }
    }
    
    // Navigate to board or task
    if (n.data.action_url) {
      navigate(n.data.action_url);
    } else if (n.data.board_id) {
      navigate(`/b/${n.data.board_id}${n.data.task_id ? `?task=${n.data.task_id}` : ''}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => {
          if (!isOpen) fetchNotifications();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent relative transition-colors mr-1"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 bg-red-500 rounded-full border-2 border-card flex items-center justify-center text-[9px] font-bold text-white px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-card border border-border rounded-2xl shadow-xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
            <h3 className="font-semibold text-[15px] text-foreground">Thông báo</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                <Check size={14} />
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Bell size={32} className="mb-3 opacity-20" />
                <p className="text-sm">Không có thông báo mới</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map(n => {
                  const isUnread = !n.read_at;
                  const { Icon, iconBg } = getNotificationIconInfo(n.data.type);

                  return (
                    <div 
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 md:p-4 hover:bg-muted/50 cursor-pointer transition-colors flex gap-3 ${isUnread ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'} line-clamp-2`}>
                          {n.data.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-primary truncate max-w-[120px]">
                            {n.data.board_name || n.data.board_title || 'Bảng công việc'}
                          </span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}</span>
                        </div>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-border/50 bg-card">
            <button 
              onClick={() => { setIsOpen(false); navigate('/notifications'); }}
              className="w-full py-2 text-sm font-medium text-foreground hover:bg-muted rounded-xl transition-colors text-center"
            >
              Xem tất cả thông báo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
