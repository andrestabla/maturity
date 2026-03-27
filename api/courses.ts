import { canDeleteCourses, canManageCourses } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createCourseRecord,
  deleteCourseRecord,
  updateCourseRecord,
} from '../lib/store.js';
import type { CourseMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface DeletePayload {
  slug?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'POST') {
    if (!canManageCourses(user.role)) {
      return errorResponse(403, 'You do not have permission to create courses');
    }

    const payload = await readJson<CourseMutationInput>(request);
    const course = await createCourseRecord(payload);

    return jsonResponse(
      {
        course,
      },
      {
        status: 201,
      },
    );
  }

  if (request.method === 'PATCH') {
    if (!canManageCourses(user.role)) {
      return errorResponse(403, 'You do not have permission to update courses');
    }

    const slug = new URL(request.url).searchParams.get('slug');

    if (!slug) {
      return errorResponse(400, 'Course slug is required');
    }

    const payload = await readJson<CourseMutationInput>(request);
    const course = await updateCourseRecord(slug, payload);

    if (!course) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse({
      course,
    });
  }

  if (request.method === 'DELETE') {
    if (!canDeleteCourses(user.role)) {
      return errorResponse(403, 'You do not have permission to delete courses');
    }

    const payload = await readJson<DeletePayload>(request);

    if (!payload.slug) {
      return errorResponse(400, 'Course slug is required');
    }

    const deleted = await deleteCourseRecord(payload.slug);

    if (!deleted) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
