import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import {
  readLibraryAssets,
  readLibrarySearchCache,
  persistLibrarySearchCache,
} from '../../lib/store.js';
import type { AuthUser, LibraryAsset, LibraryGroup, LibraryProvider, LibrarySearchResult } from '../../src/types.js';
import { federatedSearch } from '../../lib/library/orchestrator.js';
import type { SearchParams } from '../../lib/library/orchestrator.js';

export const config = {
  runtime: 'nodejs',
};

/**
 * Federated Library Search — v3 (Full Phase 1+2+3)
 * Supports all 8 external providers + institutional.
 * Returns results with per-provider status for UI live indicators.
 */
export default async function handler(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return errorResponse(401, 'No autorizado');

  const rawUrl = request.url ?? '';
  const host = request.headers.get('host') ?? 'localhost';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const url = new URL(rawUrl.startsWith('http') ? rawUrl : `${proto}://${host}${rawUrl}`);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const group = (url.searchParams.get('group') as LibraryGroup) ?? 'Investigacion';
  const language = url.searchParams.get('language') ?? 'all';
  const yearStr = url.searchParams.get('year');
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  const openAccess = url.searchParams.get('open_access') === 'true';
  const providersParam = url.searchParams.get('providers');
  const requestedProviders = providersParam
    ? (providersParam.split(',').filter(Boolean) as LibraryProvider[])
    : undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '25', 10), 100);

  try {
    // ── Institutional: served from DB ────────────────────────────────────────
    if (group === 'Institucional') {
      const assets = (await readLibraryAssets()) as LibraryAsset[];
      const filtered = filterInstitutionalAssets(assets, user, q, language);

      return jsonResponse({
        results: filtered.slice(0, limit).map(assetToSearchResult),
        total: filtered.length,
        group,
        query: q,
        providerStates: [{ provider: 'institutional', count: filtered.length, durationMs: 0 }],
        cached: false,
        fetchedAt: new Date().toISOString(),
      });
    }

    // ── Cache lookup (keyed by group + query + all filters) ──────────────────
    const cacheFilters = { language, year, openAccess, providers: requestedProviders };
    const cacheKey = buildCacheKey(group, q, cacheFilters);

    if (q) {
      // Use group → primary provider for cache namespace
      const primaryProvider = getPrimaryProviderForGroup(group);
      const cached = await readLibrarySearchCache(primaryProvider, cacheKey, cacheFilters);
      if (cached) {
        return jsonResponse({
          results: cached.results.slice(0, limit),
          total: cached.results.length,
          group,
          query: q,
          providerStates: [],
          cached: true,
          fetchedAt: cached.fetchedAt,
        });
      }
    }

    // ── Federated search ─────────────────────────────────────────────────────
    const searchParams: SearchParams = {
      query: q || (group === 'Didacticos' ? 'educacion' : group === 'YouTube' ? 'clase' : 'learning'),
      language: language !== 'all' ? language : undefined,
      year,
      openAccess: openAccess || undefined,
      limit,
      providers: requestedProviders,
    };

    const orchestratorResult = await federatedSearch(group, searchParams);

    // Persist to cache if we have a real query
    if (q && orchestratorResult.results.length > 0) {
      const primaryProvider = getPrimaryProviderForGroup(group);
      void persistLibrarySearchCache(primaryProvider, cacheKey, cacheFilters, orchestratorResult.results).catch(() => {
        /* non-blocking */
      });
    }

    return jsonResponse({
      results: orchestratorResult.results.slice(0, limit),
      total: orchestratorResult.total,
      group,
      query: q,
      providerStates: orchestratorResult.providerStates,
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[LibrarySearch] Orchestrator error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno en la búsqueda federada');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function filterInstitutionalAssets(
  assets: LibraryAsset[],
  user: AuthUser,
  q: string,
  language: string,
): LibraryAsset[] {
  return assets.filter((asset) => {
    // Visibility: 'Publico' → everyone; 'Institucional' → same institution or admin
    if (asset.visibility === 'Institucional' && asset.institutionId) {
      const isAdmin = user.role === 'Administrador' || user.role === 'Coordinador' || user.role === 'Auditor';
      const isMember =
        user.institutionId === asset.institutionId ||
        (user.memberships ?? []).some((m) => m.institutionId === asset.institutionId);
      if (!isAdmin && !isMember) return false;
    }

    // Language filter
    if (language && language !== 'all' && asset.language !== language) return false;

    // Text search
    if (!q) return true;
    const ql = q.toLowerCase();
    return (
      asset.title.toLowerCase().includes(ql) ||
      asset.abstract.toLowerCase().includes(ql) ||
      asset.tags.some((t) => t.toLowerCase().includes(ql)) ||
      (asset.institutionName ?? '').toLowerCase().includes(ql)
    );
  });
}

function assetToSearchResult(asset: LibraryAsset): LibrarySearchResult {
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
    license: asset.license ?? undefined,
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

function buildCacheKey(group: string, query: string, filters: Record<string, unknown>): string {
  return JSON.stringify({ group, query, ...filters });
}

function getPrimaryProviderForGroup(group: LibraryGroup): LibraryProvider {
  const map: Record<LibraryGroup, LibraryProvider> = {
    Investigacion: 'semantic-scholar',
    Didacticos: 'oer-commons',
    YouTube: 'youtube',
    Institucional: 'institutional',
    Otros: 'institutional',
  };
  return map[group] ?? 'semantic-scholar';
}
