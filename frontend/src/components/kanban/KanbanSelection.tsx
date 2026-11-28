import { createContext, useContext } from 'react';

/** Multi-select on the Kanban board: Ctrl/⌘/Shift + click (or the card checkbox) picks cards to move together. */
export interface KanbanSelection {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  /** Ids being dragged as a group (the other selected cards fade while dragging). */
  draggingIds: Set<string>;
}

export const KanbanSelectionContext = createContext<KanbanSelection | null>(null);

export function useKanbanSelection(): KanbanSelection | null {
  return useContext(KanbanSelectionContext);
}
