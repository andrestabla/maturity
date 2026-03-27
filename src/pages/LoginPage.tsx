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
    <main className="access-screen">
      <div className="control-grid" aria-hidden />
      <div className="access-screen__glow access-screen__glow--left" aria-hidden />
      <div className="access-screen__glow access-screen__glow--right" aria-hidden />

      <section className="access-screen__panel">
        <div className="access-screen__brand">
          <div className="access-screen__mark">M</div>
          <div>
            <span>Maturity</span>
            <strong>Control Center</strong>
          </div>
        </div>

        <div className="access-screen__copy">
          <span className="access-screen__kicker">Academic Production OS</span>
          <h1>Entrar a Maturity</h1>
          <p>Accede para operar cursos, tareas y entregables desde una sola capa de control.</p>
        </div>

        <form className="access-screen__form" onSubmit={handleSubmit}>
          <label className="access-screen__field">
            <span>Correo</span>
            <div className="access-screen__input">
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

          <label className="access-screen__field">
            <span>Contraseña</span>
            <div className="access-screen__input">
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

          <button type="submit" className="access-screen__button" disabled={isLoading}>
            <span>{isLoading ? 'Conectando sesión…' : 'Entrar a Maturity'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="access-screen__footnote">
          Diseñado para escritorio y preparado para experiencia tipo app móvil.
        </p>
      </section>
    </main>
  );
}
