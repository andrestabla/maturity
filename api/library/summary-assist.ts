import OpenAI from 'openai';
import { errorResponse, jsonResponse, readJson } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import type { LibrarySearchResult } from '../../src/types.js';
import { buildAiSummary } from '../../src/utils/libraryPresentation.js';

export const config = {
  runtime: 'edge',
};

interface SummaryAssistRequest {
  asset?: LibrarySearchResult;
}

interface SummaryAssistResponse {
  summary: string;
  source: 'openai' | 'fallback' | 'cached';
}

function buildSummaryPrompt(asset: LibrarySearchResult) {
  return `Eres un asistente experto en curaduría académica universitaria.

Tu tarea es redactar un resumen completo del recurso, 100% en español, claro y útil para docentes y estudiantes.

REGLAS:
- Devuelve un único resumen en español latinoamericano.
- No uses frases en inglés, salvo nombres propios o términos técnicos estrictamente necesarios.
- Si el abstract original está en inglés u otro idioma, tradúcelo y sintetízalo correctamente al español.
- No inventes hallazgos, autores, fechas ni resultados que no estén sustentados por los datos.
- Mantén un tono académico, concreto y aplicable.
- Extensión objetivo: entre 90 y 150 palabras.
- No devuelvas markdown ni viñetas.

DATOS DEL RECURSO:
Título: ${asset.title}
Autores: ${asset.authors.join(', ') || 'No disponibles'}
Fuente: ${asset.provider}
Tipo: ${asset.resourceType}
Fecha: ${asset.publishedAt || 'No disponible'}
Idioma original: ${asset.language || 'No disponible'}
Palabras clave: ${asset.tags.join(', ') || 'No disponibles'}
Abstract original: ${asset.abstract || 'No disponible'}

Responde SOLO con JSON válido:
{"summary":"..."}
`;
}

export default async function handler(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return errorResponse(401, 'No autorizado');
    if (request.method !== 'POST') return errorResponse(405, 'Método no permitido');

    const body = await readJson<SummaryAssistRequest>(request);
    const asset = body.asset;

    if (!asset) {
      return errorResponse(400, 'Se requiere un asset para generar el resumen.');
    }

    const cachedSpanishSummary = typeof asset.metadata?.aiSummaryEs === 'string'
      ? asset.metadata.aiSummaryEs.trim()
      : '';
    if (cachedSpanishSummary) {
      return jsonResponse({
        summary: cachedSpanishSummary,
        source: 'cached',
      } satisfies SummaryAssistResponse);
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return jsonResponse({
        summary: buildAiSummary(asset),
        source: 'fallback',
      } satisfies SummaryAssistResponse);
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildSummaryPrompt(asset) }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return jsonResponse({
        summary: buildAiSummary(asset),
        source: 'fallback',
      } satisfies SummaryAssistResponse);
    }

    const parsed = JSON.parse(content) as { summary?: string };
    const summary = parsed.summary?.trim();

    if (!summary) {
      return jsonResponse({
        summary: buildAiSummary(asset),
        source: 'fallback',
      } satisfies SummaryAssistResponse);
    }

    return jsonResponse({
      summary,
      source: 'openai',
    } satisfies SummaryAssistResponse);
  } catch (error) {
    console.error('[LibrarySummaryAssist] Error:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Error interno al generar el resumen.');
  }
}
