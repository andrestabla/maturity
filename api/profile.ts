import { recordAdminLog } from '../lib/admin-center.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { updateOwnProfileRecord } from '../lib/store.js';
import type { UserProfileUpdateInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'GET') {
    return jsonResponse({
      user,
    });
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<UserProfileUpdateInput>(request);

    if (!payload.name || !payload.email) {
      return errorResponse(400, 'Name and email are required');
    }

    try {
      const updatedUser = await updateOwnProfileRecord(user.id, payload);

      if (!updatedUser) {
        return errorResponse(404, 'User not found');
      }

      await recordAdminLog({
        category: 'Administración',
        module: 'Mi perfil',
        service: 'Perfil',
        severity: 'Success',
        event: 'profile_updated',
        result: 'ok',
        detail: `El usuario ${updatedUser.email} actualizó su perfil básico.`,
        userId: user.id,
        userName: user.name,
      });

      return jsonResponse({
        user: updatedUser,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update profile';
      return errorResponse(400, message);
    }
  }

  return errorResponse(405, 'Method not allowed');
}
