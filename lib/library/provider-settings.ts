import type { AdminIntegration, LibraryProvider } from '../../src/types.js';
import { getAdminIntegrations } from '../admin-center.js';
import { getSql } from '../db.js';

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

const PROVIDER_STATE_CACHE_TTL_MS = 60_000;

let providerStateCache: Partial<Record<LibraryProvider, LibraryProviderIntegrationState>> | null = null;
let providerStateCacheExpiresAt = 0;
let providerStateInflightPromise:
  | Promise<Partial<Record<LibraryProvider, LibraryProviderIntegrationState>>>
  | null = null;

export async function getLibraryProviderIntegrationStates() {
  const now = Date.now();

  if (providerStateCache && providerStateCacheExpiresAt > now) {
    return providerStateCache;
  }

  if (!providerStateInflightPromise) {
    providerStateInflightPromise = loadLibraryProviderIntegrationStates()
      .then((states) => {
        providerStateCache = states;
        providerStateCacheExpiresAt = Date.now() + PROVIDER_STATE_CACHE_TTL_MS;
        return states;
      })
      .finally(() => {
        providerStateInflightPromise = null;
      });
  }

  return providerStateInflightPromise;
}

async function loadLibraryProviderIntegrationStates() {
  const fastStates = await tryReadLibraryProviderStatesDirectly();
  if (fastStates) {
    return fastStates;
  }

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

interface DirectIntegrationRow {
  id: string;
  enabled: boolean;
  config: unknown;
}

async function tryReadLibraryProviderStatesDirectly() {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        enabled,
        config
      FROM maturity_admin_integrations
    `) as DirectIntegrationRow[];

    const byId = new Map(rows.map((row) => [row.id, row]));
    const entries = Object.entries(PROVIDER_TO_INTEGRATION_ID) as Array<[LibraryProvider, string]>;

    return Object.fromEntries(
      entries.map(([provider, integrationId]) => {
        const row = byId.get(integrationId);
        const config = parseIntegrationConfig(row?.config);
        return [
          provider,
          {
            integrationId,
            integration: null,
            enabled: row?.enabled ?? true,
            envReady: isProviderReady(provider, config),
            config,
            runtimeSummary: summarizeProviderRuntime(provider, config),
          } satisfies LibraryProviderIntegrationState,
        ];
      }),
    ) as Partial<Record<LibraryProvider, LibraryProviderIntegrationState>>;
  } catch {
    return null;
  }
}

function parseIntegrationConfig(value: unknown) {
  if (!value) {
    return {} as Record<string, string>;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return {};
    }
  }

  if (typeof value === 'object') {
    return value as Record<string, string>;
  }

  return {};
}

function hasSecret(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value?.trim()));
}

function isProviderReady(provider: LibraryProvider, config: Record<string, string>) {
  switch (provider) {
    case 'youtube':
      return hasSecret(process.env.YOUTUBE_API_KEY, config.youtubeApiKey, config.apiKey);
    case 'semantic-scholar':
      return hasSecret(process.env.SEMANTIC_SCHOLAR_API_KEY, config.semanticScholarApiKey, config.apiKey);
    case 'core':
      return hasSecret(process.env.CORE_API_KEY, config.coreApiKey, config.apiKey);
    case 'oer-commons':
      return hasSecret(process.env.OER_COMMONS_API_KEY, config.token, config.apiKey);
    case 'openalex':
    case 'arxiv':
    case 'scielo':
    case 'redalyc':
    case 'phet':
      return true;
    default:
      return false;
  }
}

function summarizeProviderRuntime(provider: LibraryProvider, config: Record<string, string>) {
  switch (provider) {
    case 'youtube':
      return isProviderReady(provider, config)
        ? 'YouTube Data API lista desde Gobierno.'
        : 'Falta YOUTUBE_API_KEY o credencial guardada en Gobierno.';
    case 'semantic-scholar':
      return isProviderReady(provider, config)
        ? 'Semantic Scholar listo con API key.'
        : 'Falta API key de Semantic Scholar para un uso productivo estable.';
    case 'core':
      return isProviderReady(provider, config) ? 'CORE listo con API key.' : 'Falta CORE_API_KEY.';
    case 'oer-commons':
      return isProviderReady(provider, config) ? 'OER Commons listo con token.' : 'Falta token de OER Commons.';
    case 'openalex':
      return `OpenAlex listo con mailto ${config.mailto?.trim() || 'library@maturity360.co'}.`;
    case 'arxiv':
      return `arXiv listo con cliente ${config.clientName?.trim() || 'Maturity360 Library'}.`;
    case 'scielo':
      return `SciELO listo vía ArticleMeta (${config.collection?.trim() || 'scl'}).`;
    case 'redalyc':
      return 'Redalyc listo vía OAI-PMH.';
    case 'phet':
      return 'PhET listo con catálogo público.';
    default:
      return '';
  }
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
