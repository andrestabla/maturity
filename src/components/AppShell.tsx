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
            <h1>Project management para producción académica.</h1>
          </div>
        </NavLink>

        <div className="sidebar-panel surface">
          <p className="sidebar-copy">
            Una mesa de operación más editorial que burocrática para mover cursos, equipos y decisiones con una sola lectura.
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
            <p className="eyebrow">Pulso del día</p>
            <strong>Menos cajas, más continuidad visual.</strong>
            <p>
              La plataforma deja respirar la información, cruza capas y mantiene cerca lo importante sin saturar la vista.
            </p>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-frame surface">
            <div className="topbar-copy">
              <span className="topbar-kicker">Sistema operativo para producción académica</span>
              <h2>Una operación viva para cursos, equipos y decisiones que no caben en una grilla rígida.</h2>
              <p>
                Diseñada para coordinar criterio pedagógico, ritmo operativo y control de calidad con una lectura más humana del proceso.
              </p>
            </div>

            <aside className="topbar-float surface-muted">
              <div className="topbar-float__avatar">{userInitials}</div>
              <span className="eyebrow">Sesión activa</span>
              <strong>{user.name}</strong>
              <p>{user.role}</p>
              <div className="topbar-float__meta">
                <span>{isLoading ? 'Sincronizando capa real' : dataSource === 'neon' ? 'Neon conectado' : 'Modo demo activo'}</span>
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
                <span>Mirada actual</span>
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
              <span>Abrir portafolio</span>
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
