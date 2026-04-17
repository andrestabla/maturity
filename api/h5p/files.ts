/**
 * GET /api/h5p/files?contentId=X&path=relative/path
 *
 * Proxies H5P package files from R2 storage.
 * Used by the h5p-standalone player in the embed iframe.
 *
 * Files are stored at: library/h5p-{contentId}/{path}
 */

import { getR2Object, resolveR2Config } from '../../lib/r2.js';
import { getH5PContent } from '../../lib/h5p.js';

export const config = { runtime: 'edge' };

const MIME_TYPES: Record<string, string> = {
  json:  'application/json',
  js:    'application/javascript',
  css:   'text/css',
  html:  'text/html; charset=utf-8',
  png:   'image/png',
  jpg:   'image/jpeg',
  jpeg:  'image/jpeg',
  gif:   'image/gif',
  svg:   'image/svg+xml',
  mp4:   'video/mp4',
  webm:  'video/webm',
  mp3:   'audio/mpeg',
  woff2: 'font/woff2',
  woff:  'font/woff',
  ttf:   'font/ttf',
};

export default async function handler(request: Request) {
  try {
    const rawUrl = request.url ?? '';
    const host = request.headers.get('host') ?? 'localhost';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `${proto}://${host}${rawUrl}`);

    const contentId = url.searchParams.get('contentId');
    const filePath = url.searchParams.get('path');

    if (!contentId || !filePath) {
      return new Response('Missing contentId or path', { status: 400 });
    }

    // Security: prevent path traversal
    const normalizedPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');
    if (!normalizedPath) return new Response('Invalid path', { status: 400 });

    // Validate content exists (cache-friendly: skip for known static extensions)
    const ext = normalizedPath.split('.').pop()?.toLowerCase() ?? '';
    const isStaticExt = ['js', 'css', 'png', 'jpg', 'gif', 'svg', 'mp4', 'mp3', 'woff2', 'woff', 'ttf'].includes(ext);

    if (!isStaticExt) {
      // Verify content exists in DB
      const content = await getH5PContent(contentId);
      if (!content || content.kind !== 'package') {
        return new Response('Content not found', { status: 404 });
      }
    }

    // Fetch from R2
    const r2Key = `library/h5p-${contentId}/${normalizedPath}`;
    const r2Config = resolveR2Config();
    const r2Resp = await getR2Object(r2Key, {
      r2AccountId: r2Config.accountId,
      r2AccessKeyId: r2Config.accessKeyId,
      r2SecretAccessKey: r2Config.secretAccessKey,
      r2BucketName: r2Config.bucketName,
    });

    if (!r2Resp.ok) {
      return new Response('File not found', { status: 404 });
    }

    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new Response(r2Resp.body, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('[H5P/files] Error:', err);
    return new Response('Error fetching file', { status: 500 });
  }
}
