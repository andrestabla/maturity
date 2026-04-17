import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { getSql } from '../../lib/db.js';
import type { AuthUser, LibraryAsset, LibraryGroup, LibraryProvider, LibrarySearchResult } from '../../src/types.js';
import { federatedSearch } from '../../lib/library/orchestrator.js';
import type { SearchParams } from '../../lib/library/orchestrator.js';

export const config = {
  runtime: 'edge',
};

interface YouTubeFallbackItem {
  id: string;
  title: string;
  authors: string[];
  publishedAt: string;
  abstract: string;
  tags: string[];
  videoId: string;
}

const YOUTUBE_FALLBACK_CATALOG: YouTubeFallbackItem[] = [
  {
    id: 'yt-fallback-3b1b-nn',
    title: 'But what is a Neural Network?',
    authors: ['3Blue1Brown'],
    publishedAt: '2017-10-19',
    abstract: 'Visual explicación de redes neuronales y flujo básico de entrenamiento para clases introductorias.',
    tags: ['redes neuronales', 'deep learning', 'fundamentos'],
    videoId: 'aircAruvnKk',
  },
  {
    id: 'yt-fallback-statquest-nn',
    title: 'Neural Networks Pt. 1 (StatQuest)',
    authors: ['StatQuest with Josh Starmer'],
    publishedAt: '2017-11-16',
    abstract: 'Introducción práctica a neuronas, capas y señales de aprendizaje supervisado.',
    tags: ['redes neuronales', 'machine learning', 'supervisado'],
    videoId: 'CqOfi41LfDw',
  },
  {
    id: 'yt-fallback-statquest-overfit',
    title: 'Overfitting and Underfitting (StatQuest)',
    authors: ['StatQuest with Josh Starmer'],
    publishedAt: '2018-07-16',
    abstract: 'Explica sobreajuste, subajuste y cómo interpretar sesgo/varianza de forma pedagógica.',
    tags: ['overfitting', 'regularización', 'evaluación'],
    videoId: 'EuBBz3bI-aA',
  },
  {
    id: 'yt-fallback-cs229',
    title: 'Machine Learning (Stanford CS229) - Lecture 1',
    authors: ['Stanford Online'],
    publishedAt: '2018-09-28',
    abstract: 'Clase de apertura sobre fundamentos de ML, formulación de problemas y evaluación inicial.',
    tags: ['machine learning', 'curso', 'fundamentos'],
    videoId: 'jGwO_UgTS7I',
  },
  {
    id: 'yt-fallback-andrej-nn',
    title: 'The spelled-out intro to neural networks and backpropagation',
    authors: ['Andrej Karpathy'],
    publishedAt: '2022-06-03',
    abstract: 'Sesión técnica aplicada para entender entrenamiento y backpropagation paso a paso.',
    tags: ['redes neuronales', 'backpropagation', 'python'],
    videoId: 'VMj-3S1tku0',
  },
  {
    id: 'yt-fallback-fastai',
    title: 'Practical Deep Learning for Coders - Lesson 1',
    authors: ['Jeremy Howard'],
    publishedAt: '2022-07-06',
    abstract: 'Clase enfocada en práctica docente para construir modelos sin perder intuición conceptual.',
    tags: ['deep learning', 'aprendizaje práctico', 'curso'],
    videoId: '8SF_h3xF3cE',
  },
];

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
    let finalResults = orchestratorResult.results;
    let finalTotal = orchestratorResult.total;
    let usedYouTubeFallback = false;

    if (group === 'YouTube' && finalResults.length === 0) {
      const fallbackResults = buildYouTubeFallbackResults(searchParams.query, limit);
      if (fallbackResults.length > 0) {
        finalResults = fallbackResults;
        finalTotal = fallbackResults.length;
        usedYouTubeFallback = true;
      }
    }

    // Persist to cache (non-blocking, swallow DB errors)
    if (q && finalResults.length > 0 && !usedYouTubeFallback) {
      const primaryProvider = getPrimaryProviderForGroup(group);
      void persistLibrarySearchCacheFast(primaryProvider, cacheKey, cacheFilters, finalResults).catch(() => {});
    }

    return jsonResponse({
      results: finalResults.slice(0, limit),
      total: finalTotal,
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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toYouTubeFallbackResult(item: YouTubeFallbackItem): LibrarySearchResult {
  const canonicalUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
  return {
    id: item.id,
    canonicalKey: `youtube:${item.videoId}`,
    provider: 'youtube',
    providerRecordId: item.videoId,
    providers: ['youtube'],
    group: 'YouTube',
    title: item.title,
    authors: item.authors,
    publishedAt: item.publishedAt,
    abstract: item.abstract,
    descriptionHtml: '',
    doi: '',
    canonicalUrl,
    resourceType: 'Video Educativo',
    language: 'en',
    openAccess: true,
    citationCount: 0,
    thumbnailUrl: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${item.videoId}?rel=0&modestbranding=1`,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: 'video',
    tags: item.tags,
    metadata: {
      source: 'youtube-fallback',
    },
    score: 0.72,
    sourceKinds: ['YouTube'],
    cached: false,
  };
}

function buildYouTubeFallbackResults(query: string, limit: number): LibrarySearchResult[] {
  const normalizedQuery = normalizeText(query);
  const queryTokens = normalizedQuery.split(' ').filter((token) => token.length >= 3);

  const ranked = YOUTUBE_FALLBACK_CATALOG
    .map((item) => {
      const haystack = normalizeText(`${item.title} ${item.abstract} ${item.tags.join(' ')}`);
      const matchScore = queryTokens.reduce((acc, token) => (haystack.includes(token) ? acc + 1 : acc), 0);
      return {
        item,
        matchScore,
      };
    })
    .sort((left, right) => right.matchScore - left.matchScore);

  const selected = ranked
    .filter((entry, index) => entry.matchScore > 0 || index < 3)
    .slice(0, Math.min(limit, 8))
    .map((entry) => toYouTubeFallbackResult(entry.item));

  return selected;
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
