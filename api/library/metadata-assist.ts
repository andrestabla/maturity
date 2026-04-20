import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import OpenAI from 'openai';

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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return errorResponse(500, 'Servicio de IA no disponible');

    const openai = new OpenAI({ apiKey });

    const sourceDescription =
      sourceType === 'youtube'
        ? `Video de YouTube: ${url}`
        : sourceType === 'iframe'
          ? `Recurso con código embed/iframe`
          : sourceType === 'file'
            ? `Archivo en: ${url}`
            : `Enlace web: ${url}`;

    const prompt = `Eres un experto en catalogación de recursos educativos digitales para repositorios institucionales universitarios en América Latina.

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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 700,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return errorResponse(500, 'El asistente no devolvió resultado');

    const result = JSON.parse(content) as MetadataAssistResult;
    return jsonResponse({ ok: true, metadata: result });
  } catch (err) {
    console.error('[MetadataAssist] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}
