import { getIntegrationConfig } from '../lib/admin-center.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { canManageCourses } from '../lib/permissions.js';
import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
};

type SectionKey = 'estructura' | 'introduccion' | 'cierre' | 'unidades' | 'producto';

interface Payload {
  institutionName: string;
  section: SectionKey;
  productTipo?: string;   // only for 'producto' section
  context?: string;       // optional extra text pasted by user
}

export default async function handler(request: Request | any, response?: any) {
  const isNodeRes = response && typeof response.write === 'function';
  const fail = (status: number, msg: string) =>
    isNodeRes ? response.status(status).json({ error: msg }) : errorResponse(status, msg);

  if (request.method !== 'POST') return fail(405, 'Method not allowed');

  const user = await getSessionUser(request);
  if (!user) return fail(401, 'Authentication required');
  if (!canManageCourses(user.role)) return fail(403, 'Permisos insuficientes.');

  let body: Payload = { institutionName: '', section: 'introduccion' };
  if (typeof request.json === 'function') {
    try { body = await request.json(); } catch (e) {}
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  if (!body.institutionName || !body.section) return fail(400, 'institutionName and section are required');

  await getIntegrationConfig('openai');
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fail(500, 'OPENAI_API_KEY no configurada.');

  const openai = new OpenAI({ apiKey });
  const ctx = body.context ? `\n\nContexto adicional del documento:\n${body.context.slice(0, 3000)}` : '';

  const sectionPrompts: Record<SectionKey, { system: string; user: string; schema: string }> = {
    estructura: {
      system: 'Eres un experto en diseño curricular para educación superior en Latinoamérica.',
      user: `Para la institución "${body.institutionName}", sugiere cuántas unidades/módulos y sesiones síncronas tiene un curso típico para cada cantidad de créditos académicos (1, 2, 3 y 4 créditos). Sé conciso y específico.${ctx}\n\nResponde ÚNICAMENTE con JSON: {"creditos1":"...","creditos2":"...","creditos3":"...","creditos4":"..."}`,
      schema: 'json_object',
    },
    introduccion: {
      system: 'Eres un experto en diseño instruccional para educación superior en Latinoamérica.',
      user: `Para la institución "${body.institutionName}", lista los productos educativos que típicamente componen la sección de Introducción o inicio de un curso virtual (ej. video de bienvenida, sílabo, evaluación diagnóstica, guía de aprendizaje, políticas del curso, etc.). Lista entre 4 y 8 productos concretos.${ctx}\n\nResponde ÚNICAMENTE con JSON: {"productos":["...","..."]}`,
      schema: 'json_object',
    },
    cierre: {
      system: 'Eres un experto en diseño instruccional para educación superior en Latinoamérica.',
      user: `Para la institución "${body.institutionName}", lista los productos educativos que típicamente componen la sección de Cierre o conclusión de un curso virtual (ej. evaluación final, cuestionario de salida, video de cierre, encuesta de satisfacción, etc.). Lista entre 3 y 6 productos concretos.${ctx}\n\nResponde ÚNICAMENTE con JSON: {"productos":["...","..."]}`,
      schema: 'json_object',
    },
    unidades: {
      system: 'Eres un experto en diseño instruccional para educación superior en Latinoamérica.',
      user: `Para la institución "${body.institutionName}", lista los productos educativos que típicamente componen cada unidad o módulo de un curso virtual (ej. video de contenido, actividad de aprendizaje, actividad evaluativa, cuestionario, recurso curado, guía de estudio, etc.). Lista entre 4 y 10 productos concretos.${ctx}\n\nResponde ÚNICAMENTE con JSON: {"productos":["...","..."]}`,
      schema: 'json_object',
    },
    producto: {
      system: 'Eres un experto en diseño instruccional y producción de contenido educativo.',
      user: `Para la institución "${body.institutionName}", lista las características, requisitos y criterios que debe cumplir el siguiente tipo de producto educativo: "${body.productTipo ?? 'Producto educativo'}". Incluye aspectos como duración, formato, propósito pedagógico, relación con resultados de aprendizaje, criterios de evaluación, etc. Lista entre 5 y 10 características concretas y accionables.${ctx}\n\nResponde ÚNICAMENTE con JSON: {"caracteristicas":["...","..."]}`,
      schema: 'json_object',
    },
  };

  const prompt = sectionPrompts[body.section];
  if (!prompt) return fail(400, 'section inválida.');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const raw = completion.choices[0].message.content ?? '{}';
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  if (isNodeRes) return response.status(200).json(parsed);
  return jsonResponse(parsed);
}
