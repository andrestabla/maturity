import { getIntegrationConfig } from '../lib/admin-center.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { canManageCourses } from '../lib/permissions.js';
import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
};

interface Payload {
  guidelines: string[];
}

export default async function handler(request: Request | any, response?: any) {
  const isNodeRes = response && typeof response.write === 'function';
  const fail = (status: number, msg: string) =>
    isNodeRes ? response.status(status).json({ error: msg }) : errorResponse(status, msg);

  if (request.method !== 'POST') return fail(405, 'Method not allowed');

  const user = await getSessionUser(request);
  if (!user) return fail(401, 'Authentication required');
  if (!canManageCourses(user.role)) return fail(403, 'Permisos insuficientes.');

  let body: Payload = { guidelines: [] };
  if (typeof request.json === 'function') {
    try { body = await request.json(); } catch (e) {}
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  if (!Array.isArray(body.guidelines) || body.guidelines.length < 2) {
    return isNodeRes
      ? response.status(200).json({ semanticDuplicates: [] })
      : jsonResponse({ semanticDuplicates: [] });
  }

  await getIntegrationConfig('openai');
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fail(500, 'OPENAI_API_KEY no configurada.');

  const openai = new OpenAI({ apiKey });

  const numbered = body.guidelines
    .map((g, i) => `[${i}] ${g}`)
    .join('\n');

  const systemPrompt = `Eres un experto en pedagogía y diseño curricular. Se te dará una lista numerada de lineamientos pedagógicos institucionales.

Tu tarea es identificar todos los pares de lineamientos que expresan la MISMA idea o instrucción, aunque estén redactados de forma diferente (semánticamente equivalentes o muy similares). Ignora diferencias de redacción, sinónimos o estructura gramatical.

Responde ÚNICAMENTE con un objeto JSON: { "pairs": [[i, j], ...] }
- Cada par [i, j] representa dos índices (base 0) que expresan lo mismo.
- Si no hay pares similares, devuelve { "pairs": [] }.
- No incluyas pares que sean solo vagamente relacionados; solo los que dicen esencialmente lo mismo.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Lista de lineamientos:\n\n${numbered}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const raw = completion.choices[0].message.content ?? '{}';
  let parsed: { pairs?: number[][] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { pairs: [] };
  }

  const pairs = Array.isArray(parsed.pairs) ? parsed.pairs : [];

  // Flatten pairs into a set of duplicate indices
  const semanticDuplicates = Array.from(
    new Set(pairs.flatMap((pair) => pair.filter((idx) => typeof idx === 'number' && idx >= 0 && idx < body.guidelines.length))),
  );

  if (isNodeRes) return response.status(200).json({ semanticDuplicates });
  return jsonResponse({ semanticDuplicates });
}
