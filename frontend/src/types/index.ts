export type Id = string;
export type Priority = "Thấp" | "Bình thường" | "Cao" | "Khẩn cấp";
export interface User {
  id: string;
  name: string;
  email?: string;
  username?: string;
  initials?: string;
  avatar?: string;
  phone?: string;
  gender?: string;
  position?: string;
  dob?: string;
  address?: string;
  join_date?: string;
  contact_email?: string;
  system_role?: string;
  role?: string;
  account_status?: string;
  must_change_password?: boolean;
  notification_preferences?: any;
  department_id?: number | null;
  department?: Department | null;
}
export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  manager_id?: number | null;
  manager?: User | null;
  creator?: User | null;
  status: 'active' | 'inactive';
  color?: string | null;
  employees_count?: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
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
  user_id?: string | number;
  user?: User;
  content?: string;
  created_at?: string;
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
  parent_task_id?: string | number | null;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  complexity?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  labels: Label[];
  assigneeId: string;
  assignees?: (User & { pivot?: { contribution_percent?: number } })[];
  collaborators: string[];
  startDate?: string;
  dueDate: string;
  due_date?: string | null;
  completedAt?: string | null;
  completed_at?: string | null;
  sortOrder?: number;
  creator?: User;
  subtasks?: Task[];
  qualityRating?: number | null;
  qualityReviewNote?: string | null;
  checklists: Checklist[];
  comments: Comment[];
  attachments: Attachment[];
  activity_logs?: any[];
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
  wip_limit?: number | null;
  wip_enforcement?: 'warning' | 'strict';
  wip_count?: number;
  completed?: boolean;
  archived_at?: string | null;
  archived_by?: number | string | null;
  tasks_count?: number;
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
  owner_id?: string;
  owner?: User;
  my_role?: 'owner' | 'admin' | 'member' | string;
  is_owner?: boolean;
  workspace?: any;
  columns: Column[];
  tasks: Task[];
  users: User[];
  activity: Activity[];
  sprints?: Sprint[];
  labels?: Label[];
}

