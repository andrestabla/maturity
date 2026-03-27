import { canManageHandoffs } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { advanceCourseStageRecord } from '../lib/store.js';

export const config = {
  runtime: 'edge',
};

interface HandoffPayload {
  courseSlug?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  if (!canManageHandoffs(user.role)) {
    return errorResponse(403, 'You do not have permission to transfer courses between stages');
  }

  const payload = await readJson<HandoffPayload>(request);

  if (!payload.courseSlug) {
    return errorResponse(400, 'Course slug is required');
  }

  const result = await advanceCourseStageRecord(payload.courseSlug);

  if (result.error) {
    return errorResponse(400, result.error);
  }

  return jsonResponse(result);
}
