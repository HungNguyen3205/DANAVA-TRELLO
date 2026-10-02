import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from './components/layout/AppLayout';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { WorkspaceDetail } from './pages/WorkspaceDetail';
import { BoardView } from './pages/BoardView';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuthStore } from './store/authStore';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" theme="dark" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Main Application with Top Navigation */}
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          
          {/* Workspace Routing (Includes Sidebar) */}
          <Route path="/" element={<WorkspaceLayout />}>
            <Route index element={
              // Redirect to the first workspace logic is handled inside WorkspaceLayout
              // We just need a dummy element or empty state here if no workspaces exist
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-pulse font-medium">
                Đang tải Không gian làm việc...
              </div>
            } />
            <Route path="w/:workspaceId" element={<WorkspaceDetail />} />
          </Route>
          
          {/* Board Routing (No Sidebar, Full Width) */}
          <Route path="b/:boardId" element={<BoardView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
