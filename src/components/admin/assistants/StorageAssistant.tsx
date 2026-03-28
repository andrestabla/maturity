
import { Database, HardDrive, Key, Lock, Globe, Server } from 'lucide-react';

interface StorageAssistantProps {
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
}

export function StorageAssistant({ config, onConfigChange }: StorageAssistantProps) {
  return (
    <div className="assistant-modular">
      <div className="assistant-modular__header">
        <div className="assistant-modular__icon-wrapper" style={{ background: '#f3802022', color: '#f38020' }}>
          <HardDrive size={24} />
        </div>
        <div>
          <h4>Configuración de Cloudflare R2</h4>
          <p>Almacenamiento de objetos S3-compatible para recursos multimedia y archivos.</p>
        </div>
      </div>

      <div className="assistant-layout">
        <div className="assistant-steps-box">
          <h5>Guía R2</h5>
          <div className="integration-assistant__steps">
            <div className="integration-assistant__step">
              <span>1</span>
              <p>Crea un bucket en el panel de Cloudflare R2.</p>
            </div>
            <div className="integration-assistant__step">
              <span>2</span>
              <p>Genera un token de API (S3 Clients) con permisos de lectura/escritura.</p>
            </div>
            <div className="integration-assistant__step">
              <span>3</span>
              <p>Copia el Account ID, Access Key e Ingrésalas abajo.</p>
            </div>
          </div>
        </div>

        <div className="assistant-form-box">
          <h5>Credenciales S3 / R2</h5>
          <div className="form-grid">
            <label className="field">
              <span>Account ID</span>
              <div className="field__control">
                <Globe size={16} className="field__icon" />
                <input
                  value={config.r2AccountId || ''}
                  onChange={(e) => onConfigChange('r2AccountId', e.target.value)}
                  placeholder="fea69c99a..."
                />
              </div>
            </label>

            <label className="field">
              <span>Access Key ID</span>
              <div className="field__control">
                <Key size={16} className="field__icon" />
                <input
                  value={config.r2AccessKeyId || ''}
                  onChange={(e) => onConfigChange('r2AccessKeyId', e.target.value)}
                  placeholder="e396d747..."
                />
              </div>
            </label>

            <label className="field">
              <span>Secret Access Key</span>
              <div className="field__control">
                <Lock size={16} className="field__icon" />
                <input
                  type="password"
                  value={config.r2SecretAccessKey || ''}
                  onChange={(e) => onConfigChange('r2SecretAccessKey', e.target.value)}
                  placeholder="••••••••••••••••"
                />
              </div>
            </label>

            <div className="form-row">
              <label className="field">
                <span>Nombre del Bucket</span>
                <div className="field__control">
                  <Database size={16} className="field__icon" />
                  <input
                    value={config.r2BucketName || ''}
                    onChange={(e) => onConfigChange('r2BucketName', e.target.value)}
                    placeholder="maturity-assets"
                  />
                </div>
              </label>
              <label className="field">
                <span>Ruta Base (Prefijo)</span>
                <div className="field__control">
                  <Server size={16} className="field__icon" />
                  <input
                    value={config.r2BasePath || ''}
                    onChange={(e) => onConfigChange('r2BasePath', e.target.value)}
                    placeholder="production/"
                  />
                </div>
              </label>
            </div>
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
        .field__control input {
          padding-left: 2.5rem;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
