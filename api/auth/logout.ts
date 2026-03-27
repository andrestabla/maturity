import { recordAuthenticationLog } from '../../lib/admin-center.js';
import { errorResponse, jsonResponse } from '../../lib/http.js';
import { clearSessionCookie, destroySession, getSessionUser } from '../../lib/session.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const user = await getSessionUser(request);
  await destroySession(request);

  if (user) {
    await recordAuthenticationLog({
      event: 'logout',
      result: 'ok',
      detail: `Cierre de sesión de ${user.email}.`,
      user,
    });
  }

  return jsonResponse(
    {
      ok: true,
    },
    {
      headers: {
        'set-cookie': clearSessionCookie(),
      },
    },
  );
}
