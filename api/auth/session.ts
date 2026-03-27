import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  const user = await getSessionUser(request);

  return jsonResponse({
    authenticated: Boolean(user),
    user,
  });
}
