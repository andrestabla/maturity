import { mockAppData } from '../src/data/mockData.js';
import type {
  AppData,
  AuthUser,
  Course,
  CourseMutationInput,
  Deliverable,
  DeliverableMutationInput,
  LibraryResource,
  LibraryResourceMutationInput,
  Observation,
  ObservationMutationInput,
  PasswordChangeInput,
  Role,
  RoleProfile,
  StageDefinition,
  Task,
  TaskMutationInput,
  UserMutationInput,
  UserUpdateInput,
} from '../src/types.js';
import { getSql } from './db.js';
import { createPasswordHash, verifyPassword } from './security.js';

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

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}

interface PublicUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface SessionLookupRow {
  userId: string;
  name: string;
  email: string;
  role: Role;
  expiresAt: string;
}

function getTodayLabel() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function buildStageChecklist(stageId: string): Course['stageChecklist'] {
  const stageIndex = mockAppData.stages.findIndex((stage) => stage.id === stageId);

  return mockAppData.stages.map((stage, index) => ({
    id: `ck-${stage.id}`,
    label: stage.name,
    owner: stage.owner,
    status:
      index < stageIndex
        ? 'done'
        : index === stageIndex
          ? 'active'
          : 'pending',
  }));
}

function makeCourseRecord(input: CourseMutationInput): Course {
  const slugBase = slugify(`${input.title}-${input.code}`) || `curso-${crypto.randomUUID().slice(0, 8)}`;

  return {
    id: crypto.randomUUID(),
    slug: slugBase,
    title: input.title,
    code: input.code,
    faculty: input.faculty,
    program: input.program,
    modality: input.modality,
    credits: input.credits,
    stageId: input.stageId,
    status: input.status,
    progress: 12,
    summary: input.summary,
    nextMilestone: input.nextMilestone,
    updatedAt: getTodayLabel(),
    pulse: {
      velocity: 58,
      quality: 76,
      alignment: 80,
    },
    team: [],
    deliverables: [],
    modules: [],
    observations: [],
    schedule: [
      {
        id: crypto.randomUUID(),
        label: 'Configuración inicial',
        dueDate: getTodayLabel(),
        status: 'active',
      },
    ],
    stageChecklist: buildStageChecklist(input.stageId),
    assistants: [],
  };
}

function makeTaskRecord(input: TaskMutationInput): Task {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    courseSlug: input.courseSlug,
    role: input.role,
    stageId: input.stageId,
    dueDate: input.dueDate,
    priority: input.priority,
    status: input.status,
    summary: input.summary,
  };
}

function makeDeliverableRecord(input: DeliverableMutationInput): Deliverable {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    owner: input.owner,
    status: input.status,
    dueDate: input.dueDate,
    note: input.note,
  };
}

function makeObservationRecord(input: ObservationMutationInput): Observation {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    role: input.role,
    severity: input.severity,
    status: input.status,
    detail: input.detail,
  };
}

function makeLibraryResourceRecord(input: LibraryResourceMutationInput): LibraryResource {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    kind: input.kind,
    courseSlug: input.courseSlug,
    unit: input.unit,
    source: input.source,
    status: input.status,
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    summary: input.summary,
  };
}

function parseJson<T>(value: JsonValue): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
}

async function ensureSchema() {
  const sql = getSql();
  await sql`SELECT pg_advisory_lock(3602026)`;

  try {
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

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `;
  } finally {
    await sql`SELECT pg_advisory_unlock(3602026)`;
  }
}

async function ensureAdminUserSeed() {
  const email =
    process.env.INITIAL_ADMIN_EMAIL ??
    (process.env.NODE_ENV === 'production' ? undefined : 'admin@maturity.local');
  const password =
    process.env.INITIAL_ADMIN_PASSWORD ??
    (process.env.NODE_ENV === 'production' ? undefined : 'MaturityDev123!');
  const name = process.env.INITIAL_ADMIN_NAME ?? 'Administrador Maturity';

  if (!email || !password) {
    return;
  }

  const sql = getSql();
  const normalizedEmail = email.trim().toLowerCase();
  const existingRows = (await sql`
    SELECT id
    FROM maturity_users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `) as Array<{ id: string }>;

  if (existingRows.length > 0) {
    return;
  }

  const passwordHash = await createPasswordHash(password);

  await sql`
    INSERT INTO maturity_users (id, name, email, role, password_hash, created_at)
    VALUES (
      ${crypto.randomUUID()},
      ${name},
      ${normalizedEmail},
      ${'Administrador'},
      ${passwordHash},
      ${new Date().toISOString()}
    )
  `;
}

function serializeCourseRow(row: CourseRow): Course {
  return {
    ...row,
    pulse: parseJson<Course['pulse']>(row.pulse),
    team: parseJson<Course['team']>(row.team),
    deliverables: parseJson<Course['deliverables']>(row.deliverables),
    modules: parseJson<Course['modules']>(row.modules),
    observations: parseJson<Course['observations']>(row.observations),
    schedule: parseJson<Course['schedule']>(row.schedule),
    stageChecklist: parseJson<Course['stageChecklist']>(row.stageChecklist),
    assistants: parseJson<Course['assistants']>(row.assistants),
  };
}

async function persistCourse(course: Course) {
  const sql = getSql();

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

async function persistTask(task: Task) {
  const sql = getSql();
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

async function persistLibraryResource(resource: LibraryResource) {
  const sql = getSql();

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

async function readCourseBySlug(slug: string) {
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
    WHERE slug = ${slug}
    LIMIT 1
  `) as CourseRow[];

  return rows[0] ? serializeCourseRow(rows[0]) : null;
}

async function ensureSeedData() {
  await ensureAdminUserSeed();

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
    await persistCourse(course);
  }

  for (const task of mockAppData.tasks) {
    await persistTask(task);
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

  return rows.map(serializeCourseRow);
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

async function readUsers() {
  const sql = getSql();
  return (await sql`
    SELECT
      id,
      name,
      email,
      role
    FROM maturity_users
    ORDER BY role ASC, name ASC
  `) as AuthUser[];
}

export async function prepareDatabase() {
  await ensureSchema();
  return ensureSeedData();
}

export async function loadAppData(): Promise<AppData> {
  await ensureSchema();
  await ensureSeedData();

  const [roles, stages, courses, tasks, alerts, libraryResources, roleProfiles, users] =
    await Promise.all([
      readRoles(),
      readStages(),
      readCourses(),
      readTasks(),
      readAlerts(),
      readLibraryResources(),
      readRoleProfiles(),
      readUsers(),
    ]);

  return {
    roles,
    stages,
    courses,
    tasks,
    alerts,
    libraryResources,
    roleProfiles,
    users,
  };
}

export async function findUserByEmail(email: string) {
  await ensureSchema();
  await ensureAdminUserSeed();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      name,
      email,
      role,
      password_hash AS "passwordHash"
    FROM maturity_users
    WHERE email = ${email.trim().toLowerCase()}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function createSessionRecord(userId: string, tokenHash: string, expiresAt: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO maturity_sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${tokenHash},
      ${expiresAt},
      ${new Date().toISOString()}
    )
  `;
}

export async function findSessionByTokenHash(tokenHash: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id AS "userId",
      u.name,
      u.email,
      u.role,
      s.expires_at AS "expiresAt"
    FROM maturity_sessions s
    INNER JOIN maturity_users u
      ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
    LIMIT 1
  `) as SessionLookupRow[];

  return rows[0] ?? null;
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    DELETE FROM maturity_sessions
    WHERE token_hash = ${tokenHash}
  `;
}

export async function createCourseRecord(input: CourseMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const course = makeCourseRecord(input);
  await persistCourse(course);
  return course;
}

export async function updateCourseRecord(slug: string, input: CourseMutationInput) {
  await ensureSchema();
  await ensureSeedData();

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
    WHERE slug = ${slug}
    LIMIT 1
  `) as CourseRow[];

  const current = rows[0] ? serializeCourseRow(rows[0]) : null;

  if (!current) {
    return null;
  }

  const nextCourse: Course = {
    ...current,
    title: input.title,
    code: input.code,
    faculty: input.faculty,
    program: input.program,
    modality: input.modality,
    credits: input.credits,
    stageId: input.stageId,
    status: input.status,
    summary: input.summary,
    nextMilestone: input.nextMilestone,
    updatedAt: getTodayLabel(),
    stageChecklist: buildStageChecklist(input.stageId),
  };

  await persistCourse(nextCourse);
  return nextCourse;
}

export async function deleteCourseRecord(slug: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    DELETE FROM maturity_tasks
    WHERE course_slug = ${slug}
  `;

  await sql`
    DELETE FROM maturity_alerts
    WHERE course_slug = ${slug}
  `;

  await sql`
    DELETE FROM maturity_library_resources
    WHERE course_slug = ${slug}
  `;

  const result = (await sql`
    DELETE FROM maturity_courses
    WHERE slug = ${slug}
    RETURNING id
  `) as Array<{ id: string }>;

  return result.length > 0;
}

export async function createTaskRecord(input: TaskMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const task = makeTaskRecord(input);
  await persistTask(task);
  return task;
}

export async function updateTaskRecord(id: string, input: Partial<TaskMutationInput>) {
  await ensureSchema();
  await ensureSeedData();
  const sql = getSql();

  const rows = (await sql`
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
    WHERE id = ${id}
    LIMIT 1
  `) as Task[];

  const current = rows[0];

  if (!current) {
    return null;
  }

  const nextTask: Task = {
    ...current,
    ...input,
  };

  await persistTask(nextTask);
  return nextTask;
}

export async function deleteTaskRecord(id: string) {
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    DELETE FROM maturity_tasks
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  return result.length > 0;
}

export async function findTaskById(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
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
    WHERE id = ${id}
    LIMIT 1
  `) as Task[];

  return rows[0] ?? null;
}

export async function createDeliverableRecord(courseSlug: string, input: DeliverableMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const nextCourse: Course = {
    ...course,
    updatedAt: getTodayLabel(),
    deliverables: [...course.deliverables, makeDeliverableRecord(input)],
  };

  await persistCourse(nextCourse);
  return nextCourse.deliverables.at(-1) ?? null;
}

export async function updateDeliverableRecord(
  courseSlug: string,
  deliverableId: string,
  input: Partial<DeliverableMutationInput>,
) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  let updatedDeliverable: Deliverable | null = null;
  const nextDeliverables = course.deliverables.map((deliverable) => {
    if (deliverable.id !== deliverableId) {
      return deliverable;
    }

    updatedDeliverable = {
      ...deliverable,
      ...input,
    };

    return updatedDeliverable;
  });

  if (!updatedDeliverable) {
    return null;
  }

  const nextCourse: Course = {
    ...course,
    updatedAt: getTodayLabel(),
    deliverables: nextDeliverables,
  };

  await persistCourse(nextCourse);
  return updatedDeliverable;
}

export async function deleteDeliverableRecord(courseSlug: string, deliverableId: string) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return false;
  }

  const nextDeliverables = course.deliverables.filter((deliverable) => deliverable.id !== deliverableId);

  if (nextDeliverables.length === course.deliverables.length) {
    return false;
  }

  const nextCourse: Course = {
    ...course,
    updatedAt: getTodayLabel(),
    deliverables: nextDeliverables,
  };

  await persistCourse(nextCourse);
  return true;
}

export async function findDeliverableById(courseSlug: string, deliverableId: string) {
  await ensureSchema();
  await ensureSeedData();
  const course = await readCourseBySlug(courseSlug);

  return course?.deliverables.find((deliverable) => deliverable.id === deliverableId) ?? null;
}

export async function createObservationRecord(courseSlug: string, input: ObservationMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const nextCourse: Course = {
    ...course,
    updatedAt: getTodayLabel(),
    observations: [...course.observations, makeObservationRecord(input)],
  };

  await persistCourse(nextCourse);
  return nextCourse.observations.at(-1) ?? null;
}

export async function updateObservationRecord(
  courseSlug: string,
  observationId: string,
  input: Partial<ObservationMutationInput>,
) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  let updatedObservation: Observation | null = null;
  const nextObservations = course.observations.map((observation) => {
    if (observation.id !== observationId) {
      return observation;
    }

    updatedObservation = {
      ...observation,
      ...input,
    };

    return updatedObservation;
  });

  if (!updatedObservation) {
    return null;
  }

  const nextCourse: Course = {
    ...course,
    updatedAt: getTodayLabel(),
    observations: nextObservations,
  };

  await persistCourse(nextCourse);
  return updatedObservation;
}

export async function deleteObservationRecord(courseSlug: string, observationId: string) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return false;
  }

  const nextObservations = course.observations.filter((observation) => observation.id !== observationId);

  if (nextObservations.length === course.observations.length) {
    return false;
  }

  const nextCourse: Course = {
    ...course,
    updatedAt: getTodayLabel(),
    observations: nextObservations,
  };

  await persistCourse(nextCourse);
  return true;
}

export async function findObservationById(courseSlug: string, observationId: string) {
  await ensureSchema();
  await ensureSeedData();
  const course = await readCourseBySlug(courseSlug);

  return course?.observations.find((observation) => observation.id === observationId) ?? null;
}

export async function createLibraryResourceRecord(input: LibraryResourceMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const resource = makeLibraryResourceRecord(input);
  await persistLibraryResource(resource);
  return resource;
}

export async function findLibraryResourceById(id: string) {
  await ensureSchema();
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
    WHERE id = ${id}
    LIMIT 1
  `) as Array<
    Omit<LibraryResource, 'tags'> & {
      tags: JsonValue;
    }
  >;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row,
    tags: parseJson<LibraryResource['tags']>(row.tags),
  };
}

export async function updateLibraryResourceRecord(
  id: string,
  input: Partial<LibraryResourceMutationInput>,
) {
  await ensureSchema();
  await ensureSeedData();

  const current = await findLibraryResourceById(id);

  if (!current) {
    return null;
  }

  const resource: LibraryResource = {
    ...current,
    ...input,
    tags: input.tags ? input.tags.map((tag) => tag.trim()).filter(Boolean) : current.tags,
  };

  await persistLibraryResource(resource);
  return resource;
}

export async function deleteLibraryResourceRecord(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM maturity_library_resources
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function getUserDirectory() {
  await ensureSchema();
  await ensureAdminUserSeed();
  return readUsers();
}

export async function findUserById(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      name,
      email,
      role,
      password_hash AS "passwordHash"
    FROM maturity_users
    WHERE id = ${id}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function createUserRecord(input: UserMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const sql = getSql();
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingRows = (await sql`
    SELECT id
    FROM maturity_users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `) as Array<{ id: string }>;

  if (existingRows.length > 0) {
    throw new Error('Ya existe un usuario con ese correo.');
  }

  const passwordHash = await createPasswordHash(input.password);
  const id = crypto.randomUUID();

  const rows = (await sql`
    INSERT INTO maturity_users (id, name, email, role, password_hash, created_at)
    VALUES (
      ${id},
      ${input.name},
      ${normalizedEmail},
      ${input.role},
      ${passwordHash},
      ${new Date().toISOString()}
    )
    RETURNING id, name, email, role
  `) as PublicUserRow[];

  return rows[0];
}

export async function updateUserRecord(input: UserUpdateInput) {
  await ensureSchema();
  await ensureSeedData();
  const sql = getSql();
  const normalizedEmail = input.email.trim().toLowerCase();
  const current = await findUserById(input.id);

  if (!current) {
    return null;
  }

  const conflictRows = (await sql`
    SELECT id
    FROM maturity_users
    WHERE email = ${normalizedEmail}
      AND id <> ${input.id}
    LIMIT 1
  `) as Array<{ id: string }>;

  if (conflictRows.length > 0) {
    throw new Error('Ese correo ya está en uso por otro usuario.');
  }

  const passwordHash = input.password?.trim()
    ? await createPasswordHash(input.password)
    : current.passwordHash;

  const rows = (await sql`
    UPDATE maturity_users
    SET
      name = ${input.name},
      email = ${normalizedEmail},
      role = ${input.role},
      password_hash = ${passwordHash}
    WHERE id = ${input.id}
    RETURNING id, name, email, role
  `) as PublicUserRow[];

  return rows[0] ?? null;
}

export async function deleteUserRecord(id: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    DELETE FROM maturity_sessions
    WHERE user_id = ${id}
  `;

  const rows = (await sql`
    DELETE FROM maturity_users
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function changeUserPassword(userId: string, payload: PasswordChangeInput) {
  await ensureSchema();
  await ensureSeedData();
  const current = await findUserById(userId);

  if (!current) {
    throw new Error('Usuario no encontrado.');
  }

  const isValid = await verifyPassword(payload.currentPassword, current.passwordHash);

  if (!isValid) {
    throw new Error('La contraseña actual no coincide.');
  }

  const sql = getSql();
  const passwordHash = await createPasswordHash(payload.nextPassword);

  await sql`
    UPDATE maturity_users
    SET password_hash = ${passwordHash}
    WHERE id = ${userId}
  `;
}
