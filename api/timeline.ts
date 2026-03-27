import { canCreateTasks, canDeleteTasks } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  createTimelineItemRecord,
  deleteTimelineItemRecord,
  updateTimelineItemRecord,
} from '../lib/store.js';
import type { TimelineItemMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface TimelineCreatePayload extends TimelineItemMutationInput {
  courseSlug?: string;
}

interface TimelineUpdatePayload extends Partial<TimelineItemMutationInput> {
  courseSlug?: string;
  id?: string;
}

interface TimelineDeletePayload {
  courseSlug?: string;
  id?: string;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method === 'POST') {
    if (!canCreateTasks(user.role)) {
      return errorResponse(403, 'You do not have permission to create milestones');
    }

    const payload = await readJson<TimelineCreatePayload>(request);

    if (!payload.courseSlug) {
      return errorResponse(400, 'Course slug is required');
    }

    const timelineItem = await createTimelineItemRecord(payload.courseSlug, {
      label: payload.label,
      dueDate: payload.dueDate,
      status: payload.status,
    });

    if (!timelineItem) {
      return errorResponse(404, 'Course not found');
    }

    return jsonResponse(
      {
        timelineItem,
      },
      {
        status: 201,
      },
    );
  }

  if (request.method === 'PATCH') {
    if (!canCreateTasks(user.role)) {
      return errorResponse(403, 'You do not have permission to update milestones');
    }

    const payload = await readJson<TimelineUpdatePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and milestone id are required');
    }

    const timelineItem = await updateTimelineItemRecord(payload.courseSlug, payload.id, {
      label: payload.label,
      dueDate: payload.dueDate,
      status: payload.status,
    });

    if (!timelineItem) {
      return errorResponse(404, 'Milestone not found');
    }

    return jsonResponse({
      timelineItem,
    });
  }

  if (request.method === 'DELETE') {
    if (!canDeleteTasks(user.role)) {
      return errorResponse(403, 'You do not have permission to delete milestones');
    }

    const payload = await readJson<TimelineDeletePayload>(request);

    if (!payload.courseSlug || !payload.id) {
      return errorResponse(400, 'Course slug and milestone id are required');
    }

    const deleted = await deleteTimelineItemRecord(payload.courseSlug, payload.id);

    if (!deleted) {
      return errorResponse(404, 'Milestone not found');
    }

    return jsonResponse({
      ok: true,
    });
  }

  return errorResponse(405, 'Method not allowed');
}
