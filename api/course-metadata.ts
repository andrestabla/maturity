import { canManageCourses } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { updateCourseMetadataRecord } from '../lib/store.js';
import type { CourseMetadataMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method !== 'PATCH') {
    return errorResponse(405, 'Method not allowed');
  }

  if (!canManageCourses(user.role)) {
    return errorResponse(403, 'You do not have permission to update course metadata');
  }

  const courseSlug = new URL(request.url).searchParams.get('slug');

  if (!courseSlug) {
    return errorResponse(400, 'Course slug is required');
  }

  const payload = await readJson<CourseMetadataMutationInput>(request);
  const course = await updateCourseMetadataRecord(courseSlug, payload);

  if (!course) {
    return errorResponse(404, 'Course not found');
  }

  return jsonResponse({
    course,
  });
}
