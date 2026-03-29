import { defaultBranding, mockAppData } from '../src/data/mockData.js';
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
  InstitutionSettings,
  Role,
} from '../src/types.js';
import { getSql } from './db.js';
import { probeR2Connectivity } from './r2.js';
import { getUserDirectory, prepareDatabase } from './store.js';

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
  const domain = envEmail.includes('@') ? envEmail.split('@').at(-1) ?? '' : '';
  return domain || 'maturity360.co';
}

function buildDefaultInstitutionSettings(): InstitutionSettings {
  return {
    displayName: 'Maturity University',
    institutions: uniqueValues(
      mockAppData.courses.map((course) => course.metadata.institution || 'Maturity University'),
    ),
    faculties: uniqueValues(mockAppData.courses.map((course) => course.faculty)),
    programs: uniqueValues(mockAppData.courses.map((course) => course.program)),
    academicPeriods: uniqueValues(
      mockAppData.courses.map((course) => course.metadata.academicPeriod || '2026-1'),
    ),
    courseTypes: uniqueValues(
      mockAppData.courses.map((course) => course.metadata.courseType || 'Curso'),
    ),
    supportEmail: `soporte@${inferDefaultDomain()}`,
    defaultDomain: inferDefaultDomain(),
    defaultUserState: 'Pendiente',
    allowAutoProvisioning: false,
  };
}

function sanitizeInstitutionSettings(input: InstitutionSettings): InstitutionSettings {
  return {
    displayName: input.displayName.trim() || 'Maturity University',
    institutions: uniqueValues(input.institutions),
    faculties: uniqueValues(input.faculties),
    programs: uniqueValues(input.programs),
    academicPeriods: uniqueValues(input.academicPeriods),
    courseTypes: uniqueValues(input.courseTypes),
    supportEmail: input.supportEmail.trim().toLowerCase(),
    defaultDomain: input.defaultDomain.trim().toLowerCase(),
    defaultUserState: input.defaultUserState,
    allowAutoProvisioning: Boolean(input.allowAutoProvisioning),
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
  return cleanSecretCandidate(config[configKey || '']) || cleanSecretCandidate(process.env[envKey]);
}

function cleanSecretCandidate(value?: string | null) {
  return value?.trim() ?? '';
}

async function readResponseText(response: Response) {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

async function verifyOpenAI(config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey = getIntegrationConfigValue(config, 'OPENAI_API_KEY', 'openaiApiKey');

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'La integración de OpenAI no tiene API Key disponible.',
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

async function verifyGemini(config: Record<string, string>): Promise<IntegrationTestResult> {
  const apiKey =
    getIntegrationConfigValue(config, 'GEMINI_API_KEY', 'geminiApiKey') ||
    getIntegrationConfigValue(config, 'GOOGLE_GENERATIVE_AI_API_KEY', 'geminiApiKey');

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'La integración de Gemini no tiene API Key disponible.',
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
  const apiKey = getIntegrationConfigValue(config, 'YOUTUBE_API_KEY', 'youtubeApiKey');

  if (!apiKey) {
    return {
      status: 'Con error',
      detail: 'La integración de YouTube no tiene API Key disponible.',
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
  await prepareDatabase();
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
}

async function seedAdminCenterDefaults() {
  await ensureAdminCenterSchema();
  const sql = getSql();
  const timestamp = new Date().toISOString();
  const institution = buildDefaultInstitutionSettings();

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
      const key = getVal('OPENAI_API_KEY', 'openaiApiKey');
      const ready = Boolean(key);
      return {
        ready,
        source: config.openaiApiKey ? 'governance' : ready ? 'runtime' : 'none',
        summary: ready
          ? `OpenAI listo (${config.defaultModel || 'modelo por defecto'}).`
          : 'Falta OPENAI_API_KEY.',
      };
    }
    case 'gemini': {
      const key = getVal('GEMINI_API_KEY', 'geminiApiKey') || getVal('GOOGLE_GENERATIVE_AI_API_KEY', 'geminiApiKey');
      const ready = Boolean(key);
      return {
        ready,
        source: config.geminiApiKey ? 'governance' : ready ? 'runtime' : 'none',
        summary: ready
          ? `Gemini listo (${config.defaultModel || 'flash'}).`
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
      const ready = Boolean(getVal('YOUTUBE_API_KEY', 'youtubeApiKey'));
      const source: AdminIntegrationSource = config.youtubeApiKey?.trim()
        ? 'governance'
        : ready
          ? 'runtime'
          : 'none';
      return {
        ready,
        source,
        summary: ready
          ? `YouTube Data API lista desde ${source === 'governance' ? 'Gobierno' : 'runtime'}.`
          : 'Falta YouTube API Key en runtime o en configuración guardada.',
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
  const config = parseJson<Record<string, string>>(row.config);
  const scopes = parseJson<string[]>(row.scopes);
  const runtime = evaluateIntegrationRuntime(row.id, config);
  const effectiveEnabled = row.enabled;
  const effectiveStatus: AdminIntegrationStatus = !effectiveEnabled
    ? 'Inactiva'
    : row.status === 'En prueba'
      ? 'En prueba'
      : row.status === 'Con error' || (row.lastTestAt && row.lastError)
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

  return rows.map(serializeIntegrationRow);
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

export async function getInstitutionSettings() {
  const settings = await readSetting<InstitutionSettings>(
    'institution',
    buildDefaultInstitutionSettings(),
  );
  return sanitizeInstitutionSettings(settings);
}

export async function getAdminCenterData(): Promise<AdminCenterData> {
  await seedAdminCenterDefaults();

  const [users, institution, branding, integrations, logs, audit] = await Promise.all([
    getUserDirectory(),
    getInstitutionSettings(),
    getBrandingSettings(),
    readIntegrations(),
    readLogs(),
    readAudit(),
  ]);

  return {
    users,
    institution,
    branding,
    integrations,
    logs,
    audit,
  };
}

export async function updateInstitutionSettings(input: InstitutionSettings, actor: AdminActor) {
  const before = await getInstitutionSettings();
  const next = sanitizeInstitutionSettings(input);

  await writeSetting('institution', next, actor);
  await recordAdminAudit({
    classification: 'Administrativa',
    entityType: 'institution-settings',
    entityId: 'institution',
    action: 'update',
    actorId: actor.id,
    actorName: actor.name,
    detail: 'Se actualizaron parámetros institucionales y catálogos operativos.',
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(next),
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

  return next;
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

export async function updateIntegrationSettings(
  input: AdminIntegrationMutationInput,
  actor: AdminActor,
) {
  const current = await readIntegrationRowById(input.id);

  if (!current) {
    throw new Error('Integración no encontrada.');
  }

  const nextConfig = Object.fromEntries(
    Object.entries(input.config).map(([key, value]) => [key, value.trim()]),
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
