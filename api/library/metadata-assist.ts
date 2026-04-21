import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';

export const config = {
  runtime: 'edge',
};

interface MetadataAssistRequest {
  url?: string;
  sourceType: 'link' | 'youtube' | 'iframe' | 'file';
  existingTitle?: string;
}

interface MetadataAssistResult {
  title: string;
  description: string;
  authors: string[];
  year: number;
  keywords: string[];
  thematicAreas: string[];
  resourceType: string;
  extension: string;
  format: string;
  estimatedStudyMinutes: number;
}

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] ?? '0', 10);
  const m = parseInt(match[2] ?? '0', 10);
  const s = parseInt(match[3] ?? '0', 10);
  return h * 60 + m + Math.round(s / 60);
}

function extractYouTubeId(url: string): string | null {
  return url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

async function callGemini(prompt: string, apiKey: string): Promise<MetadataAssistResult> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 800,
        },
      }),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown error');
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini devolvió respuesta vacía');

  return JSON.parse(text) as MetadataAssistResult;
}

const METADATA_PROMPT = (sourceDescription: string, existingTitle?: string) =>
  `Eres un experto en catalogación de recursos educativos digitales para repositorios institucionales universitarios en América Latina.

Dado el siguiente recurso: ${sourceDescription}
${existingTitle ? `Título conocido: "${existingTitle}"` : ''}

Genera metadatos académicos estructurados para este recurso. Infiere el contenido desde la URL o tipo de fuente:
- Para YouTube: infiere tema académico, tiempo estimado y área disciplinar.
- Para PDFs/documentos: infiere tipo, extensión y áreas temáticas.
- Para enlaces web: infiere tipo de recurso y áreas temáticas.

Responde SOLO con JSON válido con esta estructura exacta:
{
  "title": "título descriptivo del recurso",
  "description": "descripción de 2-3 oraciones sobre el contenido y su utilidad académica",
  "authors": ["Autor 1", "Autor 2"],
  "year": 2024,
  "keywords": ["palabra1", "palabra2", "palabra3", "palabra4", "palabra5"],
  "thematicAreas": ["Área temática 1", "Área temática 2"],
  "resourceType": "Video",
  "extension": "MP4",
  "format": "Video",
  "estimatedStudyMinutes": 30
}

Los valores válidos para resourceType son: Artículo, Paper, Video, Guía, Dataset, Simulación, Presentación, Otro.
Los valores válidos para format son: PDF, Video, Presentación, Documento, Imagen, Enlace externo.`;

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');
    if (request.method !== 'POST') return errorResponse(405, 'Método no permitido');

    let body: MetadataAssistRequest;
    try {
      body = (await request.json()) as MetadataAssistRequest;
    } catch {
      return errorResponse(400, 'Cuerpo JSON inválido');
    }

    const { url, sourceType, existingTitle } = body;
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    // ── YouTube Data API v3 ─────────────────────────────────────────────────
    if (sourceType === 'youtube' && url) {
      const ytKey = process.env.YOUTUBE_API_KEY?.trim();
      const videoId = extractYouTubeId(url);

      if (ytKey && videoId) {
        try {
          const ytResp = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${ytKey}`,
          );
          if (ytResp.ok) {
            const ytData = await ytResp.json() as {
              items?: Array<{
                snippet: {
                  title: string;
                  description: string;
                  channelTitle: string;
                  publishedAt: string;
                  tags?: string[];
                };
                contentDetails: { duration: string };
              }>;
            };
            const video = ytData.items?.[0];
            if (video) {
              const { snippet, contentDetails } = video;
              const minutes = parseIsoDuration(contentDetails.duration);
              return jsonResponse({
                ok: true,
                metadata: {
                  title: snippet.title,
                  description: snippet.description?.slice(0, 600) ?? '',
                  authors: [snippet.channelTitle],
                  year: new Date(snippet.publishedAt).getFullYear(),
                  keywords: (snippet.tags ?? []).slice(0, 5),
                  thematicAreas: [],
                  resourceType: 'Video',
                  extension: 'MP4',
                  format: 'Video',
                  estimatedStudyMinutes: minutes,
                } satisfies MetadataAssistResult,
              });
            }
          }
        } catch {
          // fall through to Gemini
        }
      }

      // YouTube without API key or failed: use Gemini with the URL
      if (geminiKey) {
        try {
          const result = await callGemini(
            METADATA_PROMPT(`Video de YouTube: ${url}`, existingTitle),
            geminiKey,
          );
          return jsonResponse({ ok: true, metadata: result });
        } catch {
          // fall through to error
        }
      }

      return errorResponse(500, 'Servicio de IA no disponible. Configura YOUTUBE_API_KEY o GEMINI_API_KEY.');
    }

    // ── Gemini for all other source types ──────────────────────────────────
    if (!geminiKey) return errorResponse(500, 'Servicio de IA no disponible');

    const sourceDescription =
      sourceType === 'iframe'
        ? 'Recurso con código embed/iframe'
        : sourceType === 'file'
          ? `Archivo subido: ${url ?? 'archivo'}`
          : `Enlace web: ${url}`;

    const result = await callGemini(METADATA_PROMPT(sourceDescription, existingTitle), geminiKey);
    return jsonResponse({ ok: true, metadata: result });
  } catch (err) {
    console.error('[MetadataAssist] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
