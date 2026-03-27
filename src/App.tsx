import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AmbientCursor } from './components/AmbientCursor.js';
import { AppShell } from './components/AppShell.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { defaultBranding } from './data/mockData.js';
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

function createMonogramFavicon(label: string, background: string, foreground: string) {
  const safeLabel = (label || 'M').slice(0, 2);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="18" fill="${background}" />
      <text x="32" y="38" text-anchor="middle" font-family="IBM Plex Sans, Arial, sans-serif" font-size="28" font-weight="700" fill="${foreground}">${safeLabel}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function App() {
  const { session, status, login, logout, refreshSession } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [role, setRole] = useState<Role>('Coordinador');
  const [branding, setBranding] = useState(defaultBranding);
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
        ? Array.from(new Set([authenticatedUser.role, ...(authenticatedUser.secondaryRoles ?? [])]))
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

  useEffect(() => {
    if (status === 'authenticated') {
      setBranding(appData.branding);
      return;
    }

    let cancelled = false;

    async function loadBranding() {
      try {
        const response = await fetch('/api/public-config', {
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { branding?: typeof defaultBranding };

        if (!cancelled && payload.branding) {
          setBranding(payload.branding);
        }
      } catch {
        /* noop */
      }
    }

    void loadBranding();

    return () => {
      cancelled = true;
    };
  }, [appData.branding, status]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', branding.primaryColor);
    document.documentElement.style.setProperty('--accent-strong', branding.accentColor);
    document.documentElement.style.setProperty('--font-body', `"${branding.bodyFontFamily}", sans-serif`);
    document.documentElement.style.setProperty('--font-display', `"${branding.displayFontFamily}", sans-serif`);
    document.documentElement.style.setProperty('--font-mono', `"${branding.monoFontFamily}", monospace`);
    document.title = branding.platformName;

    const faviconHref =
      branding.faviconMode === 'Imagen' && branding.faviconUrl.trim()
        ? branding.faviconUrl.trim()
        : createMonogramFavicon(branding.faviconLabel, branding.primaryColor, '#061018');
    let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");

    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }

    favicon.href = faviconHref;
  }, [branding]);

  function renderBrandMark() {
    if (branding.logoMode === 'Imagen' && branding.logoUrl.trim()) {
      return <img className="access-screen__logo" src={branding.logoUrl} alt={branding.logoText} />;
    }

    if (branding.logoMode === 'Wordmark') {
      return <div className="access-screen__wordmark">{branding.logoText}</div>;
    }

    return <div className="access-screen__mark">{branding.shortMark}</div>;
  }

  if (status === 'loading') {
    return (
      <main className="access-screen">
        <div className="control-grid" aria-hidden />
        <div className="access-screen__glow access-screen__glow--left" aria-hidden />
        <div className="access-screen__glow access-screen__glow--right" aria-hidden />
        <section className="access-screen__panel access-screen__panel--loading">
          <div className="access-screen__panel-head">
            <div className="access-screen__brand">
              {renderBrandMark()}
              <div>
                <span>{branding.logoText}</span>
                <strong>Control Center</strong>
              </div>
            </div>

            <ThemeToggle theme={theme} onToggle={toggleTheme} className="theme-switch--panel" />
          </div>

          <div className="access-screen__copy">
            <span className="access-screen__kicker">{branding.loaderLabel}</span>
            <h1>Sincronizando tu espacio de trabajo.</h1>
            <p>{branding.loaderMessage}</p>
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
    return (
      <LoginPage
        isLoading={false}
        onLogin={login}
        theme={theme}
        onToggleTheme={toggleTheme}
        branding={branding}
      />
    );
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
      branding={branding}
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
