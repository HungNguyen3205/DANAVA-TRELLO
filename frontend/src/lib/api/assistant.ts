import api from '../axios';

export type Priority = 'Thấp' | 'Bình thường' | 'Cao' | 'Khẩn cấp';

export interface MentionDraft {
  raw: string;
  user_ids: number[];
  status: 'matched' | 'ambiguous' | 'unknown';
}

export interface TaskDraft {
  title: string;
  description: string;
  source_line: string;
  assignee_ids: number[];
  mentions: MentionDraft[];
  board_id: number | null;
  board_reason: string | null;
  priority: Priority;
  done: boolean;
  due_date: string | null;
}

export interface TaskPreview {
  engine: 'gemini' | 'rules';
  warnings: string[];
  tasks: TaskDraft[];
  /** Boards the user can add tasks to; `project` is the project the board belongs to (context only). */
  boards: { id: number; name: string; public_id: string; project: string | null }[];
  people: { id: number; name: string; position: string | null }[];
  priorities: Priority[];
}

export interface AssistantMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  meta: { type: 'task_preview'; preview: TaskPreview } | null;
  attachments?: ChatAttachment[];
  created_at: string;
}

export type AttachmentKind = 'image' | 'audio' | 'pdf' | 'text' | 'docx' | 'xlsx';

export interface ChatAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: AttachmentKind;
  /** Signed link (relative to the API server) or a local blob: URL while sending. */
  url: string;
}

export interface AssistantUsageStatus {
  limits: { per_user_daily: number; company_daily: number };
  me_today: { requests: number; tokens: number };
  /** null = no per-person limit */
  me_remaining: number | null;
}

export interface AssistantState {
  name: string;
  mode: 'demo' | 'live';
  usage?: AssistantUsageStatus;
  messages: AssistantMessage[];
}

export interface ApplyItem {
  title: string;
  description?: string;
  board_id: number;
  assignee_ids: number[];
  priority: Priority;
  done: boolean;
  due_date: string | null;
  add_to_board?: boolean;
  aliases?: { alias: string; user_id: number }[];
}

export interface ApplyResult {
  index: number;
  ok: boolean;
  message?: string;
  task?: { id: number; title: string; board_id: number; board_name: string; board_code: string; column: string; assignee_ids: number[] };
  skipped_assignees?: { id: number; name: string }[];
}

export interface AssistantSettingsStatus {
  has_key: boolean;
  key_hint: string | null;
  source: 'app' | 'env' | null;
  model: string;
  mode: 'demo' | 'live';
  /** 'gemini' = Google AI Studio key, 'vertex' = Vertex AI express key */
  endpoint?: 'gemini' | 'vertex' | null;
  can_manage: boolean;
  message?: string;
  limits: AssistantUsageStatus['limits'];
  me_today: AssistantUsageStatus['me_today'];
  me_remaining: number | null;
  /** Admin only */
  company_today: { requests: number; tokens: number; users: number } | null;
  last_days: { date: string; requests: number; tokens: number }[] | null;
  key_updated: SettingUpdate | null;
  model_updated: SettingUpdate | null;
  limits_updated: SettingUpdate | null;
  /** Admin only: recent changes, newest first */
  history: { at: string; by: string | null; text: string }[] | null;
}

export interface SettingUpdate {
  by: { id: number; name: string } | null;
  at: string;
}

/** Returned with HTTP 409 when a working key would be replaced without confirmation. */
export interface ConfirmReplaceInfo {
  code: 'confirm_replace';
  message: string;
  current: { key_hint: string; source: 'app' | 'env' | null; updated_by: string | null; updated_at: string | null };
}

export interface GeminiModelOption {
  id: string;
  name: string;
  description: string | null;
}

export const assistantSettingsApi = {
  get: () => api.get<AssistantSettingsStatus>('/assistant/settings').then((r) => r.data),
  models: () => api.get<{ source: 'google' | 'builtin'; models: GeminiModelOption[] }>('/admin/assistant/models').then((r) => r.data),
  save: (data: { api_key?: string; model?: string; limit_per_user_daily?: number; limit_company_daily?: number; confirm_replace?: boolean }) =>
    api.put<AssistantSettingsStatus>('/admin/assistant/settings', data).then((r) => r.data),
  removeKey: () => api.delete<AssistantSettingsStatus>('/admin/assistant/settings/key').then((r) => r.data),
};

export const assistantApi = {
  load: () => api.get<AssistantState>('/assistant').then((r) => r.data),
  chat: (message: string, files: File[] = []) => {
    type ChatResponse = { user_message: AssistantMessage; reply: AssistantMessage; usage?: AssistantUsageStatus };
    if (!files.length) return api.post<ChatResponse>('/assistant/chat', { message }).then((r) => r.data);
    const form = new FormData();
    if (message) form.append('message', message);
    files.forEach((f) => form.append('attachments[]', f, f.name));
    // Files can take a while to upload and for Gemini to read.
    return api.post<ChatResponse>('/assistant/chat', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 }).then((r) => r.data);
  },
  clear: () => api.delete('/assistant/history'),
  apply: (items: ApplyItem[]) =>
    api.post<{ message: string; results: ApplyResult[] }>('/assistant/tasks/apply', { items }).then((r) => r.data),
};

/** "11/11/2026 14:05" in Vietnam time. */
export function formatDateTimeVN(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}
