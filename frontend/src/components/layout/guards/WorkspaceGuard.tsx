import { Navigate, Outlet, useParams } from 'react-router-dom';

export function WorkspaceGuard() {
  const { workspaceId } = useParams();

  if (!workspaceId) return <Navigate to="/home" replace />;

  return <Outlet />;
}
