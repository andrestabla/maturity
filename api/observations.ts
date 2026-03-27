import {
  canCreateObservations,
  canDeleteObservations,
  canEditObservation,
} from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createObservationRecord,
  deleteObservationRecord,
  findObservationById,
  updateObservationRecord,
} from '../lib/store.js';
import type { ObservationMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface ObservationCreatePayload extends ObservationMutationInput {
  courseSlug?: string;
}

interface ObservationUpdatePayload extends Partial<ObservationMutationInput> {
  courseSlug?: string;
  id?: string;
}

interface ObservationDeletePayload {
  courseSlug?: string;
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'POST') {
    if (!canCreateObservations(user.role)) {
      return errorResponse(403, 'You do not have permission to create observations');
    }

    const payload = await readJson<ObservationCreatePayload>(request);

    if (!payload.courseSlug) {
      return errorResponse(400, 'Course slug is required');
    }

    const observation = await createObservationRecord(payload.courseSlug, payload);

    if (!observation) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse(
      {
        observation,
      },
      {
        status: 201,
      },
    );
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<ObservationUpdatePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and observation id are required');
    }

    const current = await findObservationById(payload.courseSlug, payload.id);

    if (!current) {
      return errorResponse(404, 'Observation not found');
    }

    if (!canEditObservation(user.role, current.role)) {
      return errorResponse(403, 'You do not have permission to update this observation');
    }

    const observation = await updateObservationRecord(payload.courseSlug, payload.id, payload);

    return jsonResponse({
      observation,
    });
  }

  if (request.method === 'DELETE') {
    if (!canDeleteObservations(user.role)) {
      return errorResponse(403, 'You do not have permission to delete observations');
    }

    const payload = await readJson<ObservationDeletePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and observation id are required');
    }

    const deleted = await deleteObservationRecord(payload.courseSlug, payload.id);

    if (!deleted) {
      return errorResponse(404, 'Observation not found');
    }

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
