/**
 * POST /api/h5p/ai-generate
 *
 * Uses OpenAI to generate structured H5P content JSON from a source text.
 * The generated content can then be saved via POST /api/h5p/content with kind='ai-generated'.
 *
 * Body: { sourceText, h5pType, title, language? }
 * Returns: { contentJson, suggestedTitle, tokensUsed }
 */

import OpenAI from 'openai';
import { getSessionUser } from '../../lib/session.js';
import { errorResponse, readJson } from '../../lib/http.js';

export const config = { runtime: 'edge' };

// ─────────────────────────────────────────────────────────────────────────────
// Supported AI-generatable types
// ─────────────────────────────────────────────────────────────────────────────

export const AI_GENERATABLE_TYPES = [
  'H5P.QuestionSet',
  'H5P.Flashcards',
  'H5P.Accordion',
  'H5P.TrueFalse',
  'H5P.Blanks',
  'H5P.Summary',
  'H5P.SingleChoiceSet',
] as const;

export type AIGeneratableType = (typeof AI_GENERATABLE_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Content schemas (stored in content_json, rendered by H5PAIPlayer)
// ─────────────────────────────────────────────────────────────────────────────

export interface QuizContent {
  type: 'H5P.QuestionSet';
  title: string;
  passPercentage: number;
  questions: Array<{
    question: string;
    options: string[];
    correct: number;
    explanation?: string;
  }>;
}

export interface FlashcardsContent {
  type: 'H5P.Flashcards';
  title: string;
  description?: string;
  cards: Array<{ front: string; back: string }>;
}

export interface AccordionContent {
  type: 'H5P.Accordion';
  title: string;
  panels: Array<{ title: string; content: string }>;
}

export interface TrueFalseContent {
  type: 'H5P.TrueFalse';
  title: string;
  statements: Array<{ text: string; correct: boolean; explanation?: string }>;
}

export interface BlanksContent {
  type: 'H5P.Blanks';
  title: string;
  sentences: Array<{ text: string }>;
}

export interface SummaryContent {
  type: 'H5P.Summary';
  title: string;
  intro?: string;
  points: string[];
}

export interface SingleChoiceContent {
  type: 'H5P.SingleChoiceSet';
  title: string;
  choices: Array<{ question: string; answers: string[] }>;
}

export type AIGeneratedContent =
  | QuizContent
  | FlashcardsContent
  | AccordionContent
  | TrueFalseContent
  | BlanksContent
  | SummaryContent
  | SingleChoiceContent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompts per type
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(h5pType: AIGeneratableType, sourceText: string, title: string, language: string): string {
  const lang = language === 'es' ? 'español' : 'inglés';
  const base = `Eres un experto en diseño instruccional. A partir del siguiente contenido académico, genera una actividad interactiva H5P de tipo "${h5pType}" en ${lang}. Devuelve SOLO JSON válido sin markdown ni texto adicional.\n\nCONTENIDO FUENTE:\n${sourceText.slice(0, 4000)}\n\nTÍTULO SUGERIDO: ${title}`;

  const schemas: Record<AIGeneratableType, string> = {
    'H5P.QuestionSet': `${base}\n\nGenera un objeto JSON con esta estructura exacta:\n{"type":"H5P.QuestionSet","title":"...","passPercentage":70,"questions":[{"question":"...","options":["opción A","opción B","opción C","opción D"],"correct":0,"explanation":"..."}]}\n- Genera 5-8 preguntas de opción múltiple con 4 opciones cada una\n- "correct" es el índice (0-based) de la opción correcta\n- Incluye una explicación breve para cada pregunta`,

    'H5P.Flashcards': `${base}\n\nGenera un objeto JSON con esta estructura exacta:\n{"type":"H5P.Flashcards","title":"...","description":"...","cards":[{"front":"Término o concepto","back":"Definición o explicación"}]}\n- Genera 8-12 tarjetas con conceptos clave del contenido\n- El frente debe ser conciso (término, pregunta corta o concepto)\n- El reverso debe ser la definición o explicación completa`,

    'H5P.Accordion': `${base}\n\nGenera un objeto JSON con esta estructura exacta:\n{"type":"H5P.Accordion","title":"...","panels":[{"title":"Nombre de la sección","content":"Contenido HTML de la sección con <p>, <ul>, <strong> según corresponda"}]}\n- Genera 4-7 secciones temáticas del contenido\n- Cada sección debe tener un título descriptivo y contenido HTML formateado`,

    'H5P.TrueFalse': `${base}\n\nGenera un objeto JSON con esta estructura exacta:\n{"type":"H5P.TrueFalse","title":"...","statements":[{"text":"Afirmación sobre el contenido...","correct":true,"explanation":"..."}]}\n- Genera 8-12 afirmaciones (mezcla de verdaderas y falsas)\n- Incluye una explicación breve del por qué es verdadera o falsa`,

    'H5P.Blanks': `${base}\n\nGenera un objeto JSON con esta estructura exacta:\n{"type":"H5P.Blanks","title":"...","sentences":[{"text":"La [palabra clave] es un concepto fundamental en [área temática]."}]}\n- Genera 6-10 oraciones con espacios en blanco\n- Usa [corchetes] para marcar las palabras que deben completarse\n- Las palabras en corchetes deben ser términos clave del contenido`,

    'H5P.Summary': `${base}\n\nGenera un objeto JSON con esta estructura exacta:\n{"type":"H5P.Summary","title":"...","intro":"Párrafo introductorio opcional","points":["Punto clave 1","Punto clave 2"]}\n- Genera 6-10 puntos clave que resuman el contenido\n- Cada punto debe ser una idea completa y concisa\n- El intro debe contextualizar el tema en 1-2 oraciones`,

    'H5P.SingleChoiceSet': `${base}\n\nGenera un objeto JSON con esta estructura exacta:\n{"type":"H5P.SingleChoiceSet","title":"...","choices":[{"question":"¿Pregunta?","answers":["Respuesta correcta","Distractor 1","Distractor 2"]}]}\n- Genera 8-10 preguntas de opción única rápida\n- El PRIMER elemento de "answers" SIEMPRE es la respuesta correcta\n- Incluye 2-3 distractores plausibles por pregunta`,
  };

  return schemas[h5pType];
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(request: Request) {
  if (request.method !== 'POST') return errorResponse(405, 'Method not allowed');

  const user = await getSessionUser(request);
  if (!user) return errorResponse(401, 'No autenticado');

  const body = await readJson<{
    sourceText?: string;
    h5pType?: string;
    title?: string;
    language?: string;
  }>(request);

  const { sourceText, h5pType, title, language = 'es' } = body;

  if (!sourceText?.trim()) return errorResponse(400, 'sourceText es requerido');
  if (!h5pType || !AI_GENERATABLE_TYPES.includes(h5pType as AIGeneratableType)) {
    return errorResponse(400, `h5pType inválido. Tipos soportados: ${AI_GENERATABLE_TYPES.join(', ')}`);
  }

  const apiKey = (process.env.OPENAI_API_KEY as string | undefined)?.trim();
  if (!apiKey) return errorResponse(500, 'OPENAI_API_KEY no disponible');

  const openai = new OpenAI({ apiKey });
  const prompt = buildPrompt(h5pType as AIGeneratableType, sourceText, title ?? 'Actividad interactiva', language);

  const primaryModel = (process.env.WRITING_AI_MODEL as string | undefined)?.trim() ?? 'gpt-4o-mini';

  try {
    const completion = await openai.chat.completions.create({
      model: primaryModel,
      messages: [
        { role: 'system', content: 'Eres un experto en diseño instruccional y formato H5P. Devuelves SOLO JSON válido, sin bloques de código markdown, sin explicaciones adicionales.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let contentJson: AIGeneratedContent;

    try {
      const parsed = JSON.parse(raw) as unknown;

      if (!isRecord(parsed)) {
        return errorResponse(502, 'La IA devolvió una estructura inválida. Intenta de nuevo.');
      }

      const normalized =
        typeof parsed.type === 'string'
          ? parsed
          : {
              ...parsed,
              type: h5pType,
            };

      contentJson = normalized as unknown as AIGeneratedContent;
    } catch {
      return errorResponse(502, 'La IA devolvió un JSON inválido. Intenta de nuevo.');
    }

    return Response.json({
      contentJson,
      suggestedTitle: contentJson.title ?? title ?? 'Actividad interactiva',
      tokensUsed: completion.usage?.total_tokens ?? 0,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en generación IA';
    return errorResponse(502, `Error al generar contenido: ${message}`);
  }
}
