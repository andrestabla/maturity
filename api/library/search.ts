import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { readLibraryAssets, readLibrarySearchCache, persistLibrarySearchCache } from '../../lib/store.js';
import type { LibraryAsset, LibraryGroup, LibrarySearchResult, LibraryProvider } from '../../src/types.js';
import { searchYouTube } from '../../lib/library/adapters/youtube.js';
import { searchSemanticScholar } from '../../lib/library/adapters/semanticScholar.js';
import { searchOpenAlex } from '../../lib/library/adapters/openAlex.js';

export const config = {
  runtime: 'nodejs',
};

/**
 * Federated Library Search Orchestrator v2
 * Dispatches concurrent requests to multiple providers and caches results.
 */
export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'No autorizado');
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const group = (url.searchParams.get('group') as LibraryGroup) || 'Investigacion';

  try {
    // 1. Mode A: Institutional Search (Local DB) - No caching needed for local
    if (group === 'Institucional') {
      const assets = (await readLibraryAssets()) as LibraryAsset[];
      const results = assets
        .filter((asset: LibraryAsset) => 
          !q || 
          asset.title.toLowerCase().includes(q.toLowerCase()) || 
          asset.abstract.toLowerCase().includes(q.toLowerCase()) ||
          asset.tags.some((t: string) => t.toLowerCase().includes(q.toLowerCase()))
        )
        .map(normalizeAssetToSearchResult);

      return jsonResponse({
        results: results.slice(0, 50),
        total: results.length,
        group,
        query: q,
        cached: false,
      });
    }

    // 2. Mode B: Federated Search (Cache First)
    if (q) {
      const cacheGroupMap: Record<string, LibraryProvider> = {
        'Investigacion': 'semantic-scholar',
        'YouTube': 'youtube',
        'Didacticos': 'oer-commons'
      };
      
      const provider = cacheGroupMap[group];
      if (provider) {
        const cached = await readLibrarySearchCache(provider, q, {});
        if (cached) {
          return jsonResponse({
            results: cached.results.slice(0, 50),
            total: cached.results.length,
            group,
            query: q,
            cached: true,
            fetchedAt: cached.fetchedAt,
          });
        }
      }
    }

    // 3. Mode C: Federated Search (Adapter Execution)
    let results: LibrarySearchResult[] = [];

    if (group === 'YouTube') {
      const apiKey = process.env.YOUTUBE_API_KEY || '';
      // Fallback for demo/dev if key is not strict
      if (!apiKey) {
        console.warn('YOUTUBE_API_KEY no detectada. Búsqueda externa YouTube fallará.');
      }
      
      results = await searchYouTube(q, apiKey);
      if (q) await persistLibrarySearchCache('youtube', q, {}, results);
    } 
    else if (group === 'Investigacion') {
      // Concurrent dispatch via Promise.allSettled for resilience
      const [ssResults, oaResults] = await Promise.allSettled([
        searchSemanticScholar(q),
        searchOpenAlex(q),
      ]);

      const ssData = ssResults.status === 'fulfilled' ? ssResults.value : [];
      const oaData = oaResults.status === 'fulfilled' ? oaResults.value : [];
      
      // Merge results and de-duplicate by normalized title/authors
      results = mergeSearchResults([...ssData, ...oaData]);
      
      // Persist to cache (using semantic-scholar as primary key for this group)
      if (q) await persistLibrarySearchCache('semantic-scholar', q, {}, results);
    }

    return jsonResponse({
      results: results.slice(0, 50),
      total: results.length,
      group,
      query: q,
      cached: false,
    });
  } catch (err) {
    console.error('[LibrarySearch] Orchestrator Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno en el orquestador de búsqueda');
  }
}

function normalizeAssetToSearchResult(asset: LibraryAsset): LibrarySearchResult {
  return {
    id: asset.id,
    canonicalKey: asset.canonicalKey,
    provider: asset.provider,
    providerRecordId: asset.providerRecordId,
    providers: [asset.provider],
    group: asset.group,
    title: asset.title,
    authors: asset.authors,
    publishedAt: asset.publishedAt,
    abstract: asset.abstract,
    descriptionHtml: asset.descriptionHtml,
    doi: asset.doi,
    canonicalUrl: asset.canonicalUrl,
    resourceType: asset.resourceType,
    language: asset.language,
    license: asset.license,
    openAccess: asset.openAccess,
    citationCount: asset.citationCount,
    thumbnailUrl: asset.thumbnailUrl,
    embedUrl: asset.embedUrl,
    institutionId: asset.institutionId,
    institutionName: asset.institutionName,
    visibility: asset.visibility,
    previewKind: asset.previewKind,
    tags: asset.tags,
    metadata: asset.metadata,
    score: 1.0,
    sourceKinds: [asset.resourceType],
    cached: false,
  };
}

function mergeSearchResults(allResults: LibrarySearchResult[]): LibrarySearchResult[] {
  const seen = new Set<string>();
  return allResults.filter(r => {
    const key = (r.title + (r.authors[0] || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
