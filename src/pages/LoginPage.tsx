import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';

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
      <section className="auth-panel surface">
        <div className="auth-copy">
          <span className="hero-badge">Access Node</span>
          <span className="topbar-kicker">Maturity OS</span>
          <h1>La capa operativa de tu portafolio académico.</h1>
          <p>
            Entra con tu cuenta institucional para coordinar cursos, mover entregables y operar el flujo real sobre Neon desde una interfaz más tecnológica y precisa.
          </p>
          <div className="auth-highlights">
            <div>
              <strong>Live sync</strong>
              <span>La operación se actualiza desde Neon sin salir del mismo entorno de trabajo.</span>
            </div>
            <div>
              <strong>Role control</strong>
              <span>Cada sesión define el alcance real del usuario, sus permisos y su lectura operativa.</span>
            </div>
            <div>
              <strong>Unified workflow</strong>
              <span>Portafolio, tareas, gobierno y biblioteca conviven en una misma capa de control.</span>
            </div>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Ingreso</span>
              <h3>Entrar al control center</h3>
            </div>
          </div>

          <label className="field">
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

          <label className="field">
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
