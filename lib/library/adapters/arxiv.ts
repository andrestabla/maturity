import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';

const ARXIV_BASE = 'https://export.arxiv.org/api/query';

/**
 * arXiv API Adapter — completely free, no key needed
 * Docs: https://info.arxiv.org/help/api/user-manual.html
 * Returns Atom 1.0 XML; parsed with lightweight regex extractor.
 */
export async function searchArxiv(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const { query, year, limit = 20 } = params;

  const searchQuery = buildArxivQuery(query, year);

  const urlParams = new URLSearchParams({
    search_query: searchQuery,
    start: '0',
    max_results: String(Math.min(limit, 100)),
    sortBy: 'relevance',
    sortOrder: 'descending',
  });

  const response = await fetch(`${ARXIV_BASE}?${urlParams.toString()}`, {
    headers: { Accept: 'application/atom+xml' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`arXiv ${response.status}: ${response.statusText}`);
  }

  const xml = await response.text();
  return parseArxivAtom(xml);
}

function buildArxivQuery(query: string, year?: number): string {
  const base = `all:${query.replace(/[()]/g, '')}`;
  if (year) {
    return `${base} AND submittedDate:[${year}01010000 TO ${new Date().getFullYear()}12312359]`;
  }
  return base;
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim().replace(/\s+/g, ' '));
  }
  return results;
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  return xml.match(re)?.[1] ?? '';
}

function parseArxivAtom(xml: string): LibrarySearchResult[] {
  const entryBlocks = xml.split(/<entry[^>]*>/).slice(1);

  return entryBlocks
    .map((block) => {
      const rawBlock = `<entry>${block.split('</entry>')[0]}</entry>`;

      const rawId = extractAll(rawBlock, 'id')[0] ?? '';
      const arxivId = rawId.split('/abs/').pop()?.split('v')[0] ?? rawId;

      const title = extractAll(rawBlock, 'title')[0] ?? '(sin título)';
      const abstract = extractAll(rawBlock, 'summary')[0] ?? '';
      const published = extractAll(rawBlock, 'published')[0] ?? '';
      const updated = extractAll(rawBlock, 'updated')[0] ?? '';
      const year = (published || updated).slice(0, 4);

      const authorBlocks = rawBlock.match(/<author>([\s\S]*?)<\/author>/g) ?? [];
      const authors = authorBlocks
        .map((b) => extractAll(b, 'name')[0] ?? '')
        .filter(Boolean);

      const doiTag = extractAll(rawBlock, 'arxiv:doi')[0] ?? '';
      const doiLink = extractAttr(rawBlock, 'link', 'title') === 'doi' ? extractAttr(rawBlock, 'link', 'href') : '';
      const doi = (doiTag || doiLink).replace('https://doi.org/', '');

      const pdfHref = (() => {
        const pdfMatch = rawBlock.match(/href="(https:\/\/arxiv\.org\/pdf\/[^"]+)"/);
        return pdfMatch?.[1] ?? `https://arxiv.org/pdf/${arxivId}`;
      })();

      const categories = extractAll(rawBlock, 'arxiv:primary_category')
        .concat(extractAll(rawBlock, 'category'))
        .map((c) => {
          const term = c.match(/term="([^"]+)"/)?.[1] ?? c;
          return term;
        })
        .filter(Boolean)
        .slice(0, 4);

      const canonicalKey = doi ? `doi:${doi.toLowerCase()}` : `arxiv:${arxivId}`;

      return {
        id: `ax-${arxivId}`,
        canonicalKey,
        provider: 'arxiv' as const,
        providerRecordId: arxivId,
        providers: ['arxiv' as const],
        group: 'Investigacion' as const,
        title: title.replace(/\n/g, ' ').replace(/\s+/g, ' '),
        authors: authors.slice(0, 6),
        publishedAt: year,
        abstract: abstract.replace(/\n/g, ' ').replace(/\s+/g, ' '),
        descriptionHtml: '',
        doi,
        canonicalUrl: `https://arxiv.org/abs/${arxivId}`,
        resourceType: 'Preprint / Paper',
        language: 'en',
        openAccess: true,
        citationCount: 0,
        thumbnailUrl: undefined,
        embedUrl: pdfHref,
        institutionId: undefined,
        institutionName: undefined,
        visibility: 'Publico' as const,
        previewKind: 'pdf' as const,
        tags: categories,
        metadata: { arxivId, pdfUrl: pdfHref, categories },
        score: computeArxivScore(year),
        sourceKinds: ['arXiv'],
        cached: false,
      } satisfies LibrarySearchResult;
    })
    .filter((r) => r.title !== '(sin título)' && r.providerRecordId);
}

function computeArxivScore(year: string): number {
  const recency = year
    ? Math.max(0, 1 - (new Date().getFullYear() - parseInt(year, 10)) / 15) * 0.4
    : 0;
  return Math.min(1.0, 0.45 + recency);
}
