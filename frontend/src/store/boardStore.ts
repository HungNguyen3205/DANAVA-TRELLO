import { create } from 'zustand';
import api from '../lib/axios';
import type { Board, Task, Column } from '../types';

interface BoardState {
  board: Board | null;
  loading: boolean;
  fetchBoard: (boardId: string, force?: boolean) => Promise<void>;
  setBoard: (board: Board | ((prev: Board | null) => Board | null)) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  loading: false,
  setBoard: (updater) => {
    set((state) => ({
      board: typeof updater === 'function' ? updater(state.board) : updater
    }));
  },
  fetchBoard: async (boardId: string, force = false) => {
    const { board } = get();
    // Use cached if same board and not forced
    if (board && board.id === boardId && !force) {
      return;
    }
    
    set({ loading: true });
    try {
      const id = boardId.replace('board-', '') || '1';
      // Fetch both APIs in parallel to save time
      const [boardRes, kanbanRes] = await Promise.all([
        api.get(`/boards/${id}`),
        api.get(`/boards/${id}/kanban`)
      ]);
      
      const bData = boardRes.data;
      const columnsData = kanbanRes.data;
      
      const formattedColumns: Column[] = columnsData.map((c: any) => ({
        id: String(c.id),
        title: c.title,
        color: c.color,
      }));

      const formattedTasks: Task[] = columnsData.flatMap((c: any) => 
        c.tasks.map((t: any) => ({
          id: String(t.id),
          columnId: String(t.column_id),
          title: t.title,
          description: t.description || '',
          priority: t.priority,
          labels: t.labels ? t.labels.map((l: any) => ({ id: String(l.id), name: l.name, color: l.color })) : [],
          assigneeId: t.assignee_id ? String(t.assignee_id) : '',
          collaborators: [],
          startDate: t.start_date || '',
          dueDate: t.due_date || '',
          checklists: (t.checklists || []).map((cl: any) => ({
            id: String(cl.id),
            title: cl.title,
            items: (cl.items || []).map((i: any) => ({
              id: String(i.id),
              text: i.content,
              done: !!i.is_completed
            }))
          })),
          attachments: (t.attachments || []).map((a: any) => ({
            id: String(a.id),
            fileName: a.file_name,
            filePath: a.file_path,
            mimeType: a.mime_type,
            size: a.size,
            userId: String(a.user_id),
            createdAt: a.created_at
          })),
          comments: t.comments || []
        }))
      );

      const newBoard = {
        id: String(bData.id),
        title: bData.name,
        name: bData.name,
        description: bData.description,
        color: bData.color,
        workspace: bData.workspace,
        columns: formattedColumns,
        tasks: formattedTasks,
        users: bData.workspace?.members?.map((m: any) => ({
          id: String(m.id),
          name: m.name,
          initials: m.name.charAt(0).toUpperCase(),
          avatar: m.avatar
        })) || [],
        activity: [],
        sprints: bData.sprints || [],
        labels: bData.labels ? bData.labels.map((l: any) => ({ id: String(l.id), name: l.name, color: l.color })) : []
      };
      
      set({ board: newBoard, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  }
}));
