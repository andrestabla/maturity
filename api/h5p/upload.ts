/**
 * POST /api/h5p/upload
 *
 * Receives a .h5p file (multipart/form-data), extracts its contents using
 * JSZip, uploads all files to Cloudflare R2, and creates a new H5PContent
 * record in NeonDB.
 *
 * Form fields:
 *   file         — the .h5p file (required)
 *   courseSlug   — optional course to attach to
 *   title        — optional override for the title (default: from h5p.json)
 *   description  — optional description
 */

import JSZip from 'jszip';
import { getSessionUser } from '../../lib/session.js';
import { errorResponse } from '../../lib/http.js';
import { createH5PContent } from '../../lib/h5p.js';
import { uploadToR2 } from '../../lib/r2.js';

export const config = {
  runtime: 'nodejs',   // JSZip needs Node runtime for Buffer support
  api: { bodyParser: false },
};

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');

    if (request.method !== 'POST') return errorResponse(405, 'Método no permitido');

    // ── Parse multipart form ────────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return errorResponse(400, 'Se requiere un archivo .h5p');
    if (!file.name.endsWith('.h5p')) {
      return errorResponse(400, 'El archivo debe tener extensión .h5p');
    }

    const courseSlug = (formData.get('courseSlug') as string | null) ?? undefined;
    const titleOverride = (formData.get('title') as string | null) ?? undefined;
    const description = (formData.get('description') as string | null) ?? undefined;

    // ── Extract ZIP ─────────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Parse h5p.json (metadata)
    const h5pJsonFile = zip.file('h5p.json');
    if (!h5pJsonFile) return errorResponse(400, 'Archivo .h5p inválido: falta h5p.json');

    const h5pJsonText = await h5pJsonFile.async('text');
    const h5pJson = JSON.parse(h5pJsonText) as Record<string, unknown>;

    // Parse content/content.json (content params)
    const contentJsonFile = zip.file('content/content.json');
    const contentJson = contentJsonFile
      ? JSON.parse(await contentJsonFile.async('text')) as Record<string, unknown>
      : null;

    // Extract library name and version from h5p.json
    const mainLibrary = h5pJson.mainLibrary as string | undefined;
    const preloadedDependencies = h5pJson.preloadedDependencies as Array<{
      machineName: string;
      majorVersion: number;
      minorVersion: number;
    }> | undefined;

    const mainDep = preloadedDependencies?.find((d) => d.machineName === mainLibrary);
    const libraryVersion = mainDep
      ? `${mainDep.majorVersion}.${mainDep.minorVersion}`
      : undefined;

    // ── Upload all files to R2 ──────────────────────────────────────────────
    const contentId = crypto.randomUUID();
    const basePath = `h5p-${contentId}`;

    const uploadPromises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;

      uploadPromises.push(
        (async () => {
          const data = await zipEntry.async('arraybuffer');

          // Determine content type
          const ext = relativePath.split('.').pop()?.toLowerCase() ?? '';
          const contentTypeMap: Record<string, string> = {
            json: 'application/json',
            js:   'application/javascript',
            css:  'text/css',
            html: 'text/html',
            png:  'image/png',
            jpg:  'image/jpeg',
            jpeg: 'image/jpeg',
            gif:  'image/gif',
            svg:  'image/svg+xml',
            mp4:  'video/mp4',
            webm: 'video/webm',
            mp3:  'audio/mpeg',
            woff2:'font/woff2',
          };
          const mimeType = contentTypeMap[ext] ?? 'application/octet-stream';

          // Use scope='library', folder=basePath, fileName=relativePath
          await uploadToR2({
            scope: 'library',
            folder: basePath,
            fileName: relativePath,
            body: Buffer.from(data),
            contentType: mimeType,
          });
        })(),
      );
    });

    // Process uploads in batches of 10 to avoid overwhelming the connection
    const batchSize = 10;
    for (let i = 0; i < uploadPromises.length; i += batchSize) {
      await Promise.all(uploadPromises.slice(i, i + batchSize));
    }

    // ── Create DB record ────────────────────────────────────────────────────
    const title = titleOverride ?? (h5pJson.title as string) ?? file.name.replace('.h5p', '');

    const content = await createH5PContent({
      courseSlug,
      institutionId: user.institutionId ?? undefined,
      title,
      description,
      kind: 'package',
      r2BasePath: `library/${basePath}`,
      libraryName: mainLibrary,
      libraryVersion,
      contentJson: contentJson ?? undefined,
      h5pJson,
      width: 800,
      height: 500,
      xapiTracking: true,
      createdBy: user.id,
    });

    return Response.json({
      ok: true,
      content,
      filesUploaded: uploadPromises.length,
    }, { status: 201 });

  } catch (err) {
    console.error('[H5P/upload] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error al procesar el archivo H5P');
  }
}
