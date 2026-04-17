import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';
import { getProviderConfigValue } from '../provider-settings.js';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

function sanitizeYouTubeErrorMessage(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSpanishYouTubeError(status: number, message: string): string {
  const normalized = message.toLowerCase();

  if (status === 403 && normalized.includes('quota')) {
    return 'YouTube agotó la cuota diaria del proyecto API. Intenta de nuevo más tarde o aumenta la cuota en Google Cloud.';
  }

  if (status === 403) {
    return 'YouTube rechazó la solicitud por permisos o configuración de la API.';
  }

  if (status === 401) {
    return 'YouTube rechazó la credencial de API.';
  }

  return `YouTube devolvió un error (${status}).`;
}

/**
 * YouTube Data API v3 Adapter with Academic Ranking
 * Requires YOUTUBE_API_KEY environment variable.
 * Academic ranking: penalizes entertainment channels, boosts edu channels.
 */
export async function searchYouTube(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const integration = params.providerIntegrations?.youtube;
  const apiKey = getProviderConfigValue(
    integration,
    ['YOUTUBE_API_KEY'],
    'youtubeApiKey',
    'apiKey',
  );
  if (!apiKey) {
    console.info('[YouTube] No YOUTUBE_API_KEY configured — skipping.');
    return [];
  }

  const { query, language, limit = 20 } = params;
  const regionCode = integration?.config.defaultRegion?.trim() || 'CO';
  const safeSearchMap: Record<string, string> = {
    Estricto: 'strict',
    Moderado: 'moderate',
    'Sin filtro': 'none',
  };
  const safeSearch = safeSearchMap[integration?.config.safeSearch || 'Moderado'] || 'moderate';
  const queryFilter = integration?.config.queryFilter?.trim();

  const urlParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: queryFilter ? `${query} ${queryFilter}` : query,
    maxResults: String(Math.min(limit, 50)),
    key: apiKey,
    videoCategoryId: '27', // Education category
    relevanceLanguage: language && language !== 'all' ? language : 'es',
    regionCode,
    safeSearch,
    order: 'relevance',
  });

  let response = await fetch(`${YT_BASE}/search?${urlParams.toString()}`, { signal });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as Record<string, unknown>;
    const errorData = (error.error ?? {}) as Record<string, unknown>;
    const rawMessage = sanitizeYouTubeErrorMessage(errorData.message ?? response.statusText);
    throw new Error(toSpanishYouTubeError(response.status, rawMessage));
  }

  let data = await response.json() as { items?: unknown[] };
  let items = (data.items ?? []) as Array<Record<string, unknown>>;

  // Fallback when Education category yields 0 results.
  if (items.length === 0) {
    const broadParams = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: queryFilter ? `${query} ${queryFilter}` : query,
      maxResults: String(Math.min(limit, 50)),
      key: apiKey,
      safeSearch,
      order: 'relevance',
    });

    response = await fetch(`${YT_BASE}/search?${broadParams.toString()}`, { signal });
    if (response.ok) {
      data = await response.json() as { items?: unknown[] };
      items = (data.items ?? []) as Array<Record<string, unknown>>;
    }
  }

  const results = items.map((item) => normalizeYouTubeResult(item));

  // Apply academic ranking — sort by computed score
  return results.sort((a, b) => b.score - a.score);
}

function normalizeYouTubeResult(item: Record<string, unknown>): LibrarySearchResult {
  const idData = (item.id ?? {}) as Record<string, unknown>;
  const snippet = (item.snippet ?? {}) as Record<string, unknown>;
  const thumbnails = (snippet.thumbnails ?? {}) as Record<string, unknown>;
  const maxresThumbnail = (thumbnails.maxres ?? thumbnails.high ?? thumbnails.medium ?? thumbnails.default ?? {}) as Record<string, unknown>;

  const videoId = String(idData.videoId ?? '');
  const channelId = String(snippet.channelId ?? '');
  const channelTitle = String(snippet.channelTitle ?? '');
  const title = String(snippet.title ?? '');
  const description = String(snippet.description ?? '');
  const publishedAt = String(snippet.publishedAt ?? '');
  const year = publishedAt.slice(0, 4);

  const academicScore = computeYouTubeAcademicScore(channelTitle, channelId, title, description);

  return {
    id: `yt-${videoId}`,
    canonicalKey: `youtube:${videoId}`,
    provider: 'youtube',
    providerRecordId: videoId,
    providers: ['youtube'],
    group: 'YouTube',
    title,
    authors: [channelTitle],
    publishedAt: year,
    abstract: description.slice(0, 500),
    descriptionHtml: '',
    doi: '',
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    resourceType: 'Video Educativo',
    language: 'es',
    openAccess: true,
    citationCount: 0,
    thumbnailUrl: String(maxresThumbnail.url ?? ''),
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: 'video',
    tags: [],
    metadata: {
      channelId,
      channelTitle,
      publishedAt,
      liveBroadcastContent: snippet.liveBroadcastContent,
    },
    score: academicScore,
    sourceKinds: ['YouTube'],
    cached: false,
  };
}

// Academic channel patterns — channels known for educational content
const ACADEMIC_CHANNEL_PATTERNS = [
  /university|universidad|académi|academic|professor|lecture|coursera|khan|mit|stanford|harvard/i,
  /edx|udacity|ocw|opencourseware|facultad|department|institute|school of/i,
  /ciencias|sciences|research|investigación|laboratorio|laboratory/i,
  /ted.?ed|tedx|national geographic|smithsonian|pbs|bbc learning|cern/i,
];

const ENTERTAINMENT_PATTERNS = [
  /vlog|gaming|gamer|funny|meme|prank|challenge|reaction|mukbang|asmr/i,
  /beauty|fashion|lifestyle|travel|cooking|recipe|fitness|workout/i,
];

const ACADEMIC_TITLE_KEYWORDS =
  /lecture|class|course|tutorial|lesson|explicación|fundamentos|introducción|cátedra|seminar|workshop|conferencia/i;

function computeYouTubeAcademicScore(
  channelTitle: string,
  _channelId: string,
  title: string,
  description: string,
): number {
  let score = 0.40; // Base score

  // Academic channel bonus
  const isAcademic = ACADEMIC_CHANNEL_PATTERNS.some((p) => p.test(channelTitle));
  if (isAcademic) score += 0.30;

  // Entertainment penalty
  const isEntertainment = ENTERTAINMENT_PATTERNS.some((p) => p.test(channelTitle + ' ' + title));
  if (isEntertainment) score -= 0.25;

  // Academic keywords in title
  if (ACADEMIC_TITLE_KEYWORDS.test(title)) score += 0.15;

  // Description length (longer = more educational)
  if (description.length > 200) score += 0.05;
  if (description.length > 500) score += 0.05;

  return Math.max(0.1, Math.min(1.0, score));
}
