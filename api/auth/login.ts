import { errorResponse, jsonResponse, readJson } from '../../lib/http.js';
import { authenticateUser, createSession, createSessionCookieHeader } from '../../lib/session.js';

export const config = {
  runtime: 'edge',
};

interface LoginPayload {
  email?: string;
  password?: string;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const payload = await readJson<LoginPayload>(request);

  if (!payload.email || !payload.password) {
    return errorResponse(400, 'Email and password are required');
  }

  const user = await authenticateUser(payload.email, payload.password);

  if (!user) {
    return errorResponse(401, 'Invalid credentials');
  }

  const session = await createSession(user.id);

  return jsonResponse(
    {
      authenticated: true,
      user,
    },
    {
      headers: {
        'set-cookie': createSessionCookieHeader(session.token, session.expiresAt),
      },
    },
  );
}
