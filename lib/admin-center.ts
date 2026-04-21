import {
  defaultBranding,
  defaultExperienceSettings,
  defaultHomeContent,
  defaultWorkflowSettings,
  defaultInstitutionSettings,
} from '../src/data/platformDefaults.js';
import type {
  AdminAuditClassification,
  AdminAuditEntry,
  AdminCenterData,
  AdminIntegration,
  AdminIntegrationCategory,
  AdminIntegrationMutationInput,
  AdminIntegrationSource,
  AdminIntegrationStatus,
  AdminLogCategory,
  AdminLogEntry,
  AdminLogSeverity,
  AuthUser,
  BrandingSettings,
  ExperienceSettings,
  HomeContentSettings,
  InstitutionSettings,
  InstitutionStructure,
  Role,
  WorkflowSettings,
} from '../src/types.js';
import { getSql } from './db.js';
import { probeR2Connectivity } from './r2.js';
import {
  getInstitutionSettingsRecord,
  getProductFormatTemplates,
  getUserDirectory,
  syncInstitutionSettingsRecord,
} from './store.js';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface AdminSettingRow {
  key: string;
  value: JsonValue;
  updatedAt: string;
  updatedBy: string | null;
}

interface AdminIntegrationRow {
  id: string;
  name: string;
  category: AdminIntegrationCategory;
  provider: string;
  description: string;
  enabled: boolean;
  status: AdminIntegrationStatus;
  scopes: JsonValue;
  config: JsonValue;
  notes: string;
  fallbackTo: string;
  lastTestAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

interface AdminLogRow extends AdminLogEntry {}
interface AdminAuditRow extends AdminAuditEntry {}

interface AdminActor {
  id: string | null;
  name: string;
}

interface IntegrationTestResult {
  status: AdminIntegrationStatus;
  detail: string;
  lastError: string | null;
}

let adminCenterSchemaPromise: Promise<void> | null = null;
let adminCenterDefaultsPromise: Promise<void> | null = null;

function parseJson<T>(value: JsonValue): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'es'),
  );
}

function inferDefaultDomain() {
  const envEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const emailParts = envEmail.split('@');
  const domain = envEmail.includes('@') ? emailParts[emailParts.length - 1] ?? '' : '';
  return domain || 'maturity360.co';
}

function slugifyStructureValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashStructureValue(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(8, '0').slice(0, 8);
}

function buildLegacyStructureId(name: string) {
  const slug = slugifyStructureValue(name);
  return `institution-structure-${slug || 'structure'}`;
}

function isCanonicalStructureId(value: string | null | undefined) {
  return /^inst-[a-z0-9]{8}$/.test(value?.trim().toLowerCase() ?? '');
}

function buildStructureId(name: string, existingId?: string | null) {
  const normalizedExistingId = existingId?.trim().toLowerCase() ?? '';

  if (isCanonicalStructureId(normalizedExistingId)) {
    return normalizedExistingId;
  }

  const seed = normalizedExistingId || name.trim() || crypto.randomUUID();
  return `inst-${hashStructureValue(seed)}`;
}

function sanitizeInstitutionStructure(input: InstitutionStructure): InstitutionStructure {
  return {
    id: buildStructureId(input.institution, input.id),
    institution: input.institution.trim() || 'Institución sin definir',
    faculties: uniqueValues(input.faculties),
    programs: uniqueValues(input.programs),
    academicPeriods: uniqueValues(input.academicPeriods),
    courseTypes: uniqueValues(input.courseTypes),
    pedagogicalGuidelines: uniqueValues(input.pedagogicalGuidelines),
    allowAutoProvisioning: Boolean(input.allowAutoProvisioning),
  };
}

function buildDefaultInstitutionStructures(): InstitutionStructure[] {
  return defaultInstitutionSettings.structures.map((structure) => ({
    ...structure,
    faculties: [...structure.faculties],
    programs: [...structure.programs],
    academicPeriods: [...structure.academicPeriods],
    courseTypes: [...structure.courseTypes],
    pedagogicalGuidelines: [...structure.pedagogicalGuidelines],
  }));
}

function buildLegacyInstitutionStructures(input: InstitutionSettings): InstitutionStructure[] {
  const institutions = uniqueValues(input.institutions);
  const institutionNames =
    institutions.length > 0 ? institutions : [input.displayName.trim() || 'Maturity University'];

  return institutionNames.map((institutionName) =>
    sanitizeInstitutionStructure({
      id: buildLegacyStructureId(institutionName),
      institution: institutionName,
      faculties: input.faculties,
      programs: input.programs,
      academicPeriods: input.academicPeriods,
      courseTypes: input.courseTypes,
      pedagogicalGuidelines: [],
      allowAutoProvisioning: Boolean(input.allowAutoProvisioning),
    }),
  );
}

function collectStructureValues(
  structures: InstitutionStructure[],
  key: 'faculties' | 'programs' | 'academicPeriods' | 'courseTypes',
) {
  return uniqueValues(
    structures.reduce<string[]>((accumulator, structure) => {
      accumulator.push(...structure[key]);
      return accumulator;
    }, []),
  );
}

function buildDefaultInstitutionSettings(): InstitutionSettings {
  return {
    displayName: defaultInstitutionSettings.displayName,
    structures: buildDefaultInstitutionStructures(),
    institutions: [...defaultInstitutionSettings.institutions],
    faculties: [...defaultInstitutionSettings.faculties],
    programs: [...defaultInstitutionSettings.programs],
    academicPeriods: [...defaultInstitutionSettings.academicPeriods],
    courseTypes: [...defaultInstitutionSettings.courseTypes],
    supportEmail: `soporte@${inferDefaultDomain()}`,
    defaultDomain: inferDefaultDomain(),
    defaultUserState: defaultInstitutionSettings.defaultUserState,
    allowAutoProvisioning: defaultInstitutionSettings.allowAutoProvisioning,
  };
}

function sanitizeInstitutionSettings(input: InstitutionSettings): InstitutionSettings {
  const structures =
    input.structures && input.structures.length > 0
      ? input.structures.map(sanitizeInstitutionStructure)
      : buildLegacyInstitutionStructures(input);

  return {
    displayName: input.displayName.trim() || 'Maturity University',
    structures,
    institutions: uniqueValues(structures.map((structure) => structure.institution)),
    faculties: collectStructureValues(structures, 'faculties'),
    programs: collectStructureValues(structures, 'programs'),
    academicPeriods: collectStructureValues(structures, 'academicPeriods'),
    courseTypes: collectStructureValues(structures, 'courseTypes'),
    supportEmail: input.supportEmail.trim().toLowerCase(),
    defaultDomain: input.defaultDomain.trim().toLowerCase(),
    defaultUserState: input.defaultUserState,
    allowAutoProvisioning:
      typeof input.allowAutoProvisioning === 'boolean'
        ? input.allowAutoProvisioning
        : structures.some((structure) => structure.allowAutoProvisioning),
  };
}

function sanitizeBrandingSettings(input: BrandingSettings): BrandingSettings {
  return {
    platformName: input.platformName.trim() || defaultBranding.platformName,
    institutionName: input.institutionName.trim() || defaultBranding.institutionName,
    shortMark: input.shortMark.trim().slice(0, 4) || defaultBranding.shortMark,
    logoText: input.logoText.trim() || defaultBranding.logoText,
    logoUrl: input.logoUrl.trim(),
    logoMode: input.logoMode ?? defaultBranding.logoMode,
    faviconLabel: input.faviconLabel.trim().slice(0, 2) || defaultBranding.faviconLabel,
    faviconUrl: input.faviconUrl.trim(),
    faviconMode: input.faviconMode ?? defaultBranding.faviconMode,
    primaryColor: input.primaryColor.trim() || defaultBranding.primaryColor,
    accentColor: input.accentColor.trim() || defaultBranding.accentColor,
    surfaceStyle: input.surfaceStyle.trim() || defaultBranding.surfaceStyle,
    fontPreset: input.fontPreset ?? defaultBranding.fontPreset,
    bodyFontFamily: input.bodyFontFamily.trim() || defaultBranding.bodyFontFamily,
    displayFontFamily: input.displayFontFamily.trim() || defaultBranding.displayFontFamily,
    monoFontFamily: input.monoFontFamily.trim() || defaultBranding.monoFontFamily,
    loginVariant: input.loginVariant ?? defaultBranding.loginVariant,
    loginEyebrow: input.loginEyebrow.trim() || defaultBranding.loginEyebrow,
    loginHeadline: input.loginHeadline.trim() || defaultBranding.loginHeadline,
    loginMessage: input.loginMessage.trim() || defaultBranding.loginMessage,
    loaderLabel: input.loaderLabel.trim() || defaultBranding.loaderLabel,
    loaderMessage: input.loaderMessage.trim() || defaultBranding.loaderMessage,
    supportUrl: input.supportUrl.trim() || defaultBranding.supportUrl,
  };
}

function sanitizeExperienceSettings(input: ExperienceSettings): ExperienceSettings {
  return {
    studioMode: input.studioMode ?? defaultExperienceSettings.studioMode,
    showSummaryHero:
      typeof input.showSummaryHero === 'boolean'
        ? input.showSummaryHero
        : defaultExperienceSettings.showSummaryHero,
    showFocusedStageHeader:
      typeof input.showFocusedStageHeader === 'boolean'
        ? input.showFocusedStageHeader
        : defaultExperienceSettings.showFocusedStageHeader,
    stageRailVisibility: input.stageRailVisibility ?? defaultExperienceSettings.stageRailVisibility,
    profileLayout: input.profileLayout ?? defaultExperienceSettings.profileLayout,
  };
}

function sanitizeWorkflowSettings(input: WorkflowSettings): WorkflowSettings {
  return {
    showWorkflowStageCards:
      typeof input.showWorkflowStageCards === 'boolean'
        ? input.showWorkflowStageCards
        : defaultWorkflowSettings.showWorkflowStageCards,
    showQuickAccessPanel:
      typeof input.showQuickAccessPanel === 'boolean'
        ? input.showQuickAccessPanel
        : defaultWorkflowSettings.showQuickAccessPanel,
    handoffRequiresCheckpoint:
      typeof input.handoffRequiresCheckpoint === 'boolean'
        ? input.handoffRequiresCheckpoint
        : defaultWorkflowSettings.handoffRequiresCheckpoint,
    handoffBlocksOnBlockedCheckpoints:
      typeof input.handoffBlocksOnBlockedCheckpoints === 'boolean'
        ? input.handoffBlocksOnBlockedCheckpoints
        : defaultWorkflowSettings.handoffBlocksOnBlockedCheckpoints,
    handoffBlocksOnCriticalObservations:
      typeof input.handoffBlocksOnCriticalObservations === 'boolean'
        ? input.handoffBlocksOnCriticalObservations
        : defaultWorkflowSettings.handoffBlocksOnCriticalObservations,
  };
}

function sanitizeHomeContentSettings(input: HomeContentSettings): HomeContentSettings {
  const fallback = defaultHomeContent;
  const take = (value: unknown, fallbackValue: string) => {
    if (typeof value !== 'string') return fallbackValue;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallbackValue;
  };
  const takeArray = (value: unknown, fallbackValue: string[]) => {
    if (!Array.isArray(value) || value.length === 0) return [...fallbackValue];
    const next = value
      .map((item, index) => take(item, fallbackValue[index] ?? fallbackValue[0] ?? ''))
      .filter(Boolean);
    return next.length > 0 ? next : [...fallbackValue];
  };

  return {
    navBrandTagline: take(input.navBrandTagline, fallback.navBrandTagline),
    navFlowLabel: take(input.navFlowLabel, fallback.navFlowLabel),
    navLibraryLabel: take(input.navLibraryLabel, fallback.navLibraryLabel),
    navAnalyticsLabel: take(input.navAnalyticsLabel, fallback.navAnalyticsLabel),
    navContactLabel: take(input.navContactLabel, fallback.navContactLabel),
    navLoginLabel: take(input.navLoginLabel, fallback.navLoginLabel),
    navDemoLabel: take(input.navDemoLabel, fallback.navDemoLabel),
    heroKicker: take(input.heroKicker, fallback.heroKicker),
    heroTitle: take(input.heroTitle, fallback.heroTitle),
    heroLead: take(input.heroLead, fallback.heroLead),
    heroPrimaryCta: take(input.heroPrimaryCta, fallback.heroPrimaryCta),
    heroSecondaryCta: take(input.heroSecondaryCta, fallback.heroSecondaryCta),
    heroSignals: (Array.isArray(input.heroSignals) && input.heroSignals.length > 0
      ? input.heroSignals
      : fallback.heroSignals
    ).map((item, index) => ({
      title: take(item?.title, fallback.heroSignals[index]?.title ?? fallback.heroSignals[0].title),
      description: take(
        item?.description,
        fallback.heroSignals[index]?.description ?? fallback.heroSignals[0].description,
      ),
    })),
    heroCourseLabel: take(input.heroCourseLabel, fallback.heroCourseLabel),
    heroCourseTitle: take(input.heroCourseTitle, fallback.heroCourseTitle),
    heroCourseProgressLabel: take(input.heroCourseProgressLabel, fallback.heroCourseProgressLabel),
    heroStatusChip: take(input.heroStatusChip, fallback.heroStatusChip),
    heroStatusText: take(input.heroStatusText, fallback.heroStatusText),
    heroSidebarDashboard: take(input.heroSidebarDashboard, fallback.heroSidebarDashboard),
    heroSidebarCourses: take(input.heroSidebarCourses, fallback.heroSidebarCourses),
    heroSidebarLibrary: take(input.heroSidebarLibrary, fallback.heroSidebarLibrary),
    heroSidebarAnalytics: take(input.heroSidebarAnalytics, fallback.heroSidebarAnalytics),
    heroStageOneTitle: take(input.heroStageOneTitle, fallback.heroStageOneTitle),
    heroStageOneDescription: take(input.heroStageOneDescription, fallback.heroStageOneDescription),
    heroStageTwoTitle: take(input.heroStageTwoTitle, fallback.heroStageTwoTitle),
    heroStageTwoDescription: take(input.heroStageTwoDescription, fallback.heroStageTwoDescription),
    heroStageThreeTitle: take(input.heroStageThreeTitle, fallback.heroStageThreeTitle),
    heroStageThreeDescription: take(input.heroStageThreeDescription, fallback.heroStageThreeDescription),
    heroGlobalStatusLabel: take(input.heroGlobalStatusLabel, fallback.heroGlobalStatusLabel),
    heroCourseProgressValue: take(input.heroCourseProgressValue, fallback.heroCourseProgressValue),
    heroCourseProgressDescription: take(
      input.heroCourseProgressDescription,
      fallback.heroCourseProgressDescription,
    ),
    stripItems: takeArray(input.stripItems, fallback.stripItems),
    flowKicker: take(input.flowKicker, fallback.flowKicker),
    flowTitle: take(input.flowTitle, fallback.flowTitle),
    flowLead: take(input.flowLead, fallback.flowLead),
    timelineSteps: (Array.isArray(input.timelineSteps) && input.timelineSteps.length > 0
      ? input.timelineSteps
      : fallback.timelineSteps
    ).map((item, index) => ({
      title: take(item?.title, fallback.timelineSteps[index]?.title ?? fallback.timelineSteps[0].title),
      eyebrow: take(item?.eyebrow, fallback.timelineSteps[index]?.eyebrow ?? fallback.timelineSteps[0].eyebrow),
      description: take(
        item?.description,
        fallback.timelineSteps[index]?.description ?? fallback.timelineSteps[0].description,
      ),
    })),
    libraryKicker: take(input.libraryKicker, fallback.libraryKicker),
    libraryTitle: take(input.libraryTitle, fallback.libraryTitle),
    libraryLead: take(input.libraryLead, fallback.libraryLead),
    libraryFeatures: takeArray(input.libraryFeatures, fallback.libraryFeatures),
    librarySearchLabel: take(input.librarySearchLabel, fallback.librarySearchLabel),
    librarySearchSources: take(input.librarySearchSources, fallback.librarySearchSources),
    libraryCards: (Array.isArray(input.libraryCards) && input.libraryCards.length > 0
      ? input.libraryCards
      : fallback.libraryCards
    ).map((item, index) => ({
      title: take(item?.title, fallback.libraryCards[index]?.title ?? fallback.libraryCards[0].title),
      source: take(item?.source, fallback.libraryCards[index]?.source ?? fallback.libraryCards[0].source),
      tag: take(item?.tag, fallback.libraryCards[index]?.tag ?? fallback.libraryCards[0].tag),
    })),
    librarySuggestionLabel: take(input.librarySuggestionLabel, fallback.librarySuggestionLabel),
    librarySuggestionText: take(input.librarySuggestionText, fallback.librarySuggestionText),
    analyticsKicker: take(input.analyticsKicker, fallback.analyticsKicker),
    analyticsTitle: take(input.analyticsTitle, fallback.analyticsTitle),
    analyticsLead: take(input.analyticsLead, fallback.analyticsLead),
    analyticsNotes: takeArray(input.analyticsNotes, fallback.analyticsNotes),
    analyticsChartLabel: take(input.analyticsChartLabel, fallback.analyticsChartLabel),
    analyticsChartTitle: take(input.analyticsChartTitle, fallback.analyticsChartTitle),
    analyticsStats: (Array.isArray(input.analyticsStats) && input.analyticsStats.length > 0
      ? input.analyticsStats
      : fallback.analyticsStats
    ).map((item, index) => ({
      label: take(item?.label, fallback.analyticsStats[index]?.label ?? fallback.analyticsStats[0].label),
      value: take(item?.value, fallback.analyticsStats[index]?.value ?? fallback.analyticsStats[0].value),
    })),
    analyticsRows: (Array.isArray(input.analyticsRows) && input.analyticsRows.length > 0
      ? input.analyticsRows
      : fallback.analyticsRows
    ).map((item, index) => ({
      label: take(item?.label, fallback.analyticsRows[index]?.label ?? fallback.analyticsRows[0].label),
      value: take(item?.value, fallback.analyticsRows[index]?.value ?? fallback.analyticsRows[0].value),
    })),
    ctaKicker: take(input.ctaKicker, fallback.ctaKicker),
    ctaTitle: take(input.ctaTitle, fallback.ctaTitle),
    ctaLead: take(input.ctaLead, fallback.ctaLead),
    ctaButtonLabel: take(input.ctaButtonLabel, fallback.ctaButtonLabel),
    footerText: take(input.footerText, fallback.footerText),
    footerLinkLabel: take(input.footerLinkLabel, fallback.footerLinkLabel),
    footerLinkUrl: take(input.footerLinkUrl, fallback.footerLinkUrl),
  };
}

type IntegrationPreset = Omit<
  AdminIntegration,
  | 'envReady'
  | 'runtimeSource'
  | 'runtimeSummary'
  | 'status'
  | 'assistantTitle'
  | 'assistantSummary'
  | 'assistantSteps'
> & {
  status: AdminIntegrationStatus;
};

const defaultIntegrationPresets: IntegrationPreset[] = [
  {
    id: 'outbound-mail',
    name: 'Correo saliente',
    category: 'Correo',
    provider: 'SMTP / Resend / SES',
    description: 'Notificaciones transaccionales, activaciones de cuenta y alertas del flujo.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: [
      'RESEND_API_KEY',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'AWS_SES_ACCESS_KEY',
      'AWS_SES_SECRET_KEY',
    ],
    scopes: ['Activación de cuenta', 'Recuperación de contraseña', 'Alertas operativas'],
    config: {
      providerType: 'Resend',
      senderName: 'Maturity',
      senderEmail: `no-reply@${inferDefaultDomain()}`,
      senderDomain: inferDefaultDomain(),
      templateFamily: 'Operación Maturity',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Configura el proveedor específico (Gmail, Outlook, SES, etc.) desde el asistente modular.',
    fallbackTo: 'Desactivar envío automático',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'IA',
    provider: 'OpenAI API',
    description: 'Asistencia inteligente para autoría, revisión y apoyo operativo.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: ['OPENAI_API_KEY'],
    scopes: ['Autoría', 'Validación', 'Asistencia'],
    config: {
      defaultModel: 'gpt-5.4-mini',
      allowedModules: 'Mis cursos, Biblioteca, QA',
      primaryUse: 'Asistencia editorial y validación',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Configura qué flujos pueden usar OpenAI sin exponer la credencial.',
    fallbackTo: 'Gemini',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    category: 'IA',
    provider: 'Google Gemini',
    description: 'Capas de IA complementarias para ideación, apoyo multimedia y contraste.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    scopes: ['Multimedia', 'Ideación', 'Asistencia'],
    config: {
      defaultModel: 'gemini-2.5-flash',
      allowedModules: 'Mis cursos, Multimedia',
      primaryUse: 'Soporte complementario',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Puedes asignarlo como proveedor principal o alterno por caso de uso.',
    fallbackTo: 'OpenAI',
  },
  {
    id: 'academic-databases',
    name: 'Fuentes académicas',
    category: 'Académicas',
    provider: 'Catálogo externo',
    description: 'Búsqueda, curación y recuperación de contenidos científicos y educativos.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['ACADEMIC_DATABASE_ENDPOINT'],
    scopes: ['Curación', 'Arquitectura', 'Biblioteca'],
    config: {
      endpoint: 'https://api.fuente-academica.edu/search',
      metadataMap: 'titulo, autor, resumen, año, fuente, enlace, palabras clave',
      accessMode: 'API / REST',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Mapea metadatos y criterios de uso para curación confiable.',
    fallbackTo: 'Biblioteca propia',
  },
  {
    id: 'openalex',
    name: 'OpenAlex',
    category: 'Académicas',
    provider: 'OpenAlex API',
    description: 'Metadatos abiertos de investigación para descubrimiento académico en Library.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: ['OPENALEX_API_KEY', 'OPENALEX_MAILTO'],
    scopes: ['Biblioteca', 'Investigación', 'Curación'],
    config: {
      apiBaseUrl: 'https://api.openalex.org',
      mailto: 'library@maturity360.co',
      apiKey: '',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'OpenAlex funciona sin API key, pero se recomienda configurar mailto y api_key para mejor trazabilidad.',
    fallbackTo: 'arXiv',
  },
  {
    id: 'arxiv',
    name: 'arXiv',
    category: 'Académicas',
    provider: 'arXiv API',
    description: 'Preprints y papers abiertos para el flujo de descubrimiento de investigación.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: ['ARXIV_CLIENT_NAME'],
    scopes: ['Biblioteca', 'Investigación'],
    config: {
      apiBaseUrl: 'https://export.arxiv.org/api/query',
      clientName: 'Maturity360 Library',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'arXiv recomienda identificar el cliente y respetar una frecuencia baja de consultas.',
    fallbackTo: 'OpenAlex',
  },
  {
    id: 'semantic-scholar',
    name: 'Semantic Scholar',
    category: 'Académicas',
    provider: 'Semantic Scholar Graph API',
    description: 'Búsqueda de papers y señales de citación para investigación priorizada.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['SEMANTIC_SCHOLAR_API_KEY'],
    scopes: ['Biblioteca', 'Investigación', 'Ranking'],
    config: {
      apiBaseUrl: 'https://api.semanticscholar.org/graph/v1',
      apiKey: '',
      retryCount: '1',
      rateLimitMs: '1000',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Se recomienda API key para evitar 429 y sostener uso productivo.',
    fallbackTo: 'OpenAlex',
  },
  {
    id: 'scielo',
    name: 'SciELO',
    category: 'Académicas',
    provider: 'SciELO ArticleMeta',
    description: 'Catálogo abierto de artículos SciELO para búsqueda regional y científica.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: [],
    scopes: ['Biblioteca', 'Investigación', 'LatAm'],
    config: {
      apiBaseUrl: 'https://articlemeta.scielo.org/api/v1/articles/',
      collection: 'scl',
      pageSize: '30',
      scanWindow: '50',
      lookbackYears: '4',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Se usa ArticleMeta porque el buscador público bloquea requests servidor-servidor con 403.',
    fallbackTo: 'Redalyc',
  },
  {
    id: 'redalyc',
    name: 'Redalyc',
    category: 'Académicas',
    provider: 'Redalyc OAI-PMH',
    description: 'Harvest incremental desde Redalyc para búsqueda académica regional.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: [],
    scopes: ['Biblioteca', 'Investigación', 'LatAm'],
    config: {
      apiBaseUrl: 'http://148.215.1.70/redalyc/oai',
      metadataPrefix: 'oai_dc',
      lookbackYears: '2',
      maxPages: '3',
      pageRecordCap: '80',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Redalyc expone OAI-PMH, no una API JSON de búsqueda por palabra clave.',
    fallbackTo: 'SciELO',
  },
  {
    id: 'oer-commons',
    name: 'OER Commons',
    category: 'Académicas',
    provider: 'OER Commons API',
    description: 'Recursos didácticos abiertos para el carril de contenidos y apoyos educativos.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['OER_COMMONS_API_KEY'],
    scopes: ['Biblioteca', 'Didácticos', 'Curación'],
    config: {
      apiBaseUrl: 'https://www.oercommons.org/api/search',
      apiKey: '',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'OER Commons requiere token de acceso emitido por su equipo.',
    fallbackTo: 'PhET',
  },
  {
    id: 'phet',
    name: 'PhET',
    category: 'Académicas',
    provider: 'PhET Metadata Service',
    description: 'Simulaciones interactivas STEM para el carril didáctico de Library.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: [],
    scopes: ['Biblioteca', 'Didácticos', 'Simulaciones'],
    config: {
      apiBaseUrl:
        'https://phet.colorado.edu/services/metadata/1.2/simulations?format=json&type=html&locale=en&summary',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Catálogo público sin credenciales; la relevancia depende del dominio consultado.',
    fallbackTo: 'OER Commons',
  },
  {
    id: 'core',
    name: 'CORE',
    category: 'Académicas',
    provider: 'CORE API v3',
    description: 'Agregador adicional de papers abiertos y metadatos de investigación.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['CORE_API_KEY'],
    scopes: ['Biblioteca', 'Investigación'],
    config: {
      apiBaseUrl: 'https://api.core.ac.uk/v3',
      apiKey: '',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'CORE se mantiene opcional y se activa cuando haya credencial disponible.',
    fallbackTo: 'OpenAlex',
  },
  {
    id: 'google-sso',
    name: 'Google SSO',
    category: 'Google',
    provider: 'Google Identity',
    description: 'Inicio de sesión institucional y reglas de aprovisionamiento.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    scopes: ['Acceso', 'Aprovisionamiento'],
    config: {
      googleClientId: '',
      googleClientSecret: '',
      googleRedirectUri: 'https://maturity360.co/api/auth/google/callback',
      mode: 'Opcional',
      domainPolicy: inferDefaultDomain(),
      provisioning: 'Pendiente de aprobación',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Si se activa, los accesos SSO quedan trazados en logs de autenticación.',
    fallbackTo: 'Correo y contraseña',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'Google',
    provider: 'Google Calendar API',
    description: 'Sincronización de hitos, agendas y eventos del flujo de producción.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    scopes: ['Planeación', 'Hitos'],
    config: {
      googleClientId: '',
      googleClientSecret: '',
      calendarName: 'Producción académica',
      calendarId: 'primary',
      syncMode: 'Hitos y reuniones',
      timezone: 'America/Bogota',
      eventVisibility: 'Equipo del curso',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Hereda autenticación válida con el ecosistema de Google.',
    fallbackTo: 'Cronograma interno',
  },
  {
    id: 'google-meet',
    name: 'Google Meet',
    category: 'Google',
    provider: 'Google Meet',
    description: 'Creación de reuniones asociadas a hitos, revisiones y mesas de trabajo.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    scopes: ['Reuniones', 'Hitos'],
    config: {
      googleClientId: '',
      googleClientSecret: '',
      attachTo: 'Hitos del flujo',
      allowCreation: 'Sí',
      visibility: 'Equipo del curso',
      calendarId: 'primary',
      defaultDuration: '30 min',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Depende de autenticación Google vigente y permisos correctos.',
    fallbackTo: 'Enlace manual',
  },
  {
    id: 'cloudflare-r2',
    name: 'Cloudflare R2',
    category: 'Storage',
    provider: 'Cloudflare R2',
    description: 'Almacenamiento externo para archivos y recursos del sistema.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
    scopes: ['Recursos', 'Multimedia', 'Biblioteca'],
    config: {
      basePath: 'maturity',
      partitionRule: 'curso/modulo/tipo',
      retention: 'Operativa',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Las credenciales de acceso se consumen desde runtime seguro.',
    fallbackTo: 'Neon / almacenamiento local',
  },
  {
    id: 'youtube-data-api',
    name: 'YouTube Data API',
    category: 'Audiovisual',
    provider: 'Google APIs',
    description: 'Consulta y asociación de contenidos audiovisuales dentro del flujo.',
    enabled: false,
    status: 'Pendiente',
    requiredEnvKeys: ['YOUTUBE_API_KEY'],
    scopes: ['Curación', 'Multimedia'],
    config: {
      youtubeApiKey: '',
      allowedModules: 'Curación, Multimedia',
      defaultRegion: 'CO',
      safeSearch: 'Moderado',
      queryFilter: '',
      editorialRule: 'Usar con validación editorial antes de incorporar al curso.',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Útil para descubrimiento y control de piezas audiovisuales externas.',
    fallbackTo: 'Biblioteca interna',
  },
  {
    id: 'neon-database',
    name: 'Base de datos académica',
    category: 'Sistema',
    provider: 'Neon Postgres',
    description: 'Persistencia principal de la plataforma y datos estructurales.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: ['DATABASE_URL'],
    scopes: ['Sistema', 'Mis cursos', 'Gobierno'],
    config: {
      database: 'neondb',
      topology: 'Postgres serverless',
      region: 'us-east-1',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Se valida con consulta liviana de disponibilidad.',
    fallbackTo: 'Modo demo',
  },
  {
    id: 'vercel-runtime',
    name: 'Runtime de Vercel',
    category: 'Sistema',
    provider: 'Vercel',
    description: 'Entorno de despliegue, variables de runtime y metadatos del proyecto.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: ['VERCEL_ENV', 'VERCEL_URL', 'VERCEL_GIT_REPO_SLUG'],
    scopes: ['Sistema', 'Observabilidad'],
    config: {
      project: process.env.VERCEL_GIT_REPO_SLUG?.trim() || 'maturity',
      environment: process.env.VERCEL_ENV?.trim() || 'development',
      branch: process.env.VERCEL_GIT_COMMIT_REF?.trim() || 'local',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Expone estado de runtime y contexto de despliegue sin mostrar secretos.',
    fallbackTo: 'Entorno local',
  },
];

const integrationPresetMap = Object.fromEntries(
  defaultIntegrationPresets.map((integration) => [integration.id, integration]),
) as Record<string, IntegrationPreset>;

const integrationAssistantMap: Record<
  string,
  Pick<AdminIntegration, 'assistantTitle' | 'assistantSummary' | 'assistantSteps'>
> = {
  'outbound-mail': {
    assistantTitle: 'Asistente de correo saliente',
    assistantSummary: 'Configuración modular por proveedor (Gmail, Outlook, Amazon SES, Resend, SMTP).',
    assistantSteps: [
      'Selecciona tu proveedor de correo preferido.',
      'Sigue las instrucciones específicas de configuración y seguridad.',
      'Valida la conectividad con una prueba de envío real.',
    ],
  },
  openai: {
    assistantTitle: 'Asistente OpenAI',
    assistantSummary: 'Delimita módulos, modelo por defecto y funciones autorizadas para la capa inteligente.',
    assistantSteps: [
      'Elige el modelo visible para la operación.',
      'Define qué módulos o etapas pueden usar OpenAI.',
      'Guarda y corre una prueba para confirmar disponibilidad.',
    ],
  },
  gemini: {
    assistantTitle: 'Asistente Gemini',
    assistantSummary: 'Configura Gemini como motor principal o alterno para flujos específicos.',
    assistantSteps: [
      'Define casos de uso y módulos habilitados.',
      'Ajusta fallback hacia OpenAI o flujo manual.',
      'Valida disponibilidad en runtime y registra la prueba.',
    ],
  },
  'academic-databases': {
    assistantTitle: 'Asistente de fuentes académicas',
    assistantSummary: 'Ordena endpoint, mapeo de metadatos y alcance de curación dentro de la plataforma.',
    assistantSteps: [
      'Registra endpoint y tipo de acceso.',
      'Define campos recuperados y mapeo básico.',
      'Corre una consulta de prueba y revisa trazabilidad.',
    ],
  },
  openalex: {
    assistantTitle: 'Asistente OpenAlex',
    assistantSummary: 'Configura mailto, api_key opcional y prueba el proveedor académico abierto.',
    assistantSteps: [
      'Define mailto operativo para entrar al polite pool.',
      'Agrega api_key si tu operación lo requiere.',
      'Guarda y ejecuta una prueba de búsqueda real.',
    ],
  },
  arxiv: {
    assistantTitle: 'Asistente arXiv',
    assistantSummary: 'Ajusta identificación del cliente y valida la consulta Atom del proveedor.',
    assistantSteps: [
      'Configura nombre de cliente o contacto visible.',
      'Mantén el endpoint oficial de arXiv.',
      'Corre una prueba de consulta y revisa el parseo.',
    ],
  },
  'semantic-scholar': {
    assistantTitle: 'Asistente Semantic Scholar',
    assistantSummary: 'Controla API key, reintentos y disponibilidad del Academic Graph.',
    assistantSteps: [
      'Registra la API key para evitar rate limiting.',
      'Mantén el límite de 1 request por segundo configurado en Gobierno.',
      'Ajusta cantidad de reintentos si aplica.',
      'Prueba la búsqueda y confirma que no devuelve 429.',
    ],
  },
  scielo: {
    assistantTitle: 'Asistente SciELO',
    assistantSummary: 'Gestiona ArticleMeta, colección y ventana de escaneo para el catálogo SciELO.',
    assistantSteps: [
      'Confirma el endpoint de ArticleMeta y la colección operativa.',
      'Ajusta tamaño de página y ventana de escaneo.',
      'Ejecuta una prueba de catálogo y valida resultados filtrados.',
    ],
  },
  redalyc: {
    assistantTitle: 'Asistente Redalyc',
    assistantSummary: 'Configura el harvesting OAI-PMH y la ventana de registros recientes.',
    assistantSteps: [
      'Mantén el baseURL oficial de OAI-PMH.',
      'Ajusta lookback, páginas máximas y cupo por página.',
      'Ejecuta una prueba para revisar parseo XML y resumption tokens.',
    ],
  },
  'oer-commons': {
    assistantTitle: 'Asistente OER Commons',
    assistantSummary: 'Registra el token y el endpoint oficial de búsqueda didáctica.',
    assistantSteps: [
      'Solicita el token al equipo de OER Commons.',
      'Guárdalo en la configuración de la integración.',
      'Ejecuta una consulta de prueba con filtros educativos.',
    ],
  },
  phet: {
    assistantTitle: 'Asistente PhET',
    assistantSummary: 'Valida el catálogo público de simulaciones y su uso en la biblioteca didáctica.',
    assistantSteps: [
      'Verifica el endpoint oficial de metadatos.',
      'Guarda la configuración base.',
      'Corre una prueba para confirmar lectura del catálogo.',
    ],
  },
  core: {
    assistantTitle: 'Asistente CORE',
    assistantSummary: 'Activa el agregador CORE cuando exista API key operativa.',
    assistantSteps: [
      'Registra la API key de CORE.',
      'Mantén el endpoint v3 como base.',
      'Ejecuta una búsqueda real para validar la credencial.',
    ],
  },
  'google-sso': {
    assistantTitle: 'Asistente Google SSO',
    assistantSummary: 'Configura modo de acceso, aprovisionamiento y dominio institucional permitido.',
    assistantSteps: [
      'Activa acceso opcional u obligatorio.',
      'Define dominio y política de aprovisionamiento.',
      'Valida autenticación con una prueba controlada.',
    ],
  },
  'google-calendar': {
    assistantTitle: 'Asistente Google Calendar',
    assistantSummary: 'Organiza agendas, hitos y reglas de sincronización con el flujo de producción.',
    assistantSteps: [
      'Define calendario y tipo de eventos a sincronizar.',
      'Ajusta timezone y visibilidad.',
      'Prueba conexión y registra el resultado.',
    ],
  },
  'google-meet': {
    assistantTitle: 'Asistente Google Meet',
    assistantSummary: 'Asocia reuniones a hitos o eventos del flujo sin salir de Gobierno.',
    assistantSteps: [
      'Configura creación automática o manual.',
      'Define a qué eventos del flujo se vincula.',
      'Valida autenticación y creación de reunión.',
    ],
  },
  'cloudflare-r2': {
    assistantTitle: 'Asistente Cloudflare R2',
    assistantSummary: 'Estructura bucket, ruta base y reglas de ubicación para recursos y multimedia.',
    assistantSteps: [
      'Define partición por curso, módulo o tipo de recurso.',
      'Ajusta retención y fallback de almacenamiento.',
      'Prueba lectura y escritura desde runtime.',
    ],
  },
  'youtube-data-api': {
    assistantTitle: 'Asistente YouTube Data API',
    assistantSummary: 'Regula su uso por módulo y configura búsqueda audiovisual segura.',
    assistantSteps: [
      'Elige módulos autorizados para consulta.',
      'Configura región y nivel de filtrado.',
      'Ejecuta una prueba de consulta desde Gobierno.',
    ],
  },
  'neon-database': {
    assistantTitle: 'Asistente Neon',
    assistantSummary: 'Verifica salud de la persistencia principal y documenta el entorno conectado.',
    assistantSteps: [
      'Confirma entorno y topología visibles.',
      'Revisa fallback de operación si la base falla.',
      'Ejecuta prueba de disponibilidad.',
    ],
  },
  'vercel-runtime': {
    assistantTitle: 'Asistente Vercel',
    assistantSummary: 'Resume el entorno desplegado, variables detectadas y contexto del proyecto.',
    assistantSteps: [
      'Confirma proyecto, entorno y branch.',
      'Revisa disponibilidad de variables públicas y privadas.',
      'Ejecuta validación operativa del runtime.',
    ],
  },
};

function getIntegrationConfigValue(
  config: Record<string, string>,
  envKey: string,
  configKey?: string,
) {
  return cleanSecretCandidate(process.env[envKey]) || cleanSecretCandidate(config[configKey || '']);
}

function cleanSecretCandidate(value?: string | null) {
  return value?.trim() ?? '';
}

function sanitizeSensitiveIntegrationConfig(
  integrationId: string,
  config: Record<string, string>,
) {
  const nextConfig = { ...config };

  if (integrationId === 'openai') {
    delete nextConfig.openaiApiKey;
    delete nextConfig.apiKey;
  }

  if (integrationId === 'gemini') {
    delete nextConfig.geminiApiKey;
    delete nextConfig.apiKey;
  }

  return nextConfig;
}

async function readResponseText(response: Response) {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

async function verifyOpenAI(_config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey = cleanSecretCandidate(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'La integración de OpenAI no tiene OPENAI_API_KEY disponible en runtime.',
      lastError: 'Missing OpenAI API key',
    };
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `OpenAI rechazó la validación (${response.status}).`,
      lastError: detail || `OpenAI validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'OpenAI respondió correctamente a la consulta de modelos.',
    lastError: null,
  };
}

async function verifyGemini(_config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey =
    cleanSecretCandidate(process.env.GEMINI_API_KEY) ||
    cleanSecretCandidate(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'La integración de Gemini no tiene API Key disponible en runtime.',
      lastError: 'Missing Gemini API key',
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `Gemini rechazó la validación (${response.status}).`,
      lastError: detail || `Gemini validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'Gemini respondió correctamente a la consulta de modelos.',
    lastError: null,
  };
}

async function verifyYoutube(config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey =
    cleanSecretCandidate(process.env.YOUTUBE_API_KEY) ||
    cleanSecretCandidate(config.youtubeApiKey) ||
    cleanSecretCandidate(config.apiKey);

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'La integración de YouTube no tiene YOUTUBE_API_KEY disponible en runtime.',
      lastError: 'Missing YouTube API key',
    };
  }

  const safeSearchMap: Record<string, string> = {
    Estricto: 'strict',
    Moderado: 'moderate',
    'Sin filtro': 'none',
  };
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '1',
    q: 'educacion virtual',
    key: apiKey,
    regionCode: config.defaultRegion?.trim() || 'CO',
    safeSearch: safeSearchMap[config.safeSearch] || 'moderate',
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `YouTube Data API rechazó la consulta (${response.status}).`,
      lastError: detail || `YouTube validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'YouTube Data API respondió correctamente a una búsqueda de prueba.',
    lastError: null,
  };
}

async function verifyOpenAlex(config: Record<string, string>): Promise<IntegrationTestResult> {
  const baseUrl = cleanSecretCandidate(config.apiBaseUrl) || 'https://api.openalex.org';
  const params = new URLSearchParams({
    search: 'machine learning',
    per_page: '1',
    select: 'id,title',
  });
  const mailto = cleanSecretCandidate(process.env.OPENALEX_MAILTO) || cleanSecretCandidate(config.mailto);
  const apiKey = cleanSecretCandidate(process.env.OPENALEX_API_KEY) || cleanSecretCandidate(config.apiKey);

  if (mailto) {
    params.set('mailto', mailto);
  }
  if (apiKey) {
    params.set('api_key', apiKey);
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/works?${params.toString()}`);
  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `OpenAlex respondió con error (${response.status}).`,
      lastError: detail || `OpenAlex validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'OpenAlex respondió correctamente a la búsqueda de prueba.',
    lastError: null,
  };
}

async function verifyArxiv(config: Record<string, string>): Promise<IntegrationTestResult> {
  const baseUrl = cleanSecretCandidate(config.apiBaseUrl) || 'https://export.arxiv.org/api/query';
  const params = new URLSearchParams({
    search_query: 'all:machine learning',
    start: '0',
    max_results: '1',
  });
  const response = await fetch(`${baseUrl}?${params.toString()}`, {
    headers: {
      Accept: 'application/atom+xml',
      'User-Agent': `${cleanSecretCandidate(config.clientName) || 'Maturity360 Library'} (https://maturity360.co)`,
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `arXiv respondió con error (${response.status}).`,
      lastError: detail || `arXiv validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'arXiv respondió correctamente a la consulta Atom.',
    lastError: null,
  };
}

async function verifySemanticScholar(config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey =
    cleanSecretCandidate(process.env.SEMANTIC_SCHOLAR_API_KEY) ||
    cleanSecretCandidate(config.apiKey) ||
    cleanSecretCandidate(config.semanticScholarApiKey);

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'Semantic Scholar requiere API key para un uso estable en producción.',
      lastError: 'Missing Semantic Scholar API key',
    };
  }

  const baseUrl = cleanSecretCandidate(config.apiBaseUrl) || 'https://api.semanticscholar.org/graph/v1';
  const params = new URLSearchParams({
    query: 'machine learning',
    limit: '1',
    fields: 'paperId,title',
  });
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/paper/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `Semantic Scholar respondió con error (${response.status}).`,
      lastError: detail || `Semantic Scholar validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'Semantic Scholar respondió correctamente a la búsqueda de prueba.',
    lastError: null,
  };
}

async function verifySciELO(config: Record<string, string>): Promise<IntegrationTestResult> {
  const baseUrl = cleanSecretCandidate(config.apiBaseUrl) || 'https://articlemeta.scielo.org/api/v1/articles/';
  const url = new URL(baseUrl);
  url.searchParams.set('collection', cleanSecretCandidate(config.collection) || 'scl');
  url.searchParams.set('limit', '1');
  url.searchParams.set('offset', '0');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Maturity360 Library/1.0',
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `SciELO ArticleMeta respondió con error (${response.status}).`,
      lastError: detail || `SciELO validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'SciELO ArticleMeta respondió correctamente a la validación del catálogo.',
    lastError: null,
  };
}

async function verifyRedalyc(config: Record<string, string>): Promise<IntegrationTestResult> {
  const baseUrl = cleanSecretCandidate(config.apiBaseUrl) || 'http://148.215.1.70/redalyc/oai';
  const response = await fetch(`${baseUrl}?verb=Identify`, {
    headers: {
      Accept: 'application/xml,text/xml',
      'User-Agent': 'Maturity360 Library/1.0',
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `Redalyc OAI-PMH respondió con error (${response.status}).`,
      lastError: detail || `Redalyc validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'Redalyc respondió correctamente al Identify de OAI-PMH.',
    lastError: null,
  };
}

async function verifyOerCommons(config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey =
    cleanSecretCandidate(process.env.OER_COMMONS_API_KEY) ||
    cleanSecretCandidate(config.apiKey) ||
    cleanSecretCandidate(config.token);

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'OER Commons requiere token de acceso.',
      lastError: 'Missing OER Commons token',
    };
  }

  const baseUrl = cleanSecretCandidate(config.apiBaseUrl) || 'https://www.oercommons.org/api/search';
  const params = new URLSearchParams({
    token: apiKey,
    'f.search': 'machine learning',
    batch_size: '1',
    batch_start: '0',
  });
  const response = await fetch(`${baseUrl}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Maturity360 Library/1.0',
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `OER Commons respondió con error (${response.status}).`,
      lastError: detail || `OER Commons validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'OER Commons respondió correctamente a la búsqueda de prueba.',
    lastError: null,
  };
}

async function verifyPhET(config: Record<string, string>): Promise<IntegrationTestResult> {
  const baseUrl =
    cleanSecretCandidate(config.apiBaseUrl) ||
    'https://phet.colorado.edu/services/metadata/1.2/simulations?format=json&type=html&locale=en&summary';
  const response = await fetch(baseUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Maturity360 Library/1.0',
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `PhET respondió con error (${response.status}).`,
      lastError: detail || `PhET validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'PhET respondió correctamente a la lectura del catálogo.',
    lastError: null,
  };
}

async function verifyCore(config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey =
    cleanSecretCandidate(process.env.CORE_API_KEY) ||
    cleanSecretCandidate(config.apiKey) ||
    cleanSecretCandidate(config.coreApiKey);

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'CORE requiere API key para operar.',
      lastError: 'Missing CORE API key',
    };
  }

  const response = await fetch(`${cleanSecretCandidate(config.apiBaseUrl) || 'https://api.core.ac.uk/v3'}/search/works`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: 'machine learning',
      limit: 1,
      offset: 0,
      fields: ['id', 'title'],
    }),
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `CORE respondió con error (${response.status}).`,
      lastError: detail || `CORE validation failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'CORE respondió correctamente a la búsqueda de prueba.',
    lastError: null,
  };
}

async function verifyAcademicDatabase(config: Record<string, string>): Promise<IntegrationTestResult> {
  const endpoint =
    cleanSecretCandidate(config.endpoint) || cleanSecretCandidate(process.env.ACADEMIC_DATABASE_ENDPOINT);

  if (!endpoint) {
    return {
      status: 'Con error',
      detail: 'No hay endpoint académico configurado.',
      lastError: 'Missing academic database endpoint',
    };
  }

  const response = await fetch(endpoint, {
    method: 'GET',
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `La fuente académica respondió con error (${response.status}).`,
      lastError: detail || `Academic endpoint failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'La fuente académica respondió correctamente a la validación.',
    lastError: null,
  };
}

async function verifyGoogleConfiguration(
  integrationId: 'google-sso' | 'google-calendar' | 'google-meet',
  config: Record<string, string>,
): Promise<IntegrationTestResult> {
  const clientId = getIntegrationConfigValue(config, 'GOOGLE_CLIENT_ID', 'googleClientId');
  const clientSecret = getIntegrationConfigValue(config, 'GOOGLE_CLIENT_SECRET', 'googleClientSecret');

  if (!clientId || !clientSecret) {
    return {
      status: 'Con error',
      detail: 'Faltan Google Client ID y/o Google Client Secret.',
      lastError: 'Missing Google OAuth credentials',
    };
  }

  if (integrationId === 'google-sso') {
    const redirectUri = cleanSecretCandidate(config.googleRedirectUri);

    if (!redirectUri) {
      return {
        status: 'Con error',
        detail: 'Google SSO requiere Redirect URI para quedar listo.',
        lastError: 'Missing Google redirect URI',
      };
    }
  }

  return {
    status: 'Pendiente',
    detail:
      'La configuración OAuth base está guardada, pero la verificación end-to-end aún requiere autorización Google desde una siguiente iteración.',
    lastError: null,
  };
}

async function verifyVercelRuntime(config: Record<string, string>): Promise<IntegrationTestResult> {
  const baseUrl =
    cleanSecretCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
    (cleanSecretCandidate(process.env.VERCEL_URL)
      ? `https://${cleanSecretCandidate(process.env.VERCEL_URL)}`
      : '');

  if (!baseUrl) {
    return {
      status: 'Con error',
      detail: 'No fue posible determinar la URL del runtime desplegado.',
      lastError: 'Missing public app URL',
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, {
    headers: {
      'x-maturity-runtime-check': config.project || 'maturity',
    },
  });

  if (!response.ok) {
    const detail = await readResponseText(response);
    return {
      status: 'Con error',
      detail: `El runtime respondió con error (${response.status}).`,
      lastError: detail || `Vercel runtime failed with ${response.status}`,
    };
  }

  return {
    status: 'Activa',
    detail: 'El runtime de Vercel respondió correctamente al chequeo de salud.',
    lastError: null,
  };
}

async function ensureAdminCenterSchema() {
  if (!adminCenterSchemaPromise) {
    adminCenterSchemaPromise = (async () => {
      const sql = getSql();
      await sql`SELECT pg_advisory_lock(3612026)`;

      try {
        await sql`
          CREATE TABLE IF NOT EXISTS maturity_admin_settings (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TEXT NOT NULL,
            updated_by TEXT
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS maturity_admin_integrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            provider TEXT NOT NULL,
            description TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT false,
            status TEXT NOT NULL DEFAULT 'Pendiente',
            scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
            config JSONB NOT NULL DEFAULT '{}'::jsonb,
            notes TEXT NOT NULL DEFAULT '',
            fallback_to TEXT NOT NULL DEFAULT '',
            last_test_at TEXT,
            last_error TEXT,
            updated_at TEXT NOT NULL
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS maturity_admin_logs (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            category TEXT NOT NULL,
            module TEXT NOT NULL,
            service TEXT NOT NULL,
            severity TEXT NOT NULL,
            event TEXT NOT NULL,
            result TEXT NOT NULL,
            detail TEXT NOT NULL,
            user_id TEXT,
            user_name TEXT
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS maturity_admin_audit (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            classification TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            actor_id TEXT,
            actor_name TEXT NOT NULL,
            detail TEXT NOT NULL,
            before_value TEXT,
            after_value TEXT
          )
        `;
      } finally {
        await sql`SELECT pg_advisory_unlock(3612026)`;
      }
    })().catch((error) => {
      adminCenterSchemaPromise = null;
      throw error;
    });
  }

  return adminCenterSchemaPromise;
}

async function seedAdminCenterDefaults() {
  if (!adminCenterDefaultsPromise) {
    adminCenterDefaultsPromise = (async () => {
      await ensureAdminCenterSchema();
      const sql = getSql();
      const timestamp = new Date().toISOString();
      const baseInstitution = buildDefaultInstitutionSettings();
      const institution = {
        displayName: baseInstitution.displayName,
        supportEmail: baseInstitution.supportEmail,
        defaultDomain: baseInstitution.defaultDomain,
        defaultUserState: baseInstitution.defaultUserState,
        allowAutoProvisioning: baseInstitution.allowAutoProvisioning,
      };

      await sql`
        INSERT INTO maturity_admin_settings (key, value, updated_at, updated_by)
        VALUES (
          ${'institution'},
          ${JSON.stringify(institution)}::jsonb,
          ${timestamp},
          ${'system'}
        )
        ON CONFLICT (key) DO NOTHING
      `;

      await sql`
        INSERT INTO maturity_admin_settings (key, value, updated_at, updated_by)
        VALUES (
          ${'branding'},
          ${JSON.stringify(defaultBranding)}::jsonb,
          ${timestamp},
          ${'system'}
        )
        ON CONFLICT (key) DO NOTHING
      `;

      await sql`
        INSERT INTO maturity_admin_settings (key, value, updated_at, updated_by)
        VALUES (
          ${'experience'},
          ${JSON.stringify(defaultExperienceSettings)}::jsonb,
          ${timestamp},
          ${'system'}
        )
        ON CONFLICT (key) DO NOTHING
      `;

      await sql`
        INSERT INTO maturity_admin_settings (key, value, updated_at, updated_by)
        VALUES (
          ${'workflow'},
          ${JSON.stringify(defaultWorkflowSettings)}::jsonb,
          ${timestamp},
          ${'system'}
        )
        ON CONFLICT (key) DO NOTHING
      `;

      await sql`
        INSERT INTO maturity_admin_settings (key, value, updated_at, updated_by)
        VALUES (
          ${'home-content'},
          ${JSON.stringify(defaultHomeContent)}::jsonb,
          ${timestamp},
          ${'system'}
        )
        ON CONFLICT (key) DO NOTHING
      `;

      for (const integration of defaultIntegrationPresets) {
        await sql`
          INSERT INTO maturity_admin_integrations (
            id,
            name,
            category,
            provider,
            description,
            enabled,
            status,
            scopes,
            config,
            notes,
            fallback_to,
            last_test_at,
            last_error,
            updated_at
          )
          VALUES (
            ${integration.id},
            ${integration.name},
            ${integration.category},
            ${integration.provider},
            ${integration.description},
            ${integration.enabled},
            ${integration.status},
            ${JSON.stringify(integration.scopes)}::jsonb,
            ${JSON.stringify(integration.config)}::jsonb,
            ${integration.notes},
            ${integration.fallbackTo},
            ${integration.lastTestAt},
            ${integration.lastError},
            ${timestamp}
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
    })().catch((error) => {
      adminCenterDefaultsPromise = null;
      throw error;
    });
  }

  return adminCenterDefaultsPromise;
}

async function readSetting<T>(key: string, fallbackValue: T): Promise<T> {
  await seedAdminCenterDefaults();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      key,
      value,
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    FROM maturity_admin_settings
    WHERE key = ${key}
    LIMIT 1
  `) as AdminSettingRow[];

  if (!rows[0]) {
    return fallbackValue;
  }

  return {
    ...fallbackValue,
    ...parseJson<Record<string, unknown>>(rows[0].value),
  } as T;
}

async function writeSetting<T>(key: string, value: T, actor: AdminActor) {
  await seedAdminCenterDefaults();
  const sql = getSql();
  const timestamp = new Date().toISOString();

  await sql`
    INSERT INTO maturity_admin_settings (key, value, updated_at, updated_by)
    VALUES (
      ${key},
      ${JSON.stringify(value)}::jsonb,
      ${timestamp},
      ${actor.id}
    )
    ON CONFLICT (key) DO UPDATE
    SET
      value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by
  `;
}

function evaluateIntegrationRuntime(
  integrationId: string,
  config: Record<string, string>,
): {
  ready: boolean;
  source: AdminIntegrationSource;
  summary: string;
} {
  const getVal = (envKey: string, configKey?: string) => {
    return getIntegrationConfigValue(config, envKey, configKey);
  };

  switch (integrationId) {
    case 'outbound-mail': {
      const type = config.providerType || 'Resend';
      if (type === 'Resend') {
        const key = getVal('RESEND_API_KEY', 'resendApiKey');
        const ready = Boolean(key);
        return {
          ready,
          source: config.resendApiKey ? 'governance' : ready ? 'runtime' : 'none',
          summary: ready
            ? 'Resend configurado mediante ' + (config.resendApiKey ? 'base de datos.' : 'runtime.')
            : 'Falta RESEND_API_KEY.',
        };
      }
      if (type === 'Amazon SES') {
        const access = getVal('AWS_SES_ACCESS_KEY', 'sesAccessKey');
        const secret = getVal('AWS_SES_SECRET_KEY', 'sesSecretKey');
        const region = getVal('AWS_SES_REGION', 'sesRegion');
        const ready = Boolean(access && secret && region);
        return {
          ready,
          source:
            config.sesAccessKey || config.sesSecretKey || config.sesRegion
              ? 'governance'
              : ready
                ? 'runtime'
                : 'none',
          summary: ready
            ? `Amazon SES activo en ${region}.`
            : 'Faltan credenciales de AWS SES (Access Key, Secret Key o Región).',
        };
      }
      // Gmail, Outlook, SMTP
      const host = getVal('SMTP_HOST', 'smtpHost');
      const port = getVal('SMTP_PORT', 'smtpPort');
      const user = getVal('SMTP_USER', 'smtpUser');
      const pass = getVal('SMTP_PASSWORD', 'smtpPassword');
      const ready = Boolean(host && port && user && pass);
      return {
        ready,
        source:
          config.smtpHost || config.smtpPort || config.smtpUser || config.smtpPassword
            ? 'governance'
            : ready
              ? 'runtime'
              : 'none',
        summary: ready
          ? `SMTP listo (${host}:${port}).`
          : `Faltan parámetros de SMTP para ${type}.`,
      };
    }
    case 'openai': {
      const key = cleanSecretCandidate(process.env.OPENAI_API_KEY);
      const ready = Boolean(key);
      return {
        ready,
        source: ready ? 'runtime' : 'none',
        summary: ready
          ? `OpenAI listo desde runtime (${config.defaultModel || 'modelo por defecto'}).`
          : 'Falta OPENAI_API_KEY.',
      };
    }
    case 'gemini': {
      const key =
        cleanSecretCandidate(process.env.GEMINI_API_KEY) ||
        cleanSecretCandidate(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
      const ready = Boolean(key);
      return {
        ready,
        source: ready ? 'runtime' : 'none',
        summary: ready
          ? `Gemini listo desde runtime (${config.defaultModel || 'flash'}).`
          : 'Falta API Key de Gemini.',
      };
    }
    case 'academic-databases': {
      const ready = Boolean(process.env.ACADEMIC_DATABASE_ENDPOINT?.trim() || config.endpoint?.trim());
      return {
        ready,
        source: config.endpoint?.trim() ? 'governance' : ready ? 'runtime' : 'none',
        summary: ready
          ? `Fuente académica lista desde ${config.endpoint || 'runtime configurado'}.`
          : 'No hay endpoint académico configurado.',
      };
    }
    case 'openalex': {
      const ready = Boolean((config.apiBaseUrl || 'https://api.openalex.org').trim());
      return {
        ready,
        source: 'governance',
        summary: ready
          ? `OpenAlex listo${config.mailto?.trim() ? ` con mailto ${config.mailto.trim()}.` : '.'}`
          : 'No hay endpoint configurado para OpenAlex.',
      };
    }
    case 'arxiv': {
      const ready = Boolean((config.apiBaseUrl || 'https://export.arxiv.org/api/query').trim());
      return {
        ready,
        source: 'governance',
        summary: ready
          ? `arXiv listo con cliente ${config.clientName?.trim() || 'Maturity360 Library'}.`
          : 'No hay endpoint configurado para arXiv.',
      };
    }
    case 'semantic-scholar': {
      const apiKey =
        cleanSecretCandidate(process.env.SEMANTIC_SCHOLAR_API_KEY) ||
        cleanSecretCandidate(config.apiKey) ||
        cleanSecretCandidate(config.semanticScholarApiKey);
      const ready = Boolean(apiKey);
      return {
        ready,
        source: config.apiKey?.trim() || config.semanticScholarApiKey?.trim() ? 'governance' : ready ? 'runtime' : 'none',
        summary: ready
          ? 'Semantic Scholar listo con API key.'
          : 'Falta API key de Semantic Scholar para un uso productivo estable.',
      };
    }
    case 'scielo': {
      const ready = Boolean((config.apiBaseUrl || 'https://articlemeta.scielo.org/api/v1/articles/').trim());
      return {
        ready,
        source: 'governance',
        summary: ready
          ? `SciELO listo vía ArticleMeta (${config.collection?.trim() || 'scl'}).`
          : 'No hay endpoint configurado para SciELO.',
      };
    }
    case 'redalyc': {
      const ready = Boolean((config.apiBaseUrl || 'http://148.215.1.70/redalyc/oai').trim());
      return {
        ready,
        source: 'governance',
        summary: ready
          ? 'Redalyc listo vía OAI-PMH.'
          : 'No hay endpoint configurado para Redalyc.',
      };
    }
    case 'oer-commons': {
      const token =
        cleanSecretCandidate(process.env.OER_COMMONS_API_KEY) ||
        cleanSecretCandidate(config.apiKey) ||
        cleanSecretCandidate(config.token);
      const ready = Boolean(token);
      return {
        ready,
        source: config.apiKey?.trim() || config.token?.trim() ? 'governance' : ready ? 'runtime' : 'none',
        summary: ready
          ? 'OER Commons listo con token de acceso.'
          : 'Falta token de OER Commons.',
      };
    }
    case 'phet': {
      const ready = Boolean(
        (config.apiBaseUrl ||
          'https://phet.colorado.edu/services/metadata/1.2/simulations?format=json&type=html&locale=en&summary').trim(),
      );
      return {
        ready,
        source: 'governance',
        summary: ready ? 'PhET listo con catálogo público.' : 'No hay endpoint configurado para PhET.',
      };
    }
    case 'core': {
      const apiKey =
        cleanSecretCandidate(process.env.CORE_API_KEY) ||
        cleanSecretCandidate(config.apiKey) ||
        cleanSecretCandidate(config.coreApiKey);
      const ready = Boolean(apiKey);
      return {
        ready,
        source: config.apiKey?.trim() || config.coreApiKey?.trim() ? 'governance' : ready ? 'runtime' : 'none',
        summary: ready ? 'CORE listo con API key.' : 'Falta CORE_API_KEY.',
      };
    }
    case 'google-sso':
    case 'google-calendar':
    case 'google-meet': {
      const clientId = getVal('GOOGLE_CLIENT_ID', 'googleClientId');
      const clientSecret = getVal('GOOGLE_CLIENT_SECRET', 'googleClientSecret');
      const ready = Boolean(
        clientId && clientSecret,
      );
      const source: AdminIntegrationSource =
        config.googleClientId?.trim() || config.googleClientSecret?.trim()
          ? 'governance'
          : ready
            ? 'runtime'
            : 'none';
      return {
        ready,
        source,
        summary: ready
          ? `Credenciales Google listas desde ${source === 'governance' ? 'Gobierno' : 'runtime'}.`
          : 'Faltan Google Client ID y/o Google Client Secret.',
      };
    }
    case 'cloudflare-r2': {
      const acc = getVal('R2_ACCOUNT_ID', 'r2AccountId');
      const key = getVal('R2_ACCESS_KEY_ID', 'r2AccessKeyId');
      const sec = getVal('R2_SECRET_ACCESS_KEY', 'r2SecretAccessKey');
      const buck = getVal('R2_BUCKET_NAME', 'r2BucketName');
      const ready = Boolean(acc && key && sec && buck);
      return {
        ready,
        source:
          config.r2AccountId ||
          config.r2AccessKeyId ||
          config.r2SecretAccessKey ||
          config.r2BucketName
            ? 'governance'
            : ready
              ? 'runtime'
              : 'none',
        summary: ready
          ? `R2 listo en bucket ${buck}.`
          : 'Faltan credenciales o bucket de Cloudflare R2.',
      };
    }
    case 'youtube-data-api': {
      const ready = Boolean(
        cleanSecretCandidate(process.env.YOUTUBE_API_KEY) ||
          cleanSecretCandidate(config.youtubeApiKey) ||
          cleanSecretCandidate(config.apiKey),
      );
      const source: AdminIntegrationSource =
        config.youtubeApiKey?.trim() || config.apiKey?.trim() ? 'governance' : ready ? 'runtime' : 'none';
      return {
        ready,
        source,
        summary: ready
          ? `YouTube Data API lista desde ${source === 'governance' ? 'Gobierno' : 'runtime'}.`
          : 'Falta YOUTUBE_API_KEY o credencial guardada en Gobierno.',
      };
    }
    case 'neon-database': {
      const ready = Boolean(process.env.DATABASE_URL?.trim());
      return {
        ready,
        source: ready ? 'runtime' : 'none',
        summary: ready
          ? 'DATABASE_URL detectada; lista para validación operativa.'
          : 'DATABASE_URL no está configurada.',
      };
    }
    case 'vercel-runtime': {
      const ready = Boolean(process.env.VERCEL_URL?.trim() || process.env.VERCEL_ENV?.trim());
      return {
        ready,
        source: ready ? 'runtime' : 'none',
        summary: ready
          ? `Runtime ${process.env.VERCEL_ENV || 'desconocido'} para proyecto ${process.env.VERCEL_GIT_REPO_SLUG || config.project || 'maturity'}.`
          : 'No se detectaron variables de Vercel en runtime.',
      };
    }
    default:
      return {
        ready: false,
        source: 'none',
        summary: 'No hay diagnóstico definido para esta integración.',
      };
  }
}

function serializeIntegrationRow(row: AdminIntegrationRow): AdminIntegration {
  const preset = integrationPresetMap[row.id];
  const assistant = integrationAssistantMap[row.id];
  const config = sanitizeSensitiveIntegrationConfig(
    row.id,
    parseJson<Record<string, string>>(row.config),
  );
  const scopes = parseJson<string[]>(row.scopes);
  const runtime = evaluateIntegrationRuntime(row.id, config);
  const effectiveEnabled = row.enabled;
  const effectiveStatus: AdminIntegrationStatus = !effectiveEnabled
    ? 'Inactiva'
    : row.status === 'En prueba'
      ? 'En prueba'
      : row.status === 'Con error' || (row.lastTestAt && row.lastError)
        ? 'Con error'
        : !runtime.ready
          ? 'Con error'
        : row.status === 'Activa' && row.lastTestAt && !row.lastError && runtime.ready
          ? 'Activa'
          : 'Pendiente';

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider,
    description: row.description,
    enabled: effectiveEnabled,
    status: effectiveStatus,
    requiredEnvKeys: preset?.requiredEnvKeys ?? [],
    envReady: runtime.ready,
    runtimeSource: runtime.source,
    runtimeSummary: runtime.summary,
    scopes,
    config,
    lastTestAt: row.lastTestAt,
    lastError: row.lastError,
    notes: row.notes,
    fallbackTo: row.fallbackTo,
    assistantTitle: assistant?.assistantTitle ?? 'Asistente de integración',
    assistantSummary:
      assistant?.assistantSummary ?? 'Configura alcance, fallback y validación operativa.',
    assistantSteps: assistant?.assistantSteps ?? [
      'Define configuración visible.',
      'Ajusta alcances permitidos.',
      'Ejecuta una prueba de conectividad.',
    ],
  };
}

function shouldHideIntegration(integrationId: string) {
  return integrationId === 'academic-databases';
}

async function readIntegrations() {
  await seedAdminCenterDefaults();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      name,
      category,
      provider,
      description,
      enabled,
      status,
      scopes,
      config,
      notes,
      fallback_to AS "fallbackTo",
      last_test_at AS "lastTestAt",
      last_error AS "lastError",
      updated_at AS "updatedAt"
    FROM maturity_admin_integrations
    ORDER BY category ASC, name ASC
  `) as AdminIntegrationRow[];

  return rows.filter((row) => !shouldHideIntegration(row.id)).map(serializeIntegrationRow);
}

async function readIntegrationRowById(id: string) {
  await seedAdminCenterDefaults();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      name,
      category,
      provider,
      description,
      enabled,
      status,
      scopes,
      config,
      notes,
      fallback_to AS "fallbackTo",
      last_test_at AS "lastTestAt",
      last_error AS "lastError",
      updated_at AS "updatedAt"
    FROM maturity_admin_integrations
    WHERE id = ${id}
    LIMIT 1
  `) as AdminIntegrationRow[];

  return rows[0] ?? null;
}

export async function getIntegrationConfig(id: string) {
  const row = await readIntegrationRowById(id);

  if (!row) {
    return {} as Record<string, string>;
  }

  return sanitizeSensitiveIntegrationConfig(id, parseJson<Record<string, string>>(row.config));
}

export async function getAdminIntegrations() {
  return readIntegrations();
}

export async function getAdminIntegration(id: string) {
  const row = await readIntegrationRowById(id);
  if (!row || shouldHideIntegration(row.id)) {
    return null;
  }

  return serializeIntegrationRow(row);
}

async function readLogs() {
  await seedAdminCenterDefaults();
  const sql = getSql();
  return (await sql`
    SELECT
      id,
      created_at AS "createdAt",
      category,
      module,
      service,
      severity,
      event,
      result,
      detail,
      user_id AS "userId",
      user_name AS "userName"
    FROM maturity_admin_logs
    ORDER BY created_at DESC
    LIMIT 240
  `) as AdminLogRow[];
}

async function readAudit() {
  await seedAdminCenterDefaults();
  const sql = getSql();
  return (await sql`
    SELECT
      id,
      created_at AS "createdAt",
      classification,
      entity_type AS "entityType",
      entity_id AS "entityId",
      action,
      actor_id AS "actorId",
      actor_name AS "actorName",
      detail,
      before_value AS "beforeValue",
      after_value AS "afterValue"
    FROM maturity_admin_audit
    ORDER BY created_at DESC
    LIMIT 240
  `) as AdminAuditRow[];
}

export async function recordAdminLog(entry: {
  category: AdminLogCategory;
  module: string;
  service: string;
  severity: AdminLogSeverity;
  event: string;
  result: string;
  detail: string;
  userId?: string | null;
  userName?: string | null;
}) {
  await seedAdminCenterDefaults();
  const sql = getSql();
  const timestamp = new Date().toISOString();

  await sql`
    INSERT INTO maturity_admin_logs (
      id,
      created_at,
      category,
      module,
      service,
      severity,
      event,
      result,
      detail,
      user_id,
      user_name
    )
    VALUES (
      ${crypto.randomUUID()},
      ${timestamp},
      ${entry.category},
      ${entry.module},
      ${entry.service},
      ${entry.severity},
      ${entry.event},
      ${entry.result},
      ${entry.detail},
      ${entry.userId ?? null},
      ${entry.userName ?? null}
    )
  `;
}

export async function recordAdminAudit(entry: {
  classification: AdminAuditClassification;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  actorName: string;
  detail: string;
  beforeValue?: string | null;
  afterValue?: string | null;
}) {
  await seedAdminCenterDefaults();
  const sql = getSql();
  const timestamp = new Date().toISOString();

  await sql`
    INSERT INTO maturity_admin_audit (
      id,
      created_at,
      classification,
      entity_type,
      entity_id,
      action,
      actor_id,
      actor_name,
      detail,
      before_value,
      after_value
    )
    VALUES (
      ${crypto.randomUUID()},
      ${timestamp},
      ${entry.classification},
      ${entry.entityType},
      ${entry.entityId},
      ${entry.action},
      ${entry.actorId ?? null},
      ${entry.actorName},
      ${entry.detail},
      ${entry.beforeValue ?? null},
      ${entry.afterValue ?? null}
    )
  `;
}

export async function getBrandingSettings() {
  const branding = await readSetting<BrandingSettings>('branding', defaultBranding);
  return sanitizeBrandingSettings(branding);
}

export async function getExperienceSettings() {
  const settings = await readSetting<ExperienceSettings>('experience', defaultExperienceSettings);
  return sanitizeExperienceSettings(settings);
}

export async function getInstitutionSettings() {
  const settings = await readSetting<InstitutionSettings>(
    'institution',
    buildDefaultInstitutionSettings(),
  );
  const relationalSettings = await getInstitutionSettingsRecord({
    displayName: settings.displayName,
    supportEmail: settings.supportEmail,
    defaultDomain: settings.defaultDomain,
    defaultUserState: settings.defaultUserState,
  });
  return sanitizeInstitutionSettings(relationalSettings);
}

export async function getWorkflowSettings() {
  const settings = await readSetting<WorkflowSettings>('workflow', defaultWorkflowSettings);
  return sanitizeWorkflowSettings(settings);
}

export async function getHomeContentSettings() {
  const settings = await readSetting<HomeContentSettings>('home-content', defaultHomeContent);
  return sanitizeHomeContentSettings(settings);
}

export async function getAdminCenterData(): Promise<AdminCenterData> {
  await seedAdminCenterDefaults();

  const [users, institution, branding, homeContent, experience, workflow, integrations, logs, audit, productFormatTemplates] =
    await Promise.all([
    getUserDirectory(),
    getInstitutionSettings(),
    getBrandingSettings(),
    getHomeContentSettings(),
    getExperienceSettings(),
    getWorkflowSettings(),
    readIntegrations(),
    readLogs(),
    readAudit(),
    getProductFormatTemplates(),
  ]);

  return {
    users,
    institution,
    branding,
    homeContent,
    experience,
    workflow,
    integrations,
    logs,
    audit,
    productFormatTemplates,
  };
}

export async function updateInstitutionSettings(input: InstitutionSettings, actor: AdminActor) {
  const before = await getInstitutionSettings();
  const next = sanitizeInstitutionSettings(input);
  const synced = await syncInstitutionSettingsRecord(next);

  await writeSetting(
    'institution',
    {
      displayName: next.displayName,
      supportEmail: next.supportEmail,
      defaultDomain: next.defaultDomain,
      defaultUserState: next.defaultUserState,
      allowAutoProvisioning: next.allowAutoProvisioning,
    },
    actor,
  );
  await recordAdminAudit({
    classification: 'Administrativa',
    entityType: 'institution-settings',
    entityId: 'institution',
    action: 'update',
    actorId: actor.id,
    actorName: actor.name,
    detail: 'Se actualizaron parámetros institucionales y catálogos operativos.',
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(synced),
  });
  await recordAdminLog({
    category: 'Administración',
    module: 'Gobierno',
    service: 'Configuración institucional',
    severity: 'Success',
    event: 'institution_settings_updated',
    result: 'ok',
    detail: 'Se guardaron instituciones, facultades, programas, periodos y reglas de aprovisionamiento.',
    userId: actor.id,
    userName: actor.name,
  });

  return synced;
}

export async function updateBrandingSettings(input: BrandingSettings, actor: AdminActor) {
  const before = await getBrandingSettings();
  const next = sanitizeBrandingSettings(input);

  await writeSetting('branding', next, actor);
  await recordAdminAudit({
    classification: 'Administrativa',
    entityType: 'branding-settings',
    entityId: 'branding',
    action: 'update',
    actorId: actor.id,
    actorName: actor.name,
    detail: 'Se actualizó la identidad visual operativa de la plataforma.',
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(next),
  });
  await recordAdminLog({
    category: 'Administración',
    module: 'Gobierno',
    service: 'Branding',
    severity: 'Success',
    event: 'branding_updated',
    result: 'ok',
    detail: 'Se guardaron nombre visible, marca corta, colores y estilo de superficies.',
    userId: actor.id,
    userName: actor.name,
  });

  return next;
}

export async function updateExperienceSettings(input: ExperienceSettings, actor: AdminActor) {
  const before = await getExperienceSettings();
  const next = sanitizeExperienceSettings(input);

  await writeSetting('experience', next, actor);
  await recordAdminAudit({
    classification: 'Funcional',
    entityType: 'experience-settings',
    entityId: 'experience',
    action: 'update',
    actorId: actor.id,
    actorName: actor.name,
    detail: 'Se actualizaron las reglas de foco visual, rail y layout de trabajo.',
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(next),
  });
  await recordAdminLog({
    category: 'Administración',
    module: 'Gobierno',
    service: 'Experiencia',
    severity: 'Success',
    event: 'experience_settings_updated',
    result: 'ok',
    detail: 'Se guardaron modo de estudio, visibilidad del rail y layout de perfil.',
    userId: actor.id,
    userName: actor.name,
  });

  return next;
}

export async function updateHomeContentSettings(input: HomeContentSettings, actor: AdminActor) {
  const before = await getHomeContentSettings();
  const next = sanitizeHomeContentSettings(input);

  await writeSetting('home-content', next, actor);
  await recordAdminAudit({
    classification: 'Funcional',
    entityType: 'home-content-settings',
    entityId: 'home-content',
    action: 'update',
    actorId: actor.id,
    actorName: actor.name,
    detail: 'Se actualizó el contenido editable del home público.',
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(next),
  });
  await recordAdminLog({
    category: 'Administración',
    module: 'Gobierno',
    service: 'Home público',
    severity: 'Success',
    event: 'home_content_updated',
    result: 'ok',
    detail: 'Se guardaron los textos del home público desde el editor frontal.',
    userId: actor.id,
    userName: actor.name,
  });

  return next;
}

export async function updateWorkflowSettings(input: WorkflowSettings, actor: AdminActor) {
  const before = await getWorkflowSettings();
  const next = sanitizeWorkflowSettings(input);

  await writeSetting('workflow', next, actor);
  await recordAdminAudit({
    classification: 'Funcional',
    entityType: 'workflow-settings',
    entityId: 'workflow',
    action: 'update',
    actorId: actor.id,
    actorName: actor.name,
    detail: 'Se actualizaron reglas de handoff y visibilidad del workflow.',
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(next),
  });
  await recordAdminLog({
    category: 'Administración',
    module: 'Gobierno',
    service: 'Workflow',
    severity: 'Success',
    event: 'workflow_settings_updated',
    result: 'ok',
    detail: 'Se guardaron controles de handoff, tarjetas de etapas y acceso rápido.',
    userId: actor.id,
    userName: actor.name,
  });

  return next;
}

export async function updateIntegrationSettings(
  input: AdminIntegrationMutationInput,
  actor: AdminActor,
) {
  const current = await readIntegrationRowById(input.id);

  if (!current) {
    throw new Error('Integración no encontrada.');
  }

  const nextConfig = sanitizeSensitiveIntegrationConfig(
    input.id,
    Object.fromEntries(
      Object.entries(input.config).map(([key, value]) => [key, value.trim()]),
    ),
  );
  const nextScopes = uniqueValues(input.scopes);
  const nextStatus: AdminIntegrationStatus = input.enabled ? 'Pendiente' : 'Inactiva';
  const sql = getSql();
  const timestamp = new Date().toISOString();

  await sql`
    UPDATE maturity_admin_integrations
    SET
      enabled = ${input.enabled},
      status = ${nextStatus},
      scopes = ${JSON.stringify(nextScopes)}::jsonb,
      config = ${JSON.stringify(nextConfig)}::jsonb,
      notes = ${input.notes.trim()},
      fallback_to = ${input.fallbackTo.trim()},
      last_test_at = ${null},
      last_error = ${null},
      updated_at = ${timestamp}
    WHERE id = ${input.id}
  `;

  await recordAdminAudit({
    classification: 'Técnica',
    entityType: 'integration',
    entityId: input.id,
    action: 'update',
    actorId: actor.id,
    actorName: actor.name,
    detail: `Se actualizó la configuración de ${current.name}.`,
    beforeValue: JSON.stringify(serializeIntegrationRow(current)),
    afterValue: JSON.stringify({
      ...serializeIntegrationRow({
        ...current,
        enabled: input.enabled,
        status: nextStatus,
        scopes: nextScopes,
        config: nextConfig,
        notes: input.notes.trim(),
        fallbackTo: input.fallbackTo.trim(),
        lastTestAt: null,
        lastError: null,
        updatedAt: timestamp,
      }),
    }),
  });
  await recordAdminLog({
    category: 'Integración',
    module: 'Gobierno',
    service: current.name,
    severity: 'Success',
    event: 'integration_updated',
    result: 'ok',
    detail: `Configuración guardada para ${current.provider}.`,
    userId: actor.id,
    userName: actor.name,
  });

  const refreshed = await readIntegrationRowById(input.id);
  if (!refreshed) {
    throw new Error('No fue posible releer la integración actualizada.');
  }

  return serializeIntegrationRow(refreshed);
}

export async function runIntegrationConnectivityTest(id: string, actor: AdminActor) {
  const current = await readIntegrationRowById(id);

  if (!current) {
    throw new Error('Integración no encontrada.');
  }

  const serialized = serializeIntegrationRow(current);
  let status: AdminIntegrationStatus = serialized.enabled ? 'En prueba' : 'Inactiva';
  let detail = serialized.runtimeSummary;
  let lastError: string | null = null;
  const sql = getSql();
  const timestamp = new Date().toISOString();

  if (!serialized.enabled) {
    detail = 'La integración está inactiva. Actívala antes de ejecutar pruebas.';
    status = 'Inactiva';
  } else if (!serialized.envReady) {
    detail = `La validación falló: ${serialized.runtimeSummary}`;
    status = 'Con error';
    lastError = serialized.runtimeSummary;
  } else {
    try {
      let result: IntegrationTestResult;

      switch (id) {
        case 'neon-database': {
          const db = getSql();
          await db`SELECT 1`;
          result = {
            status: 'Activa',
            detail: 'Neon respondió correctamente a una consulta de disponibilidad.',
            lastError: null,
          };
          break;
        }
        case 'vercel-runtime':
          result = await verifyVercelRuntime(serialized.config);
          break;
        case 'cloudflare-r2':
          result = {
            status: 'Activa',
            detail: await probeR2Connectivity(serialized.config),
            lastError: null,
          };
          break;
        case 'openai':
          result = await verifyOpenAI(serialized.config);
          break;
        case 'gemini':
          result = await verifyGemini(serialized.config);
          break;
        case 'youtube-data-api':
          result = await verifyYoutube(serialized.config);
          break;
        case 'openalex':
          result = await verifyOpenAlex(serialized.config);
          break;
        case 'arxiv':
          result = await verifyArxiv(serialized.config);
          break;
        case 'semantic-scholar':
          result = await verifySemanticScholar(serialized.config);
          break;
        case 'scielo':
          result = await verifySciELO(serialized.config);
          break;
        case 'redalyc':
          result = await verifyRedalyc(serialized.config);
          break;
        case 'oer-commons':
          result = await verifyOerCommons(serialized.config);
          break;
        case 'phet':
          result = await verifyPhET(serialized.config);
          break;
        case 'core':
          result = await verifyCore(serialized.config);
          break;
        case 'academic-databases':
          result = await verifyAcademicDatabase(serialized.config);
          break;
        case 'google-sso':
        case 'google-calendar':
        case 'google-meet':
          result = await verifyGoogleConfiguration(id, serialized.config);
          break;
        default:
          result = {
            status: 'Pendiente',
            detail: `La integración ${serialized.name} aún no tiene una prueba operativa automatizada.`,
            lastError: null,
          };
          break;
      }

      status = result.status;
      detail = result.detail;
      lastError = result.lastError;
    } catch (error) {
      status = 'Con error';
      lastError = error instanceof Error ? error.message : 'integration_test_failed';
      detail = `La validación de ${serialized.name} falló: ${lastError}`;
    }
  }

  await sql`
    UPDATE maturity_admin_integrations
    SET
      status = ${status},
      last_test_at = ${timestamp},
      last_error = ${lastError},
      updated_at = ${timestamp}
    WHERE id = ${id}
  `;

  await recordAdminLog({
    category: 'Integración',
    module: 'Gobierno',
    service: current.name,
    severity: status === 'Activa' ? 'Success' : status === 'Con error' ? 'Error' : 'Warning',
    event: 'integration_test',
    result: status === 'Activa' ? 'ok' : status === 'Pendiente' ? 'pending' : 'failed',
    detail,
    userId: actor.id,
    userName: actor.name,
  });
  await recordAdminAudit({
    classification: 'Técnica',
    entityType: 'integration',
    entityId: id,
    action: 'test',
    actorId: actor.id,
    actorName: actor.name,
    detail,
    beforeValue: JSON.stringify(serialized),
    afterValue: JSON.stringify({
      ...serialized,
      status,
      lastTestAt: timestamp,
      lastError,
    }),
  });

  const refreshed = await readIntegrationRowById(id);
  if (!refreshed) {
    throw new Error('No fue posible releer la integración probada.');
  }

  return serializeIntegrationRow(refreshed);
}

export async function recordAuthenticationLog(input: {
  event: string;
  result: string;
  detail: string;
  severity?: AdminLogSeverity;
  user?: Pick<AuthUser, 'id' | 'name'> | null;
}) {
  await recordAdminLog({
    category: 'Autenticación',
    module: 'Acceso',
    service: 'Session',
    severity: input.severity ?? (input.result === 'ok' ? 'Success' : 'Warning'),
    event: input.event,
    result: input.result,
    detail: input.detail,
    userId: input.user?.id ?? null,
    userName: input.user?.name ?? null,
  });
}

export async function recordAdministrativeUserAudit(input: {
  action: string;
  actor: AdminActor;
  detail: string;
  entityId: string;
  beforeValue?: string | null;
  afterValue?: string | null;
}) {
  await recordAdminAudit({
    classification: 'Administrativa',
    entityType: 'user',
    entityId: input.entityId,
    action: input.action,
    actorId: input.actor.id,
    actorName: input.actor.name,
    detail: input.detail,
    beforeValue: input.beforeValue ?? null,
    afterValue: input.afterValue ?? null,
  });
}

export async function getAccessibleRoleMatrix() {
  const users = await getUserDirectory();
  const roleCounts = new Map<Role, number>();

  for (const user of users) {
    roleCounts.set(user.role, (roleCounts.get(user.role) ?? 0) + 1);
    for (const role of user.secondaryRoles ?? []) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
  }

  return Array.from(roleCounts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((left, right) => left.role.localeCompare(right.role, 'es'));
}
