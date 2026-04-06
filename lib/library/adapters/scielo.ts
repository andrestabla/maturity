import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';
import { getProviderConfigValue } from '../provider-settings.js';

const SCIELO_ARTICLEMETA = 'https://articlemeta.scielo.org/api/v1/articles/';

interface ScieloArticleMetaResponse {
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
  objects?: Array<Record<string, unknown>>;
}

/**
 * SciELO adapter backed by ArticleMeta.
 * Docs: https://scielo.readthedocs.io/ and https://articlemeta.scielo.org/
 *
 * SciELO's public search endpoint currently rejects server-side requests with 403.
 * ArticleMeta is reachable, so we scan the newest catalog slices and rank local matches.
 */
export async function searchScielo(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const integration = params.providerIntegrations?.scielo;
  const baseUrl = getProviderConfigValue(integration, [], 'apiBaseUrl') || SCIELO_ARTICLEMETA;
  const collection = integration?.config.collection?.trim() || 'scl';
  const scanWindow = clampNumber(integration?.config.scanWindow, 50, 20, 60);
  const pageSize = clampNumber(integration?.config.pageSize, 30, 10, 50);
  const lookbackYears = clampNumber(integration?.config.lookbackYears, 4, 1, 10);
  const { query, language, year, limit = 15 } = params;
  const queryTokens = tokenize(query);
  const matches: LibrarySearchResult[] = [];
  const sinceYear = year || new Date().getFullYear() - lookbackYears;
  const fromDate = `${sinceYear}-01-01`;
  let scanned = 0;

  for (let offset = 0; scanned < scanWindow; offset += pageSize) {
    const batch = await fetchScieloCatalog(baseUrl, collection, pageSize, offset, fromDate, signal);
    const items = batch.objects ?? [];
    if (items.length === 0) {
      break;
    }

    for (let index = items.length - 1; index >= 0; index -= 1) {
      scanned += 1;
      const normalized = normalizeScieloResult(items[index], queryTokens);

      if (!normalized) {
        continue;
      }

      if (language && language !== 'all' && normalized.language !== language) {
        continue;
      }

      if (year && Number.parseInt(normalized.publishedAt || '0', 10) < year) {
        continue;
      }

      matches.push(normalized);
      if (matches.length >= limit * 2) {
        break;
      }
    }

    if (matches.length >= limit * 2) {
      break;
    }
  }

  return matches.sort((left, right) => right.score - left.score).slice(0, limit);
}

async function fetchScieloCatalog(
  baseUrl: string,
  collection: string,
  limit: number,
  offset: number,
  fromDate: string,
  signal?: AbortSignal,
) {
  const url = new URL(baseUrl);
  url.searchParams.set('collection', collection);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('from', fromDate);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Maturity360 Library/1.0',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`SciELO ArticleMeta ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as ScieloArticleMetaResponse;
}

function normalizeScieloResult(
  item: Record<string, unknown>,
  queryTokens: string[],
): LibrarySearchResult | null {
  const code = String(item.code ?? '').trim();
  const title = String(item.title ?? '').trim();
  if (!code || !title) {
    return null;
  }

  const article = (item.article ?? {}) as Record<string, unknown>;
  const doi = extractScieloDoi(item, article);
  const authors = extractScieloAuthors(article);
  const abstract = extractScieloAbstract(article);
  const language = extractScieloLanguage(article) || 'es';
  const subjects = extractScieloSubjects(article);
  const fulltexts = ((item.fulltexts ?? {}) as Record<string, unknown>) || {};
  const pdfUrl = String(fulltexts.pdf ?? fulltexts.html ?? fulltexts.xml ?? '').trim();
  const canonicalUrl = pdfUrl || `https://www.scielo.br/j/${String(item.code_title ?? '').toLowerCase()}/`;
  const year = String(item.publication_year ?? '').trim();
  const citationCount = Number(item.citations ?? 0);
  const score = computeScieloScore(title, abstract, subjects, year, citationCount, queryTokens);

  if (queryTokens.length > 0 && score < 0.48) {
    return null;
  }

  return {
    id: `sc-${code}`,
    canonicalKey: doi ? `doi:${doi.toLowerCase()}` : `scielo:${code}`,
    provider: 'scielo',
    providerRecordId: code,
    providers: ['scielo'],
    group: 'Investigacion',
    title: stripHtml(title),
    authors: authors.slice(0, 6),
    publishedAt: year,
    abstract: stripHtml(abstract),
    descriptionHtml: abstract ? `<p>${stripHtml(abstract)}</p>` : '',
    doi,
    canonicalUrl: doi ? `https://doi.org/${doi}` : canonicalUrl,
    resourceType: 'Artículo Científico',
    language,
    openAccess: true,
    citationCount,
    thumbnailUrl: undefined,
    embedUrl: pdfUrl || undefined,
    institutionId: undefined,
    institutionName: extractJournalTitle(article),
    visibility: 'Publico',
    previewKind: pdfUrl ? 'pdf' : 'external-link',
    tags: subjects.slice(0, 6),
    metadata: {
      collection: item.collection,
      journal: extractJournalTitle(article),
      issue: item.issue,
      code,
    },
    score,
    sourceKinds: ['SciELO'],
    cached: false,
  };
}

function extractScieloDoi(item: Record<string, unknown>, article: Record<string, unknown>) {
  const direct = String(item.doi ?? '').replace('https://doi.org/', '').trim();
  if (direct) {
    return direct;
  }

  const v237 = ((article.v237 ?? []) as Array<Record<string, unknown>>).find(Boolean);
  return String(v237?._ ?? '').replace('https://doi.org/', '').trim();
}

function extractScieloAuthors(article: Record<string, unknown>) {
  return ((article.v10 ?? []) as Array<Record<string, unknown>>)
    .map((author) => `${String(author.n ?? '').trim()} ${String(author.s ?? '').trim()}`.trim())
    .filter(Boolean);
}

function extractScieloAbstract(article: Record<string, unknown>) {
  const pieces = (article.v83 ?? article.v84 ?? []) as Array<Record<string, unknown>>;
  return pieces.map((piece) => String(piece._ ?? '').trim()).filter(Boolean).join(' ');
}

function extractScieloLanguage(article: Record<string, unknown>) {
  const languagePiece = ((article.v40 ?? []) as Array<Record<string, unknown>>)[0];
  return String(languagePiece?._ ?? '').trim().toLowerCase();
}

function extractScieloSubjects(article: Record<string, unknown>) {
  return ((article.v85 ?? article.v87 ?? []) as Array<Record<string, unknown>>)
    .map((subject) => stripHtml(String(subject._ ?? '').trim()))
    .filter(Boolean);
}

function extractJournalTitle(article: Record<string, unknown>) {
  const journal = ((article.v30 ?? []) as Array<Record<string, unknown>>)[0];
  return stripHtml(String(journal?._ ?? '').trim());
}

function computeScieloScore(
  title: string,
  abstract: string,
  subjects: string[],
  year: string,
  citations: number,
  queryTokens: string[],
) {
  const haystack = `${title} ${abstract} ${subjects.join(' ')}`.toLowerCase();
  const tokenMatches = queryTokens.filter((token) => haystack.includes(token)).length;
  const tokenScore = queryTokens.length > 0 ? Math.min(0.35, tokenMatches / queryTokens.length) : 0.15;
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - Number.parseInt(year, 10)) / 10) * 0.2 : 0;
  const citationScore = Math.min(0.2, Math.log10(citations + 1) / 5);
  return Math.min(0.98, 0.35 + tokenScore + recency + citationScore);
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}
