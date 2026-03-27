import { recordAuthenticationLog } from '../../lib/admin-center.js';
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
    await recordAuthenticationLog({
      event: 'login_failed',
      result: 'invalid_credentials',
      detail: `Intento fallido para ${payload.email.trim().toLowerCase()}.`,
    });
    return errorResponse(401, 'Invalid credentials');
  }

  if (user.status === 'Pendiente') {
    await recordAuthenticationLog({
      event: 'login_denied',
      result: 'pending',
      detail: `Se bloqueó el acceso de ${user.email} porque su cuenta sigue pendiente.`,
      user,
    });
    return errorResponse(403, 'Tu cuenta sigue pendiente de activación.');
  }

  if (user.status === 'Inactivo') {
    await recordAuthenticationLog({
      event: 'login_denied',
      result: 'inactive',
      detail: `Se bloqueó el acceso de ${user.email} porque la cuenta está inactiva.`,
      user,
    });
    return errorResponse(403, 'Tu cuenta está inactiva. Contacta al administrador.');
  }

  if (user.status === 'Suspendido') {
    await recordAuthenticationLog({
      event: 'login_denied',
      result: 'suspended',
      detail: `Se bloqueó el acceso de ${user.email} porque la cuenta está suspendida.`,
      user,
    });
    return errorResponse(
      403,
      user.statusReason?.trim() || 'Tu cuenta está suspendida. Contacta al administrador.',
    );
  }

  const session = await createSession(user.id);

  await recordAuthenticationLog({
    event: 'login_success',
    result: 'ok',
    detail: `Inicio de sesión exitoso para ${user.email}.`,
    user,
  });

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
