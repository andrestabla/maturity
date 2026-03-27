import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AmbientCursor } from './components/AmbientCursor.js';
import { AppShell } from './components/AppShell.js';
import { useAppData } from './hooks/useAppData.js';
import { useSession } from './hooks/useSession.js';
import { CourseWorkspacePage } from './pages/CourseWorkspacePage.js';
import { CoursesPage } from './pages/CoursesPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LibraryPage } from './pages/LibraryPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { TeamPage } from './pages/TeamPage.js';
import type { Role } from './types.js';

export default function App() {
  const { session, status, login, logout, refreshSession } = useSession();
  const [role, setRole] = useState<Role>('Coordinador');
  const {
    appData,
    source,
    isLoading,
    refreshAppData,
  } = useAppData(status === 'authenticated');

  if (status === 'loading') {
    return (
      <>
        <AmbientCursor />
        <main className="auth-layout">
          <section className="auth-panel surface auth-panel--loading">
            <div className="loading-shell">
              <span className="hero-badge">Preparando la sesión</span>
              <div className="loading-shell__copy">
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--wide" />
                <div className="skeleton-line skeleton-line--medium" />
              </div>
              <div className="loading-shell__cards">
                <div className="skeleton-card" />
                <div className="skeleton-card" />
                <div className="skeleton-card skeleton-card--soft" />
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (!session.authenticated || !session.user) {
    return (
      <>
        <AmbientCursor />
        <LoginPage isLoading={false} onLogin={login} />
      </>
    );
  }

  const availableRoles = session.user.role === 'Administrador' ? appData.roles : [session.user.role];
  const activeRole = availableRoles.includes(role) ? role : session.user.role;

  useEffect(() => {
    if (activeRole !== role) {
      setRole(activeRole);
    }
  }, [activeRole, role]);

  return (
    <AppShell
      user={session.user}
      role={activeRole}
      availableRoles={availableRoles}
      onRoleChange={setRole}
      onLogout={logout}
      dataSource={source}
      isLoading={isLoading}
    >
      <AmbientCursor />
      <Routes>
        <Route path="/" element={<DashboardPage role={activeRole} appData={appData} isLoading={isLoading} />} />
        <Route
          path="/courses"
          element={
            <CoursesPage
              role={activeRole}
              appData={appData}
              userRole={session.user.role}
              refreshAppData={refreshAppData}
            />
          }
        />
        <Route
          path="/courses/:slug"
          element={
            <CourseWorkspacePage
              role={activeRole}
              userRole={session.user.role}
              appData={appData}
              refreshAppData={refreshAppData}
            />
          }
        />
        <Route path="/library" element={<LibraryPage role={activeRole} appData={appData} />} />
        <Route
          path="/team"
          element={
            <TeamPage
              role={activeRole}
              user={session.user}
              appData={appData}
              refreshAppData={refreshAppData}
              refreshSession={refreshSession}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
