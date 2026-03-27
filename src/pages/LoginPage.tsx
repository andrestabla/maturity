import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail, Orbit, ShieldCheck, Workflow } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface LoginPageProps {
  isLoading: boolean;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
}

export function LoginPage({ isLoading, onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(null);
      await onLogin({
        email,
        password,
      });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'No fue posible iniciar sesión.',
      );
    }
  }

  return (
    <main className="auth-layout">
      <div className="control-grid" aria-hidden />
      <div className="ambient-orb ambient-orb--left" aria-hidden />
      <div className="ambient-orb ambient-orb--right" aria-hidden />

      <header className="control-header control-header--auth">
        <NavLink to="/" className="brand-card brand-card--inline">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">Maturity</p>
            <h1>Maturity</h1>
          </div>
        </NavLink>
        <span className="control-header__label">CONTROL CENTER</span>
      </header>

      <section className="auth-panel surface">
        <div className="auth-copy auth-copy--reference">
          <span className="topbar-kicker">MATURITY 2.0</span>
          <h1>La capa operativa de tu portafolio académico.</h1>
          <p>
            Entra con tu cuenta institucional para coordinar cursos, mover entregables y operar el flujo real sobre Neon desde una interfaz precisa, sobria y continua.
          </p>

          <div className="auth-highlights auth-highlights--lined">
            <div>
              <Orbit size={18} />
              <div>
              <strong>Live sync</strong>
              <span>La operación se actualiza desde Neon sin salir del mismo entorno de trabajo.</span>
              </div>
            </div>
            <div>
              <ShieldCheck size={18} />
              <div>
              <strong>Role control</strong>
              <span>Cada sesión define el alcance real del usuario, sus permisos y su lectura operativa.</span>
              </div>
            </div>
            <div>
              <Workflow size={18} />
              <div>
              <strong>Unified workflow</strong>
              <span>Portafolio, tareas, gobierno y biblioteca conviven en una misma capa de control.</span>
              </div>
            </div>
          </div>
        </div>

        <form className="auth-form auth-form--reference" onSubmit={handleSubmit}>
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">ACCESS</span>
              <h3>Entrar al control center</h3>
            </div>
          </div>

          <label className="field field--line">
            <span>Correo</span>
            <div className="field__control">
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@institucion.edu"
                autoComplete="username"
                required
              />
            </div>
          </label>

          <label className="field field--line">
            <span>Contraseña</span>
            <div className="field__control">
              <LockKeyhole size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu clave actual"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="cta-button auth-submit" disabled={isLoading}>
            <span>{isLoading ? 'Conectando sesión…' : 'Entrar a Maturity'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
