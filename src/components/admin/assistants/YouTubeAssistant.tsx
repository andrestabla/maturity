import { Filter, Globe2, KeyRound, ShieldPlus, Youtube } from 'lucide-react';

interface YouTubeAssistantProps {
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
}

export function YouTubeAssistant({ config, onConfigChange }: YouTubeAssistantProps) {
  return (
    <div className="assistant-modular">
      <div className="assistant-modular__header">
        <div
          className="assistant-modular__icon-wrapper"
          style={{ background: '#ff000022', color: '#ff0000' }}
        >
          <Youtube size={24} />
        </div>
        <div>
          <h4>Configuración de YouTube Data API</h4>
          <p>Controla búsqueda audiovisual, región, filtros y módulos habilitados.</p>
        </div>
      </div>

      <div className="assistant-layout">
        <div className="assistant-steps-box">
          <h5>Ruta de configuración</h5>
          <div className="integration-assistant__steps">
            {[
              'Genera una API Key en Google Cloud para YouTube Data API.',
              'Define módulos autorizados, región y nivel de filtrado.',
              'Guarda y corre una prueba de consulta desde Gobierno.',
            ].map((step, index) => (
              <div key={index} className="integration-assistant__step">
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="assistant-form-box">
          <h5>Clave y reglas de uso</h5>
          <div className="form-grid">
            <label className="field">
              <span>YouTube API Key</span>
              <div className="field__control">
                <KeyRound size={16} className="field__icon" />
                <input
                  type="password"
                  value={config.youtubeApiKey || ''}
                  onChange={(event) => onConfigChange('youtubeApiKey', event.target.value)}
                  placeholder="AIza..."
                />
              </div>
            </label>

            <div className="form-row">
              <label className="field">
                <span>Módulos habilitados</span>
                <div className="field__control">
                  <ShieldPlus size={16} className="field__icon" />
                  <input
                    value={config.allowedModules || ''}
                    onChange={(event) => onConfigChange('allowedModules', event.target.value)}
                    placeholder="Curación, Multimedia"
                  />
                </div>
              </label>

              <label className="field">
                <span>Región por defecto</span>
                <div className="field__control">
                  <Globe2 size={16} className="field__icon" />
                  <input
                    value={config.defaultRegion || ''}
                    onChange={(event) => onConfigChange('defaultRegion', event.target.value)}
                    placeholder="CO"
                  />
                </div>
              </label>
            </div>

            <div className="form-row">
              <label className="field">
                <span>Safe Search</span>
                <div className="field__control">
                  <select
                    value={config.safeSearch || 'Moderado'}
                    onChange={(event) => onConfigChange('safeSearch', event.target.value)}
                  >
                    {['Estricto', 'Moderado', 'Sin filtro'].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Filtro adicional</span>
                <div className="field__control">
                  <Filter size={16} className="field__icon" />
                  <input
                    value={config.queryFilter || ''}
                    onChange={(event) => onConfigChange('queryFilter', event.target.value)}
                    placeholder="Duración corta, canal validado, idioma..."
                  />
                </div>
              </label>
            </div>

            <label className="field">
              <span>Política editorial</span>
              <div className="field__control">
                <input
                  value={config.editorialRule || ''}
                  onChange={(event) => onConfigChange('editorialRule', event.target.value)}
                  placeholder="Usar solo para curación y apoyo multimedia."
                />
              </div>
            </label>
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
