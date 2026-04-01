import { getIntegrationConfig } from '../lib/admin-center.js';
import { errorResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { findCourseRecordBySlug, getInstitutionSettingsRecord } from '../lib/store.js';
import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
};

interface GenerateArchitecturePayload {
  courseSlug: string;
  institutionStructureId?: string;
}

export default async function handler(request: Request | any, response?: any) {
  const isNodeRes = response && typeof response.write === 'function';

  if (request.method !== 'POST') {
    if (isNodeRes) return response.status(405).json({ error: 'Método no permitido' });
    return errorResponse(405, 'Método no permitido');
  }

  const user = await getSessionUser(request);
  if (!user) {
    if (isNodeRes) return response.status(401).json({ error: 'Autenticación requerida' });
    return errorResponse(401, 'Autenticación requerida');
  }

  let body: GenerateArchitecturePayload = { courseSlug: '' };
  if (typeof request.json === 'function') {
    try { body = await request.json(); } catch (e) { }
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  const { courseSlug, institutionStructureId } = body;

  if (!courseSlug) {
    if (isNodeRes) return response.status(400).json({ error: 'Se requiere el slug del curso.' });
    return errorResponse(400, 'Se requiere el slug del curso.');
  }

  try {
    const course = await findCourseRecordBySlug(courseSlug);
    if (!course) throw new Error('Curso no encontrado.');

    const settings = await getInstitutionSettingsRecord();
    const structure = settings.structures.find(s => s.id === (institutionStructureId || course.institutionStructureId));
    
    // Fallback search by institution name if ID is missing or not found
    const finalStructure = structure || settings.structures.find(s => s.institution === course.faculty || s.institution === course.program);
    const guidelines = finalStructure?.pedagogicalGuidelines || [];

    if (isNodeRes) {
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no');
      response.setHeader('Content-Encoding', 'none');
      response.write(': ' + Array(2048).join(' ') + '\n\n');
    }

    const encoder = new TextEncoder();
    const sendEvent = (payload: any) => {
      const dataString = `data: ${JSON.stringify(payload)}\n\n`;
      if (isNodeRes) {
        response.write(dataString);
        if (typeof response.flush === 'function') response.flush();
      } else {
        return encoder.encode(dataString);
      }
    };

    const notify = (payload: any) => {
      sendEvent(payload);
    };

    notify({ progress: 10, step: 'Analizando microcurrículo y lineamientos...' });

    const openaiConfig = await getIntegrationConfig('openai');
    const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

    const systemPrompt = `Eres un Arquitecto Instruccional Senior. Tu objetivo es proponer la arquitectura de productos de un curso basado en su microcurrículo y los lineamientos pedagógicos de la institución.
    
    ESTRUCTURA OBLIGATORIA DEL CURSO:
    1. Sección "Introducción": Productos iniciales (ej. Video de bienvenida, Guía de aprendizaje).
    2. Sección "Unidades": Productos por cada unidad/módulo extraído del microcurrículo.
    3. Sección "Cierre": Productos finales (ej. Evaluación final, Video de cierre).

    LINEAMIENTOS PEDAGÓGICOS (Asegúrate de que los productos cumplan esto):
    ${guidelines.map(g => `- ${g}`).join('\n')}

    DATOS DEL CURSO:
    Título: ${course.title}
    Resumen: ${course.summary}
    Unidades/Módulos: ${JSON.stringify(course.metadata.units)}

    REGLA DE SALIDA:
    Devuelve un JSON estrictamente estructurado en tres bloques: "introduccion", "unidades" y "cierre".
    Cada bloque es un arreglo de productos con: title, summary, format (ej: VIDEO, SCORM, PDF), y section (nombre de la sección o unidad).

    Ejemplo de formato:
    {
      "introduccion": [{ "title": "Video de presentación", "summary": "...", "format": "VIDEO", "section": "Introducción" }],
      "unidades": [{ "title": "Lectura fundamental U1", "summary": "...", "format": "PDF", "section": "Unidad 1" }],
      "cierre": [{ "title": "Examen final", "summary": "...", "format": "SCORM", "section": "Cierre" }]
    }`;

    notify({ progress: 40, step: 'IA diseñando ruta instruccional...' });

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Diseña la arquitectura para el curso "${course.title}".` },
      ],
      response_format: { type: 'json_object' },
    });

    const rawResult = chatCompletion.choices[0].message.content || '{}';
    const result = JSON.parse(rawResult);

    notify({ progress: 100, step: '¡Arquitectura generada!', data: result, complete: true });

    if (isNodeRes) response.end();

  } catch (error: any) {
    console.error('Architecture generation error:', error);
    const dataString = `data: ${JSON.stringify({ error: error.message || 'Error interno' })}\n\n`;
    if (isNodeRes) {
      response.write(dataString);
      response.end();
    } else {
      return errorResponse(500, error.message || 'Error interno');
    }
  }
}
