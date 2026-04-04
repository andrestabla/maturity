import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';

const OER_BASE = 'https://oercommons.org/api';

/**
 * OER Commons API Adapter
 * Docs: http://docs.oercommons.org/api/
 * Requires OER_COMMONS_API_KEY environment variable.
 * Fallback: graceful empty if no key.
 */
export async function searchOERCommons(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const apiKey = process.env.OER_COMMONS_API_KEY?.trim();
  if (!apiKey) {
    console.info('[OER Commons] No OER_COMMONS_API_KEY configured — skipping.');
    return [];
  }

  const { query, language, year, openAccess, limit = 15 } = params;

  const urlParams = new URLSearchParams({
    token: apiKey,
    q: query,
    batch_size: String(Math.min(limit, 50)),
    batch_start: '0',
  });

  if (language && language !== 'all') {
    urlParams.set('f.language', language);
  }

  if (year) {
    urlParams.set('f.date_min', `${year}-01-01`);
  }

  if (openAccess) {
    urlParams.set('f.license', 'cc-by,cc-by-sa,cc-by-nc,public-domain');
  }

  const response = await fetch(`${OER_BASE}/v1.2/?${urlParams.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`OER Commons ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const items = ((data.results ?? data.items ?? []) as unknown[]) as Array<Record<string, unknown>>;

  return items.map((item) => normalizeOERResult(item));
}

function normalizeOERResult(item: Record<string, unknown>): LibrarySearchResult {
  const oerId = String(item.id ?? item.node_id ?? '');
  const canonicalKey = `oer-commons:${oerId}`;

  const authorsRaw = item.authors ?? item.author;
  const authors: string[] = Array.isArray(authorsRaw)
    ? authorsRaw.map((a) => String((a as Record<string, unknown>).name ?? a)).filter(Boolean)
    : typeof authorsRaw === 'string'
      ? [authorsRaw]
      : [];

  const licenseData = (item.license ?? item.license_data ?? {}) as Record<string, unknown>;
  const licenseCode = String(licenseData.code ?? licenseData.license ?? item.license ?? '');
  const isOpen = /^(cc|public-domain)/i.test(licenseCode);

  const url = String(item.url ?? item.canonical_url ?? `https://oercommons.org/resources/${oerId}`);
  const thumbnailUrl = String(item.thumbnail_url ?? item.image ?? '');
  const yearStr = String(item.date_created ?? item.year ?? item.date ?? '').slice(0, 4);
  const resourceType = String(item.material_type ?? item.type ?? item.media_type ?? 'Recurso Educativo');
  const lang = String(item.language ?? 'en');

  const licenseObj = licenseCode
    ? {
        label: licenseCode.toUpperCase(),
        code: licenseCode,
        url: `https://creativecommons.org/licenses/${licenseCode.toLowerCase()}/4.0/`,
        open: isOpen,
      }
    : undefined;

  return {
    id: `oer-${oerId}`,
    canonicalKey,
    provider: 'oer-commons',
    providerRecordId: oerId,
    providers: ['oer-commons'],
    group: 'Didacticos',
    title: String(item.title ?? '(sin título)'),
    authors,
    publishedAt: yearStr,
    abstract: String(item.description ?? item.abstract ?? ''),
    descriptionHtml: String(item.description_html ?? item.body ?? ''),
    doi: '',
    canonicalUrl: url,
    resourceType,
    language: lang,
    openAccess: isOpen,
    citationCount: 0,
    thumbnailUrl: thumbnailUrl || undefined,
    embedUrl: undefined,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: 'external-link',
    tags: ((item.tags ?? item.subjects ?? []) as string[]).slice(0, 6),
    license: licenseObj,
    metadata: {
      materialType: resourceType,
      gradeLevel: item.grade_levels,
      educationalUse: item.educational_use,
    },
    score: computeOERScore(licenseCode, isOpen, yearStr),
    sourceKinds: ['OER Commons'],
    cached: false,
  };
}

function computeOERScore(licenseCode: string, isOpen: boolean, year: string): number {
  const openBonus = isOpen ? 0.25 : 0;
  const ccBonus = licenseCode.toLowerCase().startsWith('cc-by') && !licenseCode.includes('nc') ? 0.1 : 0;
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - parseInt(year, 10)) / 15) * 0.2 : 0;
  return Math.min(1.0, 0.35 + openBonus + ccBonus + recency);
}
