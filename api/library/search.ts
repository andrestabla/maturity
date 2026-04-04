import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { readLibraryAssets } from '../../lib/store.js';
import type { LibraryAsset, LibraryGroup, LibrarySearchResult } from '../../src/types.js';

export const config = {
  runtime: 'nodejs',
};

/**
 * Federated Library Search Orchestrator
 * Phase 1: Institutional & Mock Search
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
    let results: LibrarySearchResult[] = [];

    // Mode A: Institutional Search (Local DB)
    if (group === 'Institucional') {
      const assets = (await readLibraryAssets()) as LibraryAsset[];
      
      results = assets
        .filter((asset: LibraryAsset) => 
          !q || 
          asset.title.toLowerCase().includes(q.toLowerCase()) || 
          asset.abstract.toLowerCase().includes(q.toLowerCase()) ||
          asset.tags.some((t: string) => t.toLowerCase().includes(q.toLowerCase()))
        )
        .map((asset: LibraryAsset): LibrarySearchResult => ({
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
        }));
    } 
    // Mode B: External Search (Phase 2 integration)
    else {
      // In Phase 1, we return empty results for external groups 
      // until actual adapters are implemented
      results = [];
    }

    return jsonResponse({
      results: results.slice(0, 50),
      total: results.length,
      group,
      query: q
    });
  } catch (err) {
    console.error('[LibrarySearch] Error:', err);
    return errorResponse(
      500,
      err instanceof Error ? err.message : 'Error interno en el orquestador de búsqueda'
    );
  }
}
