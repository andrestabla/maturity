import {
  runIntegrationConnectivityTest,
  updateIntegrationSettings,
} from '../lib/admin-center.js';
import { canManageUsers } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import type { AdminIntegrationMutationInput } from '../src/types.js';

export const config = {
  runtime: 'nodejs',
};

interface IntegrationTestPayload {
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (!canManageUsers(user.role)) {
    return errorResponse(403, 'Solo los administradores pueden operar integraciones');
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<AdminIntegrationMutationInput>(request);

    if (!payload.id) {
      return errorResponse(400, 'Integration id is required');
    }

    const integration = await updateIntegrationSettings(payload, {
      id: user.id,
      name: user.name,
    });

    return jsonResponse({
      integration,
    });
  }

  if (request.method === 'POST') {
    const payload = await readJson<IntegrationTestPayload>(request);

    if (!payload.id) {
      return errorResponse(400, 'Integration id is required');
    }

    const integration = await runIntegrationConnectivityTest(payload.id, {
      id: user.id,
      name: user.name,
    });

    return jsonResponse({
      integration,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
