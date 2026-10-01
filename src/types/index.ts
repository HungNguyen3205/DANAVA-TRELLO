export type Id = string;
export type Priority = "Thấp" | "Bình thường" | "Cao" | "Khẩn cấp";
export interface User {
  id: string;
  name: string;
  initials: string;
}
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
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
export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  assigneeId: string;
  collaborators: string[];
  dueDate: string;
  checklist: ChecklistItem[];
  comments: Comment[];
}
export interface Column {
  id: string;
  title: string;
  completed?: boolean;
}
export interface Board {
  title: string;
  columns: Column[];
  tasks: Task[];
  users: User[];
  activity: Activity[];
}
