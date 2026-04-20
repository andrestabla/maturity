import { Suspense, lazy, useEffect, useState } from 'react';
// Build 2026-04-09T20:31 v0.2.1 - Force cache invalidation
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppShell } from './components/AppShell.js';
import { SystemDialogProvider } from './components/SystemDialogProvider.js';
import { defaultBranding, defaultHomeContent } from './data/platformDefaults.js';
import { useAppData } from './hooks/useAppData.js';
import { useSession } from './hooks/useSession.js';
import { useTheme } from './hooks/useTheme.js';
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import type { Role } from './types.js';
import { canManageUsers } from './utils/permissions.js';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.js').then((module) => ({ default: module.DashboardPage })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage.js').then((module) => ({ default: module.AnalyticsPage })),
);
const HelpDeskPage = lazy(() =>
  import('./pages/HelpDeskPage.js').then((module) => ({ default: module.HelpDeskPage })),
);
const CoursesPage = lazy(() =>
  import('./pages/CoursesPage.js').then((module) => ({ default: module.CoursesPage })),
);
const CourseWorkspacePage = lazy(() =>
  import('./pages/CourseWorkspacePage.js').then((module) => ({
    default: module.CourseWorkspacePage,
  })),
);
const LibraryPage = lazy(() =>
  import('./pages/LibraryPage.js').then((module) => ({ default: module.LibraryPage })),
);
const TeamPage = lazy(() =>
  import('./pages/TeamPage.js').then((module) => ({ default: module.TeamPage })),
);
const UserProfilePage = lazy(() =>
  import('./pages/UserProfilePage.js').then((module) => ({ default: module.UserProfilePage })),
);
const HomeEditorPage = lazy(() =>
  import('./pages/HomeEditorPage.js').then((module) => ({ default: module.HomeEditorPage })),
);

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

function RouteSkeleton() {
  return (
    <div className="page-stack page-stack--loading">
      <section className="surface section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Cargando módulo</span>
            <h3>Preparando la siguiente vista</h3>
          </div>
        </div>
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--wide" />
        <div className="skeleton-line skeleton-line--medium" />
      </section>

      <section className="metrics-grid metrics-grid--three">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="surface section-card skeleton-panel skeleton-panel--medium" />
        ))}
      </section>
    </div>
  );
}

function LegacyAdminRedirect() {
  const location = useLocation();
  const { section } = useParams<{ section?: string }>();
  const nextPath = section ? `/admin/${section}` : '/admin';

  return <Navigate to={`${nextPath}${location.search}`} replace />;
}

export default function App() {
  const { session, status, login, logout, refreshSession } = useSession();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [branding, setBranding] = useState(defaultBranding);
  const [homeContent, setHomeContent] = useState(defaultHomeContent);
  const {
    appData,
    isLoading,
    error,
    refreshAppData,
    mutateAppData,
  } = useAppData(status === 'authenticated', session.user?.id ?? 'anonymous');
  const authenticatedUser = session.user;

  useEffect(() => {
    if (status === 'authenticated') {
      setBranding(appData.branding);
      setHomeContent(appData.homeContent);
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

        const payload = (await response.json()) as {
          branding?: typeof defaultBranding;
          homeContent?: typeof defaultHomeContent;
        };

        if (!cancelled && payload.branding) {
          setBranding(payload.branding);
        }
        if (!cancelled && payload.homeContent) {
          setHomeContent(payload.homeContent);
        }
      } catch {
        /* noop */
      }
    }

    void loadBranding();

    return () => {
      cancelled = true;
    };
  }, [appData.branding, appData.homeContent, status]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', branding.primaryColor);
    document.documentElement.style.setProperty('--accent-strong', branding.accentColor);
    document.documentElement.style.setProperty('--font-body', `"${branding.bodyFontFamily}", sans-serif`);
    document.documentElement.style.setProperty('--font-display', `"${branding.displayFontFamily}", sans-serif`);
    document.documentElement.style.setProperty('--font-mono', `"${branding.monoFontFamily}", monospace`);
    document.title =
      !session.authenticated && location.pathname !== '/login'
        ? `${branding.platformName} · Tecnología e IA para equipos académicos`
        : branding.platformName;

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
  }, [branding, location.pathname, session.authenticated]);

  function renderBrandMark() {
    if (branding.logoMode === 'Imagen' && branding.logoUrl.trim()) {
      return <img className="access-screen__logo" src={branding.logoUrl} alt={branding.logoText} />;
    }

    if (branding.logoMode === 'Wordmark') {
      return <div className="access-screen__wordmark">{branding.logoText}</div>;
    }

    return <div className="access-screen__mark">{branding.shortMark}</div>;
  }

  return (
    <SystemDialogProvider>
      {status === 'loading' ? (
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
      ) : !session.authenticated || !session.user ? (
        location.pathname === '/login' ? (
          <LoginPage
            isLoading={false}
            onLogin={login}
            branding={branding}
          />
        ) : (
          <LandingPage branding={branding} homeContent={homeContent} />
        )
      ) : (
        <AppShell
          user={session.user}
          role={session.user.role}
          onLogout={logout}
          branding={branding}
          appData={appData}
        >
          <Suspense fallback={<RouteSkeleton />}>
            <Routes>
          <Route
            path="/login"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                role={session.user.role}
                userRole={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
                refreshAppData={refreshAppData}
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <AnalyticsPage
                role={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
              />
            }
          />
          <Route
            path="/helpdesk"
            element={
              <HelpDeskPage
                role={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
                refreshAppData={refreshAppData}
              />
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/courses"
            element={
              <CoursesPage
                role={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
                dataError={error}
                userRole={session.user.role}
                refreshAppData={refreshAppData}
                mutateAppData={mutateAppData}
              />
            }
          />
          <Route
            path="/courses/:slug"
            element={
              <CourseWorkspacePage
                role={session.user.role}
                userRole={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
                refreshAppData={refreshAppData}
                mutateAppData={mutateAppData}
              />
            }
          />
          <Route
            path="/courses/:slug/:section"
            element={
              <CourseWorkspacePage
                role={session.user.role}
                userRole={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
                refreshAppData={refreshAppData}
                mutateAppData={mutateAppData}
              />
            }
          />
          <Route
            path="/courses/:slug/:section/producto/:productId"
            element={
              <CourseWorkspacePage
                role={session.user.role}
                userRole={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
                refreshAppData={refreshAppData}
                mutateAppData={mutateAppData}
              />
            }
          />
          <Route
            path="/courses/:slug/:section/:workspaceRoute"
            element={
              <CourseWorkspacePage
                role={session.user.role}
                userRole={session.user.role}
                viewer={session.user}
                appData={appData}
                isLoading={isLoading}
                refreshAppData={refreshAppData}
                mutateAppData={mutateAppData}
              />
            }
          />
          <Route
            path="/library"
            element={
              <LibraryPage
                role={session.user.role}
                userRole={session.user.role}
                viewer={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
              />
            }
          />
          <Route
            path="/edit"
            element={
              canManageUsers(session.user.role) ? (
                <HomeEditorPage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              <TeamPage
                user={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
              />
            }
          />
          <Route
            path="/admin/institution/settings"
            element={
              <TeamPage
                user={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
              />
            }
          />
          <Route
            path="/admin/institution/new"
            element={
              <TeamPage
                user={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
              />
            }
          />
          <Route
            path="/admin/institution/:structureId/edit"
            element={
              <TeamPage
                user={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
              />
            }
          />
          <Route
            path="/admin/institution/:structureId"
            element={
              <TeamPage
                user={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
              />
            }
          />
          <Route
            path="/admin/:section"
            element={
              <TeamPage
                user={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
              />
            }
          />
          <Route
            path="/admin/users/:userId"
            element={
              <UserProfilePage
                viewer={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
                theme={theme}
                onThemeChange={setTheme}
                activeRole={session.user.role}
                availableRoles={[session.user.role]}
                onRoleChange={() => {}}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <UserProfilePage
                viewer={session.user}
                appData={appData}
                refreshAppData={refreshAppData}
                refreshSession={refreshSession}
                theme={theme}
                onThemeChange={setTheme}
                activeRole={session.user.role}
                availableRoles={[session.user.role]}
                onRoleChange={() => {}}
              />
            }
          />
          <Route path="/team" element={<LegacyAdminRedirect />} />
          <Route path="/team/:section" element={<LegacyAdminRedirect />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      )}
    </SystemDialogProvider>
  );
}
