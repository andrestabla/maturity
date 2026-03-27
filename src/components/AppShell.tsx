import type { ReactNode } from 'react';
import {
  CalendarClock,
  FolderKanban,
  LayoutDashboard,
  LibraryBig,
  MoveRight,
  ShieldCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { roles } from '../data/mockData.js';
import type { Role } from '../types.js';
import { formatPageDate } from '../utils/format.js';

interface AppShellProps {
  role: Role;
  onRoleChange: (role: Role) => void;
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
  role,
  onRoleChange,
  dataSource,
  isLoading,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand-card">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">Maturity</p>
            <h1>Academic production OS</h1>
          </div>
        </NavLink>

        <p className="sidebar-copy">
          Un solo entorno para organizar cursos, etapas, entregables, calidad y trazabilidad sin perder claridad.
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
          <p className="eyebrow">Enfoque</p>
          <strong>PM con ADN académico</strong>
          <p>
            El tablero prioriza ritmo, coherencia pedagógica y control por etapas desde el primer corte del producto.
          </p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar surface">
          <div className="topbar-copy">
            <span className="topbar-kicker">Project management platform para producción académica</span>
            <h2>Cada curso funciona como un proyecto vivo con equipo, ritmo, riesgos y criterio de calidad.</h2>
          </div>

          <div className="topbar-actions">
            <div className={dataSource === 'neon' ? 'status-chip status-chip--live' : 'status-chip'}>
              <span className="status-chip__dot" />
              <span>{isLoading ? 'Sincronizando' : dataSource === 'neon' ? 'Neon live' : 'Modo demo'}</span>
            </div>

            <div className="date-chip">
              <CalendarClock size={16} />
              <span>{formatPageDate()}</span>
            </div>

            <label className="role-switch">
              <span>Vista actual</span>
              <select
                aria-label="Seleccionar rol"
                value={role}
                onChange={(event) => onRoleChange(event.target.value as Role)}
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <NavLink to="/courses" className="cta-button">
              <span>Ver portafolio</span>
              <MoveRight size={16} />
            </NavLink>
          </div>
        </header>

        {children}
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
