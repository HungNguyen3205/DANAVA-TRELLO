import api from '../axios';

export interface PreviewRowData {
  external_key: string;
  parent_external_key: string;
  is_subtask: boolean;
  title: string;
  description: string;
  notes?: string;
  column_id?: number;
  column_title?: string;
  priority: string;
  complexity: string;
  estimated_points?: number;
  progress_percent?: number;
  start_date?: string;
  due_date?: string;
  assignees: Array<{
    id: number;
    name: string;
    username: string;
    avatar?: string;
    contribution_percent?: number;
  }>;
  labels: string[];
  sprint_id?: number;
  sprint_title?: string;
  completed: boolean;
}

export interface PreviewRow {
  row_index: number;
  is_valid: boolean;
  errors: string[];
  data: PreviewRowData;
}

export interface ImportPreviewResponse {
  board_id: number;
  preview_token: string;
  is_valid: boolean;
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  created_at: string;
  rows: PreviewRow[];
}

export interface ImportConfirmResponse {
  success: boolean;
  imported_count: number;
  message: string;
}

/**
 * Download the official Board Task Excel import template.
 */
export async function downloadImportTemplate(boardIdOrCode: string): Promise<void> {
  const response = await api.get(`/boards/${boardIdOrCode}/tasks/import/template`, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'DANAVA_WORK_TASK_IMPORT_TEMPLATE.xlsx');
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Upload an Excel file and get back the validation preview.
 */
export async function previewTaskImport(boardIdOrCode: string, file: File): Promise<ImportPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<ImportPreviewResponse>(
    `/boards/${boardIdOrCode}/tasks/import/preview`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
}

/**
 * Confirm import and create all tasks in the board.
 */
export async function confirmTaskImport(
  boardIdOrCode: string,
  previewToken: string
): Promise<ImportConfirmResponse> {
  const response = await api.post<ImportConfirmResponse>(
    `/boards/${boardIdOrCode}/tasks/import/confirm`,
    { preview_token: previewToken }
  );

  return response.data;
}

/**
 * Download error spreadsheet for an invalid import session.
 */
export async function downloadImportErrors(boardIdOrCode: string, token: string): Promise<void> {
  const response = await api.get(`/boards/${boardIdOrCode}/tasks/import/errors/${token}`, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `DANAVA_IMPORT_ERRORS_${token}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}
