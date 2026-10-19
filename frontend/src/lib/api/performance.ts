import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface PerformancePolicy {
  id: number;
  board_id: number;
  version: string;
  title: string;
  content: string;
  created_by: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyResponse {
  policy: PerformancePolicy;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  total_acknowledged: number;
  total_members: number;
  can_manage: boolean;
}

export interface PerformancePeriod {
  id: number;
  board_id: number;
  title: string;
  period_type: 'weekly' | 'monthly' | 'quarterly' | 'custom';
  start_date: string;
  end_date: string;
  status: 'draft' | 'published' | 'locked';
  created_by: number;
  published_by?: number;
  published_at?: string;
  locked_by?: number;
  locked_at?: string;
  created_at: string;
  updated_at: string;
  scores_count?: number;
  creator?: { id: number; name: string; avatar?: string };
  publisher?: { id: number; name: string };
  locker?: { id: number; name: string };
}

export interface TaskAllocation {
  task_id: number;
  title: string;
  parent_task_id: number | null;
  complexity: 'XS' | 'S' | 'M' | 'L' | 'XL';
  base_points: number;
  contribution_percent: number;
  effective_points: number;
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  has_due_date: boolean;
  is_on_time: boolean;
  quality_rating: number | null;
  quality_review_note: string | null;
}

export interface MemberPerformanceScore {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_avatar?: string | null;
  account_status?: string;
  department_id?: number | null;
  department_name?: string | null;
  department_color?: string | null;
  role: string;
  workload_score: number;
  on_time_score: number;
  quality_score: number;
  progress_score: number;
  total_points_earned: number;
  available_weight: number;
  final_score: number;
  is_provisional: boolean;
  rank: string;
  metrics_breakdown: {
    workload: {
      weight: number;
      has_data: boolean;
      score: number;
      planned_points: number;
      completed_points: number;
      completion_rate: number;
    };
    on_time: {
      weight: number;
      has_data: boolean;
      score: number;
      completed_due_points: number;
      on_time_completed_points: number;
      on_time_rate: number;
    };
    quality: {
      weight: number;
      has_data: boolean;
      score: number;
      reviewed_tasks_count: number;
      reviewed_points: number;
      weighted_ratio: number;
    };
    progress: {
      weight: number;
      has_data: boolean;
      score: number;
      required_updates: number;
      valid_updates: number;
      progress_rate: number;
      task_logs?: Array<{
        task_id: number;
        title: string;
        activities_count: number;
        comments_count: number;
        has_valid_update: boolean;
      }>;
    };
    overall: {
      total_points_earned: number;
      available_weight: number;
      final_score: number;
      is_provisional: boolean;
      rank: string;
    };
  };
  task_details: TaskAllocation[];
}

export interface PeriodDetailResponse {
  period: PerformancePeriod;
  scores: MemberPerformanceScore[];
  analytics: {
    total_members: number;
    board_average: number;
    rank_distribution: Record<string, number>;
    top_performers: MemberPerformanceScore[];
  };
  can_manage: boolean;
}

export async function getPerformancePolicy(boardId: string | number): Promise<PolicyResponse> {
  const res = await api.get(`/boards/${boardId}/performance/policy`);
  return res.data;
}

export async function acknowledgePerformancePolicy(boardId: string | number): Promise<{ message: string; acknowledged_at: string }> {
  const res = await api.post(`/boards/${boardId}/performance/policy/acknowledge`);
  return res.data;
}

export async function updatePerformancePolicy(
  boardId: string | number,
  data: { version: string; title: string; content: string }
): Promise<{ message: string; policy: PerformancePolicy }> {
  const res = await api.post(`/boards/${boardId}/performance/policy`, data);
  return res.data;
}

export async function getPerformancePeriods(boardId: string | number): Promise<{ periods: PerformancePeriod[]; can_manage: boolean }> {
  const res = await api.get(`/boards/${boardId}/performance/periods`);
  return res.data;
}

export async function createPerformancePeriod(
  boardId: string | number,
  data: { title: string; period_type: string; start_date: string; end_date: string }
): Promise<{ message: string; period: PerformancePeriod; scores: MemberPerformanceScore[] }> {
  const res = await api.post(`/boards/${boardId}/performance/periods`, data);
  return res.data;
}

export async function getPerformancePeriodDetails(boardId: string | number, periodId: number): Promise<PeriodDetailResponse> {
  const res = await api.get(`/boards/${boardId}/performance/periods/${periodId}`);
  return res.data;
}

export async function recalculatePerformancePeriod(
  boardId: string | number,
  periodId: number
): Promise<{ message: string; scores: MemberPerformanceScore[] }> {
  const res = await api.post(`/boards/${boardId}/performance/periods/${periodId}/calculate`);
  return res.data;
}

export async function publishPerformancePeriod(
  boardId: string | number,
  periodId: number
): Promise<{ message: string; period: PerformancePeriod; scores: MemberPerformanceScore[] }> {
  const res = await api.post(`/boards/${boardId}/performance/periods/${periodId}/publish`);
  return res.data;
}

export async function lockPerformancePeriod(
  boardId: string | number,
  periodId: number
): Promise<{ message: string; period: PerformancePeriod }> {
  const res = await api.post(`/boards/${boardId}/performance/periods/${periodId}/lock`);
  return res.data;
}

export async function unlockPerformancePeriod(
  boardId: string | number,
  periodId: number
): Promise<{ message: string; period: PerformancePeriod }> {
  const res = await api.post(`/boards/${boardId}/performance/periods/${periodId}/unlock`);
  return res.data;
}

export async function getMemberPerformanceLineage(
  boardId: string | number,
  periodId: number,
  userId: number
): Promise<{ member: any; score: MemberPerformanceScore }> {
  const res = await api.get(`/boards/${boardId}/performance/periods/${periodId}/members/${userId}/lineage`);
  return res.data;
}
