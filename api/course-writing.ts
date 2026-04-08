import OpenAI from 'openai';
import { getIntegrationConfig } from '../lib/admin-center.js';
import { extractTextFromBuffer } from '../lib/document-text.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { canManageCourses } from '../lib/permissions.js';
import { getR2Object } from '../lib/r2.js';
import { getSessionUser } from '../lib/session.js';
import {
  findCourseProductById,
  findCourseRecordBySlug,
  findLibraryResourceById,
  updateCourseProductRecord,
} from '../lib/store.js';
import type {
  CourseProduct,
  ProductWritingAsset,
  ProductWritingData,
  ProductWritingSection,
} from '../src/types.js';

export const config = {
  runtime: 'nodejs',
};

type WritingAction = 'save' | 'extract-upload' | 'generate-section';

interface WritingPayload {
  action: WritingAction;
  courseSlug?: string;
  productId?: string;
  writingData?: ProductWritingData;
  asset?: ProductWritingAsset;
  extractedTextOverride?: string;
  assetContentBase64?: string;
  libraryResourceIds?: string[];
  sectionId?: string;
  sectionTitle?: string;
  sectionInstructions?: string;
  supportAssets?: ProductWritingAsset[];
  aiPrompt?: string;
}

function canEditWritingProduct(user: Awaited<ReturnType<typeof getSessionUser>>, product: CourseProduct) {
  if (!user) {
    return false;
  }

  if (canManageCourses(user.role)) {
    return true;
  }

  if (user.role !== 'Experto') {
    return false;
  }

  const writingPhase = product.phasePlan.find((phase) => phase.phase === 'escritura');
  return writingPhase?.assigneeId === user.id;
}

const writingSectionTemplatesByFormat: Record<string, string[]> = {
  video: ['Título', 'Inicio o introducción', 'Desarrollo', 'Cierre'],
  documento: ['Título', 'Introducción', 'Desarrollo', 'Conclusiones', 'Bibliografía'],
  evaluacion: ['Título', 'Instrucciones', 'Preguntas', 'Retroalimentación'],
  actividad: ['Título', 'Contexto', 'Instrucciones', 'Entregable esperado', 'Criterios de evaluación'],
  lectura: ['Título', 'Introducción', 'Desarrollo', 'Conclusiones', 'Bibliografía'],
  infografia: ['Título', 'Mensaje central', 'Desarrollo visual', 'Cierre', 'Fuentes'],
  podcast: ['Título', 'Apertura', 'Desarrollo', 'Cierre'],
  guia: ['Título', 'Introducción', 'Desarrollo', 'Cierre', 'Bibliografía'],
};

const DEFAULT_EXTRACTION_TIMEOUT_MS = 55000;
const DEFAULT_SYNC_EXTRACTION_MAX_BYTES = 24 * 1024 * 1024;
const DEFAULT_WRITING_AI_TIMEOUT_MS = 18000;
const DEFAULT_WRITING_AI_CONTEXT_CHARS = 9000;
const DEFAULT_WRITING_AI_ASSET_READ_TIMEOUT_MS = 8000;
const DEFAULT_WRITING_AI_MAX_SUPPORT_ASSETS = 3;
const DEFAULT_WRITING_AI_MAX_LIBRARY_RESOURCES = 8;

function resolveExtractionTimeoutMs() {
  const configured = Number(process.env.WRITING_EXTRACTION_TIMEOUT_MS ?? DEFAULT_EXTRACTION_TIMEOUT_MS);
  if (!Number.isFinite(configured)) {
    return DEFAULT_EXTRACTION_TIMEOUT_MS;
  }
  return Math.max(5000, Math.min(90000, Math.trunc(configured)));
}

function resolveSyncExtractionMaxBytes() {
  const configured = Number(process.env.WRITING_SYNC_EXTRACT_MAX_BYTES ?? DEFAULT_SYNC_EXTRACTION_MAX_BYTES);
  if (!Number.isFinite(configured)) {
    return DEFAULT_SYNC_EXTRACTION_MAX_BYTES;
  }
  return Math.max(2 * 1024 * 1024, Math.min(40 * 1024 * 1024, Math.trunc(configured)));
}

function resolveWritingAiTimeoutMs() {
  const configured = Number(process.env.WRITING_AI_TIMEOUT_MS ?? DEFAULT_WRITING_AI_TIMEOUT_MS);
  if (!Number.isFinite(configured)) {
    return DEFAULT_WRITING_AI_TIMEOUT_MS;
  }
  return Math.max(10000, Math.min(90000, Math.trunc(configured)));
}

function resolveWritingAiContextChars() {
  const configured = Number(process.env.WRITING_AI_CONTEXT_CHARS ?? DEFAULT_WRITING_AI_CONTEXT_CHARS);
  if (!Number.isFinite(configured)) {
    return DEFAULT_WRITING_AI_CONTEXT_CHARS;
  }
  return Math.max(4000, Math.min(28000, Math.trunc(configured)));
}

function resolveWritingAiAssetReadTimeoutMs() {
  const configured = Number(
    process.env.WRITING_AI_ASSET_READ_TIMEOUT_MS ?? DEFAULT_WRITING_AI_ASSET_READ_TIMEOUT_MS,
  );
  if (!Number.isFinite(configured)) {
    return DEFAULT_WRITING_AI_ASSET_READ_TIMEOUT_MS;
  }
  return Math.max(3000, Math.min(15000, Math.trunc(configured)));
}

function resolveWritingAiMaxSupportAssets() {
  const configured = Number(
    process.env.WRITING_AI_MAX_SUPPORT_ASSETS ?? DEFAULT_WRITING_AI_MAX_SUPPORT_ASSETS,
  );
  if (!Number.isFinite(configured)) {
    return DEFAULT_WRITING_AI_MAX_SUPPORT_ASSETS;
  }
  return Math.max(0, Math.min(6, Math.trunc(configured)));
}

function resolveWritingAiMaxLibraryResources() {
  const configured = Number(
    process.env.WRITING_AI_MAX_LIBRARY_RESOURCES ?? DEFAULT_WRITING_AI_MAX_LIBRARY_RESOURCES,
  );
  if (!Number.isFinite(configured)) {
    return DEFAULT_WRITING_AI_MAX_LIBRARY_RESOURCES;
  }
  return Math.max(0, Math.min(12, Math.trunc(configured)));
}

class ExtractionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ExtractionTimeoutError(message));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeWritingTemplateKey(format: string) {
  return format
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function slugifyWritingSectionTitle(title: string) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(p|div|li|ul|ol|blockquote|h[1-6]|section)>/giu, '\n')
    .replace(/<li>/giu, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizePlainTextToHtml(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function inferWritingSectionTitlesFromText(text: string, format: string) {
  const plain = stripHtml(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const foundTitles: string[] = [];
  const seen = new Set<string>();
  const knownHeadings = [
    'titulo',
    'introduccion',
    'inicio',
    'apertura',
    'desarrollo',
    'cierre',
    'conclusiones',
    'bibliografia',
    'fuentes',
    'preguntas',
    'retroalimentacion',
    'contexto',
    'instrucciones',
    'entregable esperado',
    'criterios de evaluacion',
    'mensaje central',
    'desarrollo visual',
  ];

  plain.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const headingMatch = line.match(/^(?:\d+[\).\s-]+)?([A-ZÁÉÍÓÚÑ][^:]{2,80})(?::|\s*$)/u);
    if (!headingMatch) {
      return;
    }

    const normalized = headingMatch[1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!knownHeadings.some((keyword) => normalized.includes(keyword))) {
      return;
    }

    const title = headingMatch[1].trim();
    const key = slugifyWritingSectionTitle(title);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    foundTitles.push(title);
  });

  if (foundTitles.length > 1) {
    return foundTitles;
  }

  return (
    writingSectionTemplatesByFormat[normalizeWritingTemplateKey(format)] ?? [
      'Título',
      'Introducción',
      'Desarrollo',
      'Cierre',
    ]
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWritingSectionsFromTemplate(titles: string[], instructionHtml: string) {
  const plainInstructionText = stripHtml(instructionHtml)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  return titles.map((title, index) => {
    const headingPattern = new RegExp(
      `(?:^|\\n)(?:\\d+[.)\\s-]+)?${escapeRegex(title)}:?\\s*([\\s\\S]*?)(?=(?:\\n(?:\\d+[.)\\s-]+)?(?:${titles
        .filter((candidate) => candidate !== title)
        .map((candidate) => escapeRegex(candidate))
        .join('|')}):?\\s*)|$)`,
      'i',
    );
    const match = plainInstructionText.match(headingPattern);
    const sectionInstruction = match?.[1]?.trim() || plainInstructionText;

    return {
      id: slugifyWritingSectionTitle(title) || `section-${index + 1}`,
      title,
      instructions: sectionInstruction,
      content: '',
    } satisfies ProductWritingSection;
  });
}

function createWritingDraftTextFromSections(sections: ProductWritingSection[]) {
  return sections
    .map((section) => {
      const cleanContent = section.content.trim();
      if (!cleanContent) {
        return '';
      }
      return `<section data-section="${escapeHtml(section.title)}"><h3>${escapeHtml(section.title)}</h3>${cleanContent}</section>`;
    })
    .filter(Boolean)
    .join('');
}

function hydrateWritingSectionsFromText(
  baseSections: ProductWritingSection[],
  sourceText: string,
): ProductWritingSection[] {
  const cleanText = sourceText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!cleanText) {
    return baseSections;
  }

  const nextSections = baseSections.map((section) => ({ ...section, content: '' }));
  const now = new Date().toISOString();

  if (nextSections.length === 1) {
    nextSections[0].content = normalizePlainTextToHtml(cleanText);
    nextSections[0].updatedAt = now;
    return nextSections;
  }

  const normalizedLines = cleanText.split('\n');
  let currentSectionIndex = 0;
  const sectionMatchers = nextSections.map((section) => {
    const variants = [
      section.title,
      section.title.replace(/\s+o\s+/gi, ' '),
      section.title.replace(/\s*\/\s*/g, ' '),
    ];
    return new RegExp(
      `^(?:\\d+[.)\\s-]+)?(?:${variants.map((variant) => escapeRegex(variant)).join('|')})(?::)?$`,
      'i',
    );
  });

  const buffers = nextSections.map(() => [] as string[]);
  normalizedLines.forEach((line) => {
    const trimmed = line.trim();
    const matchedIndex = sectionMatchers.findIndex((pattern) => pattern.test(trimmed));
    if (matchedIndex >= 0) {
      currentSectionIndex = matchedIndex;
      return;
    }

    buffers[currentSectionIndex].push(line);
  });

  const hasSpecificBuckets = buffers.some((buffer, index) => index > 0 && buffer.join('').trim());
  if (!hasSpecificBuckets) {
    const paragraphs = cleanText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (paragraphs.length <= 1 || nextSections.length <= 1) {
      nextSections[0].content = normalizePlainTextToHtml(cleanText);
      nextSections[0].updatedAt = now;
      return nextSections;
    }

    const chunks = nextSections.map(() => [] as string[]);
    paragraphs.forEach((paragraph, index) => {
      const bucket = Math.min(
        nextSections.length - 1,
        Math.floor((index / Math.max(paragraphs.length, 1)) * nextSections.length),
      );
      chunks[bucket].push(paragraph);
    });

    nextSections.forEach((section, index) => {
      const chunkText = chunks[index].join('\n\n').trim();
      if (chunkText) {
        section.content = normalizePlainTextToHtml(chunkText);
        section.updatedAt = now;
      }
    });

    const titleIndex = nextSections.findIndex((section) => /t[ií]tulo/i.test(section.title));
    const introIndex = nextSections.findIndex((section) =>
      /(introducci[oó]n|inicio|apertura)/i.test(section.title),
    );

    if (titleIndex >= 0 && introIndex >= 0 && titleIndex !== introIndex) {
      const titlePlain = stripHtml(nextSections[titleIndex].content);
      const introPlain = stripHtml(nextSections[introIndex].content);

      if (!introPlain.trim() && titlePlain.trim()) {
        const introMarker = /\b(?:introducci[oó]n|inicio|apertura)\s*:/i;
        const markerMatch = introMarker.exec(titlePlain);

        if (markerMatch && typeof markerMatch.index === 'number') {
          const titlePart = titlePlain.slice(0, markerMatch.index).trim();
          const introPart = titlePlain
            .slice(markerMatch.index)
            .replace(introMarker, '')
            .trim();

          if (introPart) {
            if (titlePart) {
              nextSections[titleIndex].content = normalizePlainTextToHtml(titlePart);
              nextSections[titleIndex].updatedAt = now;
            }
            nextSections[introIndex].content = normalizePlainTextToHtml(introPart);
            nextSections[introIndex].updatedAt = now;
          }
        } else {
          const paragraphParts = titlePlain
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);

          if (paragraphParts.length > 1) {
            const titlePart = paragraphParts[0];
            const introPart = paragraphParts.slice(1).join('\n\n').trim();
            if (introPart) {
              nextSections[titleIndex].content = normalizePlainTextToHtml(titlePart);
              nextSections[titleIndex].updatedAt = now;
              nextSections[introIndex].content = normalizePlainTextToHtml(introPart);
              nextSections[introIndex].updatedAt = now;
            }
          }
        }
      }
    }

    return nextSections;
  }

  return nextSections.map((section, index) => ({
    ...section,
    content: normalizePlainTextToHtml(buffers[index].join('\n').trim()),
    updatedAt: buffers[index].join('').trim() ? now : section.updatedAt,
  }));
}

function buildStructuredSections(product: CourseProduct): ProductWritingSection[] {
  const instructionHtml = product.body?.trim() || product.summary?.trim() || '';
  const inferredTitles = inferWritingSectionTitlesFromText(instructionHtml, product.format);
  return buildWritingSectionsFromTemplate(inferredTitles, instructionHtml);
}

function mergeWritingData(
  current: ProductWritingData,
  next?: Partial<ProductWritingData>,
): ProductWritingData {
  const hasSubmittedAssetOverride = Boolean(
    next && Object.prototype.hasOwnProperty.call(next, 'submittedAsset'),
  );

  return {
    ...current,
    ...(next ?? {}),
    submittedAsset: hasSubmittedAssetOverride
      ? next?.submittedAsset ?? undefined
      : current.submittedAsset,
    supportAssets: next?.supportAssets ?? current.supportAssets,
    libraryResourceIds: next?.libraryResourceIds ?? current.libraryResourceIds,
    aiPrompt: next?.aiPrompt ?? current.aiPrompt,
    extractedText: next?.extractedText ?? current.extractedText,
    draftText: next?.draftText ?? current.draftText,
    sections: next?.sections ?? current.sections,
    lastSavedAt: next?.lastSavedAt ?? current.lastSavedAt,
    lastGeneratedAt: next?.lastGeneratedAt ?? current.lastGeneratedAt,
  };
}

async function readR2AssetText(asset: ProductWritingAsset) {
  const r2Config = await getIntegrationConfig('cloudflare-r2');
  const upstream = await getR2Object(asset.key, r2Config);

  if (!upstream.ok) {
    throw new Error(`No fue posible leer ${asset.name} desde R2.`);
  }

  const arrayBuffer = await upstream.arrayBuffer();
  return extractTextFromBuffer(
    Buffer.from(arrayBuffer),
    asset.name,
    asset.contentType || upstream.headers.get('content-type'),
  );
}

function stringifyLibraryResource(resource: Awaited<ReturnType<typeof findLibraryResourceById>>) {
  if (!resource) {
    return '';
  }

  return [
    `Título: ${resource.title}`,
    `Tipo: ${resource.kind}`,
    `Unidad: ${resource.unit}`,
    `Fuente: ${resource.source}`,
    `Resumen: ${resource.summary}`,
    resource.tags.length > 0 ? `Etiquetas: ${resource.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function compactPromptText(value: string, maxChars: number) {
  const normalized = stripHtml(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars).trim()}\n\n[Contexto resumido automáticamente para acelerar la generación]`;
}

function takePromptChunks(items: string[], maxChars: number) {
  const output: string[] = [];
  let used = 0;

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    if (used >= maxChars) {
      break;
    }

    const remaining = maxChars - used;
    const chunk = compactPromptText(trimmed, remaining);
    if (!chunk) {
      continue;
    }

    output.push(chunk);
    used += chunk.length + 2;
  }

  return output;
}

function isRetryableAiFailure(error: unknown) {
  if (error instanceof ExtractionTimeoutError) {
    return true;
  }

  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status?: number }).status)
      : null;

  if (status !== null && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  if (error instanceof Error) {
    return /rate limit|timeout|timed out|temporarily|overloaded|ECONNRESET|socket/i.test(
      error.message,
    );
  }

  return false;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Método no permitido');
  }

  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Autenticación requerida');
  }

  const payload = await readJson<WritingPayload>(request);

  if (!payload.courseSlug || !payload.productId) {
    return errorResponse(400, 'Se requiere el curso y el producto.');
  }

  const course = await findCourseRecordBySlug(payload.courseSlug);
  const product = await findCourseProductById(payload.courseSlug, payload.productId);

  if (!course || !product) {
    return errorResponse(404, 'Producto no encontrado.');
  }

  if (!canEditWritingProduct(user, product)) {
    return errorResponse(403, 'No tienes permisos para trabajar este producto en escritura.');
  }

  const currentWritingData = {
    ...product.writingData,
    sections:
      product.writingData.sections.length > 0
        ? product.writingData.sections
        : buildStructuredSections(product),
  };

  if (payload.action === 'save') {
    const writingData = mergeWritingData(currentWritingData, {
      ...(payload.writingData ?? currentWritingData),
      lastSavedAt: new Date().toISOString(),
    });

    const updated = await updateCourseProductRecord(payload.courseSlug, payload.productId, {
      writingData,
    });

    return jsonResponse({ product: updated });
  }

  if (payload.action === 'extract-upload') {
    if (!payload.asset?.key || !payload.asset.name) {
      return errorResponse(400, 'Se requiere un archivo válido para digitalizar.');
    }

    const baseSections =
      currentWritingData.sections.length > 0
        ? currentWritingData.sections
        : buildStructuredSections(product);
    const stagedWritingData = mergeWritingData(currentWritingData, {
      mode: 'upload',
      submittedAsset: payload.asset,
      extractedText: '',
      draftText: currentWritingData.draftText,
      sections: baseSections,
      lastSavedAt: new Date().toISOString(),
    });
    const stagedProduct = await updateCourseProductRecord(payload.courseSlug, payload.productId, {
      writingData: stagedWritingData,
    });

    const maxBytes = resolveSyncExtractionMaxBytes();
    if (payload.asset.size && payload.asset.size > maxBytes) {
      return jsonResponse({
        product: stagedProduct,
        extractedText: '',
        warning:
          `El archivo quedó cargado, pero supera ${(maxBytes / (1024 * 1024)).toFixed(0)} MB ` +
          'para digitalización rápida. Puedes continuar editando por secciones o cargar una versión más liviana.',
      });
    }

    let extractedText = '';
    try {
      const extractedOverride = payload.extractedTextOverride?.trim();
      const inlineBase64 = payload.assetContentBase64?.trim();

      if (extractedOverride) {
        extractedText = extractedOverride;
      } else if (inlineBase64) {
        const inlineBuffer = Buffer.from(inlineBase64, 'base64');
        extractedText = await withTimeout(
          extractTextFromBuffer(
            inlineBuffer,
            payload.asset.name,
            payload.asset.contentType,
          ),
          resolveExtractionTimeoutMs(),
          'La digitalización tardó demasiado para esta carga.',
        );
      } else {
        extractedText = await withTimeout(
          readR2AssetText(payload.asset),
          resolveExtractionTimeoutMs(),
          'La digitalización tardó demasiado para esta carga.',
        );
      }
    } catch (error) {
      if (error instanceof Error && /Formato no soportado/i.test(error.message)) {
        return errorResponse(400, error.message);
      }

      if (error instanceof ExtractionTimeoutError) {
        return jsonResponse({
          product: stagedProduct,
          extractedText: '',
          warning:
            'El archivo quedó cargado, pero la digitalización automática no terminó a tiempo. ' +
            'Puedes continuar editando por secciones y reintentar la carga cuando quieras.',
        });
      }

      return errorResponse(
        502,
        error instanceof Error
          ? `No fue posible procesar el archivo: ${error.message}`
          : 'No fue posible procesar el archivo cargado.',
      );
    }

    if (!extractedText.trim()) {
      return jsonResponse({
        product: stagedProduct,
        extractedText: '',
        warning:
          'El archivo se cargó correctamente, pero no se detectó texto procesable. ' +
          'Puedes continuar con edición manual por secciones.',
      });
    }

    const sections = hydrateWritingSectionsFromText(baseSections, extractedText);
    const draftText = createWritingDraftTextFromSections(sections);
    const writingData = mergeWritingData(stagedWritingData, {
      extractedText,
      draftText,
      sections,
      lastSavedAt: new Date().toISOString(),
    });

    const updated = await updateCourseProductRecord(payload.courseSlug, payload.productId, {
      writingData,
    });

    return jsonResponse({
      product: updated,
      extractedText,
    });
  }

  if (payload.action === 'generate-section') {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return errorResponse(500, 'No se encontró OPENAI_API_KEY en runtime para generar el producto.');
    }

    await getIntegrationConfig('openai');
    const openai = new OpenAI({ apiKey });
    const sectionId = payload.sectionId?.trim() || '';
    const sectionTitle = payload.sectionTitle?.trim() || 'Desarrollo del producto';
    const sectionInstructions = payload.sectionInstructions?.trim() || product.body.trim();
    const supportAssets = payload.supportAssets ?? currentWritingData.supportAssets;
    const libraryResourceIds = payload.libraryResourceIds ?? currentWritingData.libraryResourceIds;
    const aiPrompt = payload.aiPrompt?.trim() || currentWritingData.aiPrompt || '';

    const aiContextChars = resolveWritingAiContextChars();
    const aiTimeoutMs = resolveWritingAiTimeoutMs();
    const assetReadTimeoutMs = resolveWritingAiAssetReadTimeoutMs();
    const supportAssetsForPrompt = supportAssets.slice(0, resolveWritingAiMaxSupportAssets());
    const libraryResourceIdsForPrompt = libraryResourceIds.slice(
      0,
      resolveWritingAiMaxLibraryResources(),
    );

    const supportTextsRaw = await Promise.all(
      supportAssetsForPrompt.map(async (asset) => {
        try {
          const text = await withTimeout(
            readR2AssetText(asset),
            assetReadTimeoutMs,
            `La lectura de "${asset.name}" tardó demasiado para esta generación.`,
          );
          return `Archivo base: ${asset.name}\n${text}`;
        } catch {
          return `Archivo base: ${asset.name}\nNo fue posible extraer el texto.`;
        }
      }),
    );
    const supportTexts = takePromptChunks(
      supportTextsRaw,
      Math.max(3200, Math.floor(aiContextChars * 0.45)),
    );

    const libraryTextsRaw = (
      await Promise.all(
        libraryResourceIdsForPrompt.map((resourceId) => findLibraryResourceById(resourceId)),
      )
    )
      .map((resource) => stringifyLibraryResource(resource))
      .filter(Boolean);
    const libraryTexts = takePromptChunks(
      libraryTextsRaw,
      Math.max(2200, Math.floor(aiContextChars * 0.3)),
    );

    const existingSection =
      currentWritingData.sections.find((section) => section.id === sectionId) ??
      buildStructuredSections(product).find((section) => section.id === sectionId);

    const promptSections = [
      `Curso: ${course.title}`,
      `Producto: ${product.title}`,
      `Sección del producto: ${product.section ?? 'Introducción'}`,
      `Formato: ${product.format}`,
      '',
      'DETALLE ESTRUCTURADO DEL PRODUCTO:',
      compactPromptText(product.body.trim(), Math.max(1800, Math.floor(aiContextChars * 0.18))),
      '',
      aiPrompt
        ? `PROMPT ADICIONAL DEL EXPERTO:\n${compactPromptText(aiPrompt, Math.max(1200, Math.floor(aiContextChars * 0.12)))}\n`
        : '',
      `SECCIÓN A REDACTAR: ${sectionTitle}`,
      'INSTRUCCIONES DE ESTA PARTE:',
      compactPromptText(sectionInstructions, Math.max(1200, Math.floor(aiContextChars * 0.12))),
      '',
      existingSection?.content
        ? `BORRADOR PREVIO DE ESTA PARTE:\n${compactPromptText(existingSection.content, Math.max(900, Math.floor(aiContextChars * 0.1)))}`
        : 'No hay borrador previo para esta parte.',
      '',
      supportTexts.length > 0
        ? `DOCUMENTOS BASE:\n${supportTexts.join('\n\n---\n\n')}`
        : 'No se adjuntaron documentos base.',
      '',
      libraryTexts.length > 0
        ? `RECURSOS DE BIBLIOTECA:\n${libraryTexts.join('\n\n---\n\n')}`
        : 'No se seleccionaron recursos de biblioteca.',
    ]
      .filter(Boolean)
      .join('\n');

    const runCompletion = (model: string) =>
      withTimeout(
        openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Eres un asistente de escritura académica. Redactas una sección del producto respetando estrictamente las especificaciones técnicas dadas. No inventes estructura fuera de lo solicitado. Devuelve texto limpio en español, listo para edición posterior.',
            },
            {
              role: 'user',
              content: promptSections,
            },
          ],
          temperature: 0.4,
          max_tokens: 1200,
        }),
        aiTimeoutMs,
        'La generación de esta sección excedió el tiempo máximo.',
      );

    const primaryModel = process.env.WRITING_AI_MODEL?.trim() || 'gpt-4o-mini';
    const fallbackModel = primaryModel === 'gpt-4o-mini' ? 'gpt-4o' : 'gpt-4o-mini';
    let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;

    try {
      completion = await runCompletion(primaryModel);
    } catch (error) {
      if (!isRetryableAiFailure(error)) {
        return errorResponse(
          502,
          error instanceof Error
            ? `No fue posible generar esta sección: ${error.message}`
            : 'No fue posible generar esta sección.',
        );
      }

      try {
        completion = await runCompletion(fallbackModel);
      } catch (fallbackError) {
        const status =
          typeof (fallbackError as { status?: unknown })?.status === 'number'
            ? Number((fallbackError as { status?: number }).status)
            : null;
        const normalizedStatus =
          status !== null && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)
            ? status
            : 504;
        return errorResponse(
          normalizedStatus,
          fallbackError instanceof Error
            ? `No fue posible generar esta sección: ${fallbackError.message}`
            : 'No fue posible generar esta sección en este momento.',
        );
      }
    }

    const generatedText = completion.choices[0]?.message?.content?.trim() ?? '';

    if (!generatedText) {
      return errorResponse(502, 'La IA no devolvió contenido para esta parte del producto.');
    }

    const sections = currentWritingData.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            title: sectionTitle,
            instructions: sectionInstructions,
            content: generatedText,
            updatedAt: new Date().toISOString(),
          }
        : section,
    );

    const nextSections =
      sections.some((section) => section.id === sectionId)
        ? sections
        : [
            ...sections,
            {
              id: sectionId || `section-${sections.length + 1}`,
              title: sectionTitle,
              instructions: sectionInstructions,
              content: generatedText,
              updatedAt: new Date().toISOString(),
            },
          ];

    const draftText = createWritingDraftTextFromSections(nextSections);

    const writingData = mergeWritingData(currentWritingData, {
      mode: 'ai',
      supportAssets,
      libraryResourceIds,
      aiPrompt,
      sections: nextSections,
      draftText,
      lastGeneratedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });

    const updated = await updateCourseProductRecord(payload.courseSlug, payload.productId, {
      writingData,
    });

    return jsonResponse({
      product: updated,
      generatedText,
      draftText,
      sections: nextSections,
    });
  }

  return errorResponse(400, 'Acción de escritura no soportada.');
}
