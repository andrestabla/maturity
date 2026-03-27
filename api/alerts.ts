import { canManageAlerts } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { deleteAlertRecord, findAlertById } from '../lib/store.js';

export const config = {
  runtime: 'edge',
};

interface DeletePayload {
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method !== 'DELETE') {
    return errorResponse(405, 'Method not allowed');
  }

  const payload = await readJson<DeletePayload>(request);

  if (!payload.id) {
    return errorResponse(400, 'Alert id is required');
  }

  const alert = await findAlertById(payload.id);

  if (!alert) {
    return errorResponse(404, 'Alert not found');
  }

  if (!canManageAlerts(user.role, alert.owner)) {
    return errorResponse(403, 'You do not have permission to manage this alert');
  }

  const deleted = await deleteAlertRecord(payload.id);

  if (!deleted) {
    return errorResponse(404, 'Alert not found');
  }

  return jsonResponse({
    ok: true,
  });
}
