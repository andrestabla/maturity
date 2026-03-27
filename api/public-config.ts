import { getBrandingSettings } from '../lib/admin-center.js';
import { errorResponse, jsonResponse } from '../lib/http.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const branding = await getBrandingSettings();

    return jsonResponse(
      {
        branding,
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read public config';
    return errorResponse(500, message);
  }
}
