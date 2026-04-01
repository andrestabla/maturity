import { getIntegrationConfig } from '../lib/admin-center.js';
import { getR2Object } from '../lib/r2.js';
import { errorResponse } from '../lib/http.js';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
// @ts-expect-error Importación directa para sortear bug de Vercel Serverless (fs ENOENT)
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request | any, response?: any) {
  // If we are given standard Vercel API Node `(req, res)`, use natively res.write() stream
  const isNodeRes = response && typeof response.write === 'function';

  if (request.method !== 'POST') {
    if (isNodeRes) return response.status(405).json({ error: 'Método no permitido' });
    return errorResponse(405, 'Método no permitido');
  }

  let body: any = {};
  if (typeof request.json === 'function') {
    try { body = await request.json(); } catch(e){}
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  const { key } = body || {};

  if (!key) {
    if (isNodeRes) return response.status(400).json({ error: 'Se requiere la clave del archivo en R2.' });
    return errorResponse(400, 'Se requiere la clave del archivo en R2.');
  }

  // Pure Node Serverless direct stream bypassing Edge Web Standard buffer wrap
  if (isNodeRes) {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.setHeader('Content-Encoding', 'none');
    
    // Nginx padding for forcing First-Byte buffer flush
    response.write(': ' + Array(2048).join(' ') + '\n\n');
  }

  const encoder = new TextEncoder();
  const sendEvent = (payload: any) => {
    const dataString = `data: ${JSON.stringify(payload)}\n\n`;
    if (isNodeRes) {
      response.write(dataString);
      if (typeof response.flush === 'function') response.flush();
    } else {
      // Fallback to Web Stream enqueue
      return encoder.encode(dataString);
    }
  };

  const streamLogic = async (controller?: ReadableStreamDefaultController) => {
    const notify = (payload: any) => {
      if (controller) controller.enqueue(sendEvent(payload));
      else sendEvent(payload);
    };

    try {
      notify({ progress: 10, step: 'Conectando con almacenamiento...' });

      const r2Config = await getIntegrationConfig('cloudflare-r2');
      const r2Resp = await getR2Object(key, r2Config);

      if (!r2Resp.ok) throw new Error(`Error al recuperar archivo de R2 (${r2Resp.status})`);

      notify({ progress: 25, step: 'Descargando documento y validando tipo...' });

      const contentType = r2Resp.headers.get('content-type') || '';
      const arrayBuffer = await r2Resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let extractedText = '';

      notify({ progress: 40, step: 'Extrayendo contenido del documento...' });

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

      if (!extractedText.trim()) throw new Error('No fue posible extraer texto del documento.');

      notify({ progress: 60, step: 'Semántica IA analizando...' });

      const openaiConfig = await getIntegrationConfig('openai');
      const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

      const systemPrompt = `Eres un experto en currículo académico. Extrae literalmente la información del microcurrículo y devuélvela en JSON estructurado. 
      REGLA VITAL: Si un campo no se encuentra en la información, asigna el valor "No especificado" si es texto, 0 si es número, o [] si es un arreglo. 
      
      Esquema estricto:
      - facultad: string
      - programa: string
      - semestre: string
      - tipoCurso: string
      - creditos: number
      - descripcionCurso: string
      - resultadosAprendizaje: string[] (uno por campo independiente)
      - unidades: { tituloUnidad: string; tematicas: string[] }[] (módulos y sus temáticas separadas)
      - metodologia: string
      - evaluacion: string[] (discriminada en ítems separados)
      - bibliografia: string[] (ítems separados por campos)`;

      notify({ progress: 75, step: 'Sintetizando unidades y estructurando curso...' });

      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extrae de aquí:\n\n${extractedText.slice(0, 15000)}` },
        ],
        response_format: { type: 'json_object' },
      });

      const rawResult = chatCompletion.choices[0].message.content || '{}';
      let result;
      try {
        result = JSON.parse(rawResult);
      } catch (e) {
        throw new Error('La IA no devolvió un formato válido.');
      }

      notify({ progress: 100, step: '¡Completado!', data: result, complete: true });

      if (controller) controller.close();
      if (isNodeRes) response.end();

    } catch (error: any) {
      console.error('Microcurriculo error:', error);
      notify({ error: typeof error === 'string' ? error : (error.message || 'Error interno') });
      if (controller) controller.close();
      if (isNodeRes) response.end();
    }
  };

  if (isNodeRes) {
    // Vercel Serverless pure execution
    await streamLogic();
  } else {
    // Generic standard Edge response
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
