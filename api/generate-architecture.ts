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

  const streamLogic = async (controller?: ReadableStreamDefaultController) => {
    const notify = (payload: any) => {
      if (controller) controller.enqueue(sendEvent(payload));
      else sendEvent(payload);
    };

    try {
      const course = await findCourseRecordBySlug(courseSlug);
      if (!course) throw new Error('Curso no encontrado.');

      const settings = await getInstitutionSettingsRecord();
      const structureId = institutionStructureId || course.institutionStructureId;
      const structure = settings.structures.find(s => s.id === structureId);
      
      const finalStructure = structure || settings.structures.find(s => s.institution === course.faculty || s.institution === course.program);
      const guidelines = finalStructure?.pedagogicalGuidelines || [];

      notify({ progress: 10, step: 'Conectando con el Arquitecto IA...' });

      const openaiConfig = await getIntegrationConfig('openai');
      // Recuperación robusta: Configuración DB o Variable de Entorno
      const apiKey = openaiConfig.openaiApiKey || openaiConfig.apiKey || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('No se encontró una API Key de OpenAI válida en la configuración ni en el entorno.');
      }

      const openai = new OpenAI({ apiKey: apiKey.trim() });

      const systemPrompt = `Eres un Arquitecto Instruccional Senior. Tu objetivo es proponer la arquitectura de productos de un curso basado en su microcurrículo y los lineamientos pedagógicos de la institución.
      
      ESTRUCTURA OBLIGATORIA DEL CURSO:
      1. Sección "Introducción": Productos iniciales (ej. Video de bienvenida, Guía de aprendizaje).
      2. Sección "Unidades": Productos por cada unidad/módulo extraído del microcurrículo.
      3. Sección "Cierre": Productos finales (ej. Evaluación final, Video de cierre).

      LINEAMIENTOS PEDAGÓGICOS (Asegúrate de que los productos cumplan esto):
      ${guidelines.length > 0 ? guidelines.map(g => `- ${g}`).join('\n') : '- Seguir estándares generales de diseño instruccional.'}

      DATOS DEL CURSO:
      Título: ${course.title}
      Resumen: ${course.summary}
      Unidades/Módulos: ${JSON.stringify(course.metadata.units || [])}

      REGLA DE SALIDA:
      Devuelve un JSON estrictamente estructurado en tres bloques: "introduccion", "unidades" y "cierre".
      Cada bloque es un arreglo de productos con: title, summary, format (ej: Video, RED, Pódcast, Infografía, Documento, Actividad, Lectura, Evaluación), y section (nombre de la sección o unidad).

      Asegúrate de que el campo "format" coincida EXACTAMENTE con uno de estos valores: Video, RED, Pódcast, Infografía, Documento, Actividad, Lectura, Evaluación.

      Asegúrate de que el campo "section" sea "Introducción", "Cierre" o el nombre de la unidad (ej: "Unidad 1").

      Ejemplo de formato:
      {
        "introduccion": [{ "title": "Video de presentación", "summary": "...", "format": "Video", "section": "Introducción" }],
        "unidades": [{ "title": "Lectura fundamental U1", "summary": "...", "format": "Documento", "section": "Unidad 1" }],
        "cierre": [{ "title": "Examen final", "summary": "...", "format": "Evaluación", "section": "Cierre" }]
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

      if (controller) controller.close();
      if (isNodeRes) response.end();

    } catch (error: any) {
      console.error('Architecture generation error:', error);
      notify({ error: error.message || 'Error interno' });
      if (controller) controller.close();
      if (isNodeRes) response.end();
    }
  };

  if (isNodeRes) {
    await streamLogic();
  } else {
    const stream = new ReadableStream({ start: streamLogic });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'none'
      }
    });
  }
}
