import { errorResponse, jsonResponse } from '../lib/http.js';
import { canManageArchitecture } from '../lib/permissions.js';
import { getSessionUser } from '../lib/session.js';
import {
  deleteProductFormatTemplate,
  getProductFormatTemplates,
  upsertProductFormatTemplate,
} from '../lib/store.js';
import type { ProductSectionTemplate } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');

    // ── GET — list all templates ────────────────────────────────────────────
    if (request.method === 'GET') {
      const templates = await getProductFormatTemplates();
      return jsonResponse({ ok: true, templates });
    }

    // Write operations require architecture management permission
    if (!canManageArchitecture(user.role)) {
      return errorResponse(403, 'No tienes permisos para gestionar plantillas de productos');
    }

    // ── POST / PUT — upsert template ───────────────────────────────────────
    if (request.method === 'POST' || request.method === 'PUT') {
      let body: { id?: string; formatKey: string; label: string; sections: ProductSectionTemplate[] };
      try {
        body = await request.json() as typeof body;
      } catch {
        return errorResponse(400, 'Cuerpo JSON inválido');
      }

      if (!body.formatKey?.trim()) return errorResponse(400, 'formatKey es requerido');
      if (!body.label?.trim()) return errorResponse(400, 'label es requerido');
      if (!Array.isArray(body.sections)) return errorResponse(400, 'sections debe ser un array');

      const template = await upsertProductFormatTemplate({
        id: body.id,
        formatKey: body.formatKey.trim(),
        label: body.label.trim(),
        sections: body.sections,
      });

      return jsonResponse({ ok: true, template });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const formatKey = url.searchParams.get('formatKey');
      if (!formatKey) return errorResponse(400, 'formatKey es requerido');

      await deleteProductFormatTemplate(formatKey);
      return jsonResponse({ ok: true });
    }

    return errorResponse(405, 'Método no permitido');
  } catch (err) {
    console.error('[ProductTemplates] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
