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

  const numberedGuidelines = guidelines.length > 0
    ? guidelines.map((g, i) => `[L${i + 1}] ${g}`).join('\n')
    : '[L1] Seguir estándares generales de diseño instruccional.';

  const productsList = body.products
    .map((p, i) => `[P${i + 1}] Título: "${p.title}" | Formato: ${p.format} | Sección: "${p.section}"`)
    .join('\n');

  const systemPrompt = `Eres un diseñador instruccional experto con conocimiento profundo de los lineamientos pedagógicos de esta institución.

Tu proceso para cada producto es el siguiente:

PASO 1 — MAPEO: Identifica qué lineamientos [L#] mencionan, aluden o aplican directamente al producto (por su título, formato o función pedagógica). Considera sinónimos y relaciones implícitas.

PASO 2 — SÍNTESIS: Con base en SOLO los lineamientos encontrados (no inventes), redacta una descripción fiel que:
  - Refleje exactamente lo que los lineamientos establecen para ese tipo de producto.
  - Use el lenguaje y los conceptos propios de los lineamientos (no parafrasees de forma genérica).
  - Sea concisa: máximo 2-3 oraciones.
  - Esté orientada al estudiante o al docente según el contexto del producto.
  - Si ningún lineamiento aplica específicamente, describe el propósito pedagógico general del producto en el contexto del curso.

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con JSON válido:
{
  "results": [
    {
      "productIndex": 1,
      "matchedGuidelines": ["L2", "L7"],
      "description": "Descripción fiel al lineamiento..."
    },
    ...
  ]
}
El array "results" debe tener exactamente un elemento por cada producto dado, en el mismo orden.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `LINEAMIENTOS INSTITUCIONALES:\n${numberedGuidelines}\n\nPRODUCTOS A DESCRIBIR:\n${productsList}\n\nEjecuta el proceso PASO 1 → PASO 2 para cada producto y devuelve el JSON.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const raw = completion.choices[0].message.content ?? '{}';
  let parsed: { results?: Array<{ productIndex: number; matchedGuidelines: string[]; description: string }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return isNodeRes
      ? response.status(500).json({ error: 'La IA no devolvió un formato válido.' })
      : errorResponse(500, 'La IA no devolvió un formato válido.');
  }

  // Build ordered descriptions array aligned to input order
  const descriptions: string[] = new Array(body.products.length).fill('');
  if (Array.isArray(parsed.results)) {
    for (const entry of parsed.results) {
      const idx = entry.productIndex - 1; // 1-based → 0-based
      if (idx >= 0 && idx < body.products.length && entry.description) {
        descriptions[idx] = entry.description;
      }
    }
  }

  if (isNodeRes) return response.status(200).json({ descriptions });
  return jsonResponse({ descriptions });
}
