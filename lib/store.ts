import { mockAppData } from '../src/data/mockData.js';
import type { AppData, Course, RoleProfile, StageDefinition } from '../src/types.js';
import { getSql } from './db.js';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  code: string;
  faculty: string;
  program: string;
  modality: string;
  credits: number;
  stageId: string;
  status: Course['status'];
  progress: number;
  summary: string;
  nextMilestone: string;
  updatedAt: string;
  pulse: JsonValue;
  team: JsonValue;
  deliverables: JsonValue;
  modules: JsonValue;
  observations: JsonValue;
  schedule: JsonValue;
  stageChecklist: JsonValue;
  assistants: JsonValue;
}

function parseJson<T>(value: JsonValue): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
}

async function ensureSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS maturity_roles (
      role TEXT PRIMARY KEY,
      position INTEGER NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS maturity_stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT NOT NULL,
      tone TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS maturity_courses (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      faculty TEXT NOT NULL,
      program TEXT NOT NULL,
      modality TEXT NOT NULL,
      credits INTEGER NOT NULL,
      stage_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL,
      summary TEXT NOT NULL,
      next_milestone TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      pulse JSONB NOT NULL,
      team JSONB NOT NULL,
      deliverables JSONB NOT NULL,
      modules JSONB NOT NULL,
      observations JSONB NOT NULL,
      schedule JSONB NOT NULL,
      stage_checklist JSONB NOT NULL,
      assistants JSONB NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS maturity_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      course_slug TEXT NOT NULL,
      role TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS maturity_alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      course_slug TEXT NOT NULL,
      tone TEXT NOT NULL,
      owner TEXT NOT NULL,
      detail TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS maturity_library_resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      course_slug TEXT NOT NULL,
      unit TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      tags JSONB NOT NULL,
      summary TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS maturity_role_profiles (
      role TEXT PRIMARY KEY,
      overview TEXT NOT NULL,
      focus TEXT NOT NULL,
      modules JSONB NOT NULL
    )
  `;
}

async function ensureSeedData() {
  const sql = getSql();
  const countRows = (await sql`
    SELECT COUNT(*)::INT AS count
    FROM maturity_courses
  `) as Array<{ count: number }>;

  if ((countRows[0]?.count ?? 0) > 0) {
    return {
      seeded: false,
      courses: countRows[0].count,
    };
  }

  for (const [position, role] of mockAppData.roles.entries()) {
    await sql`
      INSERT INTO maturity_roles (role, position)
      VALUES (${role}, ${position})
      ON CONFLICT (role) DO UPDATE
      SET position = EXCLUDED.position
    `;
  }

  for (const stage of mockAppData.stages) {
    await sql`
      INSERT INTO maturity_stages (id, name, description, owner, tone)
      VALUES (${stage.id}, ${stage.name}, ${stage.description}, ${stage.owner}, ${stage.tone})
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        owner = EXCLUDED.owner,
        tone = EXCLUDED.tone
    `;
  }

  for (const course of mockAppData.courses) {
    await sql`
      INSERT INTO maturity_courses (
        id,
        slug,
        title,
        code,
        faculty,
        program,
        modality,
        credits,
        stage_id,
        status,
        progress,
        summary,
        next_milestone,
        updated_at,
        pulse,
        team,
        deliverables,
        modules,
        observations,
        schedule,
        stage_checklist,
        assistants
      )
      VALUES (
        ${course.id},
        ${course.slug},
        ${course.title},
        ${course.code},
        ${course.faculty},
        ${course.program},
        ${course.modality},
        ${course.credits},
        ${course.stageId},
        ${course.status},
        ${course.progress},
        ${course.summary},
        ${course.nextMilestone},
        ${course.updatedAt},
        ${JSON.stringify(course.pulse)}::jsonb,
        ${JSON.stringify(course.team)}::jsonb,
        ${JSON.stringify(course.deliverables)}::jsonb,
        ${JSON.stringify(course.modules)}::jsonb,
        ${JSON.stringify(course.observations)}::jsonb,
        ${JSON.stringify(course.schedule)}::jsonb,
        ${JSON.stringify(course.stageChecklist)}::jsonb,
        ${JSON.stringify(course.assistants)}::jsonb
      )
      ON CONFLICT (id) DO UPDATE
      SET
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        code = EXCLUDED.code,
        faculty = EXCLUDED.faculty,
        program = EXCLUDED.program,
        modality = EXCLUDED.modality,
        credits = EXCLUDED.credits,
        stage_id = EXCLUDED.stage_id,
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        summary = EXCLUDED.summary,
        next_milestone = EXCLUDED.next_milestone,
        updated_at = EXCLUDED.updated_at,
        pulse = EXCLUDED.pulse,
        team = EXCLUDED.team,
        deliverables = EXCLUDED.deliverables,
        modules = EXCLUDED.modules,
        observations = EXCLUDED.observations,
        schedule = EXCLUDED.schedule,
        stage_checklist = EXCLUDED.stage_checklist,
        assistants = EXCLUDED.assistants
    `;
  }

  for (const task of mockAppData.tasks) {
    await sql`
      INSERT INTO maturity_tasks (
        id,
        title,
        course_slug,
        role,
        stage_id,
        due_date,
        priority,
        status,
        summary
      )
      VALUES (
        ${task.id},
        ${task.title},
        ${task.courseSlug},
        ${task.role},
        ${task.stageId},
        ${task.dueDate},
        ${task.priority},
        ${task.status},
        ${task.summary}
      )
      ON CONFLICT (id) DO UPDATE
      SET
        title = EXCLUDED.title,
        course_slug = EXCLUDED.course_slug,
        role = EXCLUDED.role,
        stage_id = EXCLUDED.stage_id,
        due_date = EXCLUDED.due_date,
        priority = EXCLUDED.priority,
        status = EXCLUDED.status,
        summary = EXCLUDED.summary
    `;
  }

  for (const alert of mockAppData.alerts) {
    await sql`
      INSERT INTO maturity_alerts (id, title, course_slug, tone, owner, detail)
      VALUES (
        ${alert.id},
        ${alert.title},
        ${alert.courseSlug},
        ${alert.tone},
        ${alert.owner},
        ${alert.detail}
      )
      ON CONFLICT (id) DO UPDATE
      SET
        title = EXCLUDED.title,
        course_slug = EXCLUDED.course_slug,
        tone = EXCLUDED.tone,
        owner = EXCLUDED.owner,
        detail = EXCLUDED.detail
    `;
  }

  for (const resource of mockAppData.libraryResources) {
    await sql`
      INSERT INTO maturity_library_resources (
        id,
        title,
        kind,
        course_slug,
        unit,
        source,
        status,
        tags,
        summary
      )
      VALUES (
        ${resource.id},
        ${resource.title},
        ${resource.kind},
        ${resource.courseSlug},
        ${resource.unit},
        ${resource.source},
        ${resource.status},
        ${JSON.stringify(resource.tags)}::jsonb,
        ${resource.summary}
      )
      ON CONFLICT (id) DO UPDATE
      SET
        title = EXCLUDED.title,
        kind = EXCLUDED.kind,
        course_slug = EXCLUDED.course_slug,
        unit = EXCLUDED.unit,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        tags = EXCLUDED.tags,
        summary = EXCLUDED.summary
    `;
  }

  for (const profile of mockAppData.roleProfiles) {
    await sql`
      INSERT INTO maturity_role_profiles (role, overview, focus, modules)
      VALUES (
        ${profile.role},
        ${profile.overview},
        ${profile.focus},
        ${JSON.stringify(profile.modules)}::jsonb
      )
      ON CONFLICT (role) DO UPDATE
      SET
        overview = EXCLUDED.overview,
        focus = EXCLUDED.focus,
        modules = EXCLUDED.modules
    `;
  }

  return {
    seeded: true,
    courses: mockAppData.courses.length,
  };
}

async function readRoles() {
  const sql = getSql();
  const rows = (await sql`
    SELECT role
    FROM maturity_roles
    ORDER BY position ASC
  `) as Array<{ role: AppData['roles'][number] }>;

  return rows.map((row) => row.role);
}

async function readStages() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      name,
      description,
      owner,
      tone
    FROM maturity_stages
    ORDER BY id ASC
  `) as StageDefinition[];

  return rows;
}

async function readCourses() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      slug,
      title,
      code,
      faculty,
      program,
      modality,
      credits,
      stage_id AS "stageId",
      status,
      progress,
      summary,
      next_milestone AS "nextMilestone",
      updated_at AS "updatedAt",
      pulse,
      team,
      deliverables,
      modules,
      observations,
      schedule,
      stage_checklist AS "stageChecklist",
      assistants
    FROM maturity_courses
    ORDER BY title ASC
  `) as CourseRow[];

  return rows.map((row) => ({
    ...row,
    pulse: parseJson<Course['pulse']>(row.pulse),
    team: parseJson<Course['team']>(row.team),
    deliverables: parseJson<Course['deliverables']>(row.deliverables),
    modules: parseJson<Course['modules']>(row.modules),
    observations: parseJson<Course['observations']>(row.observations),
    schedule: parseJson<Course['schedule']>(row.schedule),
    stageChecklist: parseJson<Course['stageChecklist']>(row.stageChecklist),
    assistants: parseJson<Course['assistants']>(row.assistants),
  }));
}

async function readTasks() {
  const sql = getSql();
  return (await sql`
    SELECT
      id,
      title,
      course_slug AS "courseSlug",
      role,
      stage_id AS "stageId",
      due_date AS "dueDate",
      priority,
      status,
      summary
    FROM maturity_tasks
    ORDER BY due_date ASC, title ASC
  `) as AppData['tasks'];
}

async function readAlerts() {
  const sql = getSql();
  return (await sql`
    SELECT
      id,
      title,
      course_slug AS "courseSlug",
      tone,
      owner,
      detail
    FROM maturity_alerts
    ORDER BY title ASC
  `) as AppData['alerts'];
}

async function readLibraryResources() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      title,
      kind,
      course_slug AS "courseSlug",
      unit,
      source,
      status,
      tags,
      summary
    FROM maturity_library_resources
    ORDER BY title ASC
  `) as Array<
    Omit<AppData['libraryResources'][number], 'tags'> & {
      tags: JsonValue;
    }
  >;

  return rows.map((row) => ({
    ...row,
    tags: parseJson<AppData['libraryResources'][number]['tags']>(row.tags),
  }));
}

async function readRoleProfiles() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      role,
      overview,
      focus,
      modules
    FROM maturity_role_profiles
    ORDER BY role ASC
  `) as Array<
    Omit<RoleProfile, 'modules'> & {
      modules: JsonValue;
    }
  >;

  return rows.map((row) => ({
    ...row,
    modules: parseJson<RoleProfile['modules']>(row.modules),
  }));
}

export async function prepareDatabase() {
  await ensureSchema();
  return ensureSeedData();
}

export async function loadAppData(): Promise<AppData> {
  await ensureSchema();
  await ensureSeedData();

  const [roles, stages, courses, tasks, alerts, libraryResources, roleProfiles] =
    await Promise.all([
      readRoles(),
      readStages(),
      readCourses(),
      readTasks(),
      readAlerts(),
      readLibraryResources(),
      readRoleProfiles(),
    ]);

  return {
    roles,
    stages,
    courses,
    tasks,
    alerts,
    libraryResources,
    roleProfiles,
  };
}
