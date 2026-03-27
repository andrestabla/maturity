import { canOperateStageCheckpoint } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { findCourseRecordBySlug, updateStageCheckpointRecord } from '../lib/store.js';
import type { StageCheckpointMutationInput } from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface CheckpointPayload extends StageCheckpointMutationInput {
  courseSlug?: string;
  checkpointIndex?: number;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method !== 'PATCH') {
    return errorResponse(405, 'Method not allowed');
  }

  const payload = await readJson<CheckpointPayload>(request);

  if (!payload.courseSlug || payload.checkpointIndex === undefined) {
    return errorResponse(400, 'Course slug and checkpoint index are required');
  }

  const course = await findCourseRecordBySlug(payload.courseSlug);

  if (!course) {
    return errorResponse(404, 'Course not found');
  }

  const checkpoint = course.stageChecklist[payload.checkpointIndex];

  if (!checkpoint) {
    return errorResponse(404, 'Checkpoint not found');
  }

  if (!canOperateStageCheckpoint(user.role, checkpoint.owner)) {
    return errorResponse(403, 'You do not have permission to update this checkpoint');
  }

  const result = await updateStageCheckpointRecord(payload.courseSlug, payload.checkpointIndex, {
    status: payload.status,
  });

  if (!result) {
    return errorResponse(404, 'Checkpoint not found');
  }

  return jsonResponse(result);
}
