import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { createLibraryCourseLink, persistLibraryAsset } from '../../lib/store.js';
import type {
  LibraryAsset,
  LibraryCourseLinkMutationInput,
  LibrarySearchResult,
} from '../../src/types.js';

export const config = {
  runtime: 'edge',
};

interface CourseLinkRequestBody {
  asset: LibrarySearchResult;
  courseSlug: string;
  targetStage?: string;
  targetUnit?: string;
}

/**
 * POST /api/library/course-links
 * Upserts a LibraryAsset from search results and creates a course link.
 * This replaces the old /api/resources pattern for federated assets.
 */
export default async function handler(request: Request) {
  try {
  const user = await getSessionUser(request);
  if (!user) return errorResponse(401, 'No autorizado');

  if (request.method !== 'POST') return errorResponse(405, 'Método no permitido');

  let body: CourseLinkRequestBody;
  try {
    body = (await request.json()) as CourseLinkRequestBody;
  } catch {
    return errorResponse(400, 'Cuerpo JSON inválido');
  }

  const { asset: searchResult, courseSlug, targetStage, targetUnit } = body;

  if (!searchResult || !courseSlug) {
    return errorResponse(400, 'Se requieren asset y courseSlug');
  }

  try {
    // 1. Upsert the asset into library_assets
    const now = new Date().toISOString();
    const asset: LibraryAsset = {
      id: searchResult.id,
      canonicalKey: searchResult.canonicalKey,
      provider: searchResult.provider,
      providerRecordId: searchResult.providerRecordId,
      group: searchResult.group,
      title: searchResult.title,
      authors: searchResult.authors,
      publishedAt: searchResult.publishedAt,
      abstract: searchResult.abstract,
      descriptionHtml: searchResult.descriptionHtml,
      doi: searchResult.doi,
      canonicalUrl: searchResult.canonicalUrl,
      resourceType: searchResult.resourceType,
      language: searchResult.language,
      license: searchResult.license ?? null,
      openAccess: searchResult.openAccess,
      citationCount: searchResult.citationCount,
      thumbnailUrl: searchResult.thumbnailUrl,
      embedUrl: searchResult.embedUrl,
      institutionId: searchResult.institutionId,
      institutionName: searchResult.institutionName,
      visibility: searchResult.visibility,
      previewKind: searchResult.previewKind,
      tags: searchResult.tags,
      metadata: searchResult.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    await persistLibraryAsset(asset);

    // 2. Create the course link
    const linkInput: LibraryCourseLinkMutationInput = {
      assetId: searchResult.id,
      courseSlug,
      targetStage,
      targetUnit,
      sourceModule: 'library',
    };

    await createLibraryCourseLink({
      ...linkInput,
      addedBy: user.id,
    });

    return jsonResponse({
      ok: true,
      assetId: searchResult.id,
      courseSlug,
      message: 'Recurso vinculado exitosamente al curso.',
    });
  } catch (err) {
    console.error('[CourseLinks] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error al crear el vínculo');
  }
  } catch (err) {
    console.error('[CourseLinks] Unhandled error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
