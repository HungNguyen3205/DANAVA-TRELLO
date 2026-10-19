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
  parentTaskId?: string | null;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  labels: Label[];
  assigneeId: string;
  assignees?: User[];
  collaborators: string[];
  startDate?: string;
  dueDate: string;
  completedAt?: string | null;
  sortOrder?: number;
  creator?: User;
  subtasks?: Task[];
  checklists: Checklist[];
  comments: Comment[];
  attachments: Attachment[];
  totalSubtasksCount?: number;
  doneSubtasksCount?: number;
  totalChecklistsItems?: number;
  doneChecklistsItems?: number;
  commentsCount?: number;
  attachmentsCount?: number;
}

export interface MemberWorkloadSummary {
  total_tasks: number;
  completed_tasks: number;
  incomplete_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
}

export interface MemberWorkloadTask {
  id: number | string;
  parent_task_id: number | string | null;
  title: string;
  priority: string;
  due_date: string | null;
  is_completed: boolean;
  is_overdue: boolean;
}

export interface MemberWorkloadItem {
  id: number | string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  assigned: number;
  incomplete: number;
  completed: number;
  overdue: number;
  completion_rate: number;
  tasks?: MemberWorkloadTask[];
}

export interface BoardMemberWorkloadResponse {
  summary: MemberWorkloadSummary;
  members: MemberWorkloadItem[];
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
  publicId?: string;
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
