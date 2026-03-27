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
          <span className="hero-badge">Acceso seguro</span>
          <h1>Maturity entra en su siguiente fase: operación real con sesiones y trazabilidad viva.</h1>
          <p>
            Accede con tu usuario institucional para administrar cursos, mover tareas y activar el flujo real sobre Neon.
          </p>
          <div className="auth-highlights">
            <div>
              <strong>Producción</strong>
              <span>La plataforma ya está publicada y conectada a Vercel.</span>
            </div>
            <div>
              <strong>Persistencia</strong>
              <span>Los datos operativos viajan desde Neon en la misma interfaz de producto.</span>
            </div>
            <div>
              <strong>Roles</strong>
              <span>La sesión define el alcance real del usuario dentro del flujo.</span>
            </div>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Ingreso</span>
              <h3>Iniciar sesión</h3>
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
                placeholder="tu-correo@institucion.edu"
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
                placeholder="Tu contraseña"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="cta-button auth-submit" disabled={isLoading}>
            <span>{isLoading ? 'Entrando…' : 'Entrar a Maturity'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
