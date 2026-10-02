import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import { PromptModal } from '../components/ui/PromptModal';
import api from '../lib/axios';
import type { Board, Task, Column } from '../types';

export function BoardView() {
  const { boardId } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);

  const fetchBoard = useCallback(() => {
    const id = boardId?.replace('board-', '') || '1';
    
    api.get(`/boards/${id}`).then(res => {
      const bData = res.data;
      api.get(`/boards/${id}/kanban`).then(kanbanRes => {
        const columnsData = kanbanRes.data;
        
        const formattedColumns: Column[] = columnsData.map((c: any) => ({
          id: String(c.id),
          title: c.title,
        }));

        const formattedTasks: Task[] = columnsData.flatMap((c: any) => 
          c.tasks.map((t: any) => ({
            id: String(t.id),
            columnId: String(t.column_id),
            title: t.title,
            description: t.description || '',
            priority: t.priority,
            labels: [],
            assigneeId: t.assignee_id ? String(t.assignee_id) : '',
            collaborators: [],
            dueDate: t.due_date || '',
            checklist: [],
            comments: []
          }))
        );

        setBoard({
          title: bData.name,
          columns: formattedColumns,
          tasks: formattedTasks,
          users: [], 
          activity: []
        });
      });
    });
  }, [boardId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleOpen = (t: Task) => setActiveTask(t);
  
  const handleAdd = (columnId: string) => {
    setPromptData({
      isOpen: true,
      title: 'Nhập tên công việc mới:',
      onConfirm: async (title) => {
        if (title) {
          await api.post(`/columns/${columnId}/tasks`, { title });
          fetchBoard();
        }
        setPromptData(null);
      }
    });
  };

  const handleColumn = (c: Column | null) => {
    if (!c) {
      setPromptData({
        isOpen: true,
        title: 'Nhập tên cột mới:',
        onConfirm: async (title) => {
          if (title) {
            const id = boardId?.replace('board-', '') || '1';
            await api.post(`/boards/${id}/columns`, { title });
            fetchBoard();
          }
          setPromptData(null);
        }
      });
    }
  };
  
  const handleSave = async (b: Board, _text: string) => { 
    setBoard(b);
    const id = boardId?.replace('board-', '') || '1';
    const payload = b.tasks.map((t, idx) => ({
      id: Number(t.id),
      column_id: Number(t.columnId),
      order: idx * 1000
    }));
    api.put(`/boards/${id}/tasks/reorder`, { tasks: payload });
    return true; 
  };

  if (!board) return <div className="p-8 text-muted-foreground flex justify-center items-center h-full">Đang tải dữ liệu Bảng...</div>;

  return (
    <div className="flex-1 overflow-hidden h-full flex flex-col relative">
      <header className="px-6 py-4 flex items-center justify-between shrink-0 bg-card/30 border-b border-border">
        <h2 className="text-xl font-bold">{board.title}</h2>
      </header>
      <div className="flex-1 overflow-hidden p-6">
        <KanbanBoard 
          board={board}
          visibleTasks={board.tasks}
          onOpen={handleOpen}
          onAdd={handleAdd}
          onColumn={handleColumn}
          onSave={handleSave}
          disabled={false}
        />
      </div>

      {activeTask && (
        <TaskDetailModal 
          task={activeTask} 
          board={board}
          onClose={() => {
            setActiveTask(null);
            fetchBoard();
          }} 
        />
      )}

      {promptData && (
        <PromptModal 
          isOpen={promptData.isOpen}
          title={promptData.title}
          onConfirm={promptData.onConfirm}
          onCancel={() => setPromptData(null)}
        />
      )}
    </div>
  );
}
