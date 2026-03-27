import { canEditStageNote } from '../lib/permissions.js';
import { errorResponse, jsonResponse, readJson } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import {
  findCourseRecordBySlug,
  updateCourseStageNoteRecord,
} from '../lib/store.js';
import type {
  CourseStageNoteKey,
  CourseStageNoteMutationInput,
} from '../src/types.js';

export const config = {
  runtime: 'edge',
};

interface StageNoteUpdatePayload extends CourseStageNoteMutationInput {
  courseSlug?: string;
  key?: CourseStageNoteKey;
}

export default async function handler(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  if (request.method !== 'PATCH') {
    return errorResponse(405, 'Method not allowed');
  }

  const payload = await readJson<StageNoteUpdatePayload>(request);

  if (!payload.courseSlug || !payload.key) {
    return errorResponse(400, 'Course slug and stage note key are required');
  }

  const course = await findCourseRecordBySlug(payload.courseSlug);

  if (!course) {
    return errorResponse(404, 'Course not found');
  }

  const currentNote = course.stageNotes[payload.key];

  if (!canEditStageNote(user.role, currentNote.owner)) {
    return errorResponse(403, 'You do not have permission to update this stage note');
  }

  const stageNote = await updateCourseStageNoteRecord(payload.courseSlug, payload.key, {
    status: payload.status,
    summary: payload.summary,
    evidence: payload.evidence,
    blockers: payload.blockers,
  });

  return jsonResponse({ stageNote });
}
