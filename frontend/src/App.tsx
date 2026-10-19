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
import { LegacyBoardRedirect } from './components/layout/guards/LegacyBoardRedirect';
import { BoardCodeGuard } from './components/layout/guards/BoardCodeGuard';

// Pages
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const WorkspaceDetail = lazy(() => import('./pages/WorkspaceDetail').then((m) => ({ default: m.WorkspaceDetail })));
const BoardView = lazy(() => import('./pages/BoardView').then((m) => ({ default: m.BoardView })));
const ListView = lazy(() => import('./pages/ListView').then((m) => ({ default: m.ListView })));
const CalendarView = lazy(() => import('./pages/CalendarView').then((m) => ({ default: m.CalendarView })));
const BoardMembersView = lazy(() => import('./pages/BoardMembersView').then((m) => ({ default: m.BoardMembersView })));
const EmployeeManagementView = lazy(() => import('./pages/EmployeeManagementView').then((m) => ({ default: m.EmployeeManagementView })));
const DepartmentManagementView = lazy(() => import('./pages/DepartmentManagementView').then((m) => ({ default: m.DepartmentManagementView })));
const DepartmentDetailView = lazy(() => import('./pages/DepartmentDetailView').then((m) => ({ default: m.DepartmentDetailView })));
const WorkspaceHome = lazy(() => import('./pages/WorkspaceHome').then((m) => ({ default: m.WorkspaceHome })));
const NotificationPage = lazy(() => import('./pages/NotificationPage').then((m) => ({ default: m.NotificationPage })));
const MyTasksPage = lazy(() => import('./pages/MyTasksPage').then((m) => ({ default: m.MyTasksPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const BoardSettingsView = lazy(() => import('./pages/BoardSettingsView').then((m) => ({ default: m.BoardSettingsView })));

const WorkspaceDashboard = lazy(() =>
  import('./pages/WorkspaceDashboard').then((module) => ({ default: module.WorkspaceDashboard })),
);
const BoardWorkloadDashboard = lazy(() =>
  import('./pages/BoardWorkloadDashboard').then((module) => ({ default: module.BoardWorkloadDashboard })),
);
const BoardReviewView = lazy(() =>
  import('./pages/BoardReviewView').then((module) => ({ default: module.BoardReviewView })),
);
const PerformanceDashboardView = lazy(() =>
  import('./pages/PerformanceDashboardView').then((module) => ({ default: module.PerformanceDashboardView })),
);
const PerformancePolicyView = lazy(() =>
  import('./pages/PerformancePolicyView').then((module) => ({ default: module.PerformancePolicyView })),
);
const TrashView = lazy(() =>
  import('./pages/TrashView').then((module) => ({ default: module.TrashView })),
);


import { useUIStore } from './store/uiStore';
import { ReloadPrompt } from './components/pwa/ReloadPrompt';

function App() {
  const isDarkMode = useUIStore(state => state.isDarkMode);
  
  return (
    <BrowserRouter>
      <ReloadPrompt />
      <Toaster position="top-right" theme={isDarkMode ? 'dark' : 'light'} richColors />
      <Routes>
        {/* Guest Routes */}
        <Route element={<GuestGuard />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
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
              <Route path="/dashboard" element={
                <Suspense fallback={<div className="animate-pulse p-8 font-medium text-primary">Đang tải Tổng quan...</div>}>
                  <WorkspaceDashboard />
                </Suspense>
              } />
              <Route path="/home" element={<HomePage />} />
              <Route path="/boards" element={<WorkspaceHome />} />
              <Route path="/workspaces" element={<Navigate to="/boards" replace />} />
              <Route path="/my-tasks" element={<MyTasksPage />} />
              <Route path="/notifications" element={<NotificationPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/account/settings" element={<SettingsPage />} />
              <Route path="/admin/employees" element={<EmployeeManagementView />} />
              <Route path="/admin/departments" element={<DepartmentManagementView />} />
              <Route path="/admin/departments/:departmentId" element={<DepartmentDetailView />} />
              <Route path="/trash" element={<TrashView />} />
            </Route>

            {/* Level 2: Workspace Layout - Redirect all redundant /w/:workspaceId URLs to /boards */}
            <Route path="/w/:workspaceId" element={<WorkspaceGuard />}>
              <Route path="dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="boards" element={<Navigate to="/boards" replace />} />
              <Route path="sprints" element={<Navigate to="/boards" replace />} />
              <Route path="members" element={<Navigate to="/boards" replace />} />
              <Route path="settings" element={<Navigate to="/boards" replace />} />
              <Route index element={<Navigate to="/boards" replace />} />

              {/* Old numeric URLs remain valid and redirect to the canonical public code. */}
              <Route path="b/:boardId/*" element={<LegacyBoardRedirect />} />
            </Route>

            <Route path="/b/:boardId/*" element={<LegacyBoardRedirect />} />

            {/* Canonical Trello-style board URL: /{public-code}/{view} */}
            <Route path="/:boardCode" element={<BoardCodeGuard />}>
              <Route element={<BoardLayout />}>
                <Route path="kanban" element={<BoardView />} />
                <Route path="list" element={<ListView />} />
                <Route path="calendar" element={<CalendarView />} />
                <Route path="dashboard" element={<BoardWorkloadDashboard />} />
                <Route path="members" element={<BoardMembersView />} />
                <Route path="review" element={<BoardReviewView />} />
                <Route path="performance" element={<PerformanceDashboardView />} />
                <Route path="performance-policy" element={<PerformancePolicyView />} />
                <Route path="settings" element={<BoardSettingsView />} />
                <Route path="trash" element={<TrashView />} />
                <Route index element={<Navigate to="kanban" replace />} />
              </Route>
            </Route>

            {/* Global Fallbacks and Redirects */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<PlaceholderPage title="404 - Không tìm thấy trang" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
