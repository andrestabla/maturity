
import { Brain, Sparkles, Key, Settings } from 'lucide-react';

interface AiAssistantProps {
  integrationId: 'openai' | 'gemini';
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
}

export function AiAssistant({ integrationId, config, onConfigChange }: AiAssistantProps) {
  const isOpenAI = integrationId === 'openai';
  const title = isOpenAI ? 'Configuración de OpenAI' : 'Configuración de Google Gemini';
  const icon = isOpenAI ? <Sparkles size={24} /> : <Brain size={24} />;
  
  const models = isOpenAI 
    ? ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'] 
    : ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];

  return (
    <div className="assistant-modular">
      <div className="assistant-modular__header">
        <div className="assistant-modular__icon-wrapper" style={{ background: isOpenAI ? '#74aa9c22' : '#4285f422', color: isOpenAI ? '#74aa9c' : '#4285f4' }}>
          {icon}
        </div>
        <div>
          <h4>{title}</h4>
          <p>Potancia la inteligencia de la plataforma con {isOpenAI ? 'GPT' : 'Gemini'}.</p>
        </div>
      </div>

      <div className="assistant-layout">
        <div className="assistant-steps-box">
          <h5>Instrucciones</h5>
          <div className="integration-assistant__steps">
            <div className="integration-assistant__step">
              <span>1</span>
              <p>Obtén tu API Key desde el portal de {isOpenAI ? 'OpenAI' : 'Google AI Studio'}.</p>
            </div>
            <div className="integration-assistant__step">
              <span>2</span>
              <p>Ingresa la llave abajo. Se guardará de forma segura en la base de datos.</p>
            </div>
            <div className="integration-assistant__step">
              <span>3</span>
              <p>Selecciona el modelo por defecto para la asistencia académica.</p>
            </div>
          </div>
        </div>

        <div className="assistant-form-box">
          <h5>Configuración de Runtime</h5>
          <div className="form-grid">
            <label className="field">
              <span>API Key</span>
              <div className="field__control">
                <Key size={16} className="field__icon" />
                <input
                  type="password"
                  value={(isOpenAI ? config.openaiApiKey : config.geminiApiKey) || ''}
                  onChange={(e) => onConfigChange(isOpenAI ? 'openaiApiKey' : 'geminiApiKey', e.target.value)}
                  placeholder={isOpenAI ? 'sk-...' : 'AIza...'}
                />
              </div>
            </label>

            <label className="field">
              <span>Modelo por defecto</span>
              <div className="field__control">
                <Settings size={16} className="field__icon" />
                <select
                  value={config.defaultModel || ''}
                  onChange={(e) => onConfigChange('defaultModel', e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                >
                  <option value="">Seleccionar modelo...</option>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Módulos habilitados</span>
              <div className="field__control">
                <input
                  value={config.allowedModules || ''}
                  onChange={(e) => onConfigChange('allowedModules', e.target.value)}
                  placeholder="Ej: Mis cursos, Biblioteca, QA"
                />
              </div>
            </label>
          </div>
        </div>
      </div>

      <style>{`
        /* Reutilizamos estilos de MailAssistant si están en el scope global o los repetimos si es CSS encapusaldo */
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
        .field__control input, .field__control select {
          padding-left: 2.5rem;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
