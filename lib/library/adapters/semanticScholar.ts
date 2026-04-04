import type { LibrarySearchResult } from '../../../src/types.js';

/**
 * Semantic Scholar API Adapter
 */
export async function searchSemanticScholar(query: string): Promise<LibrarySearchResult[]> {
  const params = new URLSearchParams({
    query: query,
    limit: '25',
    fields: 'paperId,title,abstract,authors,year,url,doi,citationCount,openAccessPdf,publicationTypes,venue',
  });

  const response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Semantic Scholar Error: ${error.message || response.statusText}`);
  }

  const data = await response.json() as any;
  
  return (data.data || []).map((item: any): LibrarySearchResult => ({
    id: `ss-${item.paperId}`,
    canonicalKey: `semantic-scholar:${item.paperId}`,
    provider: 'semantic-scholar',
    providerRecordId: item.paperId,
    providers: ['semantic-scholar'],
    group: 'Investigacion',
    title: item.title,
    authors: (item.authors || []).map((a: any) => a.name),
    publishedAt: item.year ? String(item.year) : '',
    abstract: item.abstract || '',
    descriptionHtml: '',
    doi: item.doi || '',
    canonicalUrl: item.url || `https://www.semanticscholar.org/paper/${item.paperId}`,
    resourceType: 'Articulo Investigacion',
    language: 'en',
    openAccess: !!item.openAccessPdf,
    citationCount: item.citationCount || 0,
    visibility: 'Publico',
    previewKind: 'external-link',
    tags: item.publicationTypes || [],
    metadata: {
      venue: item.venue,
      openAccessPdf: item.openAccessPdf?.url,
    },
    score: 1.0,
    sourceKinds: ['Semantic Scholar'],
    cached: false,
  }));
}
