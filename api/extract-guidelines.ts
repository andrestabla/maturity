import { getIntegrationConfig } from '../lib/admin-center.js';
import { getR2Object } from '../lib/r2.js';
import { errorResponse } from '../lib/http.js';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
// @ts-expect-error Direct import for Vercel
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const config = {
  runtime: 'nodejs',
};

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

      const openaiConfig = await getIntegrationConfig('openai');
      const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

      const systemPrompt = `Eres un experto en currículo y diseño instruccional. 
      Tu tarea es extraer LINEAMIENTOS PEDAGÓGICOS, REGLAS OPERATIVAS y ESTÁNDARES DE CALIDAD del texto proporcionado.
      
      Reglas:
      1. Devuelve un JSON con un campo "guidelines" que sea un ARREGLO DE STRINGS.
      2. Cada string debe ser una regla corta, clara y autónoma (ej: "Toda unidad debe tener 1 guía de aprendizaje").
      3. Ignora información administrativa, nombres de personas o fechas de creación.
      4. Si no encuentras reglas claras, intenta sintetizar las políticas de diseño que se mencionan.
      
      Formato esperado:
      { "guidelines": ["Regla 1", "Regla 2", ...] }`;

      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extrae los lineamientos de este documento (solo reglas accionables):\n\n${extractedText.slice(0, 20000)}` },
        ],
        response_format: { type: 'json_object' },
      });

      const rawResult = chatCompletion.choices[0].message.content || '{"guidelines":[]}';
      const result = JSON.parse(rawResult);

      notify({ progress: 100, step: '¡Lineamientos extraídos!', data: result.guidelines || [], complete: true });

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
