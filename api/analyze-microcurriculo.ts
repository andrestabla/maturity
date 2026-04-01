import { getIntegrationConfig } from '../lib/admin-center.js';
import { getR2Object } from '../lib/r2.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'Método no permitido');
  }

  const { key } = await request.json();

  if (!key) {
    return errorResponse(400, 'Se requiere la clave del archivo en R2.');
  }

  try {
    const r2Config = await getIntegrationConfig('cloudflare-r2');
    const response = await getR2Object(key, r2Config);

    if (!response.ok) {
      throw new Error(`Error al recuperar archivo de R2 (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = '';

    if (contentType.includes('pdf')) {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
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
      throw new Error('No fue posible extraer texto del documento.');
    }

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

    return jsonResponse({
      data: result,
      textPreview: extractedText.slice(0, 500) + '...',
    });

  } catch (error: any) {
    console.error('Microcurriculo analyze breakdown:', {
      error: error.message,
      stack: error.stack,
      key
    });

    return errorResponse(
      500,
      typeof error === 'string' ? error : (error.message || 'Error interno durante el análisis.')
    );
  }
}
