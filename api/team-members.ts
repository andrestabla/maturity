import {
  canManageCourseTeam,
} from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createTeamMemberRecord,
  deleteTeamMemberRecord,
  findTeamMemberById,
  updateTeamMemberRecord,
} from '../lib/store.js';
import type { TeamMemberMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface TeamMemberCreatePayload extends TeamMemberMutationInput {
  courseSlug?: string;
}

interface TeamMemberUpdatePayload extends Partial<TeamMemberMutationInput> {
  courseSlug?: string;
  id?: string;
}

interface TeamMemberDeletePayload {
  courseSlug?: string;
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (!canManageCourseTeam(user.role)) {
    return errorResponse(403, 'You do not have permission to manage the course team');
  }

  if (request.method === 'POST') {
    const payload = await readJson<TeamMemberCreatePayload>(request);

    if (!payload.courseSlug) {
      return errorResponse(400, 'Course slug is required');
    }

    const member = await createTeamMemberRecord(payload.courseSlug, {
      name: payload.name,
      role: payload.role,
      focus: payload.focus,
      initials: payload.initials,
    });

    if (!member) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse({ member }, { status: 201 });
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<TeamMemberUpdatePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and member id are required');
    }

    const current = await findTeamMemberById(payload.courseSlug, payload.id);

    if (!current) {
      return errorResponse(404, 'Team member not found');
    }

    const member = await updateTeamMemberRecord(payload.courseSlug, payload.id, payload);

    return jsonResponse({ member });
  }

  if (request.method === 'DELETE') {
    const payload = await readJson<TeamMemberDeletePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and member id are required');
    }

    const deleted = await deleteTeamMemberRecord(payload.courseSlug, payload.id);

    if (!deleted) {
      return errorResponse(404, 'Team member not found');
    }

    return jsonResponse({ ok: true });
  }

  return errorResponse(405, 'Method not allowed');
}
