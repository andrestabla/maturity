import { getIntegrationConfig } from '../lib/admin-center.js';
import { getR2Object } from '../lib/r2.js';
import { errorResponse } from '../lib/http.js';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const config = {
  runtime: 'nodejs',
};

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return '{"guidelines":[]}';
  }

  const withoutCodeFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutCodeFence.indexOf('{');
  const lastBrace = withoutCodeFence.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutCodeFence.slice(firstBrace, lastBrace + 1);
  }

  return withoutCodeFence;
}

function normalizeGuideline(rule: string) {
  return rule
    .replace(/^[\-\*\d\.\)\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueGuidelines(rules: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rule of rules) {
    const normalized = normalizeGuideline(rule);
    const dedupeKey = normalized
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();

    if (!normalized || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(normalized);
  }

  return result;
}

export default async function handler(request: Request | any, response?: any) {
  const isNodeRes = response && typeof response.write === 'function';

  if (request.method !== 'POST') {
    if (isNodeRes) return response.status(405).json({ error: 'Método no permitido' });
    return errorResponse(405, 'Método no permitido');
  }

  let body: any = {};
  if (typeof request.json === 'function') {
    try { body = await request.json(); } catch (e) { }
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  const { key } = body || {};

  if (!key) {
    if (isNodeRes) return response.status(400).json({ error: 'Se requiere la clave del archivo en R2.' });
    return errorResponse(400, 'Se requiere la clave del archivo en R2.');
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
      notify({ progress: 10, step: 'Localizando documento en almacén...' });

      const r2Config = await getIntegrationConfig('cloudflare-r2');
      const r2Resp = await getR2Object(key, r2Config);

      if (!r2Resp.ok) throw new Error(`Error al recuperar archivo institucional (${r2Resp.status})`);

      notify({ progress: 30, step: 'Extrayendo texto pedagógico...' });

      const contentType = r2Resp.headers.get('content-type') || '';
      const arrayBuffer = await r2Resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let extractedText = '';

      if (contentType.includes('pdf')) {
        const data = await pdf(buffer);
        extractedText = data.text;
      } else if (contentType.includes('word') || key.endsWith('.doc') || key.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else if (contentType.includes('excel') || contentType.includes('spreadsheet') || key.endsWith('.xls') || key.endsWith('.xlsx')) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        extractedText = XLSX.utils.sheet_to_txt(sheet);
      } else {
        extractedText = buffer.toString('utf-8');
      }

      if (!extractedText.trim()) throw new Error('El documento parece estar vacío o no es legible.');

      notify({ progress: 60, step: 'IA analizando lineamientos y políticas...' });

      await getIntegrationConfig('openai');
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      
      if (!apiKey) {
        throw new Error('No se encontró OPENAI_API_KEY en runtime para la extracción.');
      }

      const openai = new OpenAI({ apiKey });

      const systemPrompt = `Eres un analista curricular experto en diseño instruccional, arquitectura de cursos y estandarización de productos académicos.
Tu objetivo es extraer una lista EXHAUSTIVA, DETALLADA y NO REPETIDA de lineamientos pedagógicos y operativos para la producción de cursos.

Prioriza especialmente reglas sobre:
1. Productos obligatorios por curso.
2. Productos obligatorios por unidad, introducción o cierre.
3. Cantidades o variaciones según número de créditos académicos.
4. Características exigidas de cada producto: formato, idioma, cantidad, obligatoriedad, propósito, relación con RAE o evaluación.
5. Recursos curados, recursos propios, encuentros sincrónicos, cuestionarios, guías, rúbricas, cierres, presentaciones, sílabos, bibliografía y validaciones.
6. Reglas de conteo, cobertura mínima y correspondencia entre créditos, unidades y productos.

Reglas de salida:
1. Devuelve SOLO JSON válido con un campo "guidelines" que sea un arreglo de strings.
2. Cada string debe ser una regla autónoma, clara, accionable y lo más específica posible.
3. Separa reglas diferentes en strings distintos.
4. Incluye explícitamente la condición cuando dependa de créditos académicos.
5. No repitas reglas equivalentes ni reformules la misma idea.
6. Omite nombres propios, firmas, fechas y texto administrativo irrelevante.
7. Si el documento describe tablas o matrices, conviértelas en reglas explícitas.
8. Conserva el detalle de productos y características, no resumas en exceso.

Formato esperado:
{ "guidelines": ["Regla 1", "Regla 2", "..."] }`;

      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              `Extrae del documento una lista exhaustiva de lineamientos para construir cursos. ` +
              `Debes capturar con el mayor detalle posible todos los productos requeridos y sus características, ` +
              `especialmente cuando cambian según el número de créditos académicos. ` +
              `No omitas reglas sobre unidades, introducción, cierre, evaluaciones, recursos, bibliografía, encuentros sincrónicos, RAE, recursos en inglés o cantidades mínimas/máximas.\n\n` +
              extractedText.slice(0, 40000),
          },
        ],
        response_format: { type: 'json_object' },
      });

      const rawResult = chatCompletion.choices[0].message.content || '{"guidelines":[]}';
      const parsed = JSON.parse(extractJsonObject(rawResult));
      const guidelines = uniqueGuidelines(Array.isArray(parsed?.guidelines) ? parsed.guidelines : []);

      notify({
        progress: 100,
        step: '¡Lineamientos extraídos!',
        data: guidelines,
        complete: true,
      });

      if (controller) controller.close();
      if (isNodeRes) response.end();

    } catch (error: any) {
      console.error('Guidelines extraction error:', error);
      notify({ error: error.message || 'Error en la extracción con IA' });
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
