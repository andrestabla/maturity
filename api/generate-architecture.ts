import { getIntegrationConfig } from '../lib/admin-center.js';
import { errorResponse } from '../lib/http.js';
import { canManageArchitecture } from '../lib/permissions.js';
import { getSessionUser } from '../lib/session.js';
import { findCourseRecordBySlug, getInstitutionSettingsRecord, getProductFormatTemplates } from '../lib/store.js';
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

  if (!canManageArchitecture(user.role)) {
    if (isNodeRes) return response.status(403).json({ error: 'No tienes permisos para generar la arquitectura con IA.' });
    return errorResponse(403, 'No tienes permisos para generar la arquitectura con IA.');
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

      const [settings, formatTemplates] = await Promise.all([
        getInstitutionSettingsRecord(),
        getProductFormatTemplates(),
      ]);
      const structureId = institutionStructureId || course.institutionStructureId;
      const structure = settings.structures.find(s => s.id === structureId);

      const finalStructure = structure || settings.structures.find(s => s.institution === course.faculty || s.institution === course.program);
      const guidelines = finalStructure?.pedagogicalGuidelines || [];

      // Build section template reference for the AI prompt
      const sectionTemplateGuide = formatTemplates.length > 0
        ? formatTemplates.map(tpl => {
            const sectionsList = tpl.sections.map(s => `    - ${s.title}: ${s.instructions.slice(0, 120)}`).join('\n');
            return `  ${tpl.label}:\n${sectionsList}`;
          }).join('\n')
        : '';

      notify({ progress: 10, step: 'Conectando con el Arquitecto IA...' });

      await getIntegrationConfig('openai');
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      
      if (!apiKey) {
        throw new Error('No se encontró OPENAI_API_KEY en runtime para generar la arquitectura.');
      }

      const openai = new OpenAI({ apiKey });
      const units = Array.isArray(course.metadata.units) ? course.metadata.units : [];
      const unitBlueprint =
        units.length > 0
          ? units
              .map((unit: any, index: number) => {
                const topics = Array.isArray(unit.tematicas) && unit.tematicas.length > 0
                  ? unit.tematicas.join(', ')
                  : 'Sin temáticas explícitas';
                return `- Unidad ${index + 1}: ${unit.tituloUnidad || `Unidad ${index + 1}`} | Temáticas: ${topics}`;
              })
              .join('\n')
          : '- El curso no tiene unidades extraídas; evita inventar más de una unidad.';

      const systemPrompt = `Eres un Arquitecto Instruccional Senior. Tu objetivo es proponer la arquitectura de productos de un curso basado en su microcurrículo y los lineamientos pedagógicos de la institución.
      
      ESTRUCTURA OBLIGATORIA DEL CURSO:
      1. Sección "Introducción": Productos iniciales (ej. Video de bienvenida, Guía de aprendizaje).
      2. Sección "Unidades": Productos por cada unidad/módulo extraído del microcurrículo.
      3. Sección "Cierre": Productos finales (ej. Evaluación final, Video de cierre).

      REGLAS CRÍTICAS DE DISTRIBUCIÓN:
      - NO pongas productos de bienvenida, encuadre, reglamento o diagnóstico dentro de las unidades.
      - NO pongas productos de cierre o evaluación final dentro de las unidades.
      - La sección "introduccion" solo contiene productos de arranque del curso.
      - La sección "cierre" solo contiene productos de cierre.
      - La sección "unidades" debe incluir productos repartidos entre TODAS las unidades listadas abajo.
      - Si existen 3 unidades, debes incluir productos con section "Unidad 1", "Unidad 2" y "Unidad 3".
      - Propón al menos 2 productos por unidad cuando el microcurrículo tenga unidades definidas.

      LINEAMIENTOS PEDAGÓGICOS (Asegúrate de que los productos cumplan esto):
      ${guidelines.length > 0 ? guidelines.map(g => `- ${g}`).join('\n') : '- Seguir estándares generales de diseño instruccional.'}

      DATOS DEL CURSO:
      Título: ${course.title}
      Resumen: ${course.summary}
      Unidades/Módulos:
      ${unitBlueprint}

      REGLA DE SALIDA:
      Devuelve un JSON estrictamente estructurado en tres bloques: "introduccion", "unidades" y "cierre".
      Cada bloque es un arreglo de productos con estos campos OBLIGATORIOS:
      - title
      - description
      - instructions
      - format
      - section

      Asegúrate de que el campo "format" coincida EXACTAMENTE con uno de estos valores: Video, RED, Pódcast, Infografía, Documento, Actividad, Lectura, Evaluación.
      El campo "description" debe explicar en 1 o 2 frases qué es el producto y cuál es su propósito.
      El campo "instructions" debe ser detallado, accionable y útil para quien tendrá que producir el recurso. Incluye estructura esperada, restricciones, componentes obligatorios, criterios pedagógicos y cualquier especificación relevante derivada del microcurrículo y los lineamientos institucionales.
      Cuando generes las instrucciones, estructura el contenido USANDO LAS SECCIONES definidas para cada formato (ver PLANTILLAS abajo). Cada sección debe aparecer como un encabezado seguido de sus instrucciones específicas para este producto y curso.

      PLANTILLAS DE SECCIONES POR FORMATO:
${sectionTemplateGuide || '      (Usar estructura libre por sección: Título, Introducción, Desarrollo, Cierre)'}

      Asegúrate de que el campo "section" sea "Introducción", "Cierre" o exactamente una de estas unidades:
      ${units.length > 0 ? units.map((_: any, index: number) => `- Unidad ${index + 1}`).join('\n') : '- Unidad 1'}

      Ejemplo de formato:
      {
        "introduccion": [{ "title": "Video de presentación", "description": "...", "instructions": "...", "format": "Video", "section": "Introducción" }],
        "unidades": [
          { "title": "Lectura fundamental U1", "description": "...", "instructions": "...", "format": "Documento", "section": "Unidad 1" },
          { "title": "Actividad aplicada U2", "description": "...", "instructions": "...", "format": "Actividad", "section": "Unidad 2" }
        ],
        "cierre": [{ "title": "Examen final", "description": "...", "instructions": "...", "format": "Evaluación", "section": "Cierre" }]
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
