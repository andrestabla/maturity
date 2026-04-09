import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type { BrandingSettings } from '../types.js';

interface LoginPageProps {
  isLoading: boolean;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  branding: BrandingSettings;
}

export function LoginPage({
  isLoading,
  onLogin,
  branding,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { showAlert } = useSystemDialog();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await onLogin({
        email,
        password,
      });
    } catch (loginError) {
      void showAlert({
        title: 'No fue posible iniciar sesión',
        message:
        loginError instanceof Error
          ? loginError.message
          : 'No fue posible iniciar sesión.',
        tone: 'error',
        confirmLabel: 'Reintentar',
      });
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
        </div>

        <div className="access-screen__copy">
          <span className="access-screen__kicker">{branding.loginEyebrow}</span>
          <h1>{branding.loginHeadline}</h1>
          <p>{branding.loginMessage}</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Correo institucional</label>
            <div className="modern-select-wrapper">
              <input
                type="email"
                className="modern-input !bg-white/5 !border-white/10 !text-white focus:!border-ocean/40 focus:!ring-4 focus:!ring-ocean/10 placeholder:text-white/20"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@institucion.edu"
                autoComplete="username"
                required
              />
              <Mail size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div className="modern-select-wrapper">
              <input
                type="password"
                className="modern-input !bg-white/5 !border-white/10 !text-white focus:!border-ocean/40 focus:!ring-4 focus:!ring-ocean/10 placeholder:text-white/20"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu clave segura"
                autoComplete="current-password"
                required
              />
              <LockKeyhole size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20" />
            </div>
          </div>

          <button type="submit" className="cta-button w-full mt-4" disabled={isLoading}>
            <span>{isLoading ? 'Conectando sesión…' : `Entrar a ${branding.platformName}`}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="access-screen__footnote">
          {branding.institutionName} · Solución digital diseñada por Algoritmo T.
        </p>
      </section>
    </main>
  );
}
