import { Navigate, Outlet, useParams } from 'react-router-dom';

export function BoardGuard() {
  const { workspaceId, boardId } = useParams();

  if (!workspaceId || !boardId) return <Navigate to={`/w/${workspaceId}/boards`} replace />;

  return <Outlet />;
}
