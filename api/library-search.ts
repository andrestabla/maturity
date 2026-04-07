import { getSql } from '../lib/db.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import type { AuthUser, LibraryGroup, LibraryProvider, LibrarySearchResult } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

const OPENALEX_BASE = 'https://api.openalex.org';
const PHET_METADATA_URL =
  'https://phet.colorado.edu/services/metadata/1.2/simulations?format=json&type=html&locale=en&summary';
const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3/search';

type ProviderState = {
  provider: LibraryProvider | string;
  count: number;
  error?: string;
  durationMs?: number;
};

type SearchParams = {
  q: string;
  group: LibraryGroup;
  language?: string;
  year?: number;
  openAccess?: boolean;
  limit: number;
};

type LibraryAssetRow = {
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
};

function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function normalizeQuery(value: string) {
  return value.trim();
}

function tokens(value: string) {
  return normalizeQuery(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreByTokens(text: string, query: string) {
  const searchTokens = tokens(query);
  if (searchTokens.length === 0) return 0.55;
  const target = text.toLowerCase();
  const matches = searchTokens.filter((token) => target.includes(token)).length;
  return Math.min(0.95, 0.4 + matches / Math.max(searchTokens.length, 1) * 0.45);
}

function withAbortTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timeout),
  };
}

async function timedProvider<T>(
  provider: ProviderState['provider'],
  runner: () => Promise<T[]>,
) {
  const startedAt = Date.now();
  try {
    const results = await runner();
    return {
      results,
      state: {
        provider,
        count: results.length,
        durationMs: Date.now() - startedAt,
      } satisfies ProviderState,
    };
  } catch (error) {
    return {
      results: [] as T[],
      state: {
        provider,
        count: 0,
        error: error instanceof Error ? error.message : 'Error desconocido',
        durationMs: Date.now() - startedAt,
      } satisfies ProviderState,
    };
  }
}

async function readInstitutionalAssets(user: AuthUser, params: SearchParams): Promise<LibrarySearchResult[]> {
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
  `) as LibraryAssetRow[];

  const filtered = rows.filter((asset) => {
    if (asset.visibility === 'Institucional' && asset.institutionId) {
      const isAdmin = user.role === 'Administrador' || user.role === 'Coordinador' || user.role === 'Auditor';
      const isMember =
        user.institutionId === asset.institutionId ||
        (user.memberships ?? []).some((membership) => membership.institutionId === asset.institutionId);
      if (!isAdmin && !isMember) return false;
    }

    if (params.language && params.language !== 'all' && asset.language !== params.language) {
      return false;
    }

    if (!params.q) return true;
    const query = params.q.toLowerCase();
    const text = `${asset.title} ${asset.abstract} ${(asset.institutionName ?? '')}`.toLowerCase();
    return text.includes(query);
  });

  return filtered.slice(0, params.limit).map((asset) => ({
    id: asset.id,
    canonicalKey: asset.canonicalKey,
    provider: asset.provider as LibraryProvider,
    providerRecordId: asset.providerRecordId,
    providers: [asset.provider as LibraryProvider],
    group: asset.group as LibraryGroup,
    title: asset.title,
    authors: parseJsonSafe<string[]>(asset.authors, []),
    publishedAt: asset.publishedAt ?? '',
    abstract: asset.abstract,
    descriptionHtml: asset.descriptionHtml,
    doi: asset.doi ?? '',
    canonicalUrl: asset.canonicalUrl,
    resourceType: asset.resourceType,
    language: asset.language,
    license: parseJsonSafe(asset.license, null),
    openAccess: asset.openAccess,
    citationCount: asset.citationCount,
    thumbnailUrl: asset.thumbnailUrl ?? undefined,
    embedUrl: asset.embedUrl ?? undefined,
    institutionId: asset.institutionId ?? undefined,
    institutionName: asset.institutionName ?? undefined,
    visibility: asset.visibility as LibrarySearchResult['visibility'],
    previewKind: asset.previewKind as LibrarySearchResult['previewKind'],
    tags: parseJsonSafe<string[]>(asset.tags, []),
    metadata: parseJsonSafe<Record<string, unknown>>(asset.metadata, {}),
    score: 0.8,
    sourceKinds: [asset.resourceType],
    cached: false,
  }));
}

async function searchOpenAlexFast(params: SearchParams): Promise<LibrarySearchResult[]> {
  const timeout = withAbortTimeout(2600);
  try {
    const url = new URL(`${OPENALEX_BASE}/works`);
    const query = params.q || 'learning';
    url.searchParams.set('search', query);
    url.searchParams.set('per_page', String(Math.min(params.limit, 20)));
    url.searchParams.set(
      'select',
      'id,display_name,authorships,publication_year,doi,language,cited_by_count,open_access,best_oa_location,abstract_inverted_index,type',
    );
    url.searchParams.set('mailto', 'library@maturity360.co');

    const filters: string[] = [];
    if (params.language && params.language !== 'all') filters.push(`language:${params.language}`);
    if (params.year) filters.push(`from_publication_date:${params.year}-01-01`);
    if (params.openAccess) filters.push('open_access.is_oa:true');
    if (filters.length > 0) url.searchParams.set('filter', filters.join(','));

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'Maturity360 Library/1.0' },
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAlex ${response.status}`);
    }

    const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
    const results = payload.results ?? [];

    return results.slice(0, params.limit).map((item) => {
      const rawId = String(item.id ?? '');
      const oaId = rawId.split('/').pop() ?? rawId;
      const doi = String(item.doi ?? '').replace('https://doi.org/', '');
      const canonicalKey = doi ? `doi:${doi.toLowerCase()}` : `openalex:${oaId}`;
      const authorships = (item.authorships as Array<Record<string, unknown>> | undefined) ?? [];
      const openAccess = (item.open_access as Record<string, unknown> | undefined) ?? {};
      const bestOA = (item.best_oa_location as Record<string, unknown> | undefined) ?? {};
      const abstract = decodeOpenAlexAbstract(item.abstract_inverted_index);
      const score = Math.min(
        0.97,
        scoreByTokens(`${String(item.display_name ?? '')} ${abstract}`, query)
          + Math.min(0.2, Math.log10(Number(item.cited_by_count ?? 0) + 1) / 10),
      );

      return {
        id: `oa-${oaId}`,
        canonicalKey,
        provider: 'openalex' as const,
        providerRecordId: oaId,
        providers: ['openalex' as const],
        group: 'Investigacion' as const,
        title: String(item.display_name ?? '(sin título)'),
        authors: authorships
          .slice(0, 6)
          .map((authorShip) => String((authorShip.author as Record<string, unknown> | undefined)?.display_name ?? ''))
          .filter(Boolean),
        publishedAt: String(item.publication_year ?? ''),
        abstract,
        descriptionHtml: '',
        doi,
        canonicalUrl: doi ? `https://doi.org/${doi}` : rawId,
        resourceType: String(item.type ?? 'Artículo'),
        language: String(item.language ?? 'en'),
        openAccess: Boolean(openAccess.is_oa),
        citationCount: Number(item.cited_by_count ?? 0),
        thumbnailUrl: undefined,
        embedUrl: String(bestOA.pdf_url ?? bestOA.landing_page_url ?? '') || undefined,
        institutionId: undefined,
        institutionName: undefined,
        visibility: 'Publico' as const,
        previewKind: bestOA.pdf_url ? ('pdf' as const) : ('paper' as const),
        tags: [],
        metadata: {},
        score,
        sourceKinds: ['OpenAlex'],
        cached: false,
      } satisfies LibrarySearchResult;
    });
  } finally {
    timeout.done();
  }
}

function decodeOpenAlexAbstract(invertedIndex: unknown) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const pairs = Object.entries(invertedIndex as Record<string, number[]>)
    .flatMap(([word, positions]) => positions.map((position) => ({ word, position })))
    .sort((a, b) => a.position - b.position);
  return pairs.map((pair) => pair.word).join(' ');
}

async function searchPhETFast(params: SearchParams): Promise<LibrarySearchResult[]> {
  const timeout = withAbortTimeout(2200);
  try {
    const response = await fetch(PHET_METADATA_URL, {
      headers: { Accept: 'application/json' },
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new Error(`PhET ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const projects = (payload.projects as Array<Record<string, unknown>> | undefined) ?? [];
    const queryTokens = tokens(params.q);
    const rows: LibrarySearchResult[] = [];

    for (const project of projects) {
      const simulations = (project.simulations as Array<Record<string, unknown>> | undefined) ?? [];
      for (const sim of simulations) {
        const name = String(project.name ?? sim.name ?? '').trim();
        if (!name) continue;
        const description = String(sim.description ?? sim.designedForDescription ?? '').trim();
        const title = String(
          ((sim.localizedSimulations as Array<Record<string, unknown>> | undefined)?.[0]?.title as string | undefined)
            ?? sim.title
            ?? name,
        );
        const haystack = `${title} ${description}`.toLowerCase();
        if (queryTokens.length > 0 && !queryTokens.some((token) => haystack.includes(token))) continue;

        rows.push({
          id: `ph-${name}`,
          canonicalKey: `phet:${name}`,
          provider: 'phet',
          providerRecordId: name,
          providers: ['phet'],
          group: 'Didacticos',
          title,
          authors: ['PhET Interactive Simulations'],
          publishedAt: String(new Date().getFullYear()),
          abstract: description || `Simulación interactiva de PhET sobre ${title}.`,
          descriptionHtml: '',
          doi: '',
          canonicalUrl: `https://phet.colorado.edu/en/simulations/${name}`,
          resourceType: 'Simulación Interactiva',
          language: 'es',
          openAccess: true,
          citationCount: 0,
          thumbnailUrl: `https://phet.colorado.edu/sims/html/${name}/latest/${name}-600.png`,
          embedUrl: `https://phet.colorado.edu/sims/html/${name}/latest/${name}_all.html`,
          institutionId: undefined,
          institutionName: undefined,
          visibility: 'Publico',
          previewKind: 'simulation',
          tags: [],
          metadata: {},
          score: scoreByTokens(`${title} ${description}`, params.q),
          sourceKinds: ['PhET'],
          cached: false,
        });
      }
    }

    return rows
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit);
  } finally {
    timeout.done();
  }
}

async function resolveYouTubeApiKey() {
  if (process.env.YOUTUBE_API_KEY?.trim()) {
    return process.env.YOUTUBE_API_KEY.trim();
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT config
    FROM maturity_admin_integrations
    WHERE id = ${'youtube-data-api'}
      AND enabled = true
    LIMIT 1
  `) as Array<{ config: unknown }>;

  const config = parseJsonSafe<Record<string, string>>(rows[0]?.config, {});
  return config.youtubeApiKey?.trim() || config.apiKey?.trim() || '';
}

async function searchYouTubeFast(params: SearchParams): Promise<LibrarySearchResult[]> {
  const apiKey = await resolveYouTubeApiKey();
  if (!apiKey) {
    throw new Error('YouTube sin credencial activa.');
  }

  const timeout = withAbortTimeout(2800);
  try {
    const url = new URL(YOUTUBE_BASE);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', String(Math.min(params.limit, 20)));
    url.searchParams.set('videoCategoryId', '27');
    url.searchParams.set('safeSearch', 'moderate');
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('regionCode', 'CO');
    url.searchParams.set('relevanceLanguage', params.language && params.language !== 'all' ? params.language : 'es');
    url.searchParams.set('q', params.q || 'aprendizaje');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new Error(`YouTube ${response.status}`);
    }

    const payload = (await response.json()) as {
      items?: Array<Record<string, unknown>>;
    };

    return (payload.items ?? []).slice(0, params.limit).map((item) => {
      const idData = (item.id as Record<string, unknown> | undefined) ?? {};
      const snippet = (item.snippet as Record<string, unknown> | undefined) ?? {};
      const thumbnails = (snippet.thumbnails as Record<string, unknown> | undefined) ?? {};
      const thumbnail = (thumbnails.high as Record<string, unknown> | undefined)
        ?? (thumbnails.medium as Record<string, unknown> | undefined)
        ?? (thumbnails.default as Record<string, unknown> | undefined)
        ?? {};

      const videoId = String(idData.videoId ?? '');
      const title = String(snippet.title ?? '(sin título)');
      const description = String(snippet.description ?? '');
      const publishedAt = String(snippet.publishedAt ?? '');
      const channelTitle = String(snippet.channelTitle ?? 'YouTube');

      return {
        id: `yt-${videoId}`,
        canonicalKey: `youtube:${videoId}`,
        provider: 'youtube',
        providerRecordId: videoId,
        providers: ['youtube'],
        group: 'YouTube',
        title,
        authors: [channelTitle],
        publishedAt: publishedAt.slice(0, 4),
        abstract: description.slice(0, 500),
        descriptionHtml: '',
        doi: '',
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        resourceType: 'Video Educativo',
        language: 'es',
        openAccess: true,
        citationCount: 0,
        thumbnailUrl: String(thumbnail.url ?? ''),
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
        institutionId: undefined,
        institutionName: undefined,
        visibility: 'Publico',
        previewKind: 'video',
        tags: [],
        metadata: {},
        score: scoreByTokens(`${title} ${description}`, params.q),
        sourceKinds: ['YouTube'],
        cached: false,
      } satisfies LibrarySearchResult;
    });
  } finally {
    timeout.done();
  }
}

export default async function handler(request: Request) {
  try {
    if (request.method !== 'GET') {
      return errorResponse(405, 'Método no permitido');
    }

    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');

    const rawUrl = request.url ?? '';
    const host = request.headers.get('host') ?? 'localhost';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `${proto}://${host}${rawUrl}`);

    const params: SearchParams = {
      q: normalizeQuery(url.searchParams.get('q') ?? ''),
      group: (url.searchParams.get('group') as LibraryGroup) ?? 'Investigacion',
      language: url.searchParams.get('language') ?? undefined,
      year: url.searchParams.get('year') ? Number.parseInt(url.searchParams.get('year') || '', 10) : undefined,
      openAccess: url.searchParams.get('open_access') === 'true',
      limit: Math.min(Number.parseInt(url.searchParams.get('limit') || '20', 10), 30),
    };

    if (params.group === 'Institucional') {
      const results = await readInstitutionalAssets(user, params);
      return jsonResponse({
        results,
        total: results.length,
        group: params.group,
        query: params.q,
        providerStates: [{ provider: 'institutional', count: results.length, durationMs: 0 }],
        cached: false,
        fetchedAt: new Date().toISOString(),
      });
    }

    if (params.group === 'YouTube') {
      const { results, state } = await timedProvider('youtube', () => searchYouTubeFast(params));
      return jsonResponse({
        results,
        total: results.length,
        group: params.group,
        query: params.q,
        providerStates: [state],
        cached: false,
        fetchedAt: new Date().toISOString(),
      });
    }

    if (params.group === 'Didacticos') {
      const { results, state } = await timedProvider('phet', () => searchPhETFast(params));
      return jsonResponse({
        results,
        total: results.length,
        group: params.group,
        query: params.q,
        providerStates: [state],
        cached: false,
        fetchedAt: new Date().toISOString(),
      });
    }

    const { results, state } = await timedProvider('openalex', () => searchOpenAlexFast(params));
    return jsonResponse({
      results,
      total: results.length,
      group: params.group,
      query: params.q,
      providerStates: [state],
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[LibrarySearchLight] Error:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Error interno');
  }
}
