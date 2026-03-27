import type { ReactNode } from 'react';
import {
  BellDot,
  CalendarClock,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  ShieldCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { AuthUser, Role } from '../types.js';
import { formatPageDate } from '../utils/format.js';
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
  children: ReactNode;
}

const navigation = [
  { to: '/', label: 'Pulse', icon: LayoutDashboard },
  { to: '/courses', label: 'Cursos', icon: FolderKanban },
  { to: '/library', label: 'Biblioteca', icon: LibraryBig },
  { to: '/team', label: 'Gobierno', icon: ShieldCheck },
];

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
  children,
}: AppShellProps) {
  useAmbientMotion();

  const userInitials = user.name
    .split(' ')
    .map((segment) => segment[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="app-shell">
      <div className="control-grid" aria-hidden />
      <div className="ambient-orb ambient-orb--left" aria-hidden />
      <div className="ambient-orb ambient-orb--right" aria-hidden />

      <header className="control-header">
        <NavLink to="/" className="brand-card brand-card--inline">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">Maturity</p>
            <h1>Maturity</h1>
          </div>
        </NavLink>
        <span className="control-header__label">CONTROL CENTER</span>
      </header>

      <div className="control-layout">
        <aside className="sidebar sidebar--rail surface">
          <div className="rail-toggle" aria-hidden>
            <Menu size={18} />
          </div>
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
        </aside>

        <main className="main-panel">
          <header className="topbar surface">
            <div className="topbar-copy">
              <span className="topbar-kicker">LIVE OPERATING LAYER</span>
              <p>
                Portafolio, tareas, biblioteca y gobierno sincronizados en una misma capa.
              </p>
            </div>

            <div className="topbar-actions">
              <div className="topbar-icon" aria-hidden>
                <BellDot size={16} />
              </div>

              <ThemeToggle theme={theme} onToggle={onToggleTheme} />

              <div className={dataSource === 'neon' ? 'status-chip status-chip--live' : 'status-chip'}>
                <span className="status-chip__dot" />
                <span>{isLoading ? 'SYNCING' : dataSource === 'neon' ? 'LIVE SYNC' : 'DEMO MODE'}</span>
              </div>

              <div className="date-chip">
                <CalendarClock size={16} />
                <span>{formatPageDate()}</span>
              </div>

              {availableRoles.length > 1 ? (
                <label className="role-switch">
                  <span>VIEW</span>
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

              <button type="button" className="ghost-button" onClick={() => void onLogout()}>
                <LogOut size={16} />
                <span>Salir</span>
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
    </div>
  );
}
