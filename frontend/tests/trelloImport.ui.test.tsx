import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrelloImportModal } from '../src/components/workspace/TrelloImportModal';
import { TrelloSourceDetails } from '../src/components/kanban/TrelloSourceDetails';
import { trelloImportApi } from '../src/lib/api/trelloImport';
import api from '../src/lib/axios';

vi.mock('../src/lib/api/trelloImport', () => ({
  trelloImportApi: { preview: vi.fn(), confirm: vi.fn(), downloadSnapshot: vi.fn() },
}));
vi.mock('../src/lib/api/projects', () => ({ projectsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../src/lib/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }) } }));

const preview = {
  preview_token: 'preview-token', expires_at: '2026-11-24T12:00:00Z',
  summary: { name: 'DANAVA DEV BUG', lists: 1, cards: 2, archived_cards: 1, checklists: 1, check_items: 3, comments: 4, attachments: 5, labels: 1 },
  members: [], columns: [{ name: 'Đang làm', cards: 2, archived: false }],
  warnings: ['Tệp được giữ bằng liên kết Trello gốc.'],
};

async function showPreview() {
  const user = userEvent.setup();
  render(<MemoryRouter><TrelloImportModal onClose={vi.fn()} onImported={vi.fn()} /></MemoryRouter>);
  await user.type(screen.getByLabelText('API key'), 'key');
  await user.type(screen.getByLabelText('Token quyền đọc'), 'token');
  await user.click(screen.getByRole('button', { name: 'Xem trước dữ liệu' }));
  await screen.findByText('DANAVA DEV BUG');
  return user;
}

describe('Trello import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trelloImportApi.preview).mockResolvedValue(preview);
    vi.mocked(trelloImportApi.downloadSnapshot).mockResolvedValue(undefined);
  });

  it('requires acknowledgement and retains the result with source download after confirming', async () => {
    vi.mocked(trelloImportApi.confirm).mockResolvedValue({
      board_id: 1, public_id: 'board', name: preview.summary.name, summary: preview.summary,
      warnings: preview.warnings, snapshot_token: 'snapshot-token',
    });
    const user = await showPreview();
    const confirm = screen.getByRole('button', { name: 'Nhập vào DANAVA' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('checkbox'));
    await user.click(confirm);
    await screen.findByRole('button', { name: 'Mở bảng đã nhập' });
    expect(trelloImportApi.confirm).toHaveBeenCalledWith('preview-token', {}, null);
    await user.click(screen.getByRole('button', { name: 'Tải dữ liệu nguồn JSON' }));
    expect(trelloImportApi.downloadSnapshot).toHaveBeenCalledWith('snapshot-token');
  });

  it('keeps the preview available for a retry after a backend failure', async () => {
    vi.mocked(trelloImportApi.confirm).mockRejectedValue({ response: { data: { errors: { preview_token: ['Phiên đã hết hạn.'] } } } });
    const user = await showPreview();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Nhập vào DANAVA' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Phiên đã hết hạn.'));
    expect(screen.getByRole('button', { name: 'Chọn lại nguồn' })).toBeTruthy();
  });

  it('renders source text safely and only permits HTTP or HTTPS attachment links', () => {
    render(<TrelloSourceDetails source={{ id: '1', name: '<script>alert(1)</script>', attachments: [
      { name: 'Unsafe', url: 'javascript:alert(1)' }, { name: 'Ảnh lỗi', url: 'https://trello.com/file.png' },
    ] }} />);
    expect(screen.queryByRole('link', { name: 'Unsafe' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ảnh lỗi' }).getAttribute('href')).toBe('https://trello.com/file.png');
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
  });
  it('suggests an employee with the same name and lets each member search an employee', async () => {
    const people = [
            { id: 9, name: 'Lê Tấn Thành', username: 'letanthanh' },
    ];
    vi.mocked(api.get).mockImplementation(async (_url, config) => {
      const q = String((config as { params: { q: string } }).params.q).toLowerCase();
      return { data: people.filter((p) => p.name.toLowerCase().includes(q) || p.username.includes(q)) };
    });
    vi.mocked(trelloImportApi.preview).mockResolvedValue({ ...preview, members: [
      { id: 'm1', name: 'Nguyễn Nam Hùng', username: 'nguynnamhung2', suggested_user: { id: 7, name: 'Nguyễn Nam Hùng', username: 'namhung' } },
      { id: 'm2', name: 'Trang Pham', username: 'trangpham' },
    ] });
    vi.mocked(trelloImportApi.confirm).mockResolvedValue({
      board_id: 1, public_id: 'board', name: preview.summary.name, summary: preview.summary,
      warnings: preview.warnings, snapshot_token: 'snapshot-token',
    });
    const user = await showPreview();
    // The server suggested an employee: shown as matched without any search request.
    await screen.findByText('Gợi ý');
    expect(screen.getByText('@namhung')).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
    // No suggestion for the second member: search and pick an employee.
    await user.type(screen.getByLabelText('Tìm nhân viên cho Trang Pham'), 'thành');
    await user.click(await screen.findByRole('option', { name: /Lê Tấn Thành/ }));
    expect(screen.getByText('Đã ghép 2/2')).toBeTruthy();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Nhập vào DANAVA' }));
    await waitFor(() => expect(trelloImportApi.confirm).toHaveBeenCalledWith('preview-token', { m1: 7, m2: 9 }, null));
  });
});
