import type { AdminIntegration, LibraryProvider } from '../../src/types.js';
import { getAdminIntegrations } from '../admin-center.js';

const PROVIDER_TO_INTEGRATION_ID: Partial<Record<LibraryProvider, string>> = {
  openalex: 'openalex',
  arxiv: 'arxiv',
  'semantic-scholar': 'semantic-scholar',
  scielo: 'scielo',
  redalyc: 'redalyc',
  'oer-commons': 'oer-commons',
  phet: 'phet',
  youtube: 'youtube-data-api',
  core: 'core',
};

export interface LibraryProviderIntegrationState {
  integrationId: string;
  integration: AdminIntegration | null;
  enabled: boolean;
  envReady: boolean;
  config: Record<string, string>;
  runtimeSummary: string;
}

export async function getLibraryProviderIntegrationStates() {
  const integrations = await getAdminIntegrations();
  const byId = new Map(integrations.map((integration) => [integration.id, integration]));
  const entries = Object.entries(PROVIDER_TO_INTEGRATION_ID) as Array<[LibraryProvider, string]>;

  return Object.fromEntries(
    entries.map(([provider, integrationId]) => {
      const integration = byId.get(integrationId) ?? null;
      return [
        provider,
        {
          integrationId,
          integration,
          enabled: integration?.enabled ?? true,
          envReady: integration?.envReady ?? true,
          config: integration?.config ?? {},
          runtimeSummary: integration?.runtimeSummary ?? '',
        } satisfies LibraryProviderIntegrationState,
      ];
    }),
  ) as Partial<Record<LibraryProvider, LibraryProviderIntegrationState>>;
}

export function getProviderConfigValue(
  state: LibraryProviderIntegrationState | undefined,
  envKeys: string[],
  ...configKeys: string[]
) {
  for (const envKey of envKeys) {
    const value = process.env[envKey]?.trim();
    if (value) {
      return value;
    }
  }

  for (const configKey of configKeys) {
    const value = state?.config[configKey]?.trim();
    if (value) {
      return value;
    }
  }

  return '';
}
