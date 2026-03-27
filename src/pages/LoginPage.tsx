import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle.js';
import type { ThemeMode } from '../hooks/useTheme.js';
import type { BrandingSettings } from '../types.js';

interface LoginPageProps {
  isLoading: boolean;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  theme: ThemeMode;
  onToggleTheme: () => void;
  branding: BrandingSettings;
}

export function LoginPage({
  isLoading,
  onLogin,
  theme,
  onToggleTheme,
  branding,
}: LoginPageProps) {
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

  const loginVariantClass =
    branding.loginVariant === 'Split'
      ? 'access-screen__panel access-screen__panel--split'
      : branding.loginVariant === 'Command'
        ? 'access-screen__panel access-screen__panel--command'
        : 'access-screen__panel';

  function renderBrandMark() {
    if (branding.logoMode === 'Imagen' && branding.logoUrl.trim()) {
      return <img className="access-screen__logo" src={branding.logoUrl} alt={branding.logoText} />;
    }

    if (branding.logoMode === 'Wordmark') {
      return <div className="access-screen__wordmark">{branding.logoText}</div>;
    }

    return <div className="access-screen__mark">{branding.shortMark}</div>;
  }

  return (
    <main className="access-screen">
      <div className="control-grid" aria-hidden />
      <div className="access-screen__glow access-screen__glow--left" aria-hidden />
      <div className="access-screen__glow access-screen__glow--right" aria-hidden />

      <section className={loginVariantClass}>
        <div className="access-screen__panel-head">
          <div className="access-screen__brand">
            {renderBrandMark()}
            <div>
              <span>{branding.logoText}</span>
              <strong>Control Center</strong>
            </div>
          </div>

          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="theme-switch--panel" />
        </div>

        <div className="access-screen__copy">
          <span className="access-screen__kicker">{branding.loginEyebrow}</span>
          <h1>{branding.loginHeadline}</h1>
          <p>{branding.loginMessage}</p>
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
            <span>{isLoading ? 'Conectando sesión…' : `Entrar a ${branding.platformName}`}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="access-screen__footnote">
          {branding.institutionName} · Diseñado para escritorio y preparado para experiencia tipo app móvil.
        </p>
      </section>
    </main>
  );
}
