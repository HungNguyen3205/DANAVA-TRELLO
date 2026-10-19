import api from '../axios';

export type TrashItemType = 'board' | 'column' | 'task' | 'attachment';

export interface TrashUser {
  id: number;
  name: string;
  username?: string;
  avatar?: string;
}

export interface TrashItem {
  id: number;
  type: TrashItemType;
  title: string;
  deleted_at: string | null;
  deleted_by: TrashUser | null;
  board_id: number | null;
  board_name: string | null;
  board_code: string | null;
  is_column_deleted: boolean;
  column_id: number | null;
  column_title: string | null;
  parent_id: number | null;
  parent_title: string | null;
  is_subtask: boolean;
  extra?: {
    color?: string;
    order?: number;
    description?: string;
    priority?: string;
    complexity?: string;
    estimated_points?: number;
    external_key?: string;
    file_size?: number;
    mime_type?: string;
    [key: string]: any;
  };
}

export interface TrashCounts {
  all: number;
  board: number;
  column: number;
  task: number;
  attachment: number;
}

export interface ActiveColumn {
  id: number;
  title: string;
}

export interface TrashResponse {
  data: TrashItem[];
  counts: TrashCounts;
  available_columns: ActiveColumn[];
}

export interface RestoreResponse {
  success?: boolean;
  message: string;
  require_target_column?: boolean;
  available_columns?: ActiveColumn[];
}

export interface ForceDeleteResponse {
  success?: boolean;
  message: string;
}

export const getTrashItems = async (params?: {
  board_id?: string | number;
  type?: string;
  search?: string;
}): Promise<TrashResponse> => {
  const res = await api.get('/trash', { params });
  return res.data;
};

export const restoreTrashItem = async (
  type: string,
  id: number,
  target_column_id?: number
): Promise<RestoreResponse> => {
  const payload = target_column_id ? { target_column_id } : {};
  const res = await api.post(`/trash/${type}/${id}/restore`, payload);
  return res.data;
};

export const forceDeleteTrashItem = async (
  type: string,
  id: number,
  confirm_name: string
): Promise<ForceDeleteResponse> => {
  const res = await api.delete(`/trash/${type}/${id}/force`, {
    data: { confirm_name },
  });
  return res.data;
};
