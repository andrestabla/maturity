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
          <span className="hero-badge">Acceso curado</span>
          <span className="topbar-kicker">Maturity 360</span>
          <h1>Un espacio de trabajo que se siente más editorial que burocrático.</h1>
          <p>
            Entra con tu cuenta institucional para coordinar cursos, mover entregables y sostener una operación real sobre Neon sin perder contexto.
          </p>
          <div className="auth-highlights">
            <div>
              <strong>Lectura clara</strong>
              <span>La interfaz prioriza foco, profundidad visual y pasos evidentes para cada rol.</span>
            </div>
            <div>
              <strong>Persistencia viva</strong>
              <span>Los datos operativos viajan desde Neon dentro de la misma experiencia de producto.</span>
            </div>
            <div>
              <strong>Alcance real</strong>
              <span>La sesión define exactamente qué puede ver, mover y aprobar cada persona.</span>
            </div>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Ingreso</span>
              <h3>Abrir mi espacio</h3>
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
            <span>{isLoading ? 'Abriendo tu espacio…' : 'Comenzar mi jornada'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
