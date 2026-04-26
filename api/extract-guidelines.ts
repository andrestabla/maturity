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

      const systemPrompt = `Eres un analista curricular experto en diseño instruccional. Analiza el documento de lineamientos pedagógicos institucionales y responde con un JSON estructurado.

El JSON debe tener EXACTAMENTE esta estructura:
{
  "estructura": {
    "creditos1": "descripción de la estructura de un curso de 1 crédito (unidades, sesiones síncronas, etc.)",
    "creditos2": "descripción para 2 créditos",
    "creditos3": "descripción para 3 créditos",
    "creditos4": "descripción para 4 créditos"
  },
  "introduccion": {
    "productos": ["nombre del producto 1", "nombre del producto 2"]
  },
  "cierre": {
    "existe": true,
    "productos": ["nombre del producto 1"]
  },
  "unidades": {
    "productos": ["nombre del producto 1", "nombre del producto 2"]
  },
  "productos": [
    {
      "tipo": "Nombre del tipo de producto (ej. Video de bienvenida)",
      "caracteristicas": [
        "Característica específica 1",
        "Característica específica 2"
      ]
    }
  ]
}

INSTRUCCIONES:
- estructura.creditos1/2/3/4: Describe cuántas unidades, sesiones síncronas u otros elementos estructurales tiene un curso con esa cantidad de créditos. Si no se especifica para ese número, usa "".
- introduccion.productos: Lista de tipos de productos que componen la sección de inicio o introducción del curso (ej. "Video de bienvenida", "Sílabo", "Evaluación diagnóstica").
- cierre.existe: true si el documento menciona sección de cierre/conclusión, false si no.
- cierre.productos: Si existe cierre, lista sus productos. Si no, [].
- unidades.productos: Tipos de productos que debe tener cada unidad o módulo.
- productos: Por cada tipo de producto mencionado en el documento (de cualquier sección), crea un objeto con su nombre y lista de características, requisitos y criterios específicos. Sé exhaustivo: duración, idioma, formato, propósito pedagógico, relación con resultados de aprendizaje, criterios de evaluación, etc.

Devuelve SOLO el JSON. Sin texto adicional.`;

      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              `Analiza este documento de lineamientos institucionales y responde con el JSON estructurado. ` +
              `Sé exhaustivo, especialmente en las características de cada tipo de producto y en la correspondencia entre créditos y estructura del curso.\n\n` +
              extractedText.slice(0, 40000),
          },
        ],
        response_format: { type: 'json_object' },
      });

      const rawResult = chatCompletion.choices[0].message.content || '{}';
      const parsed = JSON.parse(extractJsonObject(rawResult));

      // Normalize to GuidelinesStructured shape
      const structured = {
        estructura: {
          creditos1: String(parsed?.estructura?.creditos1 ?? ''),
          creditos2: String(parsed?.estructura?.creditos2 ?? ''),
          creditos3: String(parsed?.estructura?.creditos3 ?? ''),
          creditos4: String(parsed?.estructura?.creditos4 ?? ''),
        },
        introduccion: {
          productos: Array.isArray(parsed?.introduccion?.productos) ? parsed.introduccion.productos.map(String) : [],
        },
        cierre: {
          existe: Boolean(parsed?.cierre?.existe),
          productos: Array.isArray(parsed?.cierre?.productos) ? parsed.cierre.productos.map(String) : [],
        },
        unidades: {
          productos: Array.isArray(parsed?.unidades?.productos) ? parsed.unidades.productos.map(String) : [],
        },
        productos: Array.isArray(parsed?.productos)
          ? parsed.productos
              .filter((p: any) => p && typeof p.tipo === 'string' && p.tipo.trim())
              .map((p: any) => ({
                tipo: String(p.tipo).trim(),
                caracteristicas: Array.isArray(p.caracteristicas) ? p.caracteristicas.map(String) : [],
              }))
          : [],
      };

      notify({
        progress: 100,
        step: '¡Lineamientos extraídos!',
        data: structured,
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
