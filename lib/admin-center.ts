import { defaultBranding, mockAppData } from '../src/data/mockData.js';
import type {
  AdminAuditClassification,
  AdminAuditEntry,
  AdminCenterData,
  AdminIntegration,
  AdminIntegrationCategory,
  AdminIntegrationMutationInput,
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
    faviconLabel: input.faviconLabel.trim().slice(0, 2) || defaultBranding.faviconLabel,
    primaryColor: input.primaryColor.trim() || defaultBranding.primaryColor,
    accentColor: input.accentColor.trim() || defaultBranding.accentColor,
    surfaceStyle: input.surfaceStyle.trim() || defaultBranding.surfaceStyle,
    supportUrl: input.supportUrl.trim() || defaultBranding.supportUrl,
  };
}

type IntegrationPreset = Omit<AdminIntegration, 'envReady' | 'runtimeSummary' | 'status'> & {
  status: AdminIntegrationStatus;
};

const defaultIntegrationPresets: IntegrationPreset[] = [
  {
    id: 'outbound-mail',
    name: 'Correo saliente',
    category: 'Correo',
    provider: 'SMTP / Resend',
    description: 'Notificaciones transaccionales, activaciones de cuenta y alertas del flujo.',
    enabled: true,
    status: 'Pendiente',
    requiredEnvKeys: ['RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
    scopes: ['Activación de cuenta', 'Recuperación de contraseña', 'Alertas operativas'],
    config: {
      senderName: 'Maturity',
      senderEmail: `no-reply@${inferDefaultDomain()}`,
      senderDomain: inferDefaultDomain(),
      templateFamily: 'Operación Maturity',
    },
    lastTestAt: null,
    lastError: null,
    notes: 'Las credenciales viven en runtime; aquí solo se ajusta la operación visible.',
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
      calendarName: 'Producción académica',
      syncMode: 'Hitos y reuniones',
      timezone: 'America/Bogota',
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
      attachTo: 'Hitos del flujo',
      allowCreation: 'Sí',
      visibility: 'Equipo del curso',
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
      allowedModules: 'Curación, Multimedia',
      defaultRegion: 'CO',
      safeSearch: 'Moderado',
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
  summary: string;
} {
  const present = (keys: string[]) => keys.filter((key) => Boolean(process.env[key]?.trim()));

  switch (integrationId) {
    case 'outbound-mail': {
      const smtpKeys = present(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']);
      const resendKeys = present(['RESEND_API_KEY']);
      const ready = smtpKeys.length === 4 || resendKeys.length === 1;
      const summary = ready
        ? smtpKeys.length === 4
          ? 'SMTP completo detectado en runtime.'
          : 'Proveedor transaccional detectado por API key en runtime.'
        : 'Faltan variables para SMTP o proveedor transaccional.';
      return { ready, summary };
    }
    case 'openai': {
      const ready = Boolean(process.env.OPENAI_API_KEY?.trim());
      return {
        ready,
        summary: ready
          ? `OpenAI habilitado para ${config.allowedModules || 'los módulos configurados'}.`
          : 'OPENAI_API_KEY no está disponible en runtime.',
      };
    }
    case 'gemini': {
      const ready = Boolean(
        process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
      );
      return {
        ready,
        summary: ready
          ? `Gemini disponible para ${config.allowedModules || 'los módulos configurados'}.`
          : 'No se detectó credencial de Gemini en runtime.',
      };
    }
    case 'academic-databases': {
      const ready = Boolean(process.env.ACADEMIC_DATABASE_ENDPOINT?.trim() || config.endpoint?.trim());
      return {
        ready,
        summary: ready
          ? `Fuente académica lista desde ${config.endpoint || 'runtime configurado'}.`
          : 'No hay endpoint académico configurado.',
      };
    }
    case 'google-sso':
    case 'google-calendar':
    case 'google-meet': {
      const ready = Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
      );
      return {
        ready,
        summary: ready
          ? 'Credenciales Google detectadas en runtime.'
          : 'Faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET.',
      };
    }
    case 'cloudflare-r2': {
      const ready = Boolean(
        process.env.R2_ACCOUNT_ID?.trim() &&
          process.env.R2_ACCESS_KEY_ID?.trim() &&
          process.env.R2_SECRET_ACCESS_KEY?.trim() &&
          process.env.R2_BUCKET_NAME?.trim(),
      );
      return {
        ready,
        summary: ready
          ? `R2 listo sobre bucket ${process.env.R2_BUCKET_NAME}.`
          : 'Faltan variables de Cloudflare R2 para operar almacenamiento.',
      };
    }
    case 'youtube-data-api': {
      const ready = Boolean(process.env.YOUTUBE_API_KEY?.trim());
      return {
        ready,
        summary: ready
          ? 'YouTube Data API lista para consultas de curación.'
          : 'YOUTUBE_API_KEY no está disponible en runtime.',
      };
    }
    case 'neon-database': {
      const ready = Boolean(process.env.DATABASE_URL?.trim());
      return {
        ready,
        summary: ready
          ? 'DATABASE_URL detectada; lista para validación operativa.'
          : 'DATABASE_URL no está configurada.',
      };
    }
    case 'vercel-runtime': {
      const ready = Boolean(process.env.VERCEL_URL?.trim() || process.env.VERCEL_ENV?.trim());
      return {
        ready,
        summary: ready
          ? `Runtime ${process.env.VERCEL_ENV || 'desconocido'} para proyecto ${process.env.VERCEL_GIT_REPO_SLUG || config.project || 'maturity'}.`
          : 'No se detectaron variables de Vercel en runtime.',
      };
    }
    default:
      return {
        ready: false,
        summary: 'No hay diagnóstico definido para esta integración.',
      };
  }
}

function serializeIntegrationRow(row: AdminIntegrationRow): AdminIntegration {
  const preset = integrationPresetMap[row.id];
  const config = parseJson<Record<string, string>>(row.config);
  const scopes = parseJson<string[]>(row.scopes);
  const runtime = evaluateIntegrationRuntime(row.id, config);

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider,
    description: row.description,
    enabled: row.enabled,
    status: !row.enabled
      ? 'Inactiva'
      : runtime.ready
        ? row.status === 'Inactiva'
          ? 'Pendiente'
          : row.status
        : row.lastError
          ? 'Con error'
          : 'Pendiente',
    requiredEnvKeys: preset?.requiredEnvKeys ?? [],
    envReady: runtime.ready,
    runtimeSummary: runtime.summary,
    scopes,
    config,
    lastTestAt: row.lastTestAt,
    lastError: row.lastError,
    notes: row.notes,
    fallbackTo: row.fallbackTo,
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
  let status: AdminIntegrationStatus = current.enabled ? 'En prueba' : 'Inactiva';
  let detail = serialized.runtimeSummary;
  let lastError: string | null = null;
  const sql = getSql();
  const timestamp = new Date().toISOString();

  if (!current.enabled) {
    detail = 'La integración está inactiva. Actívala antes de ejecutar pruebas.';
    status = 'Inactiva';
  } else if (!serialized.envReady) {
    detail = `La validación falló: ${serialized.runtimeSummary}`;
    status = 'Con error';
    lastError = serialized.runtimeSummary;
  } else if (id === 'neon-database') {
    try {
      const db = getSql();
      await db`SELECT 1`;
      status = 'Activa';
      detail = 'Neon respondió correctamente a una consulta de disponibilidad.';
    } catch (error) {
      status = 'Con error';
      lastError = error instanceof Error ? error.message : 'database_test_failed';
      detail = `La validación de Neon falló: ${lastError}`;
    }
  } else if (id === 'vercel-runtime') {
    status = 'Activa';
    detail = serialized.runtimeSummary;
  } else {
    status = 'Activa';
    detail = `Validación de runtime completada: ${serialized.runtimeSummary}`;
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
    severity: status === 'Activa' ? 'Success' : 'Warning',
    event: 'integration_test',
    result: status === 'Activa' ? 'ok' : 'failed',
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
