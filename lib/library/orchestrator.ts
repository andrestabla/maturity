import type {
  LibraryGroup,
  LibraryProvider,
  LibrarySearchResult,
} from '../../src/types.js';
import { searchArxiv } from './adapters/arxiv.js';
import { searchCore } from './adapters/core.js';
import { searchOERCommons } from './adapters/oerCommons.js';
import { searchOpenAlex } from './adapters/openAlex.js';
import { searchPhET } from './adapters/phet.js';
import { searchRedalyc } from './adapters/redalyc.js';
import { searchScielo } from './adapters/scielo.js';
import { searchSemanticScholar } from './adapters/semanticScholar.js';
import { searchYouTube } from './adapters/youtube.js';
import {
  getLibraryProviderIntegrationStates,
  type LibraryProviderIntegrationState,
} from './provider-settings.js';

export interface SearchParams {
  query: string;
  language?: string;
  year?: number;
  openAccess?: boolean;
  limit?: number;
  providers?: LibraryProvider[];
  providerIntegrations?: Partial<Record<LibraryProvider, LibraryProviderIntegrationState>>;
}

export interface ProviderResult {
  provider: LibraryProvider;
  count: number;
  error?: string;
  durationMs: number;
}

export interface OrchestratorResult {
  results: LibrarySearchResult[];
  total: number;
  providerStates: ProviderResult[];
  cached: boolean;
  fetchedAt?: string;
}

const DEFAULT_PROVIDERS_BY_GROUP: Record<LibraryGroup, LibraryProvider[]> = {
  Investigacion: ['openalex', 'semantic-scholar', 'arxiv'],
  Didacticos: ['phet'],
  YouTube: ['youtube'],
  Institucional: [],
  Otros: ['openalex'],
};

const PROVIDER_TIMEOUT_MS_BY_PROVIDER: Partial<Record<LibraryProvider, number>> = {
  openalex: 2200,
  arxiv: 2200,
  phet: 1800,
  youtube: 2800,
  'semantic-scholar': 2400,
  scielo: 2400,
  redalyc: 2400,
  core: 2000,
  'oer-commons': 2000,
};

type AdapterFn = (params: SearchParams, signal?: AbortSignal) => Promise<LibrarySearchResult[]>;

// Provider → group mapping and adapter registry
const PROVIDER_REGISTRY: Record<string, { adapter: AdapterFn; groups: LibraryGroup[] }> = {
  'semantic-scholar': { adapter: searchSemanticScholar, groups: ['Investigacion'] },
  'openalex': { adapter: searchOpenAlex, groups: ['Investigacion'] },
  'arxiv': { adapter: searchArxiv, groups: ['Investigacion'] },
  'core': { adapter: searchCore, groups: ['Investigacion'] },
  'scielo': { adapter: searchScielo, groups: ['Investigacion'] },
  'redalyc': { adapter: searchRedalyc, groups: ['Investigacion'] },
  'oer-commons': { adapter: searchOERCommons, groups: ['Didacticos'] },
  'phet': { adapter: searchPhET, groups: ['Didacticos'] },
  'youtube': { adapter: searchYouTube, groups: ['YouTube'] },
};

function getProvidersForGroup(group: LibraryGroup, filterProviders?: LibraryProvider[]): LibraryProvider[] {
  const groupProviders = (Object.entries(PROVIDER_REGISTRY) as [LibraryProvider, { groups: LibraryGroup[] }][])
    .filter(([, cfg]) => cfg.groups.includes(group))
    .map(([provider]) => provider);

  if (filterProviders && filterProviders.length > 0) {
    return groupProviders.filter((provider) => filterProviders.includes(provider));
  }

  return (DEFAULT_PROVIDERS_BY_GROUP[group] ?? [])
    .filter((provider) => groupProviders.includes(provider));
}

function getProviderTimeoutMs(provider: LibraryProvider) {
  return PROVIDER_TIMEOUT_MS_BY_PROVIDER[provider] ?? 2200;
}

/**
 * Run a single provider with timeout and error isolation.
 */
async function runProvider(
  provider: LibraryProvider,
  params: SearchParams,
): Promise<{ provider: LibraryProvider; results: LibrarySearchResult[]; error?: string; durationMs: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutMs = getProviderTimeoutMs(provider);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const cfg = PROVIDER_REGISTRY[provider];
    if (!cfg) throw new Error(`Unknown provider: ${provider}`);
    const results = await cfg.adapter(params, controller.signal);
    return { provider, results, durationMs: Date.now() - start };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Timeout (>${timeoutMs}ms)`
          : err.message
        : 'Error desconocido';
    return { provider, results: [], error, durationMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Federated search: dispatch all relevant providers concurrently,
 * merge results, deduplicate by DOI → arXiv ID → canonical URL.
 */
export async function federatedSearch(
  group: LibraryGroup,
  params: SearchParams,
): Promise<OrchestratorResult> {
  const providerIntegrations = params.providerIntegrations ?? (await getLibraryProviderIntegrationStates());
  const resolvedParams: SearchParams = {
    ...params,
    providerIntegrations,
  };
  const requestedProviders = getProvidersForGroup(group, params.providers);
  const providerStates: ProviderResult[] = [];
  const providers = requestedProviders.filter((provider) => {
    const integration = providerIntegrations[provider];

    if (!integration?.enabled) {
      providerStates.push({
        provider,
        count: 0,
        error: 'Deshabilitada en Gobierno.',
        durationMs: 0,
      });
      return false;
    }

    if (!integration.envReady) {
      providerStates.push({
        provider,
        count: 0,
        error: integration.runtimeSummary || 'La integración no está lista para operar.',
        durationMs: 0,
      });
      return false;
    }

    return true;
  });

  if (providers.length === 0) {
    return { results: [], total: 0, providerStates, cached: false };
  }

  // Dispatch all providers concurrently
  const settled = await Promise.allSettled(providers.map((p) => runProvider(p, resolvedParams)));

  const allRaw: LibrarySearchResult[] = [];

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      const { provider, results, error, durationMs } = outcome.value;
      providerStates.push({ provider, count: results.length, error, durationMs });
      allRaw.push(...results);
    }
  }

  // Deduplicate and merge multi-source entries
  const merged = deduplicateAndMerge(allRaw);

  // Final sort by score descending
  merged.sort((a, b) => b.score - a.score);

  return {
    results: merged,
    total: merged.length,
    providerStates,
    cached: false,
  };
}

/**
 * Deduplication strategy (priority):
 * 1. Normalize DOI → "doi:{lowercased_doi}"
 * 2. arXiv ID → "arxiv:{id_without_version}"
 * 3. Canonical URL (normalized, stripped of protocol/www/trailing slash)
 * 4. provider:id (never collapses with others)
 *
 * When duplicates are found: merge providers list and keep best metadata.
 */
function deduplicateAndMerge(results: LibrarySearchResult[]): LibrarySearchResult[] {
  const seen = new Map<string, LibrarySearchResult>();

  for (const result of results) {
    const key = canonicalDedupeKey(result);

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...result });
    } else {
      // Merge: combine providers, keep best values
      seen.set(key, mergeResults(existing, result));
    }
  }

  return Array.from(seen.values());
}

function canonicalDedupeKey(r: LibrarySearchResult): string {
  // 1. DOI priority
  if (r.doi) {
    const normalized = r.doi.trim().toLowerCase().replace(/^https?:\/\/doi\.org\//, '');
    if (normalized) return `doi:${normalized}`;
  }

  // 2. Stable provider-specific canonical keys
  if (
    r.canonicalKey.startsWith('arxiv:')
    || r.canonicalKey.startsWith('youtube:')
    || r.canonicalKey.startsWith('seed:')
  ) {
    return r.canonicalKey;
  }

  // 3. Canonical URL normalized
  const url = r.canonicalUrl || '';
  if (url) {
    const normalized = url
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '')
      .split('?')[0];
    if (normalized) return `url:${normalized}`;
  }

  // 4. provider:id fallback
  return `${r.provider}:${r.providerRecordId}`;
}

function mergeResults(a: LibrarySearchResult, b: LibrarySearchResult): LibrarySearchResult {
  // Combine providers
  const providers = [...new Set([...a.providers, ...b.providers])] as LibraryProvider[];
  const sourceKinds = [...new Set([...a.sourceKinds, ...b.sourceKinds])];

  // Keep best values: prefer the one with more citations, longer abstract, etc.
  const bestCitations = Math.max(a.citationCount, b.citationCount);
  const bestAbstract = a.abstract.length >= b.abstract.length ? a.abstract : b.abstract;
  const bestTitle = a.title.length >= b.title.length ? a.title : b.title;
  const bestDoi = a.doi || b.doi;
  const bestPdfUrl = a.embedUrl || b.embedUrl;
  const bestPreviewKind = bestPdfUrl ? 'pdf' : a.previewKind !== 'external-link' ? a.previewKind : b.previewKind;
  const bestScore = Math.max(a.score, b.score) + 0.05 * Math.min(providers.length - 1, 3); // bonus for multi-source
  const bestAuthors = a.authors.length >= b.authors.length ? a.authors : b.authors;
  const allTags = [...new Set([...a.tags, ...b.tags])].slice(0, 10);

  return {
    ...a,
    providers,
    sourceKinds,
    citationCount: bestCitations,
    abstract: bestAbstract,
    title: bestTitle,
    doi: bestDoi,
    embedUrl: bestPdfUrl || a.embedUrl || b.embedUrl,
    previewKind: bestPreviewKind,
    score: Math.min(1.0, bestScore),
    authors: bestAuthors,
    tags: allTags,
  };
}
