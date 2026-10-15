import { createContext, useContext, type ReactNode } from 'react';

export interface BoardRouteInfo {
  boardId: string;
  boardCode: string;
  workspaceId: string;
  basePath: string;
}

const BoardRouteContext = createContext<BoardRouteInfo | null>(null);

export function BoardRouteProvider({ value, children }: { value: BoardRouteInfo; children: ReactNode }) {
  return <BoardRouteContext.Provider value={value}>{children}</BoardRouteContext.Provider>;
}

export function useBoardRoute(): BoardRouteInfo {
  const context = useContext(BoardRouteContext);
  if (!context) {
    throw new Error('useBoardRoute must be used inside BoardCodeGuard');
  }
  return context;
}
