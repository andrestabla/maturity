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

export default async function handler(request: Request | any) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Método no permitido');
  }

  // Soporte universal para Vercel Serverless (req.body) vs Standard Request (await req.json())
  let body: any = {};
  if (typeof request.json === 'function') {
    body = await request.json();
  } else if (request.body) {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  const { key } = body || {};

  if (!key) {
    return errorResponse(400, 'Se requiere la clave del archivo en R2.');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (payload: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        sendEvent({ progress: 10, step: 'Conectando con almacenamiento...' });

        const r2Config = await getIntegrationConfig('cloudflare-r2');
        const response = await getR2Object(key, r2Config);

        if (!response.ok) {
          throw new Error(`Error al recuperar archivo de R2 (${response.status})`);
        }

        sendEvent({ progress: 25, step: 'Descargando documento y validando tipo...' });

        const contentType = response.headers.get('content-type') || '';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let extractedText = '';

        sendEvent({ progress: 40, step: 'Extrayendo contenido del documento...' });

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

        if (!extractedText.trim()) {
          throw new Error('No fue posible extraer texto del documento. Quizá sea una imagen o está vacío.');
        }

        sendEvent({ progress: 60, step: 'Iniciando análisis semántico con Inteligencia Artificial...' });

        // OpenAI Analysis
        const openaiConfig = await getIntegrationConfig('openai');
        const openai = new OpenAI({ apiKey: openaiConfig.apiKey });

        const systemPrompt = `Eres un experto en currículo académico. Tu tarea es extraer la siguiente información LITERALMENTE de un documento de microcurrículo y devolverla en formato JSON estructurado. 
        Si un campo no se encuentra, déjalo como string vacío o array vacío.
        
        Campos requeridos:
        - facultad: string
        - programa: string
        - semestre: string
        - tipoCurso: string
        - creditos: number
        - resultadosAprendizaje: string[]
        - descripcionCurso: string
        - unidades: { title: string; objective: string; topics: string[] }[]
        - metodologia: string
        - evaluacion: string
        - bibliografia: string[]`;

        sendEvent({ progress: 75, step: 'Sintetizando unidades y resultados de aprendizaje...' });

        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analiza el siguiente texto y extrae la información requerida:\n\n${extractedText.slice(0, 15000)}` },
          ],
          response_format: { type: 'json_object' },
        });

        const rawResult = chatCompletion.choices[0].message.content || '{}';
        let result;
        try {
          result = JSON.parse(rawResult);
        } catch (e) {
          console.error('OpenAI returned invalid JSON:', rawResult);
          throw new Error('La IA no devolvió un formato válido de datos.');
        }

        sendEvent({ progress: 100, step: '¡Completado!', data: result });
        controller.close();

      } catch (error: any) {
        console.error('Microcurriculo analyze breakdown:', {
          error: error.message,
          stack: error.stack,
          key
        });

        sendEvent({ 
          error: typeof error === 'string' ? error : (error.message || 'Error interno durante el análisis.')
        });
        controller.close();
      }
    }
  });

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
