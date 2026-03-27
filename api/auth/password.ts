import { errorResponse, jsonResponse, readJson } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { changeUserPassword } from '../../lib/store.js';
import type { PasswordChangeInput } from '../../src/types.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  const payload = await readJson<PasswordChangeInput>(request);

  if (!payload.currentPassword || !payload.nextPassword) {
    return errorResponse(400, 'Current password and new password are required');
  }

  if (payload.nextPassword.length < 10) {
    return errorResponse(400, 'The new password must be at least 10 characters long');
  }

  try {
    await changeUserPassword(user.id, payload);

    return jsonResponse({
      ok: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update password';
    return errorResponse(400, message);
  }
}
