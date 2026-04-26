import { getIntegrationConfig } from '../lib/admin-center.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { canManageCourses } from '../lib/permissions.js';
import { getGuidelinesForInstitution } from '../lib/store.js';
import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
};

interface ProductDescriptionInput {
  title: string;
  format: string;
  section: string;
}

interface Payload {
  institutionId: string;
  products: ProductDescriptionInput[];
}

export default async function handler(request: Request | any, response?: any) {
  const isNodeRes = response && typeof response.write === 'function';

  const fail = (status: number, msg: string) =>
    isNodeRes ? response.status(status).json({ error: msg }) : errorResponse(status, msg);

  if (request.method !== 'POST') return fail(405, 'Method not allowed');

  const user = await getSessionUser(request);
  if (!user) return fail(401, 'Authentication required');
  if (!canManageCourses(user.role)) return fail(403, 'No tienes permisos para usar el asistente IA.');

  let body: Payload = { institutionId: '', products: [] };
  if (typeof request.json === 'function') {
    try { body = await request.json(); } catch (e) {}
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  if (!body.institutionId) return fail(400, 'institutionId is required');
  if (!Array.isArray(body.products) || body.products.length === 0) return fail(400, 'products array is required');

  const guidelines = await getGuidelinesForInstitution(body.institutionId);

  await getIntegrationConfig('openai');
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fail(500, 'OPENAI_API_KEY no configurada.');

  const openai = new OpenAI({ apiKey });

  const guidelinesText = guidelines.length > 0
    ? guidelines.map((g) => `- ${g}`).join('\n')
    : '- Seguir estándares generales de diseño instruccional.';

  const productsList = body.products
    .map((p, i) => `${i + 1}. Título: "${p.title}" | Formato: ${p.format} | Sección: ${p.section}`)
    .join('\n');

  const systemPrompt = `Eres un diseñador instruccional experto. Genera una descripción breve (máximo 2 oraciones, tono académico y claro) para cada producto de un curso virtual, respetando los lineamientos pedagógicos institucionales.

LINEAMIENTOS INSTITUCIONALES:
${guidelinesText}

INSTRUCCIONES:
- Responde ÚNICAMENTE con un objeto JSON: { "descriptions": ["desc1", "desc2", ...] }
- El array debe tener exactamente el mismo número de elementos que los productos dados.
- Cada descripción debe ser concisa, orientada al estudiante, y coherente con el formato y la sección del producto.
- Si el título ya es descriptivo, refuerza el propósito pedagógico y el resultado esperado.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Genera descripciones para estos ${body.products.length} producto(s):\n\n${productsList}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const raw = completion.choices[0].message.content ?? '{}';
  let parsed: { descriptions?: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return isNodeRes
      ? response.status(500).json({ error: 'La IA no devolvió un formato válido.' })
      : errorResponse(500, 'La IA no devolvió un formato válido.');
  }

  const descriptions = Array.isArray(parsed.descriptions) ? parsed.descriptions : [];

  if (isNodeRes) {
    return response.status(200).json({ descriptions });
  }
  return jsonResponse({ descriptions });
}
