import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';

const OA_BASE = 'https://api.openalex.org';
const FIELDS =
  'id,display_name,abstract_inverted_index,authorships,publication_year,doi,type,' +
  'primary_location,open_access,cited_by_count,language,topics,keywords,best_oa_location';

/**
 * OpenAlex API Adapter — free, no key required (polite pool with email)
 * Docs: https://docs.openalex.org/api-entities/works/search-works
 */
export async function searchOpenAlex(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const { query, language, year, openAccess, limit = 20 } = params;

  const urlParams = new URLSearchParams({
    search: query,
    per_page: String(Math.min(limit, 200)),
    select: FIELDS,
    mailto: 'library@maturity.app',
  });

  if (language && language !== 'all') {
    urlParams.set('filter', buildFilter(language, year, openAccess));
  } else {
    const filterParts: string[] = [];
    if (year) filterParts.push(`from_publication_date:${year}-01-01`);
    if (openAccess) filterParts.push('open_access.is_oa:true');
    if (filterParts.length) urlParams.set('filter', filterParts.join(','));
  }

  const response = await fetch(`${OA_BASE}/works?${urlParams.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`OpenAlex ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as { results?: unknown[] };

  return (data.results ?? []).map((item) => normalizeOAResult(item as Record<string, unknown>));
}

function buildFilter(language: string, year?: number, openAccess?: boolean): string {
  const parts: string[] = [];
  const langMap: Record<string, string> = { es: 'es', en: 'en', pt: 'pt', fr: 'fr' };
  if (langMap[language]) parts.push(`language:${langMap[language]}`);
  if (year) parts.push(`from_publication_date:${year}-01-01`);
  if (openAccess) parts.push('open_access.is_oa:true');
  return parts.join(',');
}

function decodeAbstract(invertedIndex: unknown): string {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const entries = Object.entries(invertedIndex as Record<string, number[]>);
  return entries
    .flatMap(([word, positions]) => positions.map((pos) => ({ word, pos })))
    .sort((a, b) => a.pos - b.pos)
    .map((w) => w.word)
    .join(' ');
}

function normalizeOAResult(item: Record<string, unknown>): LibrarySearchResult {
  const rawId = String(item.id ?? '');
  const oaId = rawId.split('/').pop() ?? rawId;
  const doi = String(item.doi ?? '').replace('https://doi.org/', '');
  const canonicalKey = doi ? `doi:${doi.toLowerCase()}` : `openalex:${oaId}`;

  const authorships = ((item.authorships as unknown[]) ?? []) as Array<Record<string, unknown>>;
  const primaryLocation = (item.primary_location ?? {}) as Record<string, unknown>;
  const openAccessData = (item.open_access ?? {}) as Record<string, unknown>;
  const bestOA = (item.best_oa_location ?? {}) as Record<string, unknown>;
  const topics = ((item.topics as unknown[]) ?? []) as Array<Record<string, unknown>>;
  const keywords = ((item.keywords as unknown[]) ?? []) as Array<Record<string, unknown>>;

  const citedBy = Number(item.cited_by_count ?? 0);
  const year = item.publication_year ? String(item.publication_year) : '';
  const isOA = Boolean(openAccessData.is_oa);
  const pdfUrl = String(bestOA.pdf_url ?? '') || String(bestOA.landing_page_url ?? '');
  const lang = String(item.language ?? 'en');

  return {
    id: `oa-${oaId}`,
    canonicalKey,
    provider: 'openalex',
    providerRecordId: oaId,
    providers: ['openalex'],
    group: 'Investigacion',
    title: String(item.display_name ?? '(sin título)'),
    authors: authorships
      .slice(0, 6)
      .map((a) => {
        const author = (a.author ?? {}) as Record<string, unknown>;
        return String(author.display_name ?? '');
      })
      .filter(Boolean),
    publishedAt: year,
    abstract: decodeAbstract(item.abstract_inverted_index),
    descriptionHtml: '',
    doi,
    canonicalUrl: doi ? `https://doi.org/${doi}` : rawId,
    resourceType: String(item.type ?? 'Artículo'),
    language: lang,
    openAccess: isOA,
    citationCount: citedBy,
    thumbnailUrl: undefined,
    embedUrl: pdfUrl || undefined,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: pdfUrl ? 'pdf' : 'external-link',
    tags: [
      ...topics.slice(0, 3).map((t) => String(t.display_name ?? '')).filter(Boolean),
      ...keywords.slice(0, 4).map((k) => String(k.display_name ?? '')).filter(Boolean),
    ],
    metadata: {
      venue: String((primaryLocation.source as Record<string, unknown>)?.display_name ?? ''),
      oaStatus: openAccessData.oa_status,
      pdfUrl,
    },
    score: computeAcademicScore(citedBy, year),
    sourceKinds: ['OpenAlex'],
    cached: false,
  };
}

function computeAcademicScore(citations: number, year: string): number {
  const citScore = Math.min(0.65, Math.log10(citations + 2) / 5.5);
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - parseInt(year, 10)) / 20) * 0.25 : 0;
  return Math.min(1.0, 0.3 + citScore + recency);
}
