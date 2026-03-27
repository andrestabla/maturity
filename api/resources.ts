import {
  canCreateLibraryResources,
  canDeleteLibraryResources,
  canEditLibraryResource,
} from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createLibraryResourceRecord,
  deleteLibraryResourceRecord,
  findLibraryResourceById,
  updateLibraryResourceRecord,
} from '../lib/store.js';
import type { LibraryResourceMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface ResourceUpdatePayload extends Partial<LibraryResourceMutationInput> {
  id?: string;
}

interface ResourceDeletePayload {
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'POST') {
    if (!canCreateLibraryResources(user.role)) {
      return errorResponse(403, 'You do not have permission to create resources');
    }

    const payload = await readJson<LibraryResourceMutationInput>(request);
    const resource = await createLibraryResourceRecord(payload);

    return jsonResponse(
      {
        resource,
      },
      {
        status: 201,
      },
    );
  }

  if (request.method === 'PATCH') {
    if (!canEditLibraryResource(user.role)) {
      return errorResponse(403, 'You do not have permission to update resources');
    }

    const payload = await readJson<ResourceUpdatePayload>(request);

    if (!payload.id) {
      return errorResponse(400, 'Resource id is required');
    }

    const current = await findLibraryResourceById(payload.id);

    if (!current) {
      return errorResponse(404, 'Resource not found');
    }

    const resource = await updateLibraryResourceRecord(payload.id, payload);

    return jsonResponse({
      resource,
    });
  }

  if (request.method === 'DELETE') {
    if (!canDeleteLibraryResources(user.role)) {
      return errorResponse(403, 'You do not have permission to delete resources');
    }

    const payload = await readJson<ResourceDeletePayload>(request);

    if (!payload.id) {
      return errorResponse(400, 'Resource id is required');
    }

    const deleted = await deleteLibraryResourceRecord(payload.id);

    if (!deleted) {
      return errorResponse(404, 'Resource not found');
    }

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
