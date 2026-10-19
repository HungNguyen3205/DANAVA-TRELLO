import api from '../axios';

export interface MemberStat {
  user_id: number;
  name: string;
  username: string;
  email: string;
  avatar?: string;
  role: string;
  total_tasks: number;
  completed_tasks: number;
  incomplete_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  saved_review?: {
    user_id: number;
    note?: string;
    rating?: number;
  };
}

export interface BoardStats {
  total_tasks: number;
  completed_tasks: number;
  incomplete_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  members_stats: MemberStat[];
}

export interface BoardReviewData {
  id?: number;
  board_id: number;
  status: 'draft' | 'published' | 'locked';
  goals?: string;
  summary?: string;
  achievements?: string;
  unfinished_work?: string;
  issues?: string;
  lessons_learned?: string;
  revenue?: number | string;
  cost?: number | string;
  profit?: number | string;
  overall_rating?: number;
  member_reviews?: Array<{
    user_id: number;
    note?: string;
    rating?: number;
  }>;
  attachments?: Array<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  }>;
  created_by?: number;
  creator?: { id: number; name: string };
  published_by?: number;
  publisher?: { id: number; name: string };
  published_at?: string;
  locked_by?: number;
  locker?: { id: number; name: string };
  locked_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BoardReviewResponse {
  board: {
    id: number;
    name: string;
    public_id: string;
    owner_id: number;
    is_admin: boolean;
  };
  review: BoardReviewData | null;
  stats: BoardStats;
}

export const getBoardReview = async (boardIdOrCode: string | number): Promise<BoardReviewResponse> => {
  const res = await api.get(`/boards/${boardIdOrCode}/review`);
  return res.data;
};

export const saveBoardReview = async (
  boardIdOrCode: string | number,
  data: Partial<BoardReviewData>
): Promise<{ message: string; review: BoardReviewData; stats: BoardStats }> => {
  const res = await api.post(`/boards/${boardIdOrCode}/review`, data);
  return res.data;
};

export const publishBoardReview = async (
  boardIdOrCode: string | number
): Promise<{ message: string; review: BoardReviewData; stats: BoardStats }> => {
  const res = await api.post(`/boards/${boardIdOrCode}/review/publish`);
  return res.data;
};

export const lockBoardReview = async (
  boardIdOrCode: string | number
): Promise<{ message: string; review: BoardReviewData }> => {
  const res = await api.post(`/boards/${boardIdOrCode}/review/lock`);
  return res.data;
};

export const unlockBoardReview = async (
  boardIdOrCode: string | number
): Promise<{ message: string; review: BoardReviewData }> => {
  const res = await api.post(`/boards/${boardIdOrCode}/review/unlock`);
  return res.data;
};
