import type { AuthUser, Role } from '../src/types.js';
import { createSessionToken, hashSessionToken, verifyPassword } from './security.js';
import {
  createSessionRecord,
  deleteSessionByTokenHash,
  findSessionByTokenHash,
  findUserByEmail,
  touchUserLastAccess,
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

function parseSecondaryRoles(value: unknown) {
  if (Array.isArray(value)) {
    return value as Role[];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value) as Role[];
    } catch {
      return [];
    }
  }

  return [] as Role[];
}

function mapToAuthUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles?: unknown;
  status?: AuthUser['status'];
  institution?: string | null;
  faculty?: string | null;
  program?: string | null;
  scope?: string | null;
  createdAt?: string;
  createdBy?: string | null;
  lastAccessAt?: string | null;
  statusReason?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    secondaryRoles: parseSecondaryRoles(user.secondaryRoles).filter((item) => item !== user.role),
    status: user.status,
    institution: user.institution ?? '',
    faculty: user.faculty ?? '',
    program: user.program ?? '',
    scope: user.scope ?? '',
    createdAt: user.createdAt,
    createdBy: user.createdBy ?? null,
    lastAccessAt: user.lastAccessAt ?? null,
    statusReason: user.statusReason ?? null,
  } satisfies AuthUser;
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

  return mapToAuthUser(user);
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await createSessionRecord(userId, tokenHash, expiresAt);
  await touchUserLastAccess(userId);

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
    ...mapToAuthUser(session),
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
