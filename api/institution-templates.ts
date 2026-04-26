import { canManageCourses } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  getInstitutionCourseTemplates,
  createInstitutionCourseTemplateRecord,
  updateInstitutionCourseTemplateRecord,
  deleteInstitutionCourseTemplateRecord,
} from '../lib/store.js';
import type { CourseArchitectureTemplateMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface DeletePayload {
  id?: string;
}

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);

    if (!user) {
      return errorResponse(401, 'Authentication required');
    }

    if (!canManageCourses(user.role)) {
      return errorResponse(403, 'You do not have permission to manage institution templates');
    }

    const url = new URL(request.url);
    const institutionId = url.searchParams.get('institutionId');
    const templateId = url.searchParams.get('id');

    if (request.method === 'GET') {
      if (!institutionId) {
        return errorResponse(400, 'institutionId is required');
      }
      const templates = await getInstitutionCourseTemplates(institutionId);
      return jsonResponse({ templates });
    }

    if (request.method === 'POST') {
      if (!institutionId) {
        return errorResponse(400, 'institutionId is required');
      }
      const payload = await readJson<CourseArchitectureTemplateMutationInput>(request);
      const template = await createInstitutionCourseTemplateRecord(institutionId, payload);
      return jsonResponse({ template }, { status: 201 });
    }

    if (request.method === 'PATCH') {
      if (!templateId) {
        return errorResponse(400, 'Template id is required');
      }
      const payload = await readJson<CourseArchitectureTemplateMutationInput>(request);
      const template = await updateInstitutionCourseTemplateRecord(templateId, payload);
      if (!template) {
        return errorResponse(404, 'Template not found');
      }
      return jsonResponse({ template });
    }

    if (request.method === 'DELETE') {
      const payload = await readJson<DeletePayload>(request);
      const id = templateId ?? payload.id;
      if (!id) {
        return errorResponse(400, 'Template id is required');
      }
      await deleteInstitutionCourseTemplateRecord(id);
      return jsonResponse({ ok: true });
    }

    return errorResponse(405, 'Method not allowed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return errorResponse(500, message);
  }
}
