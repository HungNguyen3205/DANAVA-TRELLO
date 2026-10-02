import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';

export function GuestGuard() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return !isAuthenticated ? <Outlet /> : <Navigate to="/home" replace />;
}
