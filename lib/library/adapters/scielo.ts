import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';

const SCIELO_SEARCH = 'https://search.scielo.org/api/v1/article/search/';

/**
 * SciELO Search API Adapter
 * Uses the SciELO SOLR-based search API — free, no key required.
 */
export async function searchScielo(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const { query, language, year, limit = 15 } = params;

  const urlParams = new URLSearchParams({
    q: query,
    count: String(Math.min(limit, 100)),
    from: '0',
    output: 'json',
    format: 'json',
  });

  if (language && language !== 'all') {
    urlParams.set('lang', language);
  }

  if (year) {
    urlParams.set('dp', String(year));
  }

  const response = await fetch(`${SCIELO_SEARCH}?${urlParams.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`SciELO ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  const response2 = (data.response ?? data) as Record<string, unknown>;
  const docs = ((response2.docs ?? data.results ?? []) as unknown[]) as Array<Record<string, unknown>>;

  return docs.map((doc) => normalizeScieloResult(doc));
}

function normalizeScieloResult(doc: Record<string, unknown>): LibrarySearchResult {
  const pid = String(doc.id ?? doc.article_id ?? doc.pid ?? '');
  const doi = String(doc.doi ?? doc.scielo_id ?? '').replace('https://doi.org/', '');
  const canonicalKey = doi ? `doi:${doi.toLowerCase()}` : `scielo:${pid}`;

  const authorsRaw = doc.au ?? doc.author ?? doc.authors;
  const authors: string[] = Array.isArray(authorsRaw)
    ? authorsRaw.map(String)
    : typeof authorsRaw === 'string'
      ? [authorsRaw]
      : [];

  const yearStr =
    String(doc.dp ?? doc.publication_year ?? doc.year ?? '').slice(0, 4);

  const title =
    (doc.ti as Record<string, unknown>)?.[String(doc.la ?? 'es')] ??
    doc.title ??
    (Array.isArray(doc.ti) ? doc.ti[0] : doc.ti) ??
    '(sin título)';

  const abstract =
    (doc.ab as Record<string, unknown>)?.[String(doc.la ?? 'es')] ??
    doc.abstract ??
    (Array.isArray(doc.ab) ? doc.ab[0] : doc.ab) ??
    '';

  const journalTitle = String(doc.ta ?? doc.journal_title ?? '');
  const lang = String(doc.la ?? doc.language ?? 'es');

  const scieloUrl = pid.startsWith('S') || pid.startsWith('http')
    ? (pid.startsWith('http') ? pid : `https://www.scielo.org/cgi-bin/wxis.exe/iah/?IsisScript=iah/iah.xis&base=article&lang=${lang}&format=iso&limit=1&nextAction=lnk&indexSearch=PID&exprSearch=${pid}`)
    : `https://search.scielo.org/?q=${encodeURIComponent(String(title))}`;

  return {
    id: `sc-${pid}`,
    canonicalKey,
    provider: 'scielo',
    providerRecordId: pid,
    providers: ['scielo'],
    group: 'Investigacion',
    title: String(title).replace(/\s+/g, ' '),
    authors: authors.slice(0, 6),
    publishedAt: yearStr,
    abstract: String(abstract).replace(/\s+/g, ' '),
    descriptionHtml: '',
    doi,
    canonicalUrl: doi ? `https://doi.org/${doi}` : scieloUrl,
    resourceType: 'Artículo Científico',
    language: lang,
    openAccess: true,
    citationCount: Number(doc.citations ?? doc.citation_count ?? 0),
    thumbnailUrl: undefined,
    embedUrl: undefined,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: 'external-link',
    tags: [
      journalTitle,
      String(doc.wok_subject_categories ?? ''),
    ].filter(Boolean).slice(0, 4),
    metadata: {
      journal: journalTitle,
      collection: doc.in,
      pid,
    },
    score: computeScieloScore(yearStr),
    sourceKinds: ['SciELO'],
    cached: false,
  };
}

function computeScieloScore(year: string): number {
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - parseInt(year, 10)) / 20) * 0.3 : 0;
  return Math.min(1.0, 0.4 + recency);
}
