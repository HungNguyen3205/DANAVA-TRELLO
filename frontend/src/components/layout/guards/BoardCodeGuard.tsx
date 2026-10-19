import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useParams } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import api from '../../../lib/axios';
import { BoardRouteProvider, type BoardRouteInfo } from '../BoardRouteContext';

export function BoardCodeGuard() {
  const { boardCode } = useParams();
  const [routeInfo, setRouteInfo] = useState<BoardRouteInfo | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRouteInfo(null);
    setErrorStatus(null);

    if (!boardCode) {
      setErrorStatus(404);
      return;
    }

    api.get(`/boards/by-code/${encodeURIComponent(boardCode)}`)
      .then(({ data }) => {
        if (cancelled) return;
        setRouteInfo({
          boardId: String(data.id),
          boardCode: String(data.public_id),
          workspaceId: String(data.workspace_id || ''),
          basePath: `/${data.public_id}`,
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorStatus(err?.response?.status || 404);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardCode]);

  if (errorStatus === 403) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-600 flex items-center justify-center mb-4 shadow-sm border border-red-500/20">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">403 - Bạn không có quyền truy cập bảng này</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          Liên kết này thuộc về một bảng làm việc riêng tư. Bạn cần được Chủ sở hữu hoặc Quản trị viên của bảng thêm vào danh sách thành viên trước khi có thể xem nội dung.
        </p>
        <Link
          to="/boards"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-[#5B4BD6] transition-colors shadow-sm"
        >
          <ArrowLeft size={16} /> Quay về Bảng của tôi
        </Link>
      </div>
    );
  }

  if (errorStatus === 404) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-muted text-muted-foreground flex items-center justify-center mb-4 shadow-sm border border-border">
          <LayoutDashboard size={32} />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">404 - Không tìm thấy bảng làm việc</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          Bảng làm việc bạn đang cố truy cập không tồn tại hoặc liên kết đã bị xóa.
        </p>
        <Link
          to="/boards"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-[#5B4BD6] transition-colors shadow-sm"
        >
          <ArrowLeft size={16} /> Quay về Bảng của tôi
        </Link>
      </div>
    );
  }

  if (errorStatus) return <Navigate to="/boards" replace />;

  if (!routeInfo) {
    return <div className="flex flex-1 items-center justify-center text-primary font-medium animate-pulse">Đang mở bảng...</div>;
  }

  return (
    <BoardRouteProvider value={routeInfo}>
      <Outlet />
    </BoardRouteProvider>
  );
}
