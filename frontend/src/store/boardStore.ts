import { create } from 'zustand';
import api from '../lib/axios';
import type { Board, Task, Column } from '../types';

interface BoardState {
  board: Board | null;
  loading: boolean;
  boardsCache: Record<string, { data: Board, timestamp: number }>;
  inFlight: Record<string, Promise<any>>;
  fetchBoard: (boardId: string, force?: boolean) => Promise<void>;
  setBoard: (board: Board | ((prev: Board | null) => Board | null)) => void;
  clearCache: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  loading: false,
  boardsCache: {},
  inFlight: {},
  clearCache: () => set({ boardsCache: {}, board: null }),
  setBoard: (updater) => {
    set((state) => {
      const newBoard = typeof updater === 'function' ? updater(state.board) : updater;
      if (newBoard) {
        return {
          board: newBoard,
          boardsCache: {
            ...state.boardsCache,
            [newBoard.id]: { data: newBoard, timestamp: Date.now() }
          }
        };
      }
      return { board: newBoard };
    });
  },
  fetchBoard: async (boardId: string, force = false) => {
    const { boardsCache, inFlight, board } = get();
    
    // Check if we have a valid cache
    const cached = boardsCache[boardId];
    const isCacheValid = cached && (Date.now() - cached.timestamp < CACHE_TTL);
    
    if (cached && !force) {
      // If we have cache, immediately show it (even if expired, we show it while background fetching)
      if (!board || board.id !== boardId) {
        set({ board: cached.data, loading: false });
      }
      // If cache is valid, no need to fetch in background
      if (isCacheValid) return;
    } else {
      // No cache or force refresh, show spinner if we are switching boards
      if (!board || board.id !== boardId) {
        set({ loading: true, board: null });
      }
    }
    
    // Prevent duplicate concurrent requests
    if (inFlight[boardId]) {
      await inFlight[boardId];
      return;
    }
    
    const id = boardId.replace('board-', '') || '1';
    
    // Create fetch promise
    const fetchPromise = Promise.all([
      api.get(`/boards/${id}`),
      api.get(`/boards/${id}/kanban`)
    ]);
    
    set((state) => ({ inFlight: { ...state.inFlight, [boardId]: fetchPromise } }));
    
    try {
      const [boardRes, kanbanRes] = await fetchPromise;
      
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
          checklists: [],
          attachments: [],
          comments: [],
          totalChecklistsItems: t.total_checklists_items || 0,
          doneChecklistsItems: t.done_checklists_items || 0,
          commentsCount: t.comments_count || 0,
          attachmentsCount: t.attachments_count || 0,
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
      
      set((state) => {
        const nextInFlight = { ...state.inFlight };
        delete nextInFlight[boardId];
        return { 
          board: newBoard, 
          loading: false,
          inFlight: nextInFlight,
          boardsCache: {
            ...state.boardsCache,
            [boardId]: { data: newBoard, timestamp: Date.now() }
          }
        };
      });
    } catch (e) {
      set((state) => {
        const nextInFlight = { ...state.inFlight };
        delete nextInFlight[boardId];
        return { loading: false, inFlight: nextInFlight };
      });
      throw e;
    }
  }
}));
