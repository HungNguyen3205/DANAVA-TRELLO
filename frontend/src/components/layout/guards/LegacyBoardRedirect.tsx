import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import api from '../../../lib/axios';

export function LegacyBoardRedirect() {
  const { boardId } = useParams();
  const navigate = useNavigate();
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
        if (res.data && res.data.workspace_id) {
          // Found the workspace ID! Redirect to the new correct URL
          navigate(`/w/${res.data.workspace_id}/b/${id}/kanban${window.location.search}`, { replace: true });
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
  }, [boardId, navigate]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <div className="animate-pulse text-primary font-medium mb-4">Đang tìm Không gian làm việc của Bảng này...</div>
      </div>
    );
  }

  if (error) {
    return <Navigate to="/home" replace />;
  }

  return null;
}
