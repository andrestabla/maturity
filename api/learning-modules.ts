import { canEditCourseModules } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createLearningModuleRecord,
  deleteLearningModuleRecord,
  findLearningModuleById,
  updateLearningModuleRecord,
} from '../lib/store.js';
import type { LearningModuleMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface LearningModuleCreatePayload extends LearningModuleMutationInput {
  courseSlug?: string;
}

interface LearningModuleUpdatePayload extends Partial<LearningModuleMutationInput> {
  courseSlug?: string;
  id?: string;
}

interface LearningModuleDeletePayload {
  courseSlug?: string;
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (!canEditCourseModules(user.role)) {
    return errorResponse(403, 'You do not have permission to manage course modules');
  }

  if (request.method === 'POST') {
    const payload = await readJson<LearningModuleCreatePayload>(request);

    if (!payload.courseSlug) {
      return errorResponse(400, 'Course slug is required');
    }

    const module = await createLearningModuleRecord(payload.courseSlug, {
      title: payload.title,
      learningGoal: payload.learningGoal,
      activities: payload.activities,
      ownResources: payload.ownResources,
      curatedResources: payload.curatedResources,
      completion: payload.completion,
    });

    if (!module) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse({ module }, { status: 201 });
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<LearningModuleUpdatePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and module id are required');
    }

    const current = await findLearningModuleById(payload.courseSlug, payload.id);

    if (!current) {
      return errorResponse(404, 'Module not found');
    }

    const module = await updateLearningModuleRecord(payload.courseSlug, payload.id, payload);

    return jsonResponse({ module });
  }

  if (request.method === 'DELETE') {
    const payload = await readJson<LearningModuleDeletePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and module id are required');
    }

    const deleted = await deleteLearningModuleRecord(payload.courseSlug, payload.id);

    if (!deleted) {
      return errorResponse(404, 'Module not found');
    }

    return jsonResponse({ ok: true });
  }

  return errorResponse(405, 'Method not allowed');
}
