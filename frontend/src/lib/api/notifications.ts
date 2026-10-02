import api from '../axios';

export interface AppNotification {
  id: string;
  type: string;
  notifiable_type: string;
  notifiable_id: number;
  data: {
    type: string;
    task_id: number;
    task_title: string;
    board_id: number;
    board_title: string;
    message: string;
    actor_id?: number;
    actor_name?: string;
    due_date?: string;
  };
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationResponse {
  notifications: {
    current_page: number;
    data: AppNotification[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: any[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
  };
  unread_count: number;
}

export const getNotifications = async (page = 1, unreadOnly = false): Promise<NotificationResponse> => {
  const params = new URLSearchParams({ page: page.toString() });
  if (unreadOnly) {
    params.append('unread', '1');
  }
  const response = await api.get(`/notifications?${params.toString()}`);
  return response.data;
};

export const markAsRead = async (id: string): Promise<void> => {
  await api.put(`/notifications/${id}/read`);
};

export const markAllAsRead = async (): Promise<void> => {
  await api.put('/notifications/read-all');
};
