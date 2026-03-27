import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AmbientCursor } from './components/AmbientCursor.js';
import { AppShell } from './components/AppShell.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { useAppData } from './hooks/useAppData.js';
import { useSession } from './hooks/useSession.js';
import { useTheme } from './hooks/useTheme.js';
import { CourseWorkspacePage } from './pages/CourseWorkspacePage.js';
import { CoursesPage } from './pages/CoursesPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LibraryPage } from './pages/LibraryPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { TeamPage } from './pages/TeamPage.js';
import type { Role } from './types.js';

export default function App() {
  const { session, status, login, logout, refreshSession } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [role, setRole] = useState<Role>('Coordinador');
  const {
    appData,
    source,
    isLoading,
    refreshAppData,
  } = useAppData(status === 'authenticated');
  const authenticatedUser = session.user;
  const availableRoles =
    authenticatedUser?.role === 'Administrador'
      ? appData.roles
      : authenticatedUser
        ? [authenticatedUser.role]
        : [];
  const activeRole =
    authenticatedUser && availableRoles.includes(role) ? role : authenticatedUser?.role ?? role;

  useEffect(() => {
    if (!authenticatedUser) {
      return;
    }

    if (activeRole !== role) {
      setRole(activeRole);
    }
  }, [activeRole, authenticatedUser, role]);

  if (status === 'loading') {
    return (
      <main className="access-screen">
        <div className="control-grid" aria-hidden />
        <div className="access-screen__glow access-screen__glow--left" aria-hidden />
        <div className="access-screen__glow access-screen__glow--right" aria-hidden />
        <section className="access-screen__panel access-screen__panel--loading">
          <div className="access-screen__panel-head">
            <div className="access-screen__brand">
              <div className="access-screen__mark">M</div>
              <div>
                <span>Maturity</span>
                <strong>Control Center</strong>
              </div>
            </div>

            <ThemeToggle theme={theme} onToggle={toggleTheme} className="theme-switch--panel" />
          </div>

          <div className="access-screen__copy">
            <span className="access-screen__kicker">Preparando la sesión</span>
            <h1>Sincronizando tu espacio de trabajo.</h1>
            <p>Estamos validando acceso y preparando la capa operativa.</p>
          </div>

          <div className="access-screen__loading">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line skeleton-line--wide" />
            <div className="skeleton-line skeleton-line--medium" />
            <div className="access-screen__loading-cards">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!session.authenticated || !session.user) {
    return <LoginPage isLoading={false} onLogin={login} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <AppShell
      user={session.user}
      role={activeRole}
      availableRoles={availableRoles}
      onRoleChange={setRole}
      onLogout={logout}
      dataSource={source}
      isLoading={isLoading}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      <AmbientCursor />
      <Routes>
        <Route
          path="/"
          element={
            <DashboardPage
              role={activeRole}
              userRole={session.user.role}
              appData={appData}
              isLoading={isLoading}
              refreshAppData={refreshAppData}
            />
          }
        />
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
        <Route
          path="/library"
          element={
            <LibraryPage
              role={activeRole}
              userRole={session.user.role}
              appData={appData}
              refreshAppData={refreshAppData}
            />
          }
        />
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
