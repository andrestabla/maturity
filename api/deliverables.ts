import {
  canCreateDeliverables,
  canDeleteDeliverables,
  canEditDeliverable,
} from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createDeliverableRecord,
  deleteDeliverableRecord,
  findDeliverableById,
  updateDeliverableRecord,
} from '../lib/store.js';
import type { DeliverableMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface DeliverableCreatePayload extends DeliverableMutationInput {
  courseSlug?: string;
}

interface DeliverableUpdatePayload extends Partial<DeliverableMutationInput> {
  courseSlug?: string;
  id?: string;
}

interface DeliverableDeletePayload {
  courseSlug?: string;
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'POST') {
    if (!canCreateDeliverables(user.role)) {
      return errorResponse(403, 'You do not have permission to create deliverables');
    }

    const payload = await readJson<DeliverableCreatePayload>(request);

    if (!payload.courseSlug) {
      return errorResponse(400, 'Course slug is required');
    }

    const deliverable = await createDeliverableRecord(payload.courseSlug, payload);

    if (!deliverable) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse(
      {
        deliverable,
      },
      {
        status: 201,
      },
    );
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<DeliverableUpdatePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and deliverable id are required');
    }

    const current = await findDeliverableById(payload.courseSlug, payload.id);

    if (!current) {
      return errorResponse(404, 'Deliverable not found');
    }

    if (!canEditDeliverable(user.role, current.owner)) {
      return errorResponse(403, 'You do not have permission to update this deliverable');
    }

    const deliverable = await updateDeliverableRecord(payload.courseSlug, payload.id, payload);

    return jsonResponse({
      deliverable,
    });
  }

  if (request.method === 'DELETE') {
    if (!canDeleteDeliverables(user.role)) {
      return errorResponse(403, 'You do not have permission to delete deliverables');
    }

    const payload = await readJson<DeliverableDeletePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and deliverable id are required');
    }

    const deleted = await deleteDeliverableRecord(payload.courseSlug, payload.id);

    if (!deleted) {
      return errorResponse(404, 'Deliverable not found');
    }

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
