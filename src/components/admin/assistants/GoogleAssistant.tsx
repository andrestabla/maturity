import {
  CalendarDays,
  Globe,
  KeyRound,
  Lock,
  ShieldCheck,
  Video,
} from 'lucide-react';

interface GoogleAssistantProps {
  integrationId: 'google-sso' | 'google-calendar' | 'google-meet';
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
}

const integrationMeta = {
  'google-sso': {
    title: 'Configuración de Google SSO',
    subtitle: 'Acceso institucional, dominio permitido y reglas de aprovisionamiento.',
    icon: ShieldCheck,
    tint: '#4285f4',
    steps: [
      'Registra Client ID y Client Secret desde Google Cloud Console.',
      'Define dominio institucional, modo de acceso y aprovisionamiento.',
      'Guarda la configuración y valida la autenticación desde Gobierno.',
    ],
  },
  'google-calendar': {
    title: 'Configuración de Google Calendar',
    subtitle: 'Sincroniza hitos, cronogramas y eventos de producción.',
    icon: CalendarDays,
    tint: '#0f9d58',
    steps: [
      'Registra las credenciales OAuth de Google y el identificador del calendario.',
      'Define timezone, alcance de sincronización y visibilidad.',
      'Guarda y ejecuta una prueba para validar lectura y escritura.',
    ],
  },
  'google-meet': {
    title: 'Configuración de Google Meet',
    subtitle: 'Asocia reuniones al flujo operativo sin salir de la plataforma.',
    icon: Video,
    tint: '#ea4335',
    steps: [
      'Conecta las credenciales OAuth válidas del ecosistema Google.',
      'Define cuándo se crean reuniones y a qué eventos del flujo se vinculan.',
      'Guarda la política y corre una prueba de disponibilidad.',
    ],
  },
} as const;

function GoogleSsoFields({
  config,
  onConfigChange,
}: Pick<GoogleAssistantProps, 'config' | 'onConfigChange'>) {
  return (
    <>
      <div className="form-row">
        <label className="field">
          <span>Modo de acceso</span>
          <div className="field__control">
            <select
              value={config.mode || 'Opcional'}
              onChange={(event) => onConfigChange('mode', event.target.value)}
            >
              {['Opcional', 'Obligatorio', 'Desactivado'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="field">
          <span>Aprovisionamiento</span>
          <div className="field__control">
            <select
              value={config.provisioning || 'Pendiente de aprobación'}
              onChange={(event) => onConfigChange('provisioning', event.target.value)}
            >
              {[
                'Pendiente de aprobación',
                'Creación automática',
                'Solo dominio aprobado',
              ].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <label className="field">
        <span>Dominio institucional permitido</span>
        <div className="field__control">
          <Globe size={16} className="field__icon" />
          <input
            value={config.domainPolicy || ''}
            onChange={(event) => onConfigChange('domainPolicy', event.target.value)}
            placeholder="algoritmot.com"
          />
        </div>
      </label>

      <label className="field">
        <span>Redirect URI</span>
        <div className="field__control">
          <Globe size={16} className="field__icon" />
          <input
            value={config.googleRedirectUri || ''}
            onChange={(event) => onConfigChange('googleRedirectUri', event.target.value)}
            placeholder="https://maturity360.co/api/auth/google/callback"
          />
        </div>
      </label>
    </>
  );
}

function GoogleCalendarFields({
  config,
  onConfigChange,
}: Pick<GoogleAssistantProps, 'config' | 'onConfigChange'>) {
  return (
    <>
      <div className="form-row">
        <label className="field">
          <span>Nombre del calendario</span>
          <div className="field__control">
            <input
              value={config.calendarName || ''}
              onChange={(event) => onConfigChange('calendarName', event.target.value)}
              placeholder="Producción académica"
            />
          </div>
        </label>

        <label className="field">
          <span>ID del calendario</span>
          <div className="field__control">
            <CalendarDays size={16} className="field__icon" />
            <input
              value={config.calendarId || ''}
              onChange={(event) => onConfigChange('calendarId', event.target.value)}
              placeholder="primary o abc123@group.calendar.google.com"
            />
          </div>
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span>Modo de sincronización</span>
          <div className="field__control">
            <select
              value={config.syncMode || 'Hitos y reuniones'}
              onChange={(event) => onConfigChange('syncMode', event.target.value)}
            >
              {['Hitos y reuniones', 'Solo hitos', 'Solo agenda', 'Bidireccional'].map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ),
              )}
            </select>
          </div>
        </label>

        <label className="field">
          <span>Zona horaria</span>
          <div className="field__control">
            <input
              value={config.timezone || 'America/Bogota'}
              onChange={(event) => onConfigChange('timezone', event.target.value)}
              placeholder="America/Bogota"
            />
          </div>
        </label>
      </div>

      <label className="field">
        <span>Visibilidad de eventos</span>
        <div className="field__control">
          <select
            value={config.eventVisibility || 'Equipo del curso'}
            onChange={(event) => onConfigChange('eventVisibility', event.target.value)}
          >
            {['Equipo del curso', 'Privado', 'Institucional'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </label>
    </>
  );
}

function GoogleMeetFields({
  config,
  onConfigChange,
}: Pick<GoogleAssistantProps, 'config' | 'onConfigChange'>) {
  return (
    <>
      <div className="form-row">
        <label className="field">
          <span>Creación de reuniones</span>
          <div className="field__control">
            <select
              value={config.allowCreation || 'Sí'}
              onChange={(event) => onConfigChange('allowCreation', event.target.value)}
            >
              {['Sí', 'No', 'Solo manual'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="field">
          <span>Vincular a</span>
          <div className="field__control">
            <select
              value={config.attachTo || 'Hitos del flujo'}
              onChange={(event) => onConfigChange('attachTo', event.target.value)}
            >
              {[
                'Hitos del flujo',
                'Eventos de calendario',
                'Revisión QA',
                'Mesas de trabajo',
              ].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span>Visibilidad</span>
          <div className="field__control">
            <select
              value={config.visibility || 'Equipo del curso'}
              onChange={(event) => onConfigChange('visibility', event.target.value)}
            >
              {['Equipo del curso', 'Coordinación', 'Institucional'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="field">
          <span>Duración por defecto</span>
          <div className="field__control">
            <input
              value={config.defaultDuration || ''}
              onChange={(event) => onConfigChange('defaultDuration', event.target.value)}
              placeholder="30 min"
            />
          </div>
        </label>
      </div>

      <label className="field">
        <span>Calendario base para reuniones</span>
        <div className="field__control">
          <CalendarDays size={16} className="field__icon" />
          <input
            value={config.calendarId || ''}
            onChange={(event) => onConfigChange('calendarId', event.target.value)}
            placeholder="primary o calendario del equipo"
          />
        </div>
      </label>
    </>
  );
}

export function GoogleAssistant({
  integrationId,
  config,
  onConfigChange,
}: GoogleAssistantProps) {
  const meta = integrationMeta[integrationId];
  const Icon = meta.icon;

  return (
    <div className="assistant-modular">
      <div className="assistant-modular__header">
        <div
          className="assistant-modular__icon-wrapper"
          style={{ background: `${meta.tint}22`, color: meta.tint }}
        >
          <Icon size={24} />
        </div>
        <div>
          <h4>{meta.title}</h4>
          <p>{meta.subtitle}</p>
        </div>
      </div>

      <div className="assistant-layout">
        <div className="assistant-steps-box">
          <h5>Ruta de configuración</h5>
          <div className="integration-assistant__steps">
            {meta.steps.map((step, index) => (
              <div key={`${integrationId}-${index}`} className="integration-assistant__step">
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="assistant-form-box">
          <h5>Credenciales y política</h5>
          <div className="form-grid">
            <label className="field">
              <span>Google Client ID</span>
              <div className="field__control">
                <KeyRound size={16} className="field__icon" />
                <input
                  value={config.googleClientId || ''}
                  onChange={(event) => onConfigChange('googleClientId', event.target.value)}
                  placeholder="1234567890-abc.apps.googleusercontent.com"
                />
              </div>
            </label>

            <label className="field">
              <span>Google Client Secret</span>
              <div className="field__control">
                <Lock size={16} className="field__icon" />
                <input
                  type="password"
                  value={config.googleClientSecret || ''}
                  onChange={(event) => onConfigChange('googleClientSecret', event.target.value)}
                  placeholder="GOCSPX-..."
                />
              </div>
            </label>

            {integrationId === 'google-sso' ? (
              <GoogleSsoFields config={config} onConfigChange={onConfigChange} />
            ) : null}

            {integrationId === 'google-calendar' ? (
              <GoogleCalendarFields config={config} onConfigChange={onConfigChange} />
            ) : null}

            {integrationId === 'google-meet' ? (
              <GoogleMeetFields config={config} onConfigChange={onConfigChange} />
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        .assistant-modular {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem;
          border-radius: var(--radius-xl);
          background: var(--surface-subtle);
          border: 1px solid var(--border);
        }
        .assistant-modular__header {
          display: flex;
          gap: 1.25rem;
          align-items: center;
        }
        .assistant-modular__icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
        }
        .assistant-modular__header h4 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
        }
        .assistant-modular__header p {
          margin: 0.25rem 0 0;
          font-size: 0.875rem;
          color: var(--text-muted);
        }
        .assistant-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 900px) {
          .assistant-layout {
            grid-template-columns: 1fr;
          }
        }
        .assistant-steps-box, .assistant-form-box {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
        }
        .assistant-steps-box h5, .assistant-form-box h5 {
          margin: 0 0 1.25rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-row {
          display: flex;
          gap: 1rem;
        }
        .field__icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .field__control {
          position: relative;
        }
        .field__control input,
        .field__control select {
          width: 100%;
          padding-left: 2.5rem;
        }
        .field__control select {
          padding-left: 1rem;
        }
      `}</style>
    </div>
  );
}
