import { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import api from '../../../lib/axios';
import { BoardRouteProvider, type BoardRouteInfo } from '../BoardRouteContext';

export function BoardCodeGuard() {
  const { boardCode } = useParams();
  const [routeInfo, setRouteInfo] = useState<BoardRouteInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRouteInfo(null);
    setFailed(false);

    if (!boardCode) {
      setFailed(true);
      return;
    }

    api.get(`/boards/by-code/${encodeURIComponent(boardCode)}`)
      .then(({ data }) => {
        if (cancelled) return;
        setRouteInfo({
          boardId: String(data.id),
          boardCode: String(data.public_id),
          workspaceId: String(data.workspace_id),
          basePath: `/${data.public_id}`,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [boardCode]);

  if (failed) return <Navigate to="/workspaces" replace />;
  if (!routeInfo) {
    return <div className="flex flex-1 items-center justify-center text-primary font-medium animate-pulse">Đang mở bảng...</div>;
  }

  return (
    <BoardRouteProvider value={routeInfo}>
      <Outlet />
    </BoardRouteProvider>
  );
}
