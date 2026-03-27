import { getBrandingSettings } from '../lib/admin-center.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { loadAppData } from '../lib/store.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);

    if (!user) {
      return errorResponse(401, 'Authentication required');
    }

    const [data, branding] = await Promise.all([loadAppData(), getBrandingSettings()]);

    return jsonResponse(
      {
        data: {
          ...data,
          branding,
        },
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error while loading data';

    return jsonResponse(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
