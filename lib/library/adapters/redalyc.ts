import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';

const REDALYC_BASE = 'http://api.redalyc.org/api';

/**
 * Redalyc API Adapter
 * Docs: http://api.redalyc.org/docs/#/
 * Requires REDALYC_API_KEY environment variable.
 * Redalyc is the main open-access repository for Latin American academic journals.
 */
export async function searchRedalyc(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const apiKey = process.env.REDALYC_API_KEY?.trim();
  if (!apiKey) {
    console.info('[Redalyc] No REDALYC_API_KEY configured — skipping.');
    return [];
  }

  const { query, language, year, limit = 15 } = params;

  const urlParams = new URLSearchParams({
    q: query,
    apiKey,
    rows: String(Math.min(limit, 50)),
    start: '0',
  });

  if (language && language !== 'all') {
    urlParams.set('idioma', language);
  }

  if (year) {
    urlParams.set('anio', String(year));
  }

  const response = await fetch(`${REDALYC_BASE}/search/articles?${urlParams.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Redalyc ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const docs = ((data.articles ?? data.data ?? data.results ?? []) as unknown[]) as Array<Record<string, unknown>>;

  return docs.map((doc) => normalizeRedalycResult(doc));
}

function normalizeRedalycResult(doc: Record<string, unknown>): LibrarySearchResult {
  const articleId = String(doc.idArticulo ?? doc.id ?? doc.articuloId ?? '');
  const doi = String(doc.doi ?? doc.DOI ?? '').replace('https://doi.org/', '');
  const canonicalKey = doi ? `doi:${doi.toLowerCase()}` : `redalyc:${articleId}`;

  const authorsRaw = doc.autores ?? doc.authors ?? doc.autor;
  const authors: string[] = Array.isArray(authorsRaw)
    ? authorsRaw.map((a) => {
        if (typeof a === 'string') return a;
        const rec = a as Record<string, unknown>;
        return String(rec.nombre ?? rec.name ?? '');
      }).filter(Boolean)
    : typeof authorsRaw === 'string'
      ? authorsRaw.split(';').map((s) => s.trim()).filter(Boolean)
      : [];

  const yearStr = String(doc.anio ?? doc.year ?? doc.anioPublicacion ?? '').slice(0, 4);
  const title = String(doc.titulo ?? doc.title ?? doc.tituloEspanol ?? '(sin título)');
  const abstract = String(doc.resumen ?? doc.abstract ?? doc.abstractEspanol ?? '');
  const journal = String(doc.revista ?? doc.journal ?? doc.nombreRevista ?? '');
  const lang = String(doc.idioma ?? doc.language ?? 'es');
  const url = String(doc.url ?? doc.urlArticulo ?? `https://www.redalyc.org/articulo.oa?id=${articleId}`);

  return {
    id: `rd-${articleId}`,
    canonicalKey,
    provider: 'redalyc',
    providerRecordId: articleId,
    providers: ['redalyc'],
    group: 'Investigacion',
    title,
    authors: authors.slice(0, 6),
    publishedAt: yearStr,
    abstract,
    descriptionHtml: '',
    doi,
    canonicalUrl: doi ? `https://doi.org/${doi}` : url,
    resourceType: 'Artículo Científico',
    language: lang,
    openAccess: true,
    citationCount: Number(doc.citaciones ?? doc.citations ?? 0),
    thumbnailUrl: undefined,
    embedUrl: undefined,
    institutionId: undefined,
    institutionName: undefined,
    visibility: 'Publico',
    previewKind: 'external-link',
    tags: [journal, String(doc.area ?? ''), String(doc.disciplina ?? '')].filter(Boolean).slice(0, 4),
    metadata: {
      journal,
      country: doc.pais,
      area: doc.area,
    },
    score: computeRedalycScore(yearStr),
    sourceKinds: ['Redalyc'],
    cached: false,
  };
}

function computeRedalycScore(year: string): number {
  const recency = year ? Math.max(0, 1 - (new Date().getFullYear() - parseInt(year, 10)) / 20) * 0.3 : 0;
  return Math.min(1.0, 0.42 + recency);
}
