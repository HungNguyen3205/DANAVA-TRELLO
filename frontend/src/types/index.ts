export type Id = string;
export type Priority = "Thấp" | "Bình thường" | "Cao" | "Khẩn cấp";
export interface User {
  id: string;
  name: string;
  email?: string;
  username?: string;
  initials: string;
  avatar?: string;
  notification_preferences?: any;
}
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}
export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}
export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}
export interface Activity {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}
export interface Label {
  id: string;
  name: string;
  color: string;
}
export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  userId: string;
  createdAt: string;
}
export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  labels: Label[];
  assigneeId: string;
  collaborators: string[];
  startDate?: string;
  dueDate: string;
  checklists: Checklist[];
  comments: Comment[];
  attachments: Attachment[];
}
export interface Column {
  id: string;
  title: string;
  color?: string;
  completed?: boolean;
}
export interface Sprint {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'pending' | 'active' | 'completed';
}
export interface Board {
  id: string;
  title: string;
  name?: string;
  description?: string;
  color?: string;
  workspace?: any;
  columns: Column[];
  tasks: Task[];
  users: User[];
  activity: Activity[];
  sprints?: Sprint[];
  labels?: Label[];
}
