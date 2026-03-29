import { AwsClient } from 'aws4fetch';

const DEFAULT_R2_BASE_PATH = 'maturity';

export type UploadScope = 'branding' | 'course' | 'library' | 'profile' | 'general';

interface R2Overrides {
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2BasePath?: string;
  basePath?: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  basePath: string;
}

interface UploadToR2Options {
  scope: UploadScope;
  folder?: string;
  fileName: string;
  contentType?: string;
  body: BodyInit | null;
}

interface UploadToR2Result {
  key: string;
  url: string;
}

function cleanValue(value?: string | null) {
  return value?.trim() ?? '';
}

function normalizeBasePath(value?: string | null) {
  return cleanValue(value)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function normalizeObjectKey(value: string) {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function sanitizeSegment(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  return normalized || 'archivo';
}

function encodeObjectKey(key: string) {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getScopePrefix(scope: UploadScope) {
  switch (scope) {
    case 'branding':
      return 'public/branding';
    case 'course':
      return 'private/course';
    case 'library':
      return 'private/library';
    case 'profile':
      return 'private/profile';
    default:
      return 'private/general';
  }
}

function toR2Overrides(config: R2Config): R2Overrides {
  return {
    r2AccountId: config.accountId,
    r2AccessKeyId: config.accessKeyId,
    r2SecretAccessKey: config.secretAccessKey,
    r2BucketName: config.bucketName,
    r2BasePath: config.basePath,
  };
}

export function resolveR2Config(overrides: R2Overrides = {}): R2Config {
  const accountId = cleanValue(overrides.r2AccountId) || cleanValue(process.env.R2_ACCOUNT_ID);
  const accessKeyId =
    cleanValue(overrides.r2AccessKeyId) || cleanValue(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey =
    cleanValue(overrides.r2SecretAccessKey) || cleanValue(process.env.R2_SECRET_ACCESS_KEY);
  const bucketName =
    cleanValue(overrides.r2BucketName) || cleanValue(process.env.R2_BUCKET_NAME);
  const basePath = normalizeBasePath(
    overrides.r2BasePath || overrides.basePath || process.env.R2_BASE_PATH || DEFAULT_R2_BASE_PATH,
  );

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('La configuración de Cloudflare R2 está incompleta.');
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    basePath: basePath || DEFAULT_R2_BASE_PATH,
  };
}

function createR2Client(config: R2Config) {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
}

function buildR2Url(config: R2Config, key: string) {
  return `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucketName)}/${encodeObjectKey(key)}`;
}

function buildObjectKey(config: R2Config, scope: UploadScope, folder: string | undefined, fileName: string) {
  const extensionIndex = fileName.lastIndexOf('.');
  const extension =
    extensionIndex >= 0 ? sanitizeSegment(fileName.slice(extensionIndex + 1)).toLowerCase() : '';
  const baseName =
    extensionIndex >= 0 ? fileName.slice(0, extensionIndex) : fileName;
  const safeName = sanitizeSegment(baseName).slice(0, 80) || 'archivo';
  const safeFolder = folder ? sanitizeSegment(folder) : '';
  const pathParts = [
    config.basePath,
    getScopePrefix(scope),
    safeFolder,
    `${Date.now()}-${crypto.randomUUID()}-${safeName}${extension ? `.${extension}` : ''}`,
  ].filter(Boolean);

  return normalizeObjectKey(pathParts.join('/'));
}

export function buildR2FileUrl(key: string) {
  return `/api/files?key=${encodeURIComponent(normalizeObjectKey(key))}`;
}

export function isPublicR2Key(key: string) {
  const normalized = normalizeObjectKey(key);
  return normalized.startsWith('public/') || normalized.includes('/public/');
}

export async function uploadToR2(
  options: UploadToR2Options,
  overrides: R2Overrides = {},
): Promise<UploadToR2Result> {
  const config = resolveR2Config(overrides);
  const client = createR2Client(config);
  const key = buildObjectKey(config, options.scope, options.folder, options.fileName);
  const response = await client.fetch(buildR2Url(config, key), {
    method: 'PUT',
    body: options.body,
    headers: {
      'content-type': options.contentType || 'application/octet-stream',
      'cache-control':
        options.scope === 'branding'
          ? 'public, max-age=31536000, immutable'
          : 'private, max-age=0, no-store',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`R2 rechazó la carga (${response.status}): ${detail || 'upload_failed'}`);
  }

  return {
    key,
    url: buildR2FileUrl(key),
  };
}

export async function getR2Object(
  key: string,
  overrides: R2Overrides = {},
) {
  const config = resolveR2Config(overrides);
  const client = createR2Client(config);
  return client.fetch(buildR2Url(config, normalizeObjectKey(key)), {
    method: 'GET',
  });
}

export async function deleteR2Object(
  key: string,
  overrides: R2Overrides = {},
) {
  const config = resolveR2Config(overrides);
  const client = createR2Client(config);
  return client.fetch(buildR2Url(config, normalizeObjectKey(key)), {
    method: 'DELETE',
  });
}

export async function probeR2Connectivity(overrides: R2Overrides = {}) {
  const config = resolveR2Config(overrides);
  const probeBody = `probe:${new Date().toISOString()}:${crypto.randomUUID()}`;
  const upload = await uploadToR2(
    {
      scope: 'branding',
      folder: 'health',
      fileName: 'probe.txt',
      contentType: 'text/plain; charset=utf-8',
      body: probeBody,
    },
    toR2Overrides(config),
  );

  try {
    const response = await getR2Object(upload.key, toR2Overrides(config));

    if (!response.ok) {
      throw new Error(`R2 no permitió releer el archivo de prueba (${response.status}).`);
    }

    const content = await response.text();

    if (content !== probeBody) {
      throw new Error('R2 devolvió un contenido distinto al archivo cargado.');
    }
  } finally {
    await deleteR2Object(upload.key, toR2Overrides(config));
  }

  return `Cloudflare R2 respondió correctamente en el bucket ${config.bucketName}.`;
}
