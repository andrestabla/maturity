import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { getSql } from '../../lib/db.js';

export const config = { runtime: 'nodejs' };

/**
 * /api/library/saved-searches
 *
 * GET  — List saved searches for the current user
 * POST — Save a new search
 * DELETE ?id=X — Remove a saved search
 */
export default async function handler(request: Request) {
  try {
  const user = await getSessionUser(request);
  if (!user) return errorResponse(401, 'No autorizado');

  const sql = getSql();

  // ───── Ensure table exists (idempotent) ─────
  await sql`
    CREATE TABLE IF NOT EXISTS maturity_library_saved_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      query TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT 'Investigacion',
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const method = request.method;

  // ───── GET: list user's saved searches ─────
  if (method === 'GET') {
    const searches = await sql`
      SELECT id, label, query, group_name as "group", filters, created_at as "createdAt"
      FROM maturity_library_saved_searches
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return jsonResponse({ ok: true, searches });
  }

  // ───── POST: save a search ─────
  if (method === 'POST') {
    let body: {
      label?: string;
      query: string;
      group?: string;
      filters?: Record<string, unknown>;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return errorResponse(400, 'JSON inválido');
    }

    if (!body.query) {
      return errorResponse(400, 'Se requiere query');
    }

    const id = `ss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const label = body.label || body.query.slice(0, 60);
    const group = body.group || 'Investigacion';
    const filters = body.filters || {};

    await sql`
      INSERT INTO maturity_library_saved_searches (id, user_id, label, query, group_name, filters)
      VALUES (${id}, ${user.id}, ${label}, ${body.query}, ${group}, ${JSON.stringify(filters)}::jsonb)
    `;

    return jsonResponse({ ok: true, id, label });
  }

  // ───── DELETE: remove a saved search ─────
  if (method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return errorResponse(400, 'Se requiere id');

    await sql`
      DELETE FROM maturity_library_saved_searches
      WHERE id = ${id} AND user_id = ${user.id}
    `;

    return jsonResponse({ ok: true, deleted: id });
  }

  return errorResponse(405, 'Método no permitido');
  } catch (err) {
    console.error('[SavedSearches] Unhandled error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
