import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';
import { getProviderConfigValue } from '../provider-settings.js';

const REDALYC_OAI_BASE = 'http://148.215.1.70/redalyc/oai';

/**
 * Redalyc adapter backed by its official OAI-PMH feed.
 * Docs: https://redalyc.org/redalyc/acerca-de/oai-pmh.html
 *
 * Redalyc does not expose a public keyword-search JSON API, so we harvest the
 * newest OAI records for a short lookback window and rank matches locally.
 */
export async function searchRedalyc(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const integration = params.providerIntegrations?.redalyc;
  const baseUrl = getProviderConfigValue(integration, [], 'apiBaseUrl') || REDALYC_OAI_BASE;
  const metadataPrefix = integration?.config.metadataPrefix?.trim() || 'oai_dc';
  const lookbackYears = clampNumber(integration?.config.lookbackYears, 2, 1, 6);
  const maxPages = clampNumber(integration?.config.maxPages, 3, 1, 10);
  const pageRecordCap = clampNumber(integration?.config.pageRecordCap, 80, 10, 200);
  const { query, language, year, limit = 15 } = params;
  const queryTokens = tokenize(query);
  const startYear = year || new Date().getFullYear() - lookbackYears;

  let requestUrl = `${baseUrl}?verb=ListRecords&metadataPrefix=${encodeURIComponent(metadataPrefix)}&from=${startYear}-01-01&until=${new Date().getFullYear()}-12-31`;
  const matches: LibrarySearchResult[] = [];
  let page = 0;

  while (requestUrl && page < maxPages && matches.length < limit * 2) {
    const response = await fetch(requestUrl, {
      headers: {
        Accept: 'application/xml,text/xml',
        'User-Agent': 'Maturity360 Library/1.0',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Redalyc OAI-PMH ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const records = splitXmlBlocks(xml, 'record').slice(0, pageRecordCap);

    for (const record of records) {
      const normalized = normalizeRedalycRecord(record, queryTokens);
      if (!normalized) {
        continue;
      }

      if (language && language !== 'all' && normalized.language !== language) {
        continue;
      }

      if (year && Number.parseInt(normalized.publishedAt || '0', 10) < year) {
        continue;
      }

      matches.push(normalized);
      if (matches.length >= limit * 2) {
        break;
      }
    }

    requestUrl = buildResumptionRequest(baseUrl, extractTagValue(xml, 'resumptionToken'));
    page += 1;
  }

  return matches.sort((left, right) => right.score - left.score).slice(0, limit);
}

function normalizeRedalycRecord(recordXml: string, queryTokens: string[]): LibrarySearchResult | null {
  const identifier = extractTagValue(recordXml, 'identifier');
  const articleId = identifier.split(':').pop()?.trim() || '';
  const title = cleanXmlText(extractTagValue(recordXml, 'dc:title'));
  if (!articleId || !title) {
    return null;
  }

  const creators = extractTagValues(recordXml, 'dc:creator').map(cleanXmlText).filter(Boolean);
  const subjects = extractTagValues(recordXml, 'dc:subject').map(cleanXmlText).filter(Boolean);
  const description = cleanXmlText(extractTagValue(recordXml, 'dc:description'));
  const source = cleanXmlText(extractTagValue(recordXml, 'dc:source'));
  const language = cleanXmlText(extractTagValue(recordXml, 'dc:language')).toLowerCase() || 'es';
  const dateRaw = cleanXmlText(extractTagValue(recordXml, 'dc:date'));
  const year = dateRaw.slice(0, 4);
  const doi = extractDoi(recordXml);
  const url = extractUrl(recordXml, articleId, doi);
  const score = computeRedalycScore(title, description, subjects, year, queryTokens);

  if (queryTokens.length > 0 && score < 0.48) {
    return null;
  }

  return {
    id: `rd-${articleId}`,
    canonicalKey: doi ? `doi:${doi.toLowerCase()}` : `redalyc:${articleId}`,
    provider: 'redalyc',
    providerRecordId: articleId,
    providers: ['redalyc'],
    group: 'Investigacion',
    title,
    authors: creators.slice(0, 6),
    publishedAt: year,
    abstract: description,
    descriptionHtml: description ? `<p>${description}</p>` : '',
    doi,
    canonicalUrl: url,
    resourceType: 'Artículo Científico',
    language,
    openAccess: true,
    citationCount: 0,
    thumbnailUrl: undefined,
    embedUrl: undefined,
    institutionId: undefined,
    institutionName: source || undefined,
    visibility: 'Publico',
    previewKind: 'external-link',
    tags: [source, ...subjects].filter(Boolean).slice(0, 6),
    metadata: {
      source,
      identifier,
    },
    score,
    sourceKinds: ['Redalyc'],
    cached: false,
  };
}

function splitXmlBlocks(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    blocks.push(match[0]);
  }

  return blocks;
}

function extractTagValue(xml: string, tagName: string) {
  const escapedTag = tagName.replace(':', '\\:');
  const match = xml.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function extractTagValues(xml: string, tagName: string) {
  const escapedTag = tagName.replace(':', '\\:');
  const pattern = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    values.push(match[1]?.trim() || '');
  }

  return values;
}

function cleanXmlText(input: string) {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDoi(xml: string) {
  const text = cleanXmlText(xml);
  const match = text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return match?.[0] || '';
}

function extractUrl(xml: string, articleId: string, doi: string) {
  const identifiers = extractTagValues(xml, 'dc:identifier').map(cleanXmlText);
  const url = identifiers.find((identifier) => /^https?:\/\//i.test(identifier));
  if (url) {
    return url;
  }

  if (doi) {
    return `https://doi.org/${doi}`;
  }

  return `https://www.redalyc.org/articulo.oa?id=${articleId}`;
}

function buildResumptionRequest(baseUrl: string, token: string) {
  if (!token) {
    return '';
  }

  return `${baseUrl}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`;
}

function computeRedalycScore(
  title: string,
  description: string,
  subjects: string[],
  year: string,
  queryTokens: string[],
) {
  const haystack = `${title} ${description} ${subjects.join(' ')}`.toLowerCase();
  const tokenMatches = queryTokens.filter((token) => haystack.includes(token)).length;
  const tokenScore = queryTokens.length > 0 ? Math.min(0.35, tokenMatches / queryTokens.length) : 0.15;
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - Number.parseInt(year, 10)) / 10) * 0.22 : 0;
  return Math.min(0.96, 0.4 + tokenScore + recency);
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}
