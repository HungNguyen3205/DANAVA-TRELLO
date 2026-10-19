import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate, useLocation } from 'react-router-dom';
import api from '../../../lib/axios';

export function LegacyBoardRedirect() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!boardId) {
      setError(true);
      setLoading(false);
      return;
    }

    const id = boardId.replace('board-', ''); // Just in case it has the 'board-' prefix

    api.get(`/boards/${id}`)
      .then((res) => {
        if (res.data?.public_id) {
          const requestedView = ['kanban', 'list', 'calendar', 'dashboard', 'members', 'settings']
            .find((view) => location.pathname.endsWith(`/${view}`)) || 'kanban';
          navigate(`/${res.data.public_id}/${requestedView}${location.search}`, { replace: true });
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [boardId, location.pathname, location.search, navigate]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <div className="animate-pulse text-primary font-medium mb-4">Đang mở bảng...</div>
      </div>
    );
  }

  if (error) {
    return <Navigate to="/boards" replace />;
  }

  return null;
}
