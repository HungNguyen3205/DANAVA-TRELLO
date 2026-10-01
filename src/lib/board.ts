import type { Board, Task } from "../types/index.ts";
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function overdue(task: Task, board: Board) {
  return (
    !!task.dueDate &&
    task.dueDate < today() &&
    !board.columns.find((c) => c.id === task.columnId)?.completed
  );
}
export function moveTask(
  board: Board,
  id: string,
  targetColumn: string,
  targetId?: string,
): Board {
  const task = board.tasks.find((t) => t.id === id);
  if (
    !task ||
    !board.columns.some((c) => c.id === targetColumn) ||
    targetId === id
  )
    return board;
  const tasks = board.tasks.filter((t) => t.id !== id);
  const updated = { ...task, columnId: targetColumn };
  const before = targetId ? tasks.findIndex((t) => t.id === targetId) : -1;
  if (before >= 0) {
    const movingDown =
      task.columnId === targetColumn &&
      board.tasks.findIndex((t) => t.id === id) <
        board.tasks.findIndex((t) => t.id === targetId);
    tasks.splice(before + (movingDown ? 1 : 0), 0, updated);
  } else {
    const last = tasks.map((t) => t.columnId).lastIndexOf(targetColumn);
    tasks.splice(last >= 0 ? last + 1 : tasks.length, 0, updated);
  }
  return { ...board, tasks };
}
export function moveColumn(board: Board, from: string, to: string): Board {
  const start = board.columns.findIndex((c) => c.id === from),
    end = board.columns.findIndex((c) => c.id === to);
  if (start < 0 || end < 0 || start === end) return board;
  const columns = [...board.columns];
  const [column] = columns.splice(start, 1);
  columns.splice(end, 0, column);
  return { ...board, columns };
}
export function logActivity(board: Board, text: string, author: string): Board {
  return {
    ...board,
    activity: [
      {
        id: crypto.randomUUID(),
        text,
        author,
        createdAt: new Date().toISOString(),
      },
      ...board.activity,
    ].slice(0, 150),
  };
}
