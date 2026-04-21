import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { persistLibraryAsset } from '../../lib/store.js';
import { getSql } from '../../lib/db.js';
import type { LibraryAsset } from '../../src/types.js';

export const config = {
  runtime: 'edge',
};

interface InstitutionalAssetInput {
  title: string;
  description: string;
  authors: string[];
  thematicAreas: string[];
  keywords: string[];
  year: string;
  resourceType: string;
  extension: string;
  format: string;
  estimatedStudyMinutes: number;
  canonicalUrl: string;
  visibility: 'Institucional' | 'Publico';
  embedCode?: string;
  sourceType: 'link' | 'youtube' | 'iframe' | 'file';
  institutionId?: string;
  institutionName?: string;
  faculty?: string;
  program?: string;
}

function inferPreviewKind(sourceType: string, extension: string): LibraryAsset['previewKind'] {
  if (sourceType === 'youtube') return 'video';
  const ext = (extension ?? '').toLowerCase();
  if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'external-link';
}

function inferEmbedUrl(sourceType: string, canonicalUrl: string): string | undefined {
  if (sourceType === 'youtube') {
    const match = canonicalUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return undefined;
}

const ALLOWED_ROLES = ['Administrador', 'Gestor LMS'];

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');

    if (!ALLOWED_ROLES.includes(user.role)) {
      return errorResponse(403, 'No tienes permisos para gestionar recursos institucionales');
    }

    // ── DELETE ─────────────────────────────────────────────────────────────────
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) return errorResponse(400, 'Se requiere el ID del recurso');

      const sql = getSql();
      const result = await sql`
        DELETE FROM maturity_library_assets
        WHERE id = ${id} AND provider = 'institutional'
        RETURNING id
      `;

      if (!result.length) return errorResponse(404, 'Recurso no encontrado o ya eliminado');

      return jsonResponse({ ok: true, message: 'Recurso eliminado.' });
    }

    // ── PATCH (update) ─────────────────────────────────────────────────────────
    if (request.method === 'PATCH') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) return errorResponse(400, 'Se requiere el ID del recurso');

      let body: InstitutionalAssetInput;
      try {
        body = (await request.json()) as InstitutionalAssetInput;
      } catch {
        return errorResponse(400, 'Cuerpo JSON inválido');
      }

      if (!body.title?.trim()) return errorResponse(400, 'El título es obligatorio');

      const sql = getSql();
      const existing = await sql`
        SELECT id, canonical_key AS "canonicalKey", created_at AS "createdAt", institution_id AS "institutionId", institution_name AS "institutionName"
        FROM maturity_library_assets
        WHERE id = ${id} AND provider = 'institutional'
        LIMIT 1
      `;
      if (!existing.length) return errorResponse(404, 'Recurso no encontrado');

      const row = existing[0] as { canonicalKey: string; createdAt: string; institutionId: string | null; institutionName: string | null };
      const now = new Date().toISOString();

      const asset: LibraryAsset = {
        id,
        canonicalKey: row.canonicalKey,
        provider: 'institutional',
        providerRecordId: id,
        group: 'Institucional',
        title: body.title.trim(),
        authors: body.authors ?? [],
        publishedAt: body.year ? `${body.year}-01-01` : now.slice(0, 10),
        abstract: body.description?.trim() ?? '',
        descriptionHtml: body.description?.trim() ?? '',
        canonicalUrl: body.canonicalUrl?.trim() ?? '',
        resourceType: body.resourceType ?? 'Otro',
        language: 'es',
        openAccess: body.visibility === 'Publico',
        citationCount: 0,
        embedUrl: inferEmbedUrl(body.sourceType, body.canonicalUrl?.trim() ?? ''),
        institutionId: row.institutionId ?? user.institutionId,
        institutionName: row.institutionName ?? user.institution,
        visibility: body.visibility ?? 'Institucional',
        previewKind: inferPreviewKind(body.sourceType, body.extension ?? ''),
        tags: [...(body.thematicAreas ?? []), ...(body.keywords ?? [])],
        metadata: {
          thematicAreas: body.thematicAreas ?? [],
          keywords: body.keywords ?? [],
          extension: body.extension ?? '',
          format: body.format ?? '',
          estimatedStudyMinutes: body.estimatedStudyMinutes ?? 0,
          addedBy: user.id,
          sourceType: body.sourceType,
          embedCode: body.embedCode ?? null,
          faculty: body.faculty ?? null,
          program: body.program ?? null,
        },
        createdAt: row.createdAt,
        updatedAt: now,
      };

      await persistLibraryAsset(asset);
      return jsonResponse({ ok: true, assetId: id, message: 'Recurso actualizado.' });
    }

    // ── POST (create) ──────────────────────────────────────────────────────────
    if (request.method !== 'POST') return errorResponse(405, 'Método no permitido');

    let body: InstitutionalAssetInput;
    try {
      body = (await request.json()) as InstitutionalAssetInput;
    } catch {
      return errorResponse(400, 'Cuerpo JSON inválido');
    }

    if (!body.title?.trim()) return errorResponse(400, 'El título es obligatorio');
    if (!body.canonicalUrl?.trim() && body.sourceType !== 'iframe') {
      return errorResponse(400, 'La URL del recurso es obligatoria');
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const canonicalKey = `institutional:${user.institutionId ?? 'global'}:${id}`;

    const asset: LibraryAsset = {
      id,
      canonicalKey,
      provider: 'institutional',
      providerRecordId: id,
      group: 'Institucional',
      title: body.title.trim(),
      authors: body.authors ?? [],
      publishedAt: body.year ? `${body.year}-01-01` : now.slice(0, 10),
      abstract: body.description?.trim() ?? '',
      descriptionHtml: body.description?.trim() ?? '',
      canonicalUrl: body.canonicalUrl?.trim() ?? '',
      resourceType: body.resourceType ?? 'Otro',
      language: 'es',
      openAccess: body.visibility === 'Publico',
      citationCount: 0,
      embedUrl: inferEmbedUrl(body.sourceType, body.canonicalUrl?.trim() ?? ''),
      institutionId: body.institutionId ?? user.institutionId,
      institutionName: body.institutionName ?? user.institution,
      visibility: body.visibility ?? 'Institucional',
      previewKind: inferPreviewKind(body.sourceType, body.extension ?? ''),
      tags: [...(body.thematicAreas ?? []), ...(body.keywords ?? [])],
      metadata: {
        thematicAreas: body.thematicAreas ?? [],
        keywords: body.keywords ?? [],
        extension: body.extension ?? '',
        format: body.format ?? '',
        estimatedStudyMinutes: body.estimatedStudyMinutes ?? 0,
        addedBy: user.id,
        sourceType: body.sourceType,
        embedCode: body.embedCode ?? null,
        faculty: body.faculty ?? null,
        program: body.program ?? null,
      },
      createdAt: now,
      updatedAt: now,
    };

    await persistLibraryAsset(asset);

    return jsonResponse({
      ok: true,
      assetId: id,
      message: 'Recurso agregado al repositorio institucional.',
    });
  } catch (err) {
    console.error('[InstitutionalAsset] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
