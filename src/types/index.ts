export type Id = string | number;

export type Priority = 'Thấp' | 'Bình thường' | 'Cao' | 'Khẩn cấp';

export interface User {
  id: Id;
  name: string;
  avatarUrl?: string;
  initials: string;
}

export interface Task {
  id: Id;
  columnId: Id;
  title: string;
  description?: string;
  priority: Priority;
  labels: string[];
  assignee?: User;
  dueDate?: Date;
  completedChecklistItems: number;
  totalChecklistItems: number;
  commentCount: number;
  attachmentCount: number;
}

export interface Column {
  id: Id;
  title: string;
}
