import api from '../axios';

export interface TelegramIntegrationStatus {
  enabled: boolean;
  chat_id?: string | null;
  chat_id_masked?: string | null;
  chat_title?: string | null;
  status: 'disconnected' | 'pending' | 'connected' | 'error' | 'disabled';
  verified_at?: string | null;
  last_tested_at?: string | null;
  last_sent_at?: string | null;
  last_error_at?: string | null;
  last_error_message?: string | null;
  event_settings?: Record<string, boolean>;
  bot_configured?: boolean;
  bot_username?: string;
  can_manage?: boolean;
  delivery_mode?: 'inherit_department' | 'board_only' | 'department_only' | 'both' | 'disabled';
  allow_department_notification?: boolean;
  has_department?: boolean;
  inherited_department?: {
    department_id: number;
    department_name: string;
    department_code: string;
    has_integration: boolean;
    enabled: boolean;
    status: string;
    chat_title?: string | null;
    chat_id_masked?: string | null;
  } | null;
}

// ------------------------------------
// Department Telegram APIs
// ------------------------------------

export async function getDepartmentTelegram(deptId: number | string): Promise<TelegramIntegrationStatus> {
  const res = await api.get(`/admin/departments/${deptId}/telegram`);
  return res.data;
}

export async function updateDepartmentTelegram(
  deptId: number | string,
  data: { chat_id?: string | null; enabled: boolean; event_settings?: Record<string, boolean> }
): Promise<{ message: string }> {
  const res = await api.put(`/admin/departments/${deptId}/telegram`, data);
  return res.data;
}

export async function verifyDepartmentTelegram(
  deptId: number | string,
  chatId: string
): Promise<{ message: string; chat_id: string; chat_title: string; status: string }> {
  const res = await api.post(`/admin/departments/${deptId}/telegram/verify`, { chat_id: chatId });
  return res.data;
}

export async function testDepartmentTelegram(deptId: number | string): Promise<{ message: string; last_tested_at: string }> {
  const res = await api.post(`/admin/departments/${deptId}/telegram/test`);
  return res.data;
}

export async function disconnectDepartmentTelegram(deptId: number | string): Promise<{ message: string }> {
  const res = await api.delete(`/admin/departments/${deptId}/telegram`);
  return res.data;
}

// ------------------------------------
// Board Telegram APIs
// ------------------------------------

export async function getBoardTelegram(boardCodeOrId: string | number): Promise<TelegramIntegrationStatus> {
  const res = await api.get(`/boards/${boardCodeOrId}/telegram`);
  return res.data;
}

export async function updateBoardTelegram(
  boardCodeOrId: string | number,
  data: {
    delivery_mode: string;
    enabled: boolean;
    chat_id?: string | null;
    allow_department_notification?: boolean;
    event_settings?: Record<string, boolean>;
  }
): Promise<{ message: string }> {
  const res = await api.put(`/boards/${boardCodeOrId}/telegram`, data);
  return res.data;
}

export async function verifyBoardTelegram(
  boardCodeOrId: string | number,
  chatId: string
): Promise<{ message: string; chat_id: string; chat_title: string; status: string }> {
  const res = await api.post(`/boards/${boardCodeOrId}/telegram/verify`, { chat_id: chatId });
  return res.data;
}

export async function testBoardTelegram(boardCodeOrId: string | number): Promise<{ message: string; last_tested_at: string }> {
  const res = await api.post(`/boards/${boardCodeOrId}/telegram/test`);
  return res.data;
}

export async function disconnectBoardTelegram(boardCodeOrId: string | number): Promise<{ message: string }> {
  const res = await api.delete(`/boards/${boardCodeOrId}/telegram`);
  return res.data;
}
