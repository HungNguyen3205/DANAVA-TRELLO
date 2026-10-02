import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { lazy, Suspense } from 'react';

// Layouts
import { AppLayout } from './components/layout/AppLayout';
import { PersonalLayout } from './components/layout/PersonalLayout';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { BoardLayout } from './components/layout/BoardLayout';

// Guards
import { AuthGuard } from './components/layout/guards/AuthGuard';
import { GuestGuard } from './components/layout/guards/GuestGuard';
import { WorkspaceGuard } from './components/layout/guards/WorkspaceGuard';
import { BoardGuard } from './components/layout/guards/BoardGuard';
import { LegacyBoardRedirect } from './components/layout/guards/LegacyBoardRedirect';

// Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const WorkspaceDetail = lazy(() => import('./pages/WorkspaceDetail').then((m) => ({ default: m.WorkspaceDetail })));
const BoardView = lazy(() => import('./pages/BoardView').then((m) => ({ default: m.BoardView })));
const ListView = lazy(() => import('./pages/ListView').then((m) => ({ default: m.ListView })));
const CalendarView = lazy(() => import('./pages/CalendarView').then((m) => ({ default: m.CalendarView })));
const BoardMembersView = lazy(() => import('./pages/BoardMembersView').then((m) => ({ default: m.BoardMembersView })));
const EmployeeManagementView = lazy(() => import('./pages/EmployeeManagementView').then((m) => ({ default: m.EmployeeManagementView })));
const WorkspaceHome = lazy(() => import('./pages/WorkspaceHome').then((m) => ({ default: m.WorkspaceHome })));
const NotificationPage = lazy(() => import('./pages/NotificationPage').then((m) => ({ default: m.NotificationPage })));
const MyTasksPage = lazy(() => import('./pages/MyTasksPage').then((m) => ({ default: m.MyTasksPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const BoardSettingsView = lazy(() => import('./pages/BoardSettingsView').then((m) => ({ default: m.BoardSettingsView })));

const WorkspaceDashboard = lazy(() =>
  import('./pages/WorkspaceDashboard').then((module) => ({ default: module.WorkspaceDashboard })),
);


import { useUIStore } from './store/uiStore';

function App() {
  const isDarkMode = useUIStore(state => state.isDarkMode);
  
  return (
    <BrowserRouter>
      <Toaster position="top-right" theme={isDarkMode ? 'dark' : 'light'} richColors />
      <Routes>
        {/* Guest Routes */}
        <Route element={<GuestGuard />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        
        {/* Private Routes */}
        <Route element={<AuthGuard />}>
          <Route element={
            <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>}>
              <AppLayout />
            </Suspense>
          }>
            
            {/* Level 1: Personal Layout */}
            <Route element={<PersonalLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/workspaces" element={<WorkspaceHome />} />
              <Route path="/my-tasks" element={<MyTasksPage />} />
              <Route path="/notifications" element={<NotificationPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/account/settings" element={<SettingsPage />} />
              <Route path="/admin/employees" element={<EmployeeManagementView />} />
            </Route>

            {/* Level 2: Workspace Layout */}
            <Route path="/w/:workspaceId" element={<WorkspaceGuard />}>
              <Route element={<WorkspaceLayout />}>
                <Route path="dashboard" element={
                  <Suspense fallback={<div className="animate-pulse p-8 font-medium text-primary">Đang tải Dashboard...</div>}>
                    <WorkspaceDashboard />
                  </Suspense>
                } />
                <Route path="boards" element={<WorkspaceDetail />} />
                <Route path="sprints" element={<PlaceholderPage title="Quản lý Sprint" />} />
                <Route path="members" element={<PlaceholderPage title="Thành viên" />} />
                <Route path="settings" element={<PlaceholderPage title="Cài đặt Không gian" />} />
                {/* Legacy redirect for old URLs */}
                <Route index element={<Navigate to="boards" replace />} />
              </Route>

              {/* Level 3: Board Layout */}
              <Route path="b/:boardId" element={<BoardGuard />}>
                <Route element={<BoardLayout />}>
                  <Route path="kanban" element={<BoardView />} />
                  <Route path="list" element={<ListView />} />
                  <Route path="calendar" element={<CalendarView />} />
                  <Route path="members" element={<BoardMembersView />} />
                  <Route path="settings" element={<BoardSettingsView />} />
                  <Route index element={<Navigate to="kanban" replace />} />
                </Route>
              </Route>
            </Route>

            {/* Global Fallbacks and Redirects */}
            <Route path="/b/:boardId" element={<LegacyBoardRedirect />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<PlaceholderPage title="404 - Không tìm thấy trang" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
