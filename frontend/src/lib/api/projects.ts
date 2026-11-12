import api from '../axios';
import type { ProjectStatus } from '../boardType';

export interface PersonLite {
  id: number;
  name: string;
  avatar: string | null;
}

export interface ProjectStats {
  tasks: number;
  done: number;
  overdue: number;
  progress: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  cover_image: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  manager: PersonLite | null;
  owner_id: number | null;
  boards_count: number;
  can_manage: boolean;
  created_at: string | null;
  stats?: ProjectStats;
  members?: PersonLite[];
  members_count?: number;
}

export interface ProjectBoard {
  id: number;
  public_id: string;
  name: string;
  description: string | null;
  color: string | null;
  background_image: string | null;
  updated_at: string | null;
  stats: ProjectStats;
  members: PersonLite[];
  can_manage: boolean;
}

export interface ProjectDetail extends ProjectSummary {
  stats: ProjectStats;
  members: PersonLite[];
  hidden_boards_count: number;
  files_count?: number;
  boards: ProjectBoard[];
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  color?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  manager_id?: number | null;
  budget?: number | null;
}

export const projectsApi = {
  list: () => api.get<ProjectSummary[]>('/projects').then((r) => r.data),
  get: (id: number | string) => api.get<ProjectDetail>(`/projects/${id}`).then((r) => r.data),
  create: (data: ProjectInput) => api.post<ProjectSummary>('/projects', data).then((r) => r.data),
  update: (id: number, data: Partial<ProjectInput>) => api.put<ProjectSummary>(`/projects/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete<{ message: string }>(`/projects/${id}`).then((r) => r.data),
  attachBoard: (id: number, boardId: number | string) =>
    api.post<{ message: string }>(`/projects/${id}/boards`, { board_id: boardId }).then((r) => r.data),
  uploadCover: (id: number, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<ProjectSummary>(`/projects/${id}/cover`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  removeCover: (id: number) => api.delete<ProjectSummary>(`/projects/${id}/cover`).then((r) => r.data),
  detachBoard: (id: number, boardId: number) => api.delete<{ message: string }>(`/projects/${id}/boards/${boardId}`).then((r) => r.data),
};

/** Project accent colours (used for the dot/bar on cards). Deliberately not purple. */
export const PROJECT_COLORS = ['#1E3A8A', '#F47624', '#0E7490', '#15803D', '#B45309', '#BE123C', '#475569', '#0369A1'];

export const projectColor = (p: { color: string | null; id: number }) => p.color || PROJECT_COLORS[p.id % PROJECT_COLORS.length];

// ---------------- Project documents ----------------

export interface ProjectFile {
  id: number;
  name: string;
  mime: string | null;
  size: number;
  uploaded_by: PersonLite | null;
  created_at: string | null;
  /** Signed links (relative to the API host), valid for a few hours. */
  download_url: string;
  view_url: string;
  can_delete: boolean;
}

export const projectFilesApi = {
  list: (projectId: number) => api.get<ProjectFile[]>(`/projects/${projectId}/files`).then((r) => r.data),
  upload: (projectId: number, files: File[], onProgress?: (percent: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append('files[]', f, f.name));
    return api
      .post<{ message: string; files: ProjectFile[] }>(`/projects/${projectId}/files`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded * 100) / e.total)),
      })
      .then((r) => r.data);
  },
  remove: (projectId: number, fileId: number) => api.delete<{ message: string }>(`/projects/${projectId}/files/${fileId}`).then((r) => r.data),
};

export const PROJECT_FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv,.md,.jpg,.jpeg,.png,.webp,.gif,.heic,.svg,.psd,.ai,.fig,.zip,.rar,.7z,.mp4,.mov,.mp3,.wav';
export const PROJECT_FILE_MAX_BYTES = 20 * 1024 * 1024;
