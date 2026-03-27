import { canCreateTasks, canDeleteTasks, canEditTask } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createTaskRecord,
  deleteTaskRecord,
  findTaskById,
  updateTaskRecord,
} from '../lib/store.js';
import type { TaskMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface TaskDeletePayload {
  id?: string;
}

interface TaskUpdatePayload extends Partial<TaskMutationInput> {
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'POST') {
    if (!canCreateTasks(user.role)) {
      return errorResponse(403, 'You do not have permission to create tasks');
    }

    const payload = await readJson<TaskMutationInput>(request);
    const task = await createTaskRecord(payload);

    return jsonResponse(
      {
        task,
      },
      {
        status: 201,
      },
    );
  }

  if (request.method === 'PATCH') {
    const payload = await readJson<TaskUpdatePayload>(request);

    if (!payload.id) {
      return errorResponse(400, 'Task id is required');
    }

    const current = await findTaskById(payload.id);

    if (!current) {
      return errorResponse(404, 'Task not found');
    }

    if (!canEditTask(user.role, current.role)) {
      return errorResponse(403, 'You do not have permission to update this task');
    }

    const nextPayload =
      user.role === 'Administrador' || user.role === 'Coordinador'
        ? payload
        : {
            status: payload.status,
            summary: payload.summary,
          };

    const task = await updateTaskRecord(payload.id, nextPayload);

    return jsonResponse({
      task,
    });
  }

  if (request.method === 'DELETE') {
    if (!canDeleteTasks(user.role)) {
      return errorResponse(403, 'You do not have permission to delete tasks');
    }

    const payload = await readJson<TaskDeletePayload>(request);

    if (!payload.id) {
      return errorResponse(400, 'Task id is required');
    }

    const deleted = await deleteTaskRecord(payload.id);

    if (!deleted) {
      return errorResponse(404, 'Task not found');
    }

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
