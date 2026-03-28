import type { AdminIntegration } from '../../types';
import { MailAssistant } from './assistants/MailAssistant';
import { AiAssistant } from './assistants/AiAssistant';
import { StorageAssistant } from './assistants/StorageAssistant';
import { GoogleAssistant } from './assistants/GoogleAssistant';
import { YouTubeAssistant } from './assistants/YouTubeAssistant';

interface IntegrationAssistantProps {
  integration: AdminIntegration;
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
}

export function IntegrationAssistant({
  integration,
  config,
  onConfigChange,
}: IntegrationAssistantProps) {
  // Router para asistentes específicos
  if (integration.id === 'outbound-mail') {
    return (
      <MailAssistant
        config={config}
        onConfigChange={onConfigChange}
      />
    );
  }

  if (integration.id === 'openai' || integration.id === 'gemini') {
    return (
      <AiAssistant
        integrationId={integration.id as 'openai' | 'gemini'}
        config={config}
        onConfigChange={onConfigChange}
      />
    );
  }

  if (integration.id === 'cloudflare-r2') {
    return (
      <StorageAssistant
        config={config}
        onConfigChange={onConfigChange}
      />
    );
  }

  if (
    integration.id === 'google-sso' ||
    integration.id === 'google-calendar' ||
    integration.id === 'google-meet'
  ) {
    return (
      <GoogleAssistant
        integrationId={integration.id}
        config={config}
        onConfigChange={onConfigChange}
      />
    );
  }

  if (integration.id === 'youtube-data-api') {
    return <YouTubeAssistant config={config} onConfigChange={onConfigChange} />;
  }

  // Fallback para asistente genérico basado en pasos
  return (
    <div className="integration-assistant">
      <strong>{integration.assistantTitle}</strong>
      <p>{integration.assistantSummary}</p>
      <div className="integration-assistant__steps">
        {integration.assistantSteps.map((step, index) => (
          <div key={`${integration.id}-step-${index}`} className="integration-assistant__step">
            <span>{index + 1}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
