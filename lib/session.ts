import type { AuthUser, Role } from '../src/types.js';
import { createSessionToken, hashSessionToken, verifyPassword } from './security.js';
import {
  createSessionRecord,
  deleteSessionByTokenHash,
  findSessionByTokenHash as findSessionByTokenHashWithBootstrap,
  findUserByEmail,
  touchUserLastAccess,
} from './store.js';
import { getSql } from './db.js';

const SESSION_COOKIE = 'maturity_session';
const SESSION_DURATION_DAYS = 30;

type SessionRequestLike = Request | { headers?: Headers | Record<string, string | string[] | undefined> | undefined };

interface FastSessionRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles: unknown;
  status: AuthUser['status'];
  headline: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  institutionId: string | null;
  institution: string | null;
  facultyId: string | null;
  faculty: string | null;
  programId: string | null;
  program: string | null;
  scope: string | null;
  statusReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  lastAccessAt: string | null;
  expiresAt: string;
}

interface FastMembershipRow {
  id: string;
  institutionId: string;
  institution: string;
  role: string;
  faculty: string;
  program: string;
  scope: string;
  primary: boolean;
}

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

function readHeader(request: SessionRequestLike, name: string) {
  const headers = request?.headers;

  if (!headers) {
    return null;
  }

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name);
  }

  const direct = (headers as Record<string, string | string[] | undefined>)[name];
  if (typeof direct === 'string') {
    return direct;
  }

  if (Array.isArray(direct)) {
    return direct.join('; ');
  }

  const lowered = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
  if (typeof lowered === 'string') {
    return lowered;
  }

  if (Array.isArray(lowered)) {
    return lowered.join('; ');
  }

  return null;
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

function parseMemberships(value: unknown) {
  if (Array.isArray(value)) {
    return value as NonNullable<AuthUser['memberships']>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value) as NonNullable<AuthUser['memberships']>;
    } catch {
      return [];
    }
  }

  return [] as NonNullable<AuthUser['memberships']>;
}

function mapToAuthUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles?: unknown;
  status?: AuthUser['status'];
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  institutionId?: string | null;
  institution?: string | null;
  facultyId?: string | null;
  faculty?: string | null;
  programId?: string | null;
  program?: string | null;
  scope?: string | null;
  createdAt?: string;
  createdBy?: string | null;
  lastAccessAt?: string | null;
  statusReason?: string | null;
  memberships?: unknown;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    secondaryRoles: parseSecondaryRoles(user.secondaryRoles).filter((item) => item !== user.role),
    status: user.status,
    headline: user.headline ?? '',
    phone: user.phone ?? '',
    location: user.location ?? '',
    bio: user.bio ?? '',
    institutionId: user.institutionId ?? '',
    institution: user.institution ?? '',
    facultyId: user.facultyId ?? '',
    faculty: user.faculty ?? '',
    programId: user.programId ?? '',
    program: user.program ?? '',
    scope: user.scope ?? '',
    createdAt: user.createdAt,
    createdBy: user.createdBy ?? null,
    lastAccessAt: user.lastAccessAt ?? null,
    statusReason: user.statusReason ?? null,
    memberships: parseMemberships(user.memberships),
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

export async function getSessionUser(request: SessionRequestLike) {
  const cookies = parseCookies(readHeader(request, 'cookie'));
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const tokenHash = await hashSessionToken(token);
  const session = await findSessionByTokenHashFast(tokenHash);

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

async function findSessionByTokenHashFast(tokenHash: string) {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.secondary_roles AS "secondaryRoles",
        u.status,
        u.headline,
        u.phone,
        u.location,
        u.bio,
        u.institution_id AS "institutionId",
        u.institution,
        u.faculty_id AS "facultyId",
        u.faculty,
        u.program_id AS "programId",
        u.program,
        u.scope,
        u.status_reason AS "statusReason",
        u.created_by AS "createdBy",
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt",
        u.last_access_at AS "lastAccessAt",
        s.expires_at AS "expiresAt"
      FROM maturity_sessions s
      INNER JOIN maturity_users u
        ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND u.status = ${'Activo'}
      LIMIT 1
    `) as FastSessionRow[];

    const session = rows[0];
    if (!session) {
      return null;
    }

    const membershipRows = (await sql`
      SELECT
        membership.id,
        membership.institution_id AS "institutionId",
        institution.name AS "institution",
        membership.role,
        COALESCE(faculty.name, '') AS faculty,
        COALESCE(program.name, '') AS program,
        COALESCE(membership.scope, '') AS scope,
        membership.is_primary AS "primary"
      FROM maturity_user_institution_roles membership
      INNER JOIN maturity_institutions institution
        ON institution.id = membership.institution_id
      LEFT JOIN maturity_institution_faculties faculty
        ON faculty.id = membership.faculty_id
      LEFT JOIN maturity_institution_programs program
        ON program.id = membership.program_id
      WHERE membership.user_id = ${session.id}
      ORDER BY membership.is_primary DESC, membership.created_at ASC
    `) as FastMembershipRow[];

    return {
      ...session,
      memberships: membershipRows,
    };
  } catch {
    return findSessionByTokenHashWithBootstrap(tokenHash);
  }
}

export async function destroySession(request: SessionRequestLike) {
  const cookies = parseCookies(readHeader(request, 'cookie'));
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
