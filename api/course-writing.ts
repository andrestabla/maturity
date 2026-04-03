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
  libraryResourceIds?: string[];
  sectionId?: string;
  sectionTitle?: string;
  sectionInstructions?: string;
  supportAssets?: ProductWritingAsset[];
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

function normalizeHeading(line: string) {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s*/, '')
    .trim();
}

function buildStructuredSections(product: CourseProduct): ProductWritingSection[] {
  const sections: ProductWritingSection[] = [];
  let current: ProductWritingSection | null = null;

  product.body.split('\n').forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (/^#\s+/.test(line)) {
      if (current) {
        const finalized = current as ProductWritingSection;
        const finalizedSection = {
          ...finalized,
          instructions: finalized.instructions.trim(),
        };
        sections.push(finalizedSection);
      }
      current = {
        id: `section-${sections.length + 1}`,
        title: normalizeHeading(line),
        instructions: '',
        content: '',
      };
      return;
    }

    if (!current) {
      return;
    }

    current.instructions = `${current.instructions}${current.instructions ? '\n' : ''}${line}`.trimEnd();
  });

  if (current) {
    const finalized = current as ProductWritingSection;
    sections.push({
      ...finalized,
      instructions: finalized.instructions.trim(),
    });
  }

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      id: 'section-general',
      title: 'Desarrollo del producto',
      instructions: product.body.trim(),
      content: '',
    },
  ];
}

function mergeWritingData(
  current: ProductWritingData,
  next?: Partial<ProductWritingData>,
): ProductWritingData {
  return {
    ...current,
    ...(next ?? {}),
    submittedAsset: next?.submittedAsset ?? current.submittedAsset,
    supportAssets: next?.supportAssets ?? current.supportAssets,
    libraryResourceIds: next?.libraryResourceIds ?? current.libraryResourceIds,
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

    const extractedText = await readR2AssetText(payload.asset);
    const writingData = mergeWritingData(currentWritingData, {
      mode: 'upload',
      submittedAsset: payload.asset,
      extractedText,
      draftText: currentWritingData.draftText || extractedText,
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

    const supportTexts = await Promise.all(
      supportAssets.map(async (asset) => {
        try {
          const text = await readR2AssetText(asset);
          return `Archivo base: ${asset.name}\n${text}`;
        } catch {
          return `Archivo base: ${asset.name}\nNo fue posible extraer el texto.`;
        }
      }),
    );

    const libraryTexts = (
      await Promise.all(libraryResourceIds.map((resourceId) => findLibraryResourceById(resourceId)))
    )
      .map((resource) => stringifyLibraryResource(resource))
      .filter(Boolean);

    const existingSection =
      currentWritingData.sections.find((section) => section.id === sectionId) ??
      buildStructuredSections(product).find((section) => section.id === sectionId);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente de escritura académica. Redactas una sección del producto respetando estrictamente las especificaciones técnicas dadas. No inventes estructura fuera de lo solicitado. Devuelve texto limpio en español, listo para edición posterior.',
        },
        {
          role: 'user',
          content: [
            `Curso: ${course.title}`,
            `Producto: ${product.title}`,
            `Sección del producto: ${product.section ?? 'Introducción'}`,
            `Formato: ${product.format}`,
            '',
            'DETALLE ESTRUCTURADO DEL PRODUCTO:',
            product.body.trim(),
            '',
            `SECCIÓN A REDACTAR: ${sectionTitle}`,
            'INSTRUCCIONES DE ESTA PARTE:',
            sectionInstructions,
            '',
            existingSection?.content
              ? `BORRADOR PREVIO DE ESTA PARTE:\n${existingSection.content}`
              : 'No hay borrador previo para esta parte.',
            '',
            supportTexts.length > 0
              ? `DOCUMENTOS BASE:\n${supportTexts.join('\n\n---\n\n')}`
              : 'No se adjuntaron documentos base.',
            '',
            libraryTexts.length > 0
              ? `RECURSOS DE BIBLIOTECA:\n${libraryTexts.join('\n\n---\n\n')}`
              : 'No se seleccionaron recursos de biblioteca.',
          ].join('\n'),
        },
      ],
    });

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

    const draftText = nextSections
      .map((section) => `# ${section.title}\n${section.content.trim()}`)
      .join('\n\n')
      .trim();

    const writingData = mergeWritingData(currentWritingData, {
      mode: 'ai',
      supportAssets,
      libraryResourceIds,
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
