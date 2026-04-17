/**
 * GET  /api/h5p/content?courseSlug=X  — list H5P activities
 * POST /api/h5p/content               — create H5P activity
 * PUT  /api/h5p/content               — update H5P activity (body: {id, ...})
 * DELETE /api/h5p/content?id=X        — delete H5P activity
 */

import { getSessionUser } from '../../lib/session.js';
import { errorResponse, readJson } from '../../lib/http.js';
import {
  listH5PContent,
  getH5PContent,
  createH5PContent,
  updateH5PContent,
  deleteH5PContent,
  type H5PContentInput,
} from '../../lib/h5p.js';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');

    const rawUrl = request.url ?? '';
    const host = request.headers.get('host') ?? 'localhost';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `${proto}://${host}${rawUrl}`);

    // ── GET — list / single ─────────────────────────────────────────────────
    if (request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        const content = await getH5PContent(id);
        if (!content) return errorResponse(404, 'Actividad H5P no encontrada');
        return Response.json(content);
      }

      const courseSlug = url.searchParams.get('courseSlug') ?? undefined;
      const institutionId = user.institutionId ?? undefined;
      const items = await listH5PContent({ courseSlug, institutionId });
      return Response.json({ items });
    }

    // ── POST — create ───────────────────────────────────────────────────────
    if (request.method === 'POST') {
      const body = await readJson<H5PContentInput>(request);

      if (!body.title?.trim()) return errorResponse(400, 'El título es obligatorio');
      if (!body.kind) return errorResponse(400, 'El tipo de contenido es obligatorio');
      if (body.kind === 'embed' && !body.embedUrl && !body.embedHtml) {
        return errorResponse(400, 'Se requiere URL de inserción o código HTML para embeds');
      }

      const content = await createH5PContent({
        ...body,
        institutionId: user.institutionId ?? undefined,
        createdBy: user.id,
      });

      return Response.json(content, { status: 201 });
    }

    // ── PUT — update ────────────────────────────────────────────────────────
    if (request.method === 'PUT') {
      const body = await readJson<{ id: string } & Partial<H5PContentInput>>(request);
      if (!body.id) return errorResponse(400, 'Se requiere id');

      const existing = await getH5PContent(body.id);
      if (!existing) return errorResponse(404, 'Actividad H5P no encontrada');

      // Only creator or admin can update
      if (existing.createdBy !== user.id && user.role !== 'admin') {
        return errorResponse(403, 'Sin permiso para editar esta actividad');
      }

      const { id, ...updates } = body;
      const updated = await updateH5PContent(id, updates);
      return Response.json(updated);
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return errorResponse(400, 'Se requiere id');

      const existing = await getH5PContent(id);
      if (!existing) return errorResponse(404, 'Actividad H5P no encontrada');

      if (existing.createdBy !== user.id && user.role !== 'admin') {
        return errorResponse(403, 'Sin permiso para eliminar esta actividad');
      }

      await deleteH5PContent(id);
      return Response.json({ ok: true });
    }

    return errorResponse(405, 'Método no permitido');
  } catch (err) {
    console.error('[H5P/content] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
