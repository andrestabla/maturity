/**
 * H5P Integration — Maturity 360
 *
 * Supports two content kinds:
 *  - 'embed'   : External iframe (h5p.org, Lumi, any H5P server)
 *  - 'package' : Self-hosted .h5p packages stored in Cloudflare R2
 *
 * Libraries are served from R2 or from the h5p-standalone CDN bundle.
 * Content params are stored as JSONB in NeonDB.
 * xAPI statements are tracked per user in maturity_h5p_user_state.
 */

import { getSql } from './db.js';
import { ensureInitialized } from './store.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type H5PContentKind = 'embed' | 'package';

export interface H5PContent {
  id: string;
  courseSlug: string | null;
  institutionId: string | null;
  title: string;
  description: string | null;
  kind: H5PContentKind;
  // embed kind
  embedUrl: string | null;
  embedHtml: string | null;
  // package kind
  r2BasePath: string | null;
  libraryName: string | null;      // e.g. "H5P.QuestionSet"
  libraryVersion: string | null;   // e.g. "1.20"
  contentJson: Record<string, unknown> | null;
  h5pJson: Record<string, unknown> | null;
  // config
  width: number;
  height: number;
  xapiTracking: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface H5PUserState {
  id: string;
  contentId: string;
  userId: string;
  courseSlug: string | null;
  xapiStatements: unknown[];
  score: number | null;
  maxScore: number | null;
  completion: boolean;
  success: boolean | null;
  updatedAt: string;
}

export interface H5PContentInput {
  courseSlug?: string;
  institutionId?: string;
  title: string;
  description?: string;
  kind: H5PContentKind;
  embedUrl?: string;
  embedHtml?: string;
  r2BasePath?: string;
  libraryName?: string;
  libraryVersion?: string;
  contentJson?: Record<string, unknown>;
  h5pJson?: Record<string, unknown>;
  width?: number;
  height?: number;
  xapiTracking?: boolean;
  createdBy: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rowToContent(row: Record<string, unknown>): H5PContent {
  return {
    id: row.id as string,
    courseSlug: (row.course_slug as string | null) ?? null,
    institutionId: (row.institution_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    kind: row.kind as H5PContentKind,
    embedUrl: (row.embed_url as string | null) ?? null,
    embedHtml: (row.embed_html as string | null) ?? null,
    r2BasePath: (row.r2_base_path as string | null) ?? null,
    libraryName: (row.library_name as string | null) ?? null,
    libraryVersion: (row.library_version as string | null) ?? null,
    contentJson: (row.content_json as Record<string, unknown> | null) ?? null,
    h5pJson: (row.h5p_json as Record<string, unknown> | null) ?? null,
    width: Number(row.width ?? 800),
    height: Number(row.height ?? 500),
    xapiTracking: Boolean(row.xapi_tracking ?? true),
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToState(row: Record<string, unknown>): H5PUserState {
  return {
    id: row.id as string,
    contentId: row.content_id as string,
    userId: row.user_id as string,
    courseSlug: (row.course_slug as string | null) ?? null,
    xapiStatements: (row.xapi_statements as unknown[]) ?? [],
    score: row.score != null ? Number(row.score) : null,
    maxScore: row.max_score != null ? Number(row.max_score) : null,
    completion: Boolean(row.completion ?? false),
    success: row.success != null ? Boolean(row.success) : null,
    updatedAt: row.updated_at as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Content CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function listH5PContent(params: {
  courseSlug?: string;
  institutionId?: string;
}): Promise<H5PContent[]> {
  await ensureInitialized();
  const sql = getSql();

  const rows = await sql`
    SELECT * FROM maturity_h5p_content
    WHERE
      (${params.courseSlug ?? null}::text IS NULL OR course_slug = ${params.courseSlug ?? null})
      AND (${params.institutionId ?? null}::text IS NULL OR institution_id = ${params.institutionId ?? null})
    ORDER BY created_at DESC
  `;

  return rows.map(rowToContent);
}

export async function getH5PContent(id: string): Promise<H5PContent | null> {
  await ensureInitialized();
  const sql = getSql();

  const rows = await sql`
    SELECT * FROM maturity_h5p_content WHERE id = ${id}
  `;

  return rows.length > 0 ? rowToContent(rows[0] as Record<string, unknown>) : null;
}

export async function createH5PContent(input: H5PContentInput): Promise<H5PContent> {
  await ensureInitialized();
  const sql = getSql();

  const rows = await sql`
    INSERT INTO maturity_h5p_content (
      id, course_slug, institution_id, title, description, kind,
      embed_url, embed_html, r2_base_path,
      library_name, library_version, content_json, h5p_json,
      width, height, xapi_tracking, created_by, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      ${input.courseSlug ?? null},
      ${input.institutionId ?? null},
      ${input.title},
      ${input.description ?? null},
      ${input.kind},
      ${input.embedUrl ?? null},
      ${input.embedHtml ?? null},
      ${input.r2BasePath ?? null},
      ${input.libraryName ?? null},
      ${input.libraryVersion ?? null},
      ${input.contentJson ? JSON.stringify(input.contentJson) : null}::jsonb,
      ${input.h5pJson ? JSON.stringify(input.h5pJson) : null}::jsonb,
      ${input.width ?? 800},
      ${input.height ?? 500},
      ${input.xapiTracking ?? true},
      ${input.createdBy},
      NOW()::text,
      NOW()::text
    )
    RETURNING *
  `;

  return rowToContent(rows[0] as Record<string, unknown>);
}

export async function updateH5PContent(
  id: string,
  input: Partial<Omit<H5PContentInput, 'createdBy'>>,
): Promise<H5PContent | null> {
  await ensureInitialized();
  const sql = getSql();

  const rows = await sql`
    UPDATE maturity_h5p_content SET
      title        = COALESCE(${input.title ?? null}, title),
      description  = COALESCE(${input.description ?? null}, description),
      embed_url    = COALESCE(${input.embedUrl ?? null}, embed_url),
      embed_html   = COALESCE(${input.embedHtml ?? null}, embed_html),
      r2_base_path = COALESCE(${input.r2BasePath ?? null}, r2_base_path),
      library_name = COALESCE(${input.libraryName ?? null}, library_name),
      library_version = COALESCE(${input.libraryVersion ?? null}, library_version),
      content_json = COALESCE(${input.contentJson ? JSON.stringify(input.contentJson) : null}::jsonb, content_json),
      h5p_json     = COALESCE(${input.h5pJson ? JSON.stringify(input.h5pJson) : null}::jsonb, h5p_json),
      width        = COALESCE(${input.width ?? null}, width),
      height       = COALESCE(${input.height ?? null}, height),
      xapi_tracking = COALESCE(${input.xapiTracking ?? null}, xapi_tracking),
      updated_at   = NOW()::text
    WHERE id = ${id}
    RETURNING *
  `;

  return rows.length > 0 ? rowToContent(rows[0] as Record<string, unknown>) : null;
}

export async function deleteH5PContent(id: string): Promise<boolean> {
  await ensureInitialized();
  const sql = getSql();

  const result = await sql`
    DELETE FROM maturity_h5p_content WHERE id = ${id}
  `;

  return (result as unknown as { count: number }).count > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// xAPI / User state
// ─────────────────────────────────────────────────────────────────────────────

export async function getH5PUserState(
  contentId: string,
  userId: string,
): Promise<H5PUserState | null> {
  await ensureInitialized();
  const sql = getSql();

  const rows = await sql`
    SELECT * FROM maturity_h5p_user_state
    WHERE content_id = ${contentId} AND user_id = ${userId}
  `;

  return rows.length > 0 ? rowToState(rows[0] as Record<string, unknown>) : null;
}

export async function upsertH5PUserState(params: {
  contentId: string;
  userId: string;
  courseSlug?: string;
  statement?: unknown;
  score?: number;
  maxScore?: number;
  completion?: boolean;
  success?: boolean;
}): Promise<H5PUserState> {
  await ensureInitialized();
  const sql = getSql();

  const rows = await sql`
    INSERT INTO maturity_h5p_user_state
      (id, content_id, user_id, course_slug, xapi_statements, score, max_score, completion, success, updated_at)
    VALUES (
      gen_random_uuid(),
      ${params.contentId},
      ${params.userId},
      ${params.courseSlug ?? null},
      ${params.statement ? JSON.stringify([params.statement]) : '[]'}::jsonb,
      ${params.score ?? null},
      ${params.maxScore ?? null},
      ${params.completion ?? false},
      ${params.success ?? null},
      NOW()::text
    )
    ON CONFLICT (content_id, user_id)
    DO UPDATE SET
      xapi_statements = CASE
        WHEN ${params.statement != null} THEN
          maturity_h5p_user_state.xapi_statements || ${params.statement ? JSON.stringify([params.statement]) : '[]'}::jsonb
        ELSE maturity_h5p_user_state.xapi_statements
      END,
      score      = COALESCE(${params.score ?? null}, maturity_h5p_user_state.score),
      max_score  = COALESCE(${params.maxScore ?? null}, maturity_h5p_user_state.max_score),
      completion = COALESCE(${params.completion ?? null}, maturity_h5p_user_state.completion),
      success    = COALESCE(${params.success ?? null}, maturity_h5p_user_state.success),
      updated_at = NOW()::text
    RETURNING *
  `;

  return rowToState(rows[0] as Record<string, unknown>);
}

export async function getH5PCourseStats(courseSlug: string): Promise<{
  totalActivities: number;
  completedByUser: Record<string, number>;
}> {
  await ensureInitialized();
  const sql = getSql();

  const [countRow, statsRows] = await Promise.all([
    sql`SELECT COUNT(*) as cnt FROM maturity_h5p_content WHERE course_slug = ${courseSlug}`,
    sql`
      SELECT user_id, COUNT(*) FILTER (WHERE completion = true) as completed
      FROM maturity_h5p_user_state us
      JOIN maturity_h5p_content c ON c.id = us.content_id
      WHERE c.course_slug = ${courseSlug}
      GROUP BY user_id
    `,
  ]);

  const completedByUser: Record<string, number> = {};
  for (const row of statsRows as Array<Record<string, unknown>>) {
    completedByUser[row.user_id as string] = Number(row.completed);
  }

  return {
    totalActivities: Number((countRow[0] as Record<string, unknown>).cnt ?? 0),
    completedByUser,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Supported H5P content types (curated list for the content picker)
// ─────────────────────────────────────────────────────────────────────────────

export const H5P_CONTENT_TYPES = [
  { machineName: 'H5P.QuestionSet',         title: 'Cuestionario',                icon: '📝', description: 'Preguntas de opción múltiple, verdadero/falso y más.' },
  { machineName: 'H5P.InteractiveVideo',    title: 'Video Interactivo',           icon: '🎬', description: 'Enriquece videos con preguntas, notas y marcadores.' },
  { machineName: 'H5P.CoursePresentation',  title: 'Presentación de Curso',       icon: '📊', description: 'Diapositivas interactivas con contenido multimedia.' },
  { machineName: 'H5P.Flashcards',          title: 'Tarjetas Didácticas',         icon: '🃏', description: 'Memorización efectiva con tarjetas de doble cara.' },
  { machineName: 'H5P.DragQuestion',        title: 'Arrastrar y Soltar',          icon: '🔀', description: 'Actividades de clasificación y emparejamiento visual.' },
  { machineName: 'H5P.Summary',             title: 'Resumen Interactivo',         icon: '📋', description: 'Construye resúmenes con retroalimentación.' },
  { machineName: 'H5P.SingleChoiceSet',     title: 'Opción Múltiple Rápida',      icon: '⚡', description: 'Ronda rápida de preguntas de una sola respuesta.' },
  { machineName: 'H5P.Blanks',              title: 'Completar Espacios',          icon: '✏️', description: 'Rellena los huecos con las palabras correctas.' },
  { machineName: 'H5P.Timeline',            title: 'Línea de Tiempo',             icon: '📅', description: 'Visualización cronológica de eventos históricos.' },
  { machineName: 'H5P.Column',              title: 'Columna de Contenido',        icon: '📄', description: 'Agrega múltiples actividades en una sola página.' },
  { machineName: 'H5P.Accordion',           title: 'Acordeón',                    icon: '📂', description: 'Organiza texto e imágenes en secciones expandibles.' },
  { machineName: 'H5P.TrueFalse',           title: 'Verdadero o Falso',           icon: '✅', description: 'Afirmaciones para evaluar comprensión rápida.' },
] as const;
