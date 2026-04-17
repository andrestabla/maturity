/**
 * GET  /api/h5p/state?contentId=X   — get current user's state for a content
 * POST /api/h5p/state               — save xAPI statement or update state
 *
 * Used by the H5P player to persist learner progress.
 */

import { getSessionUser } from '../../lib/session.js';
import { errorResponse, readJson } from '../../lib/http.js';
import { getH5PUserState, upsertH5PUserState } from '../../lib/h5p.js';

export const config = { runtime: 'edge' };

interface XAPIStatement {
  verb?: { id?: string };
  result?: {
    score?: { raw?: number; max?: number; scaled?: number };
    completion?: boolean;
    success?: boolean;
  };
  [key: string]: unknown;
}

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');

    const rawUrl = request.url ?? '';
    const host = request.headers.get('host') ?? 'localhost';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `${proto}://${host}${rawUrl}`);

    // ── GET — load state ────────────────────────────────────────────────────
    if (request.method === 'GET') {
      const contentId = url.searchParams.get('contentId');
      if (!contentId) return errorResponse(400, 'Se requiere contentId');

      const state = await getH5PUserState(contentId, user.id);
      return Response.json(state ?? { completion: false, score: null, xapiStatements: [] });
    }

    // ── POST — save statement ───────────────────────────────────────────────
    if (request.method === 'POST') {
      const body = await readJson<{
        contentId: string;
        courseSlug?: string;
        statement?: XAPIStatement;
        score?: number;
        maxScore?: number;
        completion?: boolean;
        success?: boolean;
      }>(request);

      if (!body.contentId) return errorResponse(400, 'Se requiere contentId');

      // Extract data from xAPI statement if provided
      let score = body.score;
      let maxScore = body.maxScore;
      let completion = body.completion;
      let success = body.success;

      if (body.statement?.result) {
        const result = body.statement.result;
        if (result.score?.raw != null) score ??= result.score.raw;
        if (result.score?.max != null) maxScore ??= result.score.max;
        if (result.completion != null) completion ??= result.completion;
        if (result.success != null) success ??= result.success;
      }

      const state = await upsertH5PUserState({
        contentId: body.contentId,
        userId: user.id,
        courseSlug: body.courseSlug,
        statement: body.statement,
        score,
        maxScore,
        completion,
        success,
      });

      return Response.json(state);
    }

    return errorResponse(405, 'Método no permitido');
  } catch (err) {
    console.error('[H5P/state] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
