import type { ReactNode } from 'react';
import {
  CalendarClock,
  FolderKanban,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  MoveRight,
  ShieldCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { AuthUser, Role } from '../types.js';
import { formatPageDate } from '../utils/format.js';
import { useAmbientMotion } from '../hooks/useAmbientMotion.js';

interface AppShellProps {
  user: AuthUser;
  role: Role;
  availableRoles: Role[];
  onRoleChange: (role: Role) => void;
  onLogout: () => Promise<void>;
  dataSource: 'demo' | 'neon';
  isLoading: boolean;
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
      <div className="ambient-orb ambient-orb--left" aria-hidden />
      <div className="ambient-orb ambient-orb--right" aria-hidden />

      <aside className="sidebar">
        <NavLink to="/" className="brand-card">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">Maturity 360</p>
            <h1>Command center para producción académica.</h1>
          </div>
        </NavLink>

        <div className="sidebar-panel surface">
          <p className="sidebar-copy">
            Supervisa cursos, cuellos de botella y decisiones de calidad desde una sola capa operativa.
          </p>

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

          <div className="sidebar-note">
            <p className="eyebrow">Signal Layer</p>
            <strong>Velocidad operativa con trazabilidad.</strong>
            <p>
              Cada módulo conserva contexto, responsables y estado en tiempo real para evitar fricción entre etapas.
            </p>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-frame surface">
            <div className="topbar-copy">
              <span className="topbar-kicker">Maturity OS / Academic Production</span>
              <h2>Opera portafolio, calidad y ejecución desde una misma capa de control.</h2>
              <p>
                Una interfaz más nítida y tecnológica para coordinar responsables, hitos, alertas y avance real sin perder claridad.
              </p>
              <div className="topbar-signal-strip">
                <span>{`role:${role.toLowerCase()}`}</span>
                <span>{dataSource === 'neon' ? 'sync:live' : 'sync:demo'}</span>
                <span>{isLoading ? 'state:refreshing' : 'state:stable'}</span>
              </div>
            </div>

            <aside className="topbar-float surface-muted">
              <div className="topbar-float__avatar">{userInitials}</div>
              <span className="eyebrow">Nodo activo</span>
              <strong>{user.name}</strong>
              <p>{user.role}</p>
              <div className="topbar-float__meta">
                <span>{isLoading ? 'Refreshing live data' : dataSource === 'neon' ? 'Neon link established' : 'Demo sandbox active'}</span>
                <span>{formatPageDate()}</span>
              </div>
            </aside>
          </div>

          <div className="topbar-actions">
            <div className={dataSource === 'neon' ? 'status-chip status-chip--live' : 'status-chip'}>
              <span className="status-chip__dot" />
              <span>{isLoading ? 'Sincronizando' : dataSource === 'neon' ? 'Datos en vivo' : 'Modo demo'}</span>
            </div>

            <div className="date-chip">
              <CalendarClock size={16} />
              <span>{formatPageDate()}</span>
            </div>

            {availableRoles.length > 1 ? (
              <label className="role-switch">
                <span>Vista</span>
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

            <NavLink to="/courses" className="cta-button">
              <span>Ir al portafolio</span>
              <MoveRight size={16} />
            </NavLink>

            <button type="button" className="ghost-button" onClick={() => void onLogout()}>
              <LogOut size={16} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        <div className="content-stage">{children}</div>
      </main>

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
