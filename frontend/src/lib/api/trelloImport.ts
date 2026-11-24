import api from '../axios';

export interface TrelloSummary {
  name: string;
  lists: number;
  cards: number;
  archived_cards: number;
  checklists: number;
  check_items: number;
  comments: number;
  attachments: number;
  labels: number;
}

export interface TrelloImportResult {
  board_id: number;
  public_id: string;
  name: string;
  summary: TrelloSummary;
  warnings: string[];
  snapshot_token: string;
}

export interface TrelloPreview {
  preview_token: string;
  expires_at: string;
  summary: TrelloSummary;
  warnings: string[];
  members: { id: string; name: string; username?: string }[];
  columns: { name: string; archived: boolean; cards: number }[];
}

export const trelloImportApi = {
  preview: async (body: FormData | { source: 'api'; board_url: string; api_key: string; api_token: string }) => {
    const response = await api.post<TrelloPreview | { existing: TrelloImportResult }>(
      '/imports/trello/preview', body,
      { timeout: 300000, headers: body instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined },
    );
    return response.data;
  },
  confirm: async (previewToken: string, memberMap: Record<string, number | null>, projectId: number | null) => {
    const response = await api.post<TrelloImportResult>('/imports/trello/confirm', {
      preview_token: previewToken, member_map: memberMap, project_id: projectId,
    }, { timeout: 300000 });
    return response.data;
  },
  downloadSnapshot: async (token: string) => {
    const response = await api.get(`/imports/trello/${encodeURIComponent(token)}/snapshot`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trello-source.json';
    link.click();
    URL.revokeObjectURL(url);
  },
};
