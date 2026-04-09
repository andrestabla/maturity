import { getIntegrationConfig } from '../lib/admin-center.js';
import { errorResponse } from '../lib/http.js';
import { canManageArchitecture } from '../lib/permissions.js';
import { getSessionUser } from '../lib/session.js';
import { findCourseRecordBySlug } from '../lib/store.js';
import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
};

interface GenerateQualityCriteriaPayload {
  courseSlug: string;
  title: string;
  format?: string;
  section?: string;
  summary?: string;
  body?: string;
  stage?: string;
}

function normalizeCriterion(value: string) {
  return value
    .replace(/^[\-\*\d\.\)\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueCriteria(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeCriterion(value);
    if (!normalized) {
      continue;
    }

    const dedupeKey = normalized
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(normalized);
  }

  return result;
}

function fallbackCriteria(input: GenerateQualityCriteriaPayload) {
  const normalizedFormat = (input.format ?? '').trim() || 'Documento';
  const normalizedSection = (input.section ?? '').trim() || 'la sección asignada';
  const baseLabel = input.title.trim();

  return uniqueCriteria([
    `El producto responde al propósito de "${baseLabel}".`,
    `La estructura del producto es clara, completa y coherente con ${normalizedSection}.`,
    `Las instrucciones son accionables, específicas y no dejan ambigüedad para quien produce el recurso.`,
    `El formato ${normalizedFormat} es consistente con el tipo de producto y su intención pedagógica.`,
    `El contenido mantiene alineación con los lineamientos del curso y el alcance de la ficha.`,
  ]);
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
    if (isNodeRes) {
      return response.status(403).json({
        error: 'No tienes permisos para generar criterios de calidad en Arquitectura.',
      });
    }
    return errorResponse(403, 'No tienes permisos para generar criterios de calidad en Arquitectura.');
  }

  let body: GenerateQualityCriteriaPayload = { courseSlug: '', title: '' };
  if (typeof request.json === 'function') {
    try {
      body = await request.json();
    } catch {
      // noop
    }
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  const payload = {
    courseSlug: (body.courseSlug ?? '').trim(),
    title: (body.title ?? '').trim(),
    format: body.format?.trim() ?? '',
    section: body.section?.trim() ?? '',
    summary: body.summary?.trim() ?? '',
    body: body.body?.trim() ?? '',
    stage: body.stage?.trim() ?? '',
  };

  if (!payload.courseSlug || !payload.title) {
    if (isNodeRes) {
      return response.status(400).json({
        error: 'Se requieren el curso y el título del producto para generar criterios.',
      });
    }
    return errorResponse(400, 'Se requieren el curso y el título del producto para generar criterios.');
  }

  const course = await findCourseRecordBySlug(payload.courseSlug);
  if (!course) {
    if (isNodeRes) return response.status(404).json({ error: 'Curso no encontrado.' });
    return errorResponse(404, 'Curso no encontrado.');
  }

  try {
    await getIntegrationConfig('openai');
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (apiKey) {
      const openai = new OpenAI({ apiKey });
      const systemPrompt = `Eres un diseñador instruccional senior.
Genera entre 5 y 7 criterios de calidad breves, accionables y no redundantes para evaluar un producto académico.
Los criterios deben alinearse con el título, el formato, la sección y las instrucciones del producto.
Cada criterio debe ser verificable por un revisor humano y redactarse como una afirmación de calidad.
Devuelve solo JSON válido con un campo "criteria" que sea un arreglo de strings.`;

      const userPrompt = [
        `Curso: ${course.title}`,
        `Producto: ${payload.title}`,
        payload.format ? `Formato: ${payload.format}` : '',
        payload.section ? `Sección: ${payload.section}` : '',
        payload.stage ? `Etapa: ${payload.stage}` : '',
        payload.summary ? `Descripción: ${payload.summary}` : '',
        payload.body ? `Instrucciones: ${payload.body}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const rawResult = completion.choices[0].message.content || '{"criteria":[]}';
      const parsed = JSON.parse(rawResult);
      const criteria = uniqueCriteria(Array.isArray(parsed?.criteria) ? parsed.criteria : []);

      const nextCriteria = criteria.length > 0 ? criteria.slice(0, 7) : fallbackCriteria(payload);

      if (isNodeRes) {
        return response.status(200).json({ criteria: nextCriteria });
      }

      return new Response(JSON.stringify({ criteria: nextCriteria }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  } catch (error) {
    console.error('Generate quality criteria error:', error);
  }

  const criteria = fallbackCriteria(payload);

  if (isNodeRes) {
    return response.status(200).json({ criteria });
  }

  return new Response(JSON.stringify({ criteria }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
