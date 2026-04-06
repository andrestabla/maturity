import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';
import { getProviderConfigValue } from '../provider-settings.js';

const CORE_BASE = 'https://api.core.ac.uk/v3';

/**
 * CORE API v3 Adapter
 * Docs: https://api.core.ac.uk/docs/v3
 * Requires CORE_API_KEY environment variable.
 * Fallback: graceful empty if no key.
 */
export async function searchCore(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const integration = params.providerIntegrations?.core;
  const apiKey = getProviderConfigValue(integration, ['CORE_API_KEY'], 'apiKey', 'coreApiKey');
  if (!apiKey) {
    console.info('[CORE] No CORE_API_KEY configured — skipping.');
    return [];
  }

  const { query, language, year, openAccess, limit = 20 } = params;
  const baseUrl = getProviderConfigValue(integration, [], 'apiBaseUrl') || CORE_BASE;

  const body: Record<string, unknown> = {
    q: buildCoreQuery(query, language, year, openAccess),
    limit: Math.min(limit, 100),
    offset: 0,
    fields: [
      'id', 'title', 'abstract', 'authors', 'publishedDate', 'yearPublished',
      'doi', 'downloadUrl', 'fullText', 'language', 'publisher', 'journals',
      'documentType', 'openAccess', 'citationCount', 'topics', 'fieldOfStudy',
    ],
  };

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/search/works`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`CORE API ${response.status}: ${String(err.message ?? response.statusText)}`);
  }

  const data = await response.json() as { results?: unknown[] };
  return (data.results ?? []).map((item) => normalizeCoreResult(item as Record<string, unknown>));
}

function buildCoreQuery(query: string, language?: string, year?: number, openAccess?: boolean): string {
  const parts = [query];
  if (language && language !== 'all') parts.push(`language.code:${language}`);
  if (year) parts.push(`yearPublished>=${year}`);
  if (openAccess) parts.push('openAccess:true');
  return parts.join(' AND ');
}

function normalizeCoreResult(item: Record<string, unknown>): LibrarySearchResult {
  const doi = String(item.doi ?? '').replace('https://doi.org/', '');
  const coreId = String(item.id ?? '');
  const canonicalKey = doi ? `doi:${doi.toLowerCase()}` : `core:${coreId}`;

  const authors = ((item.authors as unknown[]) ?? []) as Array<Record<string, unknown>>;
  const journals = ((item.journals as unknown[]) ?? []) as Array<Record<string, unknown>>;
  const yearPublished = String(item.yearPublished ?? (item.publishedDate ? String(item.publishedDate).slice(0, 4) : ''));
  const isOA = Boolean(item.openAccess);
  const pdfUrl = String(item.downloadUrl ?? '');
  const langCode = String((item.language as Record<string, unknown>)?.code ?? item.language ?? 'en');
  const citationCount = Number(item.citationCount ?? 0);
  const topics = ((item.topics as unknown[]) ?? []) as Array<Record<string, unknown>>;

  return {
    id: `co-${coreId}`,
    canonicalKey,
    provider: 'core',
    providerRecordId: coreId,
    providers: ['core'],
    group: 'Investigacion',
    title: String(item.title ?? '(sin título)'),
    authors: authors.slice(0, 6).map((a) => String(a.name ?? '')).filter(Boolean),
    publishedAt: yearPublished,
    abstract: String(item.abstract ?? ''),
    descriptionHtml: '',
    doi,
    canonicalUrl: doi ? `https://doi.org/${doi}` : `https://core.ac.uk/works/${coreId}`,
    resourceType: String(item.documentType ?? 'Artículo'),
    language: langCode,
    openAccess: isOA,
    citationCount,
    thumbnailUrl: undefined,
    embedUrl: pdfUrl || undefined,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: pdfUrl ? 'pdf' : 'external-link',
    tags: [
      ...topics.slice(0, 4).map((t) => String(t.name ?? '')).filter(Boolean),
      journals[0] ? String(journals[0].title ?? '') : '',
    ].filter(Boolean),
    metadata: {
      publisher: item.publisher,
      journal: journals[0]?.title,
      pdfUrl,
    },
    score: computeAcademicScore(citationCount, yearPublished),
    sourceKinds: ['CORE'],
    cached: false,
  };
}

function computeAcademicScore(citations: number, year: string): number {
  const citScore = Math.min(0.6, Math.log10(citations + 2) / 5);
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - parseInt(year, 10)) / 20) * 0.25 : 0;
  return Math.min(1.0, 0.35 + citScore + recency);
}
