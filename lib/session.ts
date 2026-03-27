import type { AuthUser } from '../src/types.js';
import { createSessionToken, hashSessionToken, verifyPassword } from './security.js';
import {
  createSessionRecord,
  deleteSessionByTokenHash,
  findSessionByTokenHash,
  findUserByEmail,
} from './store.js';

const SESSION_COOKIE = 'maturity_session';
const SESSION_DURATION_DAYS = 30;

function parseCookies(headerValue: string | null) {
  const entries = (headerValue ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf('=');
      if (separator === -1) {
        return [part, ''];
      }

      return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
    });

  return Object.fromEntries(entries);
}

function createCookie(token: string, expiresAt: string) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ].join('; ');
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ');
}

export async function authenticateUser(email: string, password: string) {
  const user = await findUserByEmail(email.trim().toLowerCase());

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  } satisfies AuthUser;
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await createSessionRecord(userId, tokenHash, expiresAt);

  return {
    token,
    expiresAt,
  };
}

export async function getSessionUser(request: Request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const tokenHash = await hashSessionToken(token);
  const session = await findSessionByTokenHash(tokenHash);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
  } satisfies AuthUser;
}

export async function destroySession(request: Request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return;
  }

  const tokenHash = await hashSessionToken(token);
  await deleteSessionByTokenHash(tokenHash);
}

export function createSessionCookieHeader(token: string, expiresAt: string) {
  return createCookie(token, expiresAt);
}
