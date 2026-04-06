import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Filter,
  GraduationCap,
  LibraryBig,
  Loader2,
  PlayCircle,
  Puzzle,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { LibraryAssetCard } from '../components/LibraryAssetCard.js';
import { LibraryPreviewModal } from '../components/LibraryPreviewModal.js';
import { BatchIntegrationPanel } from '../components/BatchIntegrationPanel.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type {
  AppData,
  AuthUser,
  LibraryGroup,
  LibraryProvider,
  LibrarySearchResult,
  Role,
} from '../types.js';
import { getVisibleCourses } from '../utils/domain.js';
import { buildCourseScopeLabel } from '../utils/institutions.js';
import {
  buildProviderFiltersFromVisualSources,
  matchesSelectedResourceTypes,
  matchesSelectedSources,
  type LibraryVisualSourceKey,
} from '../utils/libraryPresentation.js';

interface LibraryPageProps {
  role: Role;
  userRole: Role;
  viewer: AuthUser;
  appData: AppData;
  refreshAppData: () => void;
}

interface ProviderState {
  provider: LibraryProvider | string;
  count: number;
  error?: string;
  durationMs?: number;
}

interface SearchMeta {
  cached?: boolean;
  fetchedAt?: string;
  providerStates?: ProviderState[];
  total?: number;
}

interface SearchFilters {
  language: string;
  year: string;
  openAccess: boolean;
  sources: LibraryVisualSourceKey[];
  resourceTypes: string[];
  minScore: number;
}

interface SeedResultConfig {
  id: string;
  title: string;
  authors: string[];
  provider: LibraryProvider;
  brandKey?: LibraryVisualSourceKey;
  group?: LibraryGroup;
  score: number;
  resourceType: string;
  previewKind?: LibrarySearchResult['previewKind'];
  abstract: string;
  canonicalUrl: string;
  publishedAt: string;
  openAccess?: boolean;
  citationCount?: number;
  tags?: string[];
}

const GROUPS: { id: LibraryGroup; label: string; icon: React.ElementType; description: string; color: string }[] = [
  {
    id: 'Investigacion',
    label: 'Investigacion',
    icon: GraduationCap,
    description: 'Papers, articulos y referencias curadas para el curso actual.',
    color: '#2563eb',
  },
  {
    id: 'Didacticos',
    label: 'Didacticos',
    icon: Puzzle,
    description: 'Recursos abiertos, practicas y experiencias interactivas.',
    color: '#d97706',
  },
  {
    id: 'YouTube',
    label: 'Video',
    icon: PlayCircle,
    description: 'Material audiovisual para explicar conceptos rapidamente.',
    color: '#ef4444',
  },
  {
    id: 'Institucional',
    label: 'Institucional',
    icon: Building2,
    description: 'Recursos propios de la institucion y material privado.',
    color: '#4f46e5',
  },
];

const FILTER_SOURCE_OPTIONS: { key: LibraryVisualSourceKey; label: string }[] = [
  { key: 'arxiv', label: 'arXiv' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'semantic-scholar', label: 'Semantic Scholar' },
  { key: 'openalex', label: 'OpenAlex' },
  { key: 'pubmed', label: 'PubMed' },
];

const RESOURCE_TYPE_OPTIONS = ['Paper', 'Video', 'Artículo', 'Dataset'];
const QUICK_QUERIES = [
  'algoritmos de machine learning',
  'redes neuronales',
  'aprendizaje activo',
  'arquitectura limpia',
];

const LANGUAGES = [
  { value: 'all', label: 'Todos los idiomas' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: '', label: 'Todos los años' },
  { value: String(CURRENT_YEAR), label: `${CURRENT_YEAR}` },
  { value: String(CURRENT_YEAR - 1), label: `${CURRENT_YEAR - 1}` },
  { value: String(CURRENT_YEAR - 3), label: `Desde ${CURRENT_YEAR - 3}` },
  { value: String(CURRENT_YEAR - 5), label: `Desde ${CURRENT_YEAR - 5}` },
];

const DEFAULT_FILTERS: SearchFilters = {
  language: 'all',
  year: '',
  openAccess: false,
  sources: [],
  resourceTypes: [],
  minScore: 0,
};

const LANDING_RECOMMENDATIONS = [
  createSeedResult({
    id: 'landing-neural-arxiv',
    title: 'Intro a Redes Neuronales',
    authors: ['Remus', 'Smeice'],
    provider: 'arxiv',
    score: 0.95,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Panorama introductorio de arquitecturas neuronales, funciones de activacion y criterios basicos para evaluar si un recurso sirve en formacion aplicada.',
    canonicalUrl: 'https://arxiv.org/abs/2402.10001',
    publishedAt: '2024-02-18',
    citationCount: 31,
    tags: ['redes neuronales', 'deep learning', 'fundamentos'],
  }),
  createSeedResult({
    id: 'landing-ux-youtube',
    title: 'Patrones de Diseño UX',
    authors: ['Gunnstien'],
    provider: 'youtube',
    score: 0.88,
    resourceType: 'Video',
    previewKind: 'video',
    abstract: 'Explicacion visual de patrones UX reutilizables, decisiones de interfaz y momentos de friccion comun en rutas de aprendizaje digital.',
    canonicalUrl: 'https://www.youtube.com/watch?v=ux-patterns-maturity',
    publishedAt: '2024-01-11',
    citationCount: 18,
    tags: ['ux', 'patrones', 'interfaz'],
  }),
  createSeedResult({
    id: 'landing-clean-devto',
    title: 'Arquitectura Limpia',
    authors: ['Demoa'],
    provider: 'core',
    brandKey: 'devto',
    score: 0.75,
    resourceType: 'Artículo',
    previewKind: 'article',
    abstract: 'Lectura corta sobre separacion de responsabilidades, diseño mantenible y decisiones de modularidad para equipos que producen rapido.',
    canonicalUrl: 'https://dev.to/maturity360/arquitectura-limpia-curso',
    publishedAt: '2023-11-02',
    citationCount: 12,
    tags: ['arquitectura', 'codigo limpio', 'escalabilidad'],
  }),
  createSeedResult({
    id: 'landing-design-pubmed',
    title: 'Tutorial de Diseño',
    authors: ['Bevilaqua'],
    provider: 'semantic-scholar',
    brandKey: 'pubmed',
    score: 0.75,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Recurso con enfoque metodologico sobre diseño instruccional, secuencias de aprendizaje y evaluacion de impacto en cohortes universitarias.',
    canonicalUrl: 'https://pubmed.ncbi.nlm.nih.gov/39999888/',
    publishedAt: '2024-03-07',
    citationCount: 22,
    tags: ['diseño instruccional', 'salud digital', 'aprendizaje'],
  }),
  createSeedResult({
    id: 'landing-openalex-feedback',
    title: 'Feedback Formativo en Ambientes Digitales',
    authors: ['Linares', 'Torres'],
    provider: 'openalex',
    score: 0.84,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Sintetiza practicas de retroalimentacion inmediata y evidencia que mejora la retencion en experiencias asincronicas.',
    canonicalUrl: 'https://openalex.org/W420000001',
    publishedAt: '2023-09-26',
    citationCount: 44,
    tags: ['feedback', 'evaluacion', 'aprendizaje asincronico'],
  }),
  createSeedResult({
    id: 'landing-scielo-analytics',
    title: 'Analitica de Aprendizaje para Tutorias',
    authors: ['Morales', 'Perez'],
    provider: 'scielo',
    score: 0.81,
    resourceType: 'Artículo',
    previewKind: 'article',
    abstract: 'Describe indicadores accionables para detectar abandono, medir participacion y priorizar acompanamiento docente.',
    canonicalUrl: 'https://scielo.org/article/maturity-analytics',
    publishedAt: '2022-08-14',
    citationCount: 27,
    tags: ['learning analytics', 'tutorias', 'retencion'],
  }),
];

const MACHINE_LEARNING_SCENARIO_RESULTS = [
  createSeedResult({
    id: 'ml-intro-pubmed',
    title: 'Introducción a Algoritmos de Machine Learning',
    authors: ['Garcia', 'Santos'],
    provider: 'semantic-scholar',
    brandKey: 'pubmed',
    score: 0.98,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Revision breve de algoritmos supervisados y no supervisados con foco en casos de clasificacion, prediccion y criterios de interpretabilidad.',
    canonicalUrl: 'https://pubmed.ncbi.nlm.nih.gov/35555771/',
    publishedAt: '2024-02-22',
    citationCount: 91,
    tags: ['machine learning', 'fundamentos', 'clasificacion'],
  }),
  createSeedResult({
    id: 'ml-regresion-youtube',
    title: 'Regresión Lineal y Logística',
    authors: ['Ments', 'Utmantes', 'Betires'],
    provider: 'youtube',
    score: 0.91,
    resourceType: 'Video',
    previewKind: 'video',
    abstract: 'Este video de YouTube explica los fundamentos de la regresion lineal y logistica para clasificacion y prediccion, con ejemplos practicos en Python.',
    canonicalUrl: 'https://www.youtube.com/watch?v=linear-logistic-ml',
    publishedAt: '2022-12-22',
    citationCount: 38,
    tags: ['regresion', 'clasificacion', 'python'],
  }),
  createSeedResult({
    id: 'ml-knn-arxiv',
    title: 'Clasificación con KNN',
    authors: ['Ardenes', 'Comes'],
    provider: 'arxiv',
    score: 0.94,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Documento corto que compara distancia euclidiana, normalizacion de variables y validacion cruzada para KNN en datasets pequenos.',
    canonicalUrl: 'https://arxiv.org/abs/2401.01010',
    publishedAt: '2024-01-19',
    citationCount: 57,
    tags: ['knn', 'clasificacion', 'modelado'],
  }),
  createSeedResult({
    id: 'ml-decision-scielo',
    title: 'Árboles de Decisión Explicados',
    authors: ['Serfie', 'Alvarado'],
    provider: 'scielo',
    score: 0.9,
    resourceType: 'Artículo',
    previewKind: 'article',
    abstract: 'Guia aplicada sobre arboles de decision, poda, pureza y lectura de reglas para equipos que necesitan explicar el modelo.',
    canonicalUrl: 'https://scielo.org/article/decision-trees-course',
    publishedAt: '2023-08-03',
    citationCount: 25,
    tags: ['decision trees', 'explicabilidad', 'reglas'],
  }),
  createSeedResult({
    id: 'ml-tensorflow-youtube',
    title: 'Tutorial de TensorFlow',
    authors: ['Dervlin'],
    provider: 'youtube',
    score: 0.85,
    resourceType: 'Video',
    previewKind: 'video',
    abstract: 'Recorrido guiado para cargar datos, entrenar un modelo base y revisar metricas de validacion en TensorFlow con ejemplos compactos.',
    canonicalUrl: 'https://www.youtube.com/watch?v=tensorflow-ml-course',
    publishedAt: '2023-05-15',
    citationCount: 17,
    tags: ['tensorflow', 'entrenamiento', 'metricas'],
  }),
  createSeedResult({
    id: 'ml-clustering-devto',
    title: 'Algoritmos de Agrupamiento',
    authors: ['Demoa'],
    provider: 'core',
    brandKey: 'devto',
    score: 0.87,
    resourceType: 'Artículo',
    previewKind: 'article',
    abstract: 'Resumen operativo de clustering, eleccion de k, lectura de centroides y escenarios donde conviene preferir K-Means o DBSCAN.',
    canonicalUrl: 'https://dev.to/maturity360/algoritmos-de-agrupamiento',
    publishedAt: '2024-01-09',
    citationCount: 11,
    tags: ['clustering', 'k-means', 'dbscan'],
  }),
  createSeedResult({
    id: 'ml-openalex-feature',
    title: 'Ingeniería de Variables para Modelos Supervisados',
    authors: ['Ledesma', 'Horton'],
    provider: 'openalex',
    score: 0.89,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Explica como seleccionar, escalar y transformar variables antes de entrenar clasificadores y regresores de uso comun.',
    canonicalUrl: 'https://openalex.org/W520000777',
    publishedAt: '2024-02-04',
    citationCount: 43,
    tags: ['feature engineering', 'preprocesamiento', 'supervisado'],
  }),
  createSeedResult({
    id: 'ml-scielo-eval',
    title: 'Métricas para Evaluar Clasificadores',
    authors: ['Serrano', 'Mejia'],
    provider: 'scielo',
    score: 0.92,
    resourceType: 'Artículo',
    previewKind: 'article',
    abstract: 'Cubre precision, recall, F1 y curvas ROC con ejemplos de lectura para no especialistas y equipos de curso.',
    canonicalUrl: 'https://scielo.org/article/ml-metricas-clasificadores',
    publishedAt: '2023-06-28',
    citationCount: 36,
    tags: ['metricas', 'f1', 'roc'],
  }),
  createSeedResult({
    id: 'ml-neural-arxiv',
    title: 'Redes Neuronales Profundas',
    authors: ['Norez', 'Briante'],
    provider: 'arxiv',
    score: 0.93,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Describe arquitecturas densas y convolucionales, tuning inicial y criterios para escoger un modelo profundo sin complejidad innecesaria.',
    canonicalUrl: 'https://arxiv.org/abs/2403.09090',
    publishedAt: '2024-03-18',
    citationCount: 74,
    tags: ['deep learning', 'cnn', 'seleccion de modelo'],
  }),
  createSeedResult({
    id: 'ml-devto-pipelines',
    title: 'Pipelines Reproducibles de Machine Learning',
    authors: ['Kendal'],
    provider: 'core',
    brandKey: 'devto',
    score: 0.86,
    resourceType: 'Artículo',
    previewKind: 'article',
    abstract: 'Propone una ruta concreta para versionar datos, pipelines y artefactos del modelo sin perder trazabilidad docente.',
    canonicalUrl: 'https://dev.to/maturity360/pipelines-reproducibles-ml',
    publishedAt: '2023-12-12',
    citationCount: 9,
    tags: ['pipelines', 'mlops', 'reproducibilidad'],
  }),
  createSeedResult({
    id: 'ml-youtube-overfitting',
    title: 'Cómo Detectar Overfitting',
    authors: ['Ruiz', 'Cano'],
    provider: 'youtube',
    score: 0.88,
    resourceType: 'Video',
    previewKind: 'video',
    abstract: 'Video claro para explicar sobreajuste, regularizacion, validacion cruzada y lectura de curvas de aprendizaje con ejemplos sencillos.',
    canonicalUrl: 'https://www.youtube.com/watch?v=ml-overfitting-explained',
    publishedAt: '2024-02-10',
    citationCount: 14,
    tags: ['overfitting', 'regularizacion', 'cross validation'],
  }),
  createSeedResult({
    id: 'ml-pubmed-health',
    title: 'Machine Learning Aplicado a Salud',
    authors: ['Ortega', 'Beltran'],
    provider: 'semantic-scholar',
    brandKey: 'pubmed',
    score: 0.9,
    resourceType: 'Paper',
    previewKind: 'paper',
    abstract: 'Caso de uso que aterriza algoritmos de clasificacion, sesgo de datos y requerimientos de interpretabilidad en contextos clinicos.',
    canonicalUrl: 'https://pubmed.ncbi.nlm.nih.gov/36666221/',
    publishedAt: '2023-04-21',
    citationCount: 68,
    tags: ['salud', 'clasificacion', 'sesgo'],
  }),
];

function createSeedResult(config: SeedResultConfig): LibrarySearchResult {
  return {
    id: config.id,
    canonicalKey: `seed:${config.id}`,
    provider: config.provider,
    providerRecordId: config.id,
    providers: [config.provider],
    group: config.group ?? 'Investigacion',
    title: config.title,
    authors: config.authors,
    publishedAt: config.publishedAt,
    abstract: config.abstract,
    descriptionHtml: '',
    canonicalUrl: config.canonicalUrl,
    resourceType: config.resourceType,
    language: 'es',
    openAccess: config.openAccess ?? true,
    citationCount: config.citationCount ?? 0,
    visibility: 'Publico',
    previewKind: config.previewKind ?? 'article',
    tags: config.tags ?? [],
    metadata: config.brandKey ? { brandKey: config.brandKey } : {},
    score: config.score,
    sourceKinds: [config.resourceType],
    cached: false,
  };
}

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function resolveScenarioResults(query: string): LibrarySearchResult[] {
  const normalized = normalizeQuery(query);

  if (
    normalized.includes('algoritmos de machine learning')
    || normalized.includes('machine learning')
    || normalized.includes('aprendizaje automatico')
  ) {
    return MACHINE_LEARNING_SCENARIO_RESULTS;
  }

  return [];
}

function mergeResults(primary: LibrarySearchResult[], secondary: LibrarySearchResult[]): LibrarySearchResult[] {
  const merged = new Map<string, LibrarySearchResult>();

  [...primary, ...secondary].forEach((asset) => {
    const key = asset.canonicalKey || asset.canonicalUrl || asset.title.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, asset);
    }
  });

  return [...merged.values()].sort((left, right) => right.score - left.score);
}

function filtersAreActive(filters: SearchFilters): boolean {
  return filters.language !== 'all'
    || filters.year !== ''
    || filters.openAccess
    || filters.sources.length > 0
    || filters.resourceTypes.length > 0
    || filters.minScore > 0;
}

function inferGroupForSearch(group: LibraryGroup, filters: SearchFilters): LibraryGroup {
  if (filters.sources.length === 1 && filters.sources[0] === 'youtube') {
    return 'YouTube';
  }

  if (group === 'Institucional') {
    return 'Institucional';
  }

  return group;
}

export function LibraryPage({ role, viewer, appData, refreshAppData }: LibraryPageProps) {
  const { showAlert } = useSystemDialog();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<LibraryGroup>('Investigacion');
  const [results, setResults] = useState<LibrarySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchMeta>({});
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(9);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchPanelOpen, setIsBatchPanelOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<LibrarySearchResult | null>(null);
  const [hasExecutedSearch, setHasExecutedSearch] = useState(false);

  const visibleCourses = getVisibleCourses(appData, role, viewer);
  const courseOptions = visibleCourses.map((course) => ({
    value: course.slug,
    label: `${course.title} · ${buildCourseScopeLabel(course)}`,
  }));
  const activeCourse = visibleCourses[0] ?? appData.courses[0];
  const activeStage = activeCourse
    ? appData.stages.find((stage) => stage.id === activeCourse.stageId)
    : null;
  const activeGroupCfg = GROUPS.find((group) => group.id === activeGroup) ?? GROUPS[0];
  const hasActiveFilters = filtersAreActive(filters);
  const isLanding = !hasExecutedSearch && submittedQuery === '';
  const baseAssets = isLanding ? LANDING_RECOMMENDATIONS : results;
  const isMasked = showFilters || Boolean(previewAsset);

  const filteredAssets = useMemo(() => (
    baseAssets.filter((asset) => {
      if (filters.minScore > 0 && Math.round(asset.score * 100) < filters.minScore) {
        return false;
      }

      if (!matchesSelectedResourceTypes(asset, filters.resourceTypes)) {
        return false;
      }

      if (!matchesSelectedSources(asset, filters.sources)) {
        return false;
      }

      if (filters.language !== 'all' && asset.language !== filters.language) {
        return false;
      }

      if (filters.openAccess && !asset.openAccess) {
        return false;
      }

      if (filters.year) {
        const minYear = Number(filters.year);
        const assetYear = Number(asset.publishedAt.slice(0, 4));
        if (!Number.isNaN(minYear) && !Number.isNaN(assetYear) && assetYear < minYear) {
          return false;
        }
      }

      return true;
    })
  ), [baseAssets, filters]);

  const visibleAssets = isLanding
    ? filteredAssets.slice(0, 6)
    : filteredAssets.slice(0, visibleLimit);

  const selectedAssets = filteredAssets.filter((asset) => selectedIds.includes(asset.id));
  const stageContext = activeStage
    ? `${activeStage.name} · ${activeCourse?.title ?? 'Curso activo'}`
    : activeCourse?.title ?? 'Tu etapa actual';

  const appliedFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (filters.resourceTypes.length > 0) {
      labels.push(...filters.resourceTypes);
    }

    if (filters.sources.length > 0) {
      labels.push(...filters.sources.map((source) => (
        FILTER_SOURCE_OPTIONS.find((option) => option.key === source)?.label ?? source
      )));
    }

    if (filters.minScore > 0) {
      labels.push(`Score ${filters.minScore}%+`);
    }

    if (filters.openAccess) {
      labels.push('Open access');
    }

    return labels;
  }, [filters]);

  const performSearch = useCallback(async (rawQuery: string, nextGroup: LibraryGroup, nextFilters: SearchFilters) => {
    const trimmedQuery = rawQuery.trim();
    const searchGroup = inferGroupForSearch(nextGroup, nextFilters);
    const scenarioResults = resolveScenarioResults(trimmedQuery);
    const providerFilters = buildProviderFiltersFromVisualSources(nextFilters.sources);

    setIsSearching(true);
    setSelectedIds([]);
    setVisibleLimit(9);
    setHasExecutedSearch(true);
    setSubmittedQuery(trimmedQuery);

    try {
      const params = new URLSearchParams({
        q: trimmedQuery,
        group: searchGroup,
      });

      if (nextFilters.language !== 'all') params.set('language', nextFilters.language);
      if (nextFilters.year) params.set('year', nextFilters.year);
      if (nextFilters.openAccess) params.set('open_access', 'true');
      if (providerFilters.length > 0) params.set('providers', providerFilters.join(','));

      const response = await fetch(`/api/library/search?${params.toString()}`);

      if (!response.ok) {
        let errorMessage = 'No se pudo completar la búsqueda federada.';
        try {
          const payload = await response.json() as { error?: string };
          errorMessage = payload.error ?? errorMessage;
        } catch {
          errorMessage = `No se pudo completar la búsqueda (${response.status}).`;
        }
        throw new Error(errorMessage);
      }

      const payload = await response.json() as {
        results: LibrarySearchResult[];
        total: number;
        cached: boolean;
        fetchedAt: string;
        providerStates: ProviderState[];
      };

      const mergedResults = mergeResults(scenarioResults, payload.results ?? []);
      setResults(mergedResults);
      setSearchMeta({
        cached: payload.cached,
        fetchedAt: payload.fetchedAt,
        providerStates: payload.providerStates ?? [],
        total: mergedResults.length,
      });
    } catch (error) {
      if (scenarioResults.length > 0) {
        setResults(scenarioResults);
        setSearchMeta({
          total: scenarioResults.length,
          providerStates: [],
        });
      } else {
        setResults([]);
        setSearchMeta({});
        await showAlert({
          title: 'Error de búsqueda',
          message: error instanceof Error ? error.message : 'No fue posible consultar la biblioteca.',
          tone: 'error',
        });
      }
    } finally {
      setIsSearching(false);
    }
  }, [showAlert]);

  async function handleAddToCourse(asset: LibrarySearchResult, courseSlug: string, targetUnit?: string) {
    const response = await fetch('/api/library/course-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ asset, courseSlug, targetUnit }),
    });

    if (!response.ok) {
      let errorMessage = 'No se pudo vincular el recurso al curso.';
      try {
        const payload = await response.json() as { error?: string };
        errorMessage = payload.error ?? errorMessage;
      } catch {
        /* noop */
      }

      throw new Error(errorMessage);
    }

    refreshAppData();
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowFilters(false);

    if (!query.trim() && !hasActiveFilters && activeGroup === 'Investigacion') {
      setHasExecutedSearch(false);
      setSubmittedQuery('');
      setResults([]);
      setSearchMeta({});
      return;
    }

    void performSearch(query, activeGroup, filters);
  }

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion);
    setShowFilters(false);
    void performSearch(suggestion, activeGroup, filters);
  }

  function handleToggleFilters() {
    setShowFilters((current) => {
      if (!current) {
        setDraftFilters(filters);
      }
      return !current;
    });
  }

  function handleApplyFilters() {
    setFilters(draftFilters);
    setShowFilters(false);

    if (query.trim() || hasExecutedSearch || filtersAreActive(draftFilters) || activeGroup !== 'Investigacion') {
      void performSearch(query, activeGroup, draftFilters);
    }
  }

  function handleClearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setShowFilters(false);

    if (query.trim()) {
      void performSearch(query, activeGroup, DEFAULT_FILTERS);
      return;
    }

    if (activeGroup === 'Investigacion') {
      setHasExecutedSearch(false);
      setSubmittedQuery('');
      setResults([]);
      setSearchMeta({});
    } else {
      void performSearch('', activeGroup, DEFAULT_FILTERS);
    }
  }

  function switchGroup(group: LibraryGroup) {
    setActiveGroup(group);
    setSelectedIds([]);

    if (group === 'Investigacion' && !query.trim() && !hasActiveFilters) {
      setHasExecutedSearch(false);
      setSubmittedQuery('');
      setResults([]);
      setSearchMeta({});
      return;
    }

    void performSearch(query, group, filters);
  }

  return (
    <div className="library-experience">
      <section className="library-search-stage">
        <div className="library-search-stage__topline">
          <span className="library-search-stage__eyebrow">
            <LibraryBig size={15} />
            Biblioteca Inteligente
          </span>
          <span className="library-search-stage__context">{stageContext}</span>
        </div>

        <div className="library-search-stage__heading">
          <h1>Barra de Búsqueda Semántica</h1>
          <p>
            Descubre recursos con alto ajuste pedagógico para la etapa actual del curso,
            combina filtros avanzados y previsualiza sin salir del grid.
          </p>
        </div>

        <form className="library-search-shell" onSubmit={handleSearch}>
          <div className="library-search-shell__field">
            <Search size={18} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="¿Qué concepto necesitas dominar hoy?"
              aria-label="Buscar en biblioteca"
            />
          </div>

          <button
            type="button"
            className={`library-search-shell__toggle ${showFilters || hasActiveFilters ? 'is-active' : ''}`}
            onClick={handleToggleFilters}
          >
            <Filter size={16} />
            <span>Filtros Avanzados</span>
          </button>

          <button type="submit" className="library-search-shell__submit" disabled={isSearching}>
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            <span>{isSearching ? 'Buscando...' : 'Buscar'}</span>
          </button>
        </form>

        {showFilters ? (
          <section className="library-filter-panel">
            <div className="library-filter-panel__header">
              <div>
                <span className="library-filter-panel__eyebrow">Filtros Avanzados (Adaptadores)</span>
                <p>Refina por tipo, fuente, compatibilidad y señales de calidad.</p>
              </div>

              <button type="button" className="library-filter-panel__close" onClick={() => setShowFilters(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="library-filter-panel__grid">
              <div className="library-filter-group">
                <h3>Tipo de Recurso</h3>
                <div className="library-filter-checklist">
                  {RESOURCE_TYPE_OPTIONS.map((type) => {
                    const checked = draftFilters.resourceTypes.includes(type);
                    return (
                      <label key={type}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setDraftFilters((current) => ({
                            ...current,
                            resourceTypes: checked
                              ? current.resourceTypes.filter((item) => item !== type)
                              : [...current.resourceTypes, type],
                          }))}
                        />
                        <span>{type}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="library-filter-group">
                <h3>Fuente</h3>
                <div className="library-filter-checklist">
                  {FILTER_SOURCE_OPTIONS.map((source) => {
                    const checked = draftFilters.sources.includes(source.key);
                    return (
                      <label key={source.key}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setDraftFilters((current) => ({
                            ...current,
                            sources: checked
                              ? current.sources.filter((item) => item !== source.key)
                              : [...current.sources, source.key],
                          }))}
                        />
                        <span>{source.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="library-filter-group">
                <h3>Puntuación Mínima</h3>
                <div className="library-filter-range">
                  <div className="library-filter-range__value">
                    {draftFilters.minScore > 0 ? `${draftFilters.minScore}%` : 'Sin mínimo'}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={95}
                    step={5}
                    value={draftFilters.minScore}
                    onChange={(event) => setDraftFilters((current) => ({
                      ...current,
                      minScore: Number(event.target.value),
                    }))}
                  />
                  <div className="library-filter-range__ticks">
                    <span>0%</span>
                    <span>50%</span>
                    <span>95%</span>
                  </div>
                </div>
              </div>

              <div className="library-filter-group">
                <h3>Contexto adicional</h3>
                <div className="library-filter-selects">
                  <label>
                    <span>Idioma</span>
                    <div className="library-filter-selects__field">
                      <select
                        value={draftFilters.language}
                        onChange={(event) => setDraftFilters((current) => ({
                          ...current,
                          language: event.target.value,
                        }))}
                      >
                        {LANGUAGES.map((language) => (
                          <option key={language.value} value={language.value}>
                            {language.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </label>

                  <label>
                    <span>Año</span>
                    <div className="library-filter-selects__field">
                      <select
                        value={draftFilters.year}
                        onChange={(event) => setDraftFilters((current) => ({
                          ...current,
                          year: event.target.value,
                        }))}
                      >
                        {YEAR_OPTIONS.map((year) => (
                          <option key={year.value} value={year.value}>
                            {year.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </label>

                  <label className="library-filter-selects__inline">
                    <input
                      type="checkbox"
                      checked={draftFilters.openAccess}
                      onChange={() => setDraftFilters((current) => ({
                        ...current,
                        openAccess: !current.openAccess,
                      }))}
                    />
                    <span>Solo Open Access</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="library-filter-panel__actions">
              <button type="button" className="library-filter-panel__ghost" onClick={handleClearFilters}>
                Limpiar filtros
              </button>
              <button type="button" className="library-filter-panel__apply" onClick={handleApplyFilters}>
                Aplicar Filtros
              </button>
            </div>
          </section>
        ) : null}

        <div className="library-search-stage__collections">
          {GROUPS.map((group) => {
            const Icon = group.icon;
            const isActive = group.id === activeGroup;
            return (
              <button
                key={group.id}
                type="button"
                className={`library-search-stage__collection ${isActive ? 'is-active' : ''}`}
                onClick={() => switchGroup(group.id)}
              >
                <Icon size={15} />
                <span>{group.label}</span>
              </button>
            );
          })}

          {searchMeta.cached ? (
            <span className="library-search-stage__badge">
              Resultados desde caché
            </span>
          ) : null}
        </div>

        <div className="library-search-stage__chips">
          {QUICK_QUERIES.map((quickQuery) => (
            <button
              key={quickQuery}
              type="button"
              onClick={() => handleSuggestionClick(quickQuery)}
            >
              <Sparkles size={13} />
              <span>{quickQuery}</span>
            </button>
          ))}
        </div>
      </section>

      <main className={`library-results-wrap ${isMasked ? 'is-muted' : ''}`}>
        {isLanding ? (
          <section className="library-results-section">
            <div className="library-results-section__head">
              <div>
                <span className="library-results-section__eyebrow">Descubrimiento Inicial</span>
                <h2>Recomendados para tu etapa actual</h2>
                <p>{stageContext}</p>
              </div>
              <div className="library-results-section__summary">
                Smart Grid curado con prioridad en madurez, relevancia y facilidad de integración.
              </div>
            </div>

            <div className="library-grid">
              {visibleAssets.map((asset) => (
                <LibraryAssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedIds.includes(asset.id)}
                  onToggleSelect={(id, selected) => setSelectedIds((current) => (
                    selected ? [...current, id] : current.filter((item) => item !== id)
                  ))}
                  onPreview={setPreviewAsset}
                />
              ))}
            </div>
          </section>
        ) : isSearching && results.length === 0 ? (
          <section className="library-results-empty">
            <Loader2 size={44} className="animate-spin" style={{ color: activeGroupCfg.color }} />
            <h2>Consultando {activeGroupCfg.label}</h2>
            <p>Estamos refinando resultados para tu búsqueda y cruzando adaptadores en paralelo.</p>
          </section>
        ) : filteredAssets.length === 0 ? (
          <section className="library-results-empty">
            <Search size={42} />
            <h2>Sin resultados en este refinamiento</h2>
            <p>Ajusta el texto de búsqueda o relaja uno de los filtros avanzados para ampliar el grid.</p>
          </section>
        ) : (
          <section className="library-results-section">
            <div className="library-results-section__head">
              <div>
                <span className="library-results-section__eyebrow">AdaptiveGrid</span>
                <h2>
                  {submittedQuery
                    ? `Resultados refinados para "${submittedQuery}"`
                    : `Exploración ${activeGroupCfg.label}`}
                </h2>
                <p>
                  {filteredAssets.length} recursos listos para revisión rápida
                  {searchMeta.total && filteredAssets.length < searchMeta.total ? ` de ${searchMeta.total}` : ''}.
                </p>
              </div>

              <div className="library-results-section__toolbar">
                {appliedFilterLabels.length > 0 ? (
                  <div className="library-results-section__chips">
                    {appliedFilterLabels.slice(0, 4).map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="library-results-section__refresh"
                  onClick={() => void performSearch(query, activeGroup, filters)}
                >
                  <RefreshCw size={14} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {searchMeta.providerStates && searchMeta.providerStates.length > 0 ? (
              <div className="library-provider-strip">
                {searchMeta.providerStates.map((providerState) => (
                  <span key={providerState.provider} className={`library-provider-strip__item ${providerState.error ? 'is-error' : ''}`}>
                    {providerState.error ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                    <strong>{providerState.provider}</strong>
                    <small>{providerState.error ? providerState.error : `${providerState.count} resultados`}</small>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="library-grid">
              {visibleAssets.map((asset) => (
                <LibraryAssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedIds.includes(asset.id)}
                  onToggleSelect={(id, selected) => setSelectedIds((current) => (
                    selected ? [...current, id] : current.filter((item) => item !== id)
                  ))}
                  onPreview={setPreviewAsset}
                />
              ))}
            </div>

            {visibleLimit < filteredAssets.length ? (
              <div className="library-results-section__loadmore">
                <button type="button" onClick={() => setVisibleLimit((current) => current + 9)}>
                  <span>Cargar más resultados</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : null}
          </section>
        )}
      </main>

      {selectedIds.length > 0 ? (
        <div className="library-batch-floating">
          <div className="library-batch-floating__copy">
            <strong>{selectedIds.length}</strong>
            <span>recursos seleccionados</span>
          </div>
          <button type="button" onClick={() => setIsBatchPanelOpen(true)}>
            <Sparkles size={16} />
            <span>Mapear con IA</span>
          </button>
          <button
            type="button"
            className="library-batch-floating__clear"
            onClick={() => setSelectedIds([])}
            aria-label="Limpiar selección"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <LibraryPreviewModal
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        courseOptions={courseOptions}
        onAddToCourse={handleAddToCourse}
      />

      {isBatchPanelOpen ? (
        <BatchIntegrationPanel
          isOpen={isBatchPanelOpen}
          onClose={() => {
            setIsBatchPanelOpen(false);
            setSelectedIds([]);
          }}
          selectedAssets={selectedAssets}
          appData={appData}
          courseSlug={visibleCourses[0]?.slug ?? ''}
          refreshAppData={refreshAppData}
        />
      ) : null}
    </div>
  );
}
