import type { LibraryProvider, LibrarySearchResult } from '../types.js';

export type LibraryVisualSourceKey =
  | LibraryProvider
  | 'pubmed'
  | 'devto';

export interface LibraryVisualSource {
  key: LibraryVisualSourceKey;
  label: string;
  mark: string;
  accent: string;
  soft: string;
  ringStart: string;
  ringEnd: string;
  markTextColor?: string;
}

export const LIBRARY_SOURCE_PRESENTATION: Record<LibraryVisualSourceKey, LibraryVisualSource> = {
  'semantic-scholar': {
    key: 'semantic-scholar',
    label: 'Semantic Scholar',
    mark: 'SS',
    accent: '#2563eb',
    soft: 'rgba(37, 99, 235, 0.12)',
    ringStart: '#60a5fa',
    ringEnd: '#2563eb',
  },
  openalex: {
    key: 'openalex',
    label: 'OpenAlex',
    mark: 'OA',
    accent: '#0f766e',
    soft: 'rgba(15, 118, 110, 0.12)',
    ringStart: '#2dd4bf',
    ringEnd: '#0f766e',
  },
  arxiv: {
    key: 'arxiv',
    label: 'arXiv',
    mark: 'arXiv',
    accent: '#b45309',
    soft: 'rgba(180, 83, 9, 0.12)',
    ringStart: '#f59e0b',
    ringEnd: '#b45309',
    markTextColor: '#fff7ed',
  },
  core: {
    key: 'core',
    label: 'CORE',
    mark: 'CORE',
    accent: '#15803d',
    soft: 'rgba(21, 128, 61, 0.12)',
    ringStart: '#4ade80',
    ringEnd: '#15803d',
    markTextColor: '#f0fdf4',
  },
  scielo: {
    key: 'scielo',
    label: 'SciELO',
    mark: 'SciELO',
    accent: '#0ea5e9',
    soft: 'rgba(14, 165, 233, 0.12)',
    ringStart: '#7dd3fc',
    ringEnd: '#0ea5e9',
  },
  redalyc: {
    key: 'redalyc',
    label: 'Redalyc',
    mark: 'RD',
    accent: '#7c3aed',
    soft: 'rgba(124, 58, 237, 0.12)',
    ringStart: '#c084fc',
    ringEnd: '#7c3aed',
  },
  'oer-commons': {
    key: 'oer-commons',
    label: 'OER Commons',
    mark: 'OER',
    accent: '#d97706',
    soft: 'rgba(217, 119, 6, 0.12)',
    ringStart: '#fbbf24',
    ringEnd: '#d97706',
  },
  phet: {
    key: 'phet',
    label: 'PhET',
    mark: 'PhET',
    accent: '#0891b2',
    soft: 'rgba(8, 145, 178, 0.12)',
    ringStart: '#67e8f9',
    ringEnd: '#0891b2',
  },
  youtube: {
    key: 'youtube',
    label: 'YouTube',
    mark: 'YouTube',
    accent: '#ef4444',
    soft: 'rgba(239, 68, 68, 0.12)',
    ringStart: '#f87171',
    ringEnd: '#ef4444',
    markTextColor: '#fff5f5',
  },
  institutional: {
    key: 'institutional',
    label: 'Institucional',
    mark: 'INST',
    accent: '#4f46e5',
    soft: 'rgba(79, 70, 229, 0.12)',
    ringStart: '#818cf8',
    ringEnd: '#4f46e5',
  },
  pubmed: {
    key: 'pubmed',
    label: 'PubMed',
    mark: 'PubMed',
    accent: '#2563eb',
    soft: 'rgba(37, 99, 235, 0.12)',
    ringStart: '#93c5fd',
    ringEnd: '#2563eb',
  },
  devto: {
    key: 'devto',
    label: 'Dev.to',
    mark: 'DEV',
    accent: '#111827',
    soft: 'rgba(17, 24, 39, 0.1)',
    ringStart: '#6b7280',
    ringEnd: '#111827',
    markTextColor: '#ffffff',
  },
};

const VISUAL_TO_PROVIDER: Partial<Record<LibraryVisualSourceKey, LibraryProvider>> = {
  'semantic-scholar': 'semantic-scholar',
  openalex: 'openalex',
  arxiv: 'arxiv',
  core: 'core',
  scielo: 'scielo',
  redalyc: 'redalyc',
  'oer-commons': 'oer-commons',
  phet: 'phet',
  youtube: 'youtube',
  institutional: 'institutional',
  pubmed: 'semantic-scholar',
  devto: 'core',
};

export function getLibraryVisualSourceKey(
  asset: Pick<LibrarySearchResult, 'provider' | 'metadata'>,
): LibraryVisualSourceKey {
  const candidate = asset.metadata?.brandKey;
  if (typeof candidate === 'string' && candidate in LIBRARY_SOURCE_PRESENTATION) {
    return candidate as LibraryVisualSourceKey;
  }

  if (asset.provider in LIBRARY_SOURCE_PRESENTATION) {
    return asset.provider as LibraryVisualSourceKey;
  }

  return 'semantic-scholar';
}

export function getLibraryVisualSource(
  asset: Pick<LibrarySearchResult, 'provider' | 'metadata'>,
): LibraryVisualSource {
  return LIBRARY_SOURCE_PRESENTATION[getLibraryVisualSourceKey(asset)];
}

export function buildProviderFiltersFromVisualSources(
  sources: LibraryVisualSourceKey[],
): LibraryProvider[] {
  return [...new Set(sources
    .map((source) => VISUAL_TO_PROVIDER[source])
    .filter((provider): provider is LibraryProvider => Boolean(provider)))];
}

export function matchesSelectedSources(
  asset: LibrarySearchResult,
  selectedSources: LibraryVisualSourceKey[],
): boolean {
  if (selectedSources.length === 0) return true;

  const visualKey = getLibraryVisualSourceKey(asset);
  const equivalents = new Set<LibraryVisualSourceKey>([visualKey]);

  if (visualKey === 'pubmed') equivalents.add('semantic-scholar');
  if (visualKey === 'devto') equivalents.add('core');

  return selectedSources.some((source) => equivalents.has(source));
}

export function matchesSelectedResourceTypes(
  asset: LibrarySearchResult,
  selectedTypes: string[],
): boolean {
  if (selectedTypes.length === 0) return true;

  const normalizedResourceType = normalizeText(asset.resourceType);
  const normalizedPreviewKind = normalizeText(asset.previewKind);

  return selectedTypes.some((selectedType) => {
    const normalizedType = normalizeText(selectedType);

    if (normalizedType === 'paper') {
      return ['paper', 'preprint', 'journal', 'research'].some((token) =>
        normalizedResourceType.includes(token));
    }

    if (normalizedType === 'articulo' || normalizedType === 'artículo') {
      return ['article', 'articulo', 'artículo', 'post'].some((token) =>
        normalizedResourceType.includes(token));
    }

    if (normalizedType === 'dataset') {
      return normalizedResourceType.includes('dataset');
    }

    if (normalizedType === 'video') {
      return normalizedPreviewKind.includes('video')
        || normalizedResourceType.includes('video')
        || asset.provider === 'youtube';
    }

    return normalizedResourceType.includes(normalizedType);
  });
}

export function buildAiSummary(asset: LibrarySearchResult): string {
  const cachedSpanishSummary = typeof asset.metadata?.aiSummaryEs === 'string'
    ? asset.metadata.aiSummaryEs.trim()
    : '';
  if (cachedSpanishSummary) {
    return truncateSummary(cachedSpanishSummary, 260);
  }

  const abstract = asset.abstract?.trim();
  if (abstract && (asset.language?.toLowerCase().startsWith('es') || looksLikeSpanishText(abstract))) {
    return truncateSummary(abstract, 260);
  }

  const source = getLibraryVisualSource(asset).label;
  const authors = asset.authors.length > 0 ? asset.authors.slice(0, 2).join(', ') : 'autoría curada';
  const topics = asset.tags.slice(0, 3).join(', ');
  const resourceType = asset.resourceType?.trim() || 'recurso académico';
  const publicationYear = asset.publishedAt?.slice(0, 4);
  const modality =
    asset.previewKind === 'video'
      ? 'en formato audiovisual'
      : asset.previewKind === 'pdf'
        ? 'en formato documental'
        : 'como material curado';

  const summary =
    `${asset.title} es un ${resourceType.toLowerCase()} disponible en ${source} ${modality}. ` +
    `${abstract ? 'Presenta una síntesis útil para orientar su lectura y aplicación pedagógica. ' : 'Ofrece una entrada clara para trabajar el tema en contexto formativo. '}` +
    `${topics ? `Aborda especialmente ${topics}. ` : ''}` +
    `${publicationYear ? `Su edición consultada corresponde a ${publicationYear}` : 'Cuenta con curaduría vigente'} y puede incorporarse como apoyo de estudio, discusión o profundización. ` +
    `La referencia principal está asociada a ${authors}.`;

  return truncateSummary(summary, 260);
}

export function buildMaturityBreakdown(asset: LibrarySearchResult): string[] {
  const score = Math.round(asset.score * 100);
  const citations = asset.citationCount || 0;
  const depth = clamp(score + (citations > 20 ? 3 : 0), 52, 99);
  const compatibility = clamp(score - (asset.previewKind === 'video' ? 4 : 1), 50, 98);
  const trust = clamp(score + (asset.openAccess ? 2 : 0), 48, 99);
  const authority = clamp(score + (asset.providers.length > 1 ? 4 : citations > 100 ? 5 : 1), 54, 99);

  return [
    `Detalle de profundidad: ${depth}%`,
    `Compatibilidad didáctica: ${compatibility}%`,
    `Componente de confiabilidad: ${trust}%`,
    `Autoridad de la fuente: ${authority}%`,
  ];
}

export function formatLibraryDate(dateValue?: string): string {
  if (!dateValue) return 'Sin fecha visible';

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue.slice(0, 10);
  }

  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function truncateSummary(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trim()}...` : value;
}

function looksLikeSpanishText(value: string): boolean {
  const sample = ` ${normalizeText(value)} `;
  const spanishMarkers = [' el ', ' la ', ' los ', ' las ', ' de ', ' para ', ' con ', ' una ', ' un ', ' y '];
  const englishMarkers = [' the ', ' and ', ' with ', ' for ', ' from ', ' this ', ' that ', ' are ', ' is '];
  const spanishHits = spanishMarkers.filter((token) => sample.includes(token)).length;
  const englishHits = englishMarkers.filter((token) => sample.includes(token)).length;

  return spanishHits >= englishHits;
}
