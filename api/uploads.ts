import { canManageUsers } from '../lib/permissions.js';
import { buildR2FileUrl, uploadToR2, type UploadScope } from '../lib/r2.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';

export const config = {
  runtime: 'nodejs',
};

const ALLOWED_SCOPES = new Set<UploadScope>(['branding', 'course', 'library', 'profile', 'general']);

function resolveScope(value: FormDataEntryValue | null): UploadScope {
  if (typeof value !== 'string') {
    return 'general';
  }

  return ALLOWED_SCOPES.has(value as UploadScope) ? (value as UploadScope) : 'general';
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const user = await getSessionUser(request);

  if (!user) {
    return errorResponse(401, 'Authentication required');
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const scope = resolveScope(formData.get('scope'));
  const folder = typeof formData.get('folder') === 'string' ? String(formData.get('folder')) : '';

  if (!(file instanceof File)) {
    return errorResponse(400, 'Debes adjuntar un archivo válido.');
  }

  if (scope === 'branding' && !canManageUsers(user.role)) {
    return errorResponse(403, 'Solo administradores pueden cargar recursos de branding.');
  }

  if (!file.size) {
    return errorResponse(400, 'El archivo está vacío.');
  }

  const maxBytes = scope === 'branding' ? 8 * 1024 * 1024 : 25 * 1024 * 1024;

  if (file.size > maxBytes) {
    return errorResponse(400, 'El archivo supera el tamaño permitido para esta carga.');
  }

  if (scope === 'branding' && file.type && !file.type.startsWith('image/')) {
    return errorResponse(400, 'Branding solo admite imágenes para logo y favicon.');
  }

  try {
    const result = await uploadToR2({
      scope,
      folder,
      fileName: file.name || 'archivo',
      contentType: file.type || 'application/octet-stream',
      body: await file.arrayBuffer(),
    });

    return jsonResponse(
      {
        key: result.key,
        url: buildR2FileUrl(result.key),
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : 'No fue posible cargar el archivo en R2.',
    );
  }
}
