import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { readCourseContextForAI } from '../../lib/store.js';
import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
};

/**
 * AI Assistant for Batch Asset Integration
 * Analyzes assets vs course curriculum to provide mapping suggestions.
 */
export default async function handler(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return errorResponse(401, 'No autorizado');

  if (request.method !== 'POST') return errorResponse(405, 'Método no permitido');

  try {
    const body = await request.json() as any;
    const { courseSlug, assets } = body;

    if (!courseSlug || !assets || !Array.isArray(assets)) {
      return errorResponse(400, 'Se requiere courseSlug y un arreglo de assets');
    }

    const courseContext = await readCourseContextForAI(courseSlug);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    
    if (!apiKey) {
      return errorResponse(500, 'OPENAI_API_KEY no disponible en el runtime');
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `Eres un Asistente Curricular de IA experto en Diseño Instruccional.
Tu objetivo es mapear recursos de biblioteca (Assets) a un curso específico de manera coherente y pedagógica.

CONTEXTO DEL CURSO:
${courseContext}

REGLAS DE ANÁLISIS:
1. Revisa el título y abstract de cada Asset.
2. Identifica el Módulo más relevante (por ID o Título) y la Unidad/Temática adecuada.
3. Proporciona una justificación breve para el docente.
4. Escribe un "Resumen Pedagógico" de 2 líneas máximo, orientado al estudiante.
5. Clasifica el recurso con tags como "Lectura Obligatoria", "Material Complementario", "Caso de Estudio", etc.

RESPONDE EXCLUSIVAMENTE EN JSON CON ESTE FORMATO:
{
  "mappings": [
    {
      "assetId": "id-del-asset",
      "suggestedModuleId": "id-del-modulo",
      "suggestedUnit": "Nombre de la Unidad",
      "justification": "Razón pedagógica",
      "pedagogicalSummary": "Resumen para el estudiante",
      "suggestedTags": ["Tag 1", "Tag 2"]
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Realiza el mapeo de estos ${assets.length} activos:\n${JSON.stringify(assets.map(a => ({ 
            id: a.id, 
            title: a.title, 
            abstract: a.abstract,
            type: a.resourceType
          })))}` 
        }
      ],
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0].message.content || '{"mappings": []}';
    const result = JSON.parse(responseContent);

    return jsonResponse(result);

  } catch (err) {
    console.error('[AI Assistant] Analysis Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno en el análisis de IA');
  }
}
