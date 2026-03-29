import { getR2Object, isPublicR2Key } from '../lib/r2.js';
import { errorResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';

export const config = {
  runtime: 'nodejs',
};

function sanitizeKey(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  const url = new URL(request.url);
  const key = sanitizeKey(url.searchParams.get('key') || '');

  if (!key || key.includes('..')) {
    return errorResponse(400, 'Archivo inválido.');
  }

  if (!isPublicR2Key(key)) {
    const user = await getSessionUser(request);

    if (!user) {
      return errorResponse(401, 'Authentication required');
    }
  }

  try {
    const upstream = await getR2Object(key);

    if (upstream.status === 404) {
      return errorResponse(404, 'Archivo no encontrado.');
    }

    if (!upstream.ok) {
      const detail = await upstream.text();
      return errorResponse(502, detail || 'No fue posible leer el archivo desde R2.');
    }

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const etag = upstream.headers.get('etag');

    if (contentType) {
      headers.set('content-type', contentType);
    }

    if (contentLength) {
      headers.set('content-length', contentLength);
    }

    if (etag) {
      headers.set('etag', etag);
    }

    headers.set(
      'cache-control',
      isPublicR2Key(key) ? 'public, max-age=31536000, immutable' : 'private, max-age=0, no-store',
    );

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'No fue posible recuperar el archivo.',
    );
  }
}
