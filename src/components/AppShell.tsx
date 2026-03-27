import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  BellDot,
  ChevronDown,
  ChevronRight,
  Command,
  FolderKanban,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { NavLink, matchPath, useLocation, useNavigate } from 'react-router-dom';
import type { AppData, AuthUser, BrandingSettings, Role } from '../types.js';
import { getVisibleCourses } from '../utils/domain.js';
import { useAmbientMotion } from '../hooks/useAmbientMotion.js';
import { ThemeToggle } from './ThemeToggle.js';
import type { ThemeMode } from '../hooks/useTheme.js';

interface AppShellProps {
  user: AuthUser;
  role: Role;
  availableRoles: Role[];
  onRoleChange: (role: Role) => void;
  onLogout: () => Promise<void>;
  dataSource: 'demo' | 'neon';
  isLoading: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  branding: BrandingSettings;
  appData: AppData;
  children: ReactNode;
}

interface CommandItem {
  id: string;
  title: string;
  meta: string;
  path: string;
  kind: 'view' | 'course' | 'user' | 'admin';
  keywords: string;
}

const commandKindLabel: Record<CommandItem['kind'], string> = {
  view: 'Vista',
  course: 'Curso',
  user: 'Usuario',
  admin: 'Ajuste',
};

const navigation = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/courses', label: 'Mis cursos', icon: FolderKanban },
  { to: '/library', label: 'Biblioteca', icon: LibraryBig },
  { to: '/team', label: 'Gobierno', icon: ShieldCheck },
];

const governmentTabLabels = {
  users: 'Usuarios',
  institution: 'Institución',
  branding: 'Branding',
  integrations: 'Integraciones',
  services: 'Servicios',
  logs: 'Logs',
  audit: 'Auditoría',
} as const;

const courseSectionLabels = {
  summary: 'Resumen',
  general: 'Información general',
  architecture: 'Arquitectura',
  planning: 'Planeación',
  production: 'Producción',
  resources: 'Recursos',
  lms: 'LMS',
  qa: 'QA y validación',
  history: 'Historial',
} as const;

export function AppShell({
  user,
  role,
  availableRoles,
  onRoleChange,
  onLogout,
  dataSource,
  isLoading,
  theme,
  onToggleTheme,
  branding,
  appData,
  children,
}: AppShellProps) {
  useAmbientMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const deferredCommandQuery = useDeferredValue(commandQuery);

  const userInitials = user.name
    .split(' ')
    .map((segment) => segment[0])
    .slice(0, 2)
    .join('');
  const visibleCourses = useMemo(() => getVisibleCourses(appData, role), [appData, role]);
  const isGovernmentEnabled =
    user.role === 'Administrador' || (user.secondaryRoles ?? []).includes('Administrador');
  const courseMatch = matchPath('/courses/:slug', location.pathname);
  const activeCourse =
    courseMatch?.params.slug
      ? appData.courses.find((course) => course.slug === courseMatch.params.slug)
      : null;
  const activeGovernmentHash = location.hash.replace('#', '');
  const activeCourseSectionHash = location.hash.replace('#', '');
  const pageMeta = useMemo(() => {
    if (location.pathname === '/') {
      return {
        title: 'Inicio',
        description: 'Vista general del flujo, alertas y actividad reciente.',
      };
    }

    if (location.pathname === '/courses') {
      return {
        title: 'Mis cursos',
        description: 'Explora expedientes, etapas, productos y avance por curso.',
      };
    }

    if (courseMatch && activeCourse) {
      const sectionLabel =
        courseSectionLabels[activeCourseSectionHash as keyof typeof courseSectionLabels];

      return {
        title: activeCourse.title,
        description: sectionLabel
          ? `Expediente del curso · ${sectionLabel}`
          : `Expediente del curso · ${activeCourse.program}`,
      };
    }

    if (location.pathname === '/library') {
      return {
        title: 'Biblioteca',
        description: 'Recursos propios y curados listos para producción.',
      };
    }

    if (location.pathname === '/team') {
      const sectionLabel =
        governmentTabLabels[activeGovernmentHash as keyof typeof governmentTabLabels];

      return {
        title: sectionLabel ? `Gobierno · ${sectionLabel}` : 'Gobierno',
        description: 'Configuración, usuarios, marca e integraciones de la plataforma.',
      };
    }

    return {
      title: branding.platformName,
      description: 'Navegación y operación de la plataforma.',
    };
  }, [
    activeCourse,
    activeCourseSectionHash,
    activeGovernmentHash,
    branding.platformName,
    courseMatch,
    location.pathname,
  ]);

  const breadcrumbs = useMemo(() => {
    if (location.pathname === '/') {
      return [{ label: 'Inicio', path: '/' }];
    }

    if (location.pathname === '/courses') {
      return [{ label: 'Mis cursos', path: '/courses' }];
    }

    if (courseMatch && activeCourse) {
      const items = [
        { label: 'Mis cursos', path: '/courses' },
        { label: activeCourse.faculty, path: '/courses' },
        { label: activeCourse.program, path: '/courses' },
        { label: activeCourse.title, path: `/courses/${activeCourse.slug}` },
      ];

      const sectionLabel =
        courseSectionLabels[activeCourseSectionHash as keyof typeof courseSectionLabels];

      if (sectionLabel && activeCourseSectionHash !== 'summary') {
        items.push({
          label: sectionLabel,
          path: `/courses/${activeCourse.slug}#${activeCourseSectionHash}`,
        });
      }

      return items;
    }

    if (location.pathname === '/library') {
      return [{ label: 'Biblioteca', path: '/library' }];
    }

    if (location.pathname === '/team') {
      const items = [{ label: 'Gobierno', path: '/team#users' }];
      const sectionLabel =
        governmentTabLabels[activeGovernmentHash as keyof typeof governmentTabLabels];

      if (sectionLabel && activeGovernmentHash !== 'users') {
        items.push({
          label: sectionLabel,
          path: `/team#${activeGovernmentHash}`,
        });
      }

      return items;
    }

    return [];
  }, [activeCourse, activeCourseSectionHash, activeGovernmentHash, courseMatch, location.pathname]);

  const commandItems = useMemo<CommandItem[]>(() => {
    const coreViews: CommandItem[] = [
      {
        id: 'view-pulse',
        title: 'Pulse',
        meta: 'Vista general del flujo',
        path: '/',
        kind: 'view',
        keywords: 'dashboard pulse inicio overview workflow',
      },
      {
        id: 'view-courses',
        title: 'Mis cursos',
        meta: 'Explorador de expedientes',
        path: '/courses',
        kind: 'view',
        keywords: 'cursos expediente portafolio mis cursos',
      },
      {
        id: 'view-library',
        title: 'Biblioteca',
        meta: 'Recursos y curación',
        path: '/library',
        kind: 'view',
        keywords: 'biblioteca recursos curacion resource',
      },
    ];

    const governmentViews: CommandItem[] = isGovernmentEnabled
      ? (Object.entries(governmentTabLabels) as Array<
          [keyof typeof governmentTabLabels, string]
        >).map(([id, label]) => ({
          id: `admin-${id}`,
          title: label,
          meta: 'Módulo Gobierno',
          path: `/team#${id}`,
          kind: 'admin',
          keywords: `gobierno ${label.toLowerCase()} administracion team settings`,
        }))
      : [];

    const courseViews: CommandItem[] = visibleCourses.map((course) => ({
      id: `course-${course.id}`,
      title: course.title,
      meta: `${course.faculty} · ${course.program}`,
      path: `/courses/${course.slug}`,
      kind: 'course',
      keywords: `${course.title} ${course.code} ${course.faculty} ${course.program} ${course.summary}`,
    }));

    const userViews: CommandItem[] = isGovernmentEnabled
      ? appData.users.map((member) => ({
          id: `user-${member.id}`,
          title: member.name,
          meta: `${member.role} · ${member.email}`,
          path: `/team?user=${member.id}#users`,
          kind: 'user',
          keywords: `${member.name} ${member.email} ${member.role} ${(member.secondaryRoles ?? []).join(' ')} usuario`,
        }))
      : [];

    return [...coreViews, ...governmentViews, ...courseViews, ...userViews];
  }, [appData.users, isGovernmentEnabled, visibleCourses]);

  const visibleCommandItems = useMemo(() => {
    const query = deferredCommandQuery.trim().toLowerCase();

    if (!query) {
      return commandItems.slice(0, 10);
    }

    return commandItems
      .filter((item) =>
        `${item.title} ${item.meta} ${item.keywords}`.toLowerCase().includes(query),
      )
      .slice(0, 12);
  }, [commandItems, deferredCommandQuery]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandOpen(true);
        return;
      }

      if (event.key === 'Escape') {
        setIsCommandOpen(false);
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  useEffect(() => {
    if (!isCommandOpen) {
      setCommandQuery('');
      setSelectedIndex(0);
      return;
    }

    commandInputRef.current?.focus();
  }, [isCommandOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [deferredCommandQuery]);

  function handleCommandSelect(item: CommandItem) {
    navigate(item.path);
    setIsCommandOpen(false);
  }

  function handleCommandInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) =>
        visibleCommandItems.length === 0 ? 0 : Math.min(current + 1, visibleCommandItems.length - 1),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const selectedItem = visibleCommandItems[selectedIndex];

      if (selectedItem) {
        event.preventDefault();
        handleCommandSelect(selectedItem);
      }
    }
  }

  function renderBrandMark() {
    if (branding.logoMode === 'Imagen' && branding.logoUrl.trim()) {
      return <img className="brand-logo-image" src={branding.logoUrl} alt={branding.logoText} />;
    }

    if (branding.logoMode === 'Wordmark') {
      return <div className="brand-wordmark">{branding.logoText}</div>;
    }

    return <div className="brand-mark">{branding.shortMark}</div>;
  }

  return (
    <div className="app-shell">
      <div className="control-grid" aria-hidden />
      <div className="ambient-orb ambient-orb--left" aria-hidden />
      <div className="ambient-orb ambient-orb--right" aria-hidden />

      <div className="control-layout">
        <aside className="sidebar sidebar--rail surface">
          <NavLink to="/" className="brand-card brand-card--sidebar">
            {renderBrandMark()}
            <div>
              <p className="eyebrow">{branding.institutionName}</p>
              <h1>{branding.logoText}</h1>
            </div>
          </NavLink>

          <nav className="sidebar-nav" aria-label="Navegación principal">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                isActive ? 'nav-link nav-link--active' : 'nav-link'
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-meta">
            <span className={dataSource === 'neon' ? 'status-chip status-chip--live' : 'status-chip'}>
              <span className="status-chip__dot" />
              <span>{isLoading ? 'Sincronizando' : dataSource === 'neon' ? 'Conectado' : 'Modo demo'}</span>
            </span>
          </div>
        </aside>

        <main className="main-panel">
          <header className="topbar surface">
            <button type="button" className="topbar-icon topbar-icon--menu" aria-label="Menú principal">
              <Menu size={18} />
            </button>

            <div className="topbar-copy">
              {breadcrumbs.length > 0 ? (
                <div className="app-breadcrumbs" aria-label="Migas de pan">
                  {breadcrumbs.map((item, index) => (
                    <button
                      key={`${item.label}-${index}`}
                      type="button"
                      className={
                        index === breadcrumbs.length - 1
                          ? 'app-breadcrumbs__item app-breadcrumbs__item--current'
                          : 'app-breadcrumbs__item'
                      }
                      onClick={() => navigate(item.path)}
                      disabled={index === breadcrumbs.length - 1}
                    >
                      {index > 0 ? <ChevronRight size={14} /> : null}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <span className="topbar-kicker">{branding.platformName}</span>
              <div className="topbar-title-row">
                <h2>{pageMeta.title}</h2>
                <span
                  className={
                    dataSource === 'neon' ? 'status-chip status-chip--live' : 'status-chip'
                  }
                >
                  <span className="status-chip__dot" />
                  <span>{isLoading ? 'SYNC' : dataSource === 'neon' ? 'LIVE' : 'DEMO'}</span>
                </span>
              </div>
              <p>{pageMeta.description}</p>
            </div>

            <div className="topbar-actions">
              <button
                type="button"
                className="command-trigger ghost-button"
                onClick={() => setIsCommandOpen(true)}
              >
                <Search size={16} />
                <span>Buscar...</span>
                <kbd>Ctrl K</kbd>
              </button>

              <div className="topbar-icon" aria-hidden>
                <BellDot size={16} />
              </div>

              <ThemeToggle theme={theme} onToggle={onToggleTheme} className="theme-switch--icon" />

              {availableRoles.length > 1 ? (
                <label className="role-switch">
                  <span>Rol</span>
                  <select
                    aria-label="Seleccionar rol"
                    value={role}
                    onChange={(event) => onRoleChange(event.target.value as Role)}
                  >
                    {availableRoles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="user-chip">
                <div className="topbar-float__avatar">{userInitials}</div>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.role}</span>
                </div>
                <ChevronDown size={14} />
              </div>

              <button
                type="button"
                className="topbar-icon"
                aria-label="Cerrar sesión"
                onClick={() => void onLogout()}
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          </header>

          <div className="content-stage">{children}</div>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? 'mobile-nav-link mobile-nav-link--active' : 'mobile-nav-link'
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {isCommandOpen ? (
        <div
          className="command-bar-backdrop"
          role="presentation"
          onClick={() => setIsCommandOpen(false)}
        >
          <section
            className="command-bar surface"
            role="dialog"
            aria-modal="true"
            aria-label="Buscar y saltar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="command-bar__head">
              <div>
                <span className="eyebrow">Navegación rápida</span>
                <h3>Buscar curso, usuario o ajuste</h3>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsCommandOpen(false)}>
                <span>Cerrar</span>
              </button>
            </div>

            <label className="field field--search command-bar__field">
              <span>Buscar</span>
              <div className="field__control">
                <Search size={16} />
                <input
                  ref={commandInputRef}
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  onKeyDown={handleCommandInputKeyDown}
                  placeholder="Cursos, usuarios, branding, integraciones..."
                />
              </div>
            </label>

            <div className="command-bar__list">
              {visibleCommandItems.length === 0 ? (
                <div className="empty-state empty-state--positive">
                  <strong>Sin coincidencias por ahora</strong>
                  <p>Prueba con un nombre de curso, un usuario o un ajuste de Gobierno.</p>
                </div>
              ) : (
                visibleCommandItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      index === selectedIndex
                        ? 'command-bar__item command-bar__item--active'
                        : 'command-bar__item'
                    }
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => handleCommandSelect(item)}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.meta}</p>
                    </div>
                    <span className="badge badge--outline">{commandKindLabel[item.kind]}</span>
                  </button>
                ))
              )}
            </div>

            <div className="command-bar__foot">
              <span>
                <Command size={14} /> Usa <strong>Ctrl + K</strong> para abrir este buscador desde cualquier pantalla.
              </span>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
