import React from 'react';
import { Mail, ShieldCheck, Zap, Globe, Server, Check, Lock, Key } from 'lucide-react';

interface MailAssistantProps {
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
}

type MailProvider = 'Resend' | 'Gmail' | 'Outlook' | 'Amazon SES' | 'SMTP';

const PROVIDERS: { id: MailProvider; name: string; icon: React.ReactNode; color: string }[] = [
  { id: 'Resend', name: 'Resend', icon: <Zap size={18} />, color: 'var(--text)' },
  { id: 'Gmail', name: 'Gmail', icon: <Mail size={18} />, color: '#EA4335' },
  { id: 'Outlook', name: 'Outlook', icon: <Globe size={18} />, color: '#0078D4' },
  { id: 'Amazon SES', name: 'Amazon SES', icon: <ShieldCheck size={18} />, color: '#FF9900' },
  { id: 'SMTP', name: 'SMTP Genérico', icon: <Server size={18} />, color: 'var(--text-muted)' },
];

export function MailAssistant({ config, onConfigChange }: MailAssistantProps) {
  const selectedProvider = (config.providerType as MailProvider) || 'Resend';

  const renderSteps = () => {
    switch (selectedProvider) {
      case 'Resend':
        return [
          'Obtén tu API Key desde el dashboard de Resend.',
          'Verifica tu dominio (DNS) para asegurar la entrega.',
          'Ingresa la API Key en el campo de configuración abajo.',
        ];
      case 'Gmail':
        return [
          'Activa la verificación en dos pasos en tu cuenta de Google.',
          'Genera una "Contraseña de aplicación" específica para Maturity.',
          'Usa smtp.gmail.com (puerto 465) con tu correo y la contraseña generada.',
        ];
      case 'Outlook':
        return [
          'Usa smtp.office365.com (puerto 587) con STARTTLS.',
          'Asegúrate de que el envío SMTP esté habilitado en Microsoft 365.',
          'Ingresa tus credenciales institucionales o contraseña de aplicación.',
        ];
      case 'Amazon SES':
        return [
          'Crea un usuario IAM con permisos AmazonSesSendingAccess.',
          'Genera credenciales SMTP (Access Key y Secret Key).',
          'Ingresa las llaves y la región (ej: us-east-1) abajo.',
        ];
      case 'SMTP':
        return [
          'Reúne host, puerto y credenciales de tu servidor SMTP.',
          'Configura los parámetros técnicos en el formulario.',
          'Prueba la conexión asegurando que el servidor permite envíos externos.',
        ];
      default:
        return [];
    }
  };

  const renderProviderFields = () => {
    switch (selectedProvider) {
      case 'Resend':
        return (
          <label className="field">
            <span>API Key de Resend</span>
            <div className="field__control">
              <Key size={16} className="field__icon" />
              <input
                type="password"
                value={config.resendApiKey || ''}
                onChange={(e) => onConfigChange('resendApiKey', e.target.value)}
                placeholder="re_123456789..."
              />
            </div>
          </label>
        );
      case 'Amazon SES':
        return (
          <>
            <label className="field">
              <span>Access Key ID</span>
              <div className="field__control">
                <Key size={16} className="field__icon" />
                <input
                  value={config.sesAccessKey || ''}
                  onChange={(e) => onConfigChange('sesAccessKey', e.target.value)}
                  placeholder="AKIA..."
                />
              </div>
            </label>
            <label className="field">
              <span>Secret Access Key</span>
              <div className="field__control">
                <Lock size={16} className="field__icon" />
                <input
                  type="password"
                  value={config.sesSecretKey || ''}
                  onChange={(e) => onConfigChange('sesSecretKey', e.target.value)}
                  placeholder="••••••••••••••••"
                />
              </div>
            </label>
            <label className="field">
              <span>Región de AWS</span>
              <div className="field__control">
                <Globe size={16} className="field__icon" />
                <input
                  value={config.sesRegion || ''}
                  onChange={(e) => onConfigChange('sesRegion', e.target.value)}
                  placeholder="us-east-1"
                />
              </div>
            </label>
          </>
        );
      case 'Gmail':
      case 'Outlook':
      case 'SMTP':
        return (
          <>
            <div className="form-row">
              <label className="field">
                <span>Servidor SMTP</span>
                <div className="field__control">
                  <Server size={16} className="field__icon" />
                  <input
                    value={config.smtpHost || ''}
                    onChange={(e) => onConfigChange('smtpHost', e.target.value)}
                    placeholder={selectedProvider === 'Gmail' ? 'smtp.gmail.com' : selectedProvider === 'Outlook' ? 'smtp.office365.com' : 'smtp.ejemplo.com'}
                  />
                </div>
              </label>
              <label className="field" style={{ flex: '0 0 120px' }}>
                <span>Puerto</span>
                <div className="field__control">
                  <input
                    value={config.smtpPort || ''}
                    onChange={(e) => onConfigChange('smtpPort', e.target.value)}
                    placeholder="465"
                  />
                </div>
              </label>
            </div>
            <label className="field">
              <span>Usuario / Email</span>
              <div className="field__control">
                <Mail size={16} className="field__icon" />
                <input
                  value={config.smtpUser || ''}
                  onChange={(e) => onConfigChange('smtpUser', e.target.value)}
                  placeholder="usuario@dominio.com"
                />
              </div>
            </label>
            <label className="field">
              <span>Contraseña</span>
              <div className="field__control">
                <Lock size={16} className="field__icon" />
                <input
                  type="password"
                  value={config.smtpPassword || ''}
                  onChange={(e) => onConfigChange('smtpPassword', e.target.value)}
                  placeholder="••••••••••••••••"
                />
              </div>
            </label>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="assistant-modular">
      <div className="assistant-modular__header">
        <div className="assistant-modular__icon-wrapper">
          <Mail size={24} />
        </div>
        <div>
          <h4>Configuración de Correo Saliente</h4>
          <p>Gestiona proveedores y credenciales directamente desde la plataforma.</p>
        </div>
      </div>

      <div className="provider-selector">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={selectedProvider === p.id ? 'provider-card provider-card--active' : 'provider-card'}
            onClick={() => onConfigChange('providerType', p.id)}
          >
            <div className="provider-card__icon" style={{ color: p.color }}>
              {p.icon}
            </div>
            <span>{p.name}</span>
            {selectedProvider === p.id && <Check size={14} className="provider-card__check" />}
          </button>
        ))}
      </div>

      <div className="assistant-layout">
        <div className="assistant-steps-box">
          <h5>Guía de Configuración</h5>
          <div className="integration-assistant__steps">
            {renderSteps().map((step, index) => (
              <div key={index} className="integration-assistant__step">
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="assistant-form-box">
          <h5>Credenciales y Operación</h5>
          <div className="form-grid">
            <div className="form-row">
              <label className="field">
                <span>Nombre Remitente</span>
                <div className="field__control">
                  <input
                    value={config.senderName || ''}
                    onChange={(e) => onConfigChange('senderName', e.target.value)}
                    placeholder="Maturity OS"
                  />
                </div>
              </label>
              <label className="field">
                <span>Email de envío</span>
                <div className="field__control">
                  <input
                    value={config.senderEmail || ''}
                    onChange={(e) => onConfigChange('senderEmail', e.target.value)}
                    placeholder="no-reply@dominio.com"
                  />
                </div>
              </label>
            </div>
            
            <div className="separator" />
            
            {renderProviderFields()}
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
          background: var(--primary-subtle);
          color: var(--primary);
        }
        .assistant-modular__header h4 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text);
        }
        .assistant-modular__header p {
          margin: 0.25rem 0 0;
          font-size: 0.875rem;
          color: var(--text-muted);
        }
        .provider-selector {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.75rem;
        }
        .provider-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 1.25rem;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .provider-card:hover {
          background: var(--surface-hover);
          transform: translateY(-2px);
          border-color: var(--border-hover);
        }
        .provider-card--active {
          border-color: var(--primary);
          background: var(--primary-subtle);
          box-shadow: 0 0 0 1px var(--primary);
        }
        .provider-card__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .provider-card span {
          font-size: 0.8125rem;
          font-weight: 600;
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
        .separator {
          height: 1px;
          background: var(--border);
          margin: 0.5rem 0;
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
        .field__control input {
          padding-left: 2.5rem;
        }
      `}</style>
    </div>
  );
}
