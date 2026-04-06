import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';
import { getProviderConfigValue } from '../provider-settings.js';

const SS_BASE = 'https://api.semanticscholar.org/graph/v1';
const FIELDS =
  'paperId,title,abstract,authors,year,url,doi,citationCount,openAccessPdf,' +
  'publicationTypes,venue,externalIds,fieldsOfStudy,s2FieldsOfStudy,referenceCount';

/**
 * Semantic Scholar API Adapter
 * Docs: https://api.semanticscholar.org/api-docs/
 */
export async function searchSemanticScholar(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const { query, language, year, openAccess, limit = 20 } = params;
  const integration = params.providerIntegrations?.['semantic-scholar'];
  const baseUrl = getProviderConfigValue(integration, [], 'apiBaseUrl') || SS_BASE;
  const apiKey = getProviderConfigValue(
    integration,
    ['SEMANTIC_SCHOLAR_API_KEY'],
    'apiKey',
    'semanticScholarApiKey',
  );
  const retries = Number.parseInt(integration?.config.retryCount || '1', 10);

  const urlParams = new URLSearchParams({
    query,
    limit: String(Math.min(limit, 100)),
    fields: FIELDS,
  });

  if (year) {
    urlParams.set('year', `${year}-`);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetchWithRateLimitRetry(
    `${baseUrl.replace(/\/$/, '')}/paper/search?${urlParams.toString()}`,
    {
      headers,
      signal,
    },
    retries,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Semantic Scholar ${response.status}: ${String(error.message ?? response.statusText)}`);
  }

  const data = await response.json() as { data?: unknown[] };

  return (data.data ?? [])
    .map((item) => normalizeSSResult(item as Record<string, unknown>))
    .filter((r) => !openAccess || r.openAccess)
    .filter((r) => !language || r.language === language || language === 'all');
}

async function fetchWithRateLimitRetry(url: string, init: RequestInit, retries: number) {
  let attempt = 0;

  while (true) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt >= retries) {
      return response;
    }

    const retryAfterSeconds = Number.parseInt(response.headers.get('retry-after') || '2', 10);
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfterSeconds) * 1000));
    attempt += 1;
  }
}

function normalizeSSResult(item: Record<string, unknown>): LibrarySearchResult {
  const externalIds = (item.externalIds ?? {}) as Record<string, string>;
  const doi = String(externalIds.DOI ?? item.doi ?? '');
  const arxivId = String(externalIds.ArXiv ?? '');
  const canonicalKey = doi
    ? `doi:${doi.toLowerCase()}`
    : arxivId
      ? `arxiv:${arxivId}`
      : `semantic-scholar:${String(item.paperId ?? '')}`;

  const openAccessPdf = (item.openAccessPdf ?? {}) as Record<string, unknown>;
  const authors = ((item.authors as unknown[]) ?? []) as Array<Record<string, unknown>>;
  const publicationTypes = ((item.publicationTypes as unknown[]) ?? []) as string[];
  const fields = ((item.s2FieldsOfStudy as unknown[]) ?? []) as Array<Record<string, unknown>>;

  const citationCount = Number(item.citationCount ?? 0);
  const year = item.year ? String(item.year) : '';

  return {
    id: `ss-${String(item.paperId ?? '')}`,
    canonicalKey,
    provider: 'semantic-scholar',
    providerRecordId: String(item.paperId ?? ''),
    providers: ['semantic-scholar'],
    group: 'Investigacion',
    title: String(item.title ?? '(sin título)'),
    authors: authors.map((a) => String(a.name ?? '')).filter(Boolean),
    publishedAt: year,
    abstract: String(item.abstract ?? ''),
    descriptionHtml: '',
    doi,
    canonicalUrl:
      String(item.url ?? '') ||
      (doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${String(item.paperId ?? '')}`),
    resourceType: publicationTypes[0] ?? 'Artículo',
    language: 'en',
    openAccess: Boolean(openAccessPdf.url ?? item.openAccessPdf),
    citationCount,
    thumbnailUrl: undefined,
    embedUrl: openAccessPdf.url ? String(openAccessPdf.url) : undefined,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: openAccessPdf.url ? 'pdf' : 'external-link',
    tags: [
      ...publicationTypes,
      ...fields.map((f) => String(f.category ?? '')).filter(Boolean),
    ],
    metadata: {
      venue: item.venue,
      referenceCount: item.referenceCount,
      openAccessPdfUrl: openAccessPdf.url,
    },
    score: computeAcademicScore(citationCount, year),
    sourceKinds: ['Semantic Scholar'],
    cached: false,
  };
}

function computeAcademicScore(citations: number, year: string): number {
  const citScore = Math.min(0.7, Math.log10(citations + 2) / 5);
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - parseInt(year, 10)) / 20) * 0.3 : 0;
  return Math.min(1.0, 0.3 + citScore + recency);
}
