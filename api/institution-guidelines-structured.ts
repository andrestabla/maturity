import { canManageCourses } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  getGuidelinesStructuredForInstitution,
  saveGuidelinesStructuredForInstitution,
} from '../lib/store.js';
import type { GuidelinesStructured } from '../src/types.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request | any, response?: any) {
  const isNodeRes = response && typeof response.write === 'function';
  const fail = (status: number, msg: string) =>
    isNodeRes ? response.status(status).json({ error: msg }) : errorResponse(status, msg);

  const user = await getSessionUser(request);
  if (!user) return fail(401, 'Authentication required');
  if (!canManageCourses(user.role)) return fail(403, 'Permisos insuficientes.');

  const url = new URL(request.url ?? `http://localhost${request.url ?? ''}`, 'http://localhost');
  const institutionId = url.searchParams.get('institutionId');
  if (!institutionId) return fail(400, 'institutionId is required');

  if (request.method === 'GET') {
    const structured = await getGuidelinesStructuredForInstitution(institutionId);
    if (isNodeRes) return response.status(200).json({ structured });
    return jsonResponse({ structured });
  }

  if (request.method === 'PUT') {
    let body: { structured?: GuidelinesStructured } = {};
    if (typeof request.json === 'function') {
      try { body = await request.json(); } catch (e) {}
    } else if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    } else {
      try { body = await readJson<typeof body>(request); } catch (e) {}
    }
    if (!body.structured) return fail(400, 'structured payload is required');
    await saveGuidelinesStructuredForInstitution(institutionId, body.structured);
    if (isNodeRes) return response.status(200).json({ ok: true });
    return jsonResponse({ ok: true });
  }

  return fail(405, 'Method not allowed');
}
