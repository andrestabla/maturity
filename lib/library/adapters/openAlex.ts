import type { LibrarySearchResult } from '../../../src/types.js';

/**
 * OpenAlex API Adapter
 */
export async function searchOpenAlex(query: string): Promise<LibrarySearchResult[]> {
  const params = new URLSearchParams({
    search: query,
    per_page: '25',
    select: 'id,display_name,abstract_inverted_index,authorships,publication_year,doi,type,primary_location',
  });

  const response = await fetch(`https://api.openalex.org/works?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`OpenAlex API Error: ${response.statusText}`);
  }

  const data = await response.json() as any;
  
  // OpenAlex provides abstract as an inverted index
  const decodeAbstract = (invertedIndex: any) => {
    if (!invertedIndex || typeof invertedIndex !== 'object') return '';
    const sortedWords = Object.entries(invertedIndex)
      .flatMap(([word, positions]) => (positions as any[]).map(pos => ({ word, pos })))
      .sort((a, b) => a.pos - b.pos);
    return sortedWords.map(w => w.word).join(' ');
  };

  return (data.results || []).map((item: any): LibrarySearchResult => ({
    id: `oa-${item.id.split('/').pop()}`,
    canonicalKey: `openalex:${item.id.split('/').pop()}`,
    provider: 'openalex',
    providerRecordId: item.id.split('/').pop(),
    providers: ['openalex'],
    group: 'Investigacion',
    title: item.display_name,
    authors: (item.authorships || []).map((a: any) => a.author.display_name),
    publishedAt: item.publication_year ? String(item.publication_year) : '',
    abstract: decodeAbstract(item.abstract_inverted_index),
    descriptionHtml: '',
    doi: item.doi || '',
    canonicalUrl: item.doi || item.id,
    resourceType: item.type || 'Articulo',
    language: 'en',
    openAccess: !!item.primary_location?.is_oa,
    citationCount: 0,
    visibility: 'Publico',
    previewKind: 'external-link',
    tags: [],
    metadata: {
      venue: item.primary_location?.source?.display_name,
    },
    score: 1.0,
    sourceKinds: ['OpenAlex'],
    cached: false,
  }));
}
