import { useCallback, useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import type { Task } from '../types';

/**
 * "Việc của tôi" filter for a board's views (Kanban, Danh sách, Lịch).
 * A card counts as mine when I'm its assignee, one of its co-assignees or collaborators,
 * or when I'm assigned to any of its sub-tasks (the sub-task lives inside that card).
 */
export function isMyTask(task: Task, userId: string | number | null | undefined): boolean {
  if (userId == null || userId === '') return false;
  const me = String(userId);
  if (task.assigneeId != null && String(task.assigneeId) === me) return true;
  if (task.assignees?.some((u) => String(u.id) === me)) return true;
  if (task.collaborators?.some((id) => String(id) === me)) return true;
  return task.subtasks?.some((s) => isMyTask(s, me)) ?? false;
}

const storageKey = (boardId: string | number | null | undefined) => `board-only-mine:${boardId ?? 'none'}`;

function readStored(boardId: string | number | null | undefined): boolean {
  try {
    return localStorage.getItem(storageKey(boardId)) === '1';
  } catch {
    return false;
  }
}

/** On/off state for the filter, remembered per board in this browser. */
export function useOnlyMine(boardId: string | number | null | undefined): [boolean, () => void] {
  const [onlyMine, setOnlyMine] = useState(() => readStored(boardId));

  // Switching boards picks up that board's own setting.
  useEffect(() => {
    setOnlyMine(readStored(boardId));
  }, [boardId]);

  const toggle = useCallback(() => {
    setOnlyMine((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.setItem(storageKey(boardId), '1');
        else localStorage.removeItem(storageKey(boardId));
      } catch {
        /* storage blocked: the filter still works for this visit */
      }
      return next;
    });
  }, [boardId]);

  return [onlyMine, toggle];
}

/** Pill toggle shown next to a view's search box. */
export function OnlyMineToggle({ active, onToggle, size = 'sm' }: { active: boolean; onToggle: () => void; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? 'Đang chỉ hiện việc của tôi – bấm để hiện tất cả' : 'Chỉ hiện việc tôi được giao hoặc cùng thực hiện'}
      className={`${size === 'md' ? 'h-9 w-9' : 'h-8 w-8'} sm:w-auto sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-full border-[1.5px] text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
        active
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-card/70 border-border text-primary hover:bg-accent'
      }`}
    >
      <UserCheck size={15} className="shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Việc của tôi</span>
    </button>
  );
}
