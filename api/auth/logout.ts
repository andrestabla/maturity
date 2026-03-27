import { errorResponse, jsonResponse } from '../../lib/http.js';
import { clearSessionCookie, destroySession } from '../../lib/session.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  await destroySession(request);

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
