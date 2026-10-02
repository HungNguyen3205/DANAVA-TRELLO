import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { LoginPage } from "./pages/LoginPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { BoardPage } from "./pages/BoardPage";
import "./App.css";
import "./Workspace.css";
function ApplicationRoutes() {
  const { user, loading } = useAuth();
  const { dark } = useTheme();
  if (loading)
    return (
      <div className="auth-screen">
        <p>Đang mở không gian làm việc…</p>
      </div>
    );
  return (
    <>
      <Toaster richColors theme={dark ? "dark" : "light"} />
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={user ? <WorkspacePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/workspaces/:workspaceId"
          element={user ? <WorkspacePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/boards/:boardId"
          element={user ? <BoardPage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ApplicationRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
