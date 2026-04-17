/**
 * GET /api/h5p/embed?id=X
 *
 * Returns a full standalone HTML page that renders the H5P activity.
 * Loaded inside an <iframe> by the H5PPlayer React component.
 *
 * For 'package' kind: uses h5p-standalone player loading content from R2.
 * For 'embed' kind:   redirects to the stored embed URL.
 */

import { getSessionUser } from '../../lib/session.js';
import { errorResponse } from '../../lib/http.js';
import { getH5PContent } from '../../lib/h5p.js';

export const config = { runtime: 'edge' };

// Public CDN bundle for h5p-standalone player
const H5P_STANDALONE_CDN =
  'https://cdn.jsdelivr.net/npm/h5p-standalone@3.7.1/dist/main.bundle.js';

function buildEmbedHtml(params: {
  contentId: string;
  filesBase: string;  // e.g. /api/h5p/files?contentId=X&path=
  width: number;
  height: number;
  title: string;
}): string {
  const { contentId, filesBase, width, height, title } = params;
  const baseUrl = filesBase;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f8fafc; font-family: system-ui, sans-serif; }
    #h5p-container {
      width: ${width}px;
      max-width: 100%;
      margin: 0 auto;
    }
    .h5p-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 300px;
      color: #64748b;
      gap: 12px;
      font-size: 14px;
    }
    .h5p-spinner {
      width: 24px; height: 24px;
      border: 3px solid #e2e8f0;
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .h5p-error {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #dc2626;
      font-size: 13px;
      text-align: center;
      padding: 24px;
    }
  </style>
</head>
<body>
  <div id="h5p-container">
    <div class="h5p-loading" id="loading">
      <div class="h5p-spinner"></div>
      <span>Cargando actividad H5P…</span>
    </div>
  </div>

  <script src="${H5P_STANDALONE_CDN}"></script>
  <script>
    (async function () {
      try {
        const el = document.getElementById('h5p-container');
        // Build a virtual base URL for h5p-standalone
        // It fetches h5p.json, content/content.json, and library files via our proxy
        const filesProxy = (path) =>
          '/api/h5p/files?contentId=${contentId}&path=' + encodeURIComponent(path);

        const player = await new H5PStandalone.H5P(el, {
          h5pJsonPath: filesProxy('h5p.json'),
          frameJs: filesProxy('frame.bundle.js'),
          frameCss: filesProxy('styles/h5p.css'),
          contentJsonPath: filesProxy('content/content.json'),
          librariesPath: (lib) => filesProxy(lib),
        });

        document.getElementById('loading')?.remove();

        // Forward xAPI statements to parent window
        if (window.H5P) {
          window.H5P.externalDispatcher.on('xAPI', function(event) {
            window.parent.postMessage({
              type: 'h5p:xapi',
              contentId: '${contentId}',
              statement: event.data.statement,
            }, '*');
          });
        }
      } catch (err) {
        document.getElementById('loading')?.remove();
        document.getElementById('h5p-container').innerHTML =
          '<div class="h5p-error">Error al cargar la actividad H5P.<br><small>' +
          err.message + '</small></div>';
        console.error('H5P load error:', err);
      }
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const rawUrl = request.url ?? '';
    const host = request.headers.get('host') ?? 'localhost';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `${proto}://${host}${rawUrl}`);

    const id = url.searchParams.get('id');
    if (!id) return new Response('Missing id', { status: 400 });

    const content = await getH5PContent(id);
    if (!content) return new Response('Not found', { status: 404 });

    // ── Embed kind: redirect to stored URL ─────────────────────────────────
    if (content.kind === 'embed') {
      const src = content.embedUrl ?? '';
      if (!src) return new Response('No embed URL configured', { status: 404 });

      // Return a thin wrapper that iframes the external URL
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; }
    body, html { height: 100%; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe src="${escapeHtml(src)}"
    allow="fullscreen; autoplay"
    allowfullscreen
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
  </iframe>
</body>
</html>`;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // ── Package kind: h5p-standalone player ────────────────────────────────
    if (!content.r2BasePath) {
      return new Response('No R2 path configured', { status: 404 });
    }

    // Files are served through /api/h5p/files?contentId=X&path=Y
    const filesBase = `/api/h5p/files?contentId=${content.id}&path=`;

    const html = buildEmbedHtml({
      contentId: content.id,
      filesBase,
      width: content.width,
      height: content.height,
      title: content.title,
    });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });

  } catch (err) {
    console.error('[H5P/embed] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
