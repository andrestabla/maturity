import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { getSql } from '../../lib/db.js';
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
  try {
    // Session check inside outer try/catch so DB/init failures return JSON, not Vercel HTML
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

    // ── Institutional: served from DB ────────────────────────────────────────
    if (group === 'Institucional') {
      const assets = await readInstitutionalAssetsFast().catch(() => []) as LibraryAsset[];
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
      try {
        const primaryProvider = getPrimaryProviderForGroup(group);
        const cached = await readLibrarySearchCacheFast(primaryProvider, cacheKey, cacheFilters);
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
      } catch {
        // Cache table may not exist yet — skip gracefully
      }
    }

    // ── Federated search ─────────────────────────────────────────────────────
    const searchParams: SearchParams = {
      query: q || (group === 'Didacticos' ? 'educacion' : group === 'YouTube' ? 'aprendizaje' : 'learning'),
      language: language !== 'all' ? language : undefined,
      year,
      openAccess: openAccess || undefined,
      limit,
      providers: requestedProviders,
    };

    const orchestratorResult = await federatedSearch(group, searchParams);

    // Persist to cache (non-blocking, swallow DB errors)
    if (q && orchestratorResult.results.length > 0) {
      const primaryProvider = getPrimaryProviderForGroup(group);
      void persistLibrarySearchCacheFast(primaryProvider, cacheKey, cacheFilters, orchestratorResult.results).catch(() => {});
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
    console.error('[LibrarySearch] Error:', err);
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
    Investigacion: 'openalex',
    Didacticos: 'phet',
    YouTube: 'youtube',
    Institucional: 'institutional',
    Otros: 'institutional',
  };
  return map[group] ?? 'openalex';
}

interface LibrarySearchCacheFastRow {
  results: unknown;
  fetchedAt: string;
}

interface LibraryAssetFastRow {
  id: string;
  canonicalKey: string;
  provider: string;
  providerRecordId: string;
  group: string;
  title: string;
  authors: unknown;
  publishedAt: string | null;
  abstract: string;
  descriptionHtml: string;
  doi: string | null;
  canonicalUrl: string;
  resourceType: string;
  language: string;
  license: unknown;
  openAccess: boolean;
  citationCount: number;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  institutionId: string | null;
  institutionName: string | null;
  visibility: string;
  previewKind: string;
  tags: unknown;
  metadata: unknown;
}

function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (value == null) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

async function readLibrarySearchCacheFast(provider: LibraryProvider, query: string, filters: unknown) {
  const sql = getSql();
  const cacheKey = JSON.stringify({ query, filters });
  const rows = (await sql`
    SELECT
      results,
      fetched_at AS "fetchedAt"
    FROM maturity_library_search_cache
    WHERE provider = ${provider}
      AND cache_key = ${cacheKey}
      AND expires_at > ${new Date().toISOString()}
    LIMIT 1
  `) as LibrarySearchCacheFastRow[];

  if (!rows[0]) {
    return null;
  }

  return {
    results: parseJsonSafe<LibrarySearchResult[]>(rows[0].results, []),
    fetchedAt: rows[0].fetchedAt,
  };
}

async function persistLibrarySearchCacheFast(
  provider: LibraryProvider,
  query: string,
  filters: unknown,
  results: LibrarySearchResult[],
) {
  const sql = getSql();
  const cacheKey = JSON.stringify({ query, filters });

  await sql`
    INSERT INTO maturity_library_search_cache (
      provider,
      cache_key,
      query,
      filters,
      results,
      fetched_at,
      expires_at
    ) VALUES (
      ${provider},
      ${cacheKey},
      ${query},
      ${JSON.stringify(filters)}::jsonb,
      ${JSON.stringify(results)}::jsonb,
      CURRENT_TIMESTAMP,
      (CURRENT_TIMESTAMP + INTERVAL '24 hours')
    )
    ON CONFLICT (provider, cache_key) DO UPDATE SET
      results = EXCLUDED.results,
      fetched_at = EXCLUDED.fetched_at,
      expires_at = EXCLUDED.expires_at
  `;
}

async function readInstitutionalAssetsFast() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      canonical_key AS "canonicalKey",
      provider,
      provider_record_id AS "providerRecordId",
      group_name AS "group",
      title,
      authors,
      published_at AS "publishedAt",
      abstract,
      description_html AS "descriptionHtml",
      doi,
      canonical_url AS "canonicalUrl",
      resource_type AS "resourceType",
      language,
      license,
      open_access AS "openAccess",
      citation_count AS "citationCount",
      thumbnail_url AS "thumbnailUrl",
      embed_url AS "embedUrl",
      institution_id AS "institutionId",
      institution_name AS "institutionName",
      visibility,
      preview_kind AS "previewKind",
      tags,
      metadata
    FROM maturity_library_assets
    WHERE group_name = ${'Institucional'}
       OR visibility = ${'Institucional'}
       OR provider = ${'institutional'}
    ORDER BY title ASC
  `) as LibraryAssetFastRow[];

  return rows.map((row) => ({
    id: row.id,
    canonicalKey: row.canonicalKey,
    provider: row.provider as LibraryProvider,
    providerRecordId: row.providerRecordId,
    group: row.group as LibraryGroup,
    title: row.title,
    authors: parseJsonSafe<string[]>(row.authors, []),
    publishedAt: row.publishedAt ?? '',
    abstract: row.abstract,
    descriptionHtml: row.descriptionHtml,
    doi: row.doi ?? undefined,
    canonicalUrl: row.canonicalUrl,
    resourceType: row.resourceType,
    language: row.language,
    license: parseJsonSafe(row.license, null),
    openAccess: row.openAccess,
    citationCount: row.citationCount,
    thumbnailUrl: row.thumbnailUrl ?? undefined,
    embedUrl: row.embedUrl ?? undefined,
    institutionId: row.institutionId ?? undefined,
    institutionName: row.institutionName ?? undefined,
    visibility: row.visibility as LibraryAsset['visibility'],
    previewKind: row.previewKind as LibrarySearchResult['previewKind'],
    tags: parseJsonSafe<string[]>(row.tags, []),
    metadata: parseJsonSafe<Record<string, unknown>>(row.metadata, {}),
    files: [],
    createdAt: '',
    updatedAt: '',
  } satisfies LibraryAsset));
}
