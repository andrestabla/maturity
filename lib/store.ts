import { mockAppData } from '../src/data/mockData.js';
import type {
  Alert,
  AlertMutationInput,
  AppData,
  AuthUser,
  Course,
  CourseAuditEntry,
  CourseMetadata,
  CourseMetadataMutationInput,
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
  StageCheckpoint,
  StageDefinition,
  StageCheckpointMutationInput,
  Task,
  TaskMutationInput,
  TimelineItem,
  TimelineItemMutationInput,
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
  metadata: JsonValue;
  auditLog: JsonValue;
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

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

function buildCourseRoute(course: Pick<Course, 'faculty' | 'program' | 'title'>) {
  return `Repositorio institucional / ${course.faculty} / ${course.program} / ${course.title}`;
}

function deriveRiskLevel(status: Course['status']): CourseMetadata['riskLevel'] {
  if (status === 'Bloqueado' || status === 'Riesgo') {
    return 'Alto';
  }

  if (status === 'En revisión') {
    return 'Medio';
  }

  return 'Bajo';
}

function derivePriority(status: Course['status']): CourseMetadata['priority'] {
  return status === 'Bloqueado' || status === 'Riesgo' ? 'Alta' : 'Media';
}

function buildDefaultCourseMetadata(
  course: Pick<
    Course,
    | 'title'
    | 'code'
    | 'faculty'
    | 'program'
    | 'modality'
    | 'summary'
    | 'status'
    | 'updatedAt'
    | 'schedule'
    | 'modules'
  >,
): CourseMetadata {
  const targetCloseDate =
    course.schedule
      .slice()
      .sort((left, right) => right.dueDate.localeCompare(left.dueDate))[0]?.dueDate ?? course.updatedAt;

  return {
    institution: 'Maturity University',
    shortName: course.title,
    semester: 'Por definir',
    academicPeriod: '2026-1',
    courseType: 'Curso',
    learningOutcomes: [course.summary],
    topics: course.modules.map((module) => module.title),
    methodology: `${course.modality} con seguimiento por etapas y expediente persistente.`,
    evaluation:
      'Seguimiento por entregables, validación por etapa y observaciones trazables dentro del expediente.',
    bibliography: ['Documento base del curso', 'Biblioteca asociada al expediente'],
    targetCloseDate,
    currentVersion: 'v1.0',
    priority: derivePriority(course.status),
    riskLevel: deriveRiskLevel(course.status),
    route: buildCourseRoute(course),
  };
}

function makeAuditEntry(
  title: string,
  detail: string,
  type: CourseAuditEntry['type'],
  happenedAt = getTodayLabel(),
): CourseAuditEntry {
  return {
    id: crypto.randomUUID(),
    title,
    detail,
    happenedAt,
    type,
  };
}

function buildInitialAuditLog(course: Course): CourseAuditEntry[] {
  return [
    makeAuditEntry(
      'Expediente activo',
      `El curso mantiene una ficha consolidada en ${mockAppData.stages.find((stage) => stage.id === course.stageId)?.name ?? course.stageId}.`,
      'history',
      course.updatedAt,
    ),
    ...course.schedule.slice(0, 3).map((item) =>
      makeAuditEntry(
        item.label,
        `Hito del cronograma en estado ${item.status}.`,
        'planning',
        item.dueDate,
      ),
    ),
    ...course.deliverables.slice(0, 2).map((item) =>
      makeAuditEntry(
        item.title,
        `Entregable de ${item.owner} en estado ${item.status}.`,
        'production',
        item.dueDate,
      ),
    ),
    ...course.observations.slice(0, 2).map((item) =>
      makeAuditEntry(
        item.title,
        `Observación ${item.severity.toLowerCase()} con estado ${item.status}.`,
        'qa',
        course.updatedAt,
      ),
    ),
  ];
}

function normalizeCourse(course: Course): Course {
  const normalizedMetadata = {
    ...buildDefaultCourseMetadata(course),
    ...(course.metadata ?? {}),
    route: buildCourseRoute(course),
  };

  const normalizedAuditLog =
    course.auditLog.length > 0
      ? course.auditLog
          .slice()
          .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt))
      : buildInitialAuditLog({
          ...course,
          metadata: normalizedMetadata,
          auditLog: [],
        });

  return {
    ...course,
    metadata: normalizedMetadata,
    auditLog: normalizedAuditLog,
  };
}

function appendAuditEntry(
  course: Course,
  title: string,
  detail: string,
  type: CourseAuditEntry['type'],
  happenedAt = getTodayLabel(),
) {
  const nextCourse = normalizeCourse(course);

  return {
    ...nextCourse,
    updatedAt: happenedAt,
    auditLog: [
      makeAuditEntry(title, detail, type, happenedAt),
      ...nextCourse.auditLog,
    ].slice(0, 80),
  };
}

function makeCourseRecord(input: CourseMutationInput): Course {
  const slugBase = slugify(`${input.title}-${input.code}`) || `curso-${crypto.randomUUID().slice(0, 8)}`;

  return normalizeCourse({
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
    metadata: buildDefaultCourseMetadata({
      title: input.title,
      code: input.code,
      faculty: input.faculty,
      program: input.program,
      modality: input.modality,
      summary: input.summary,
      status: input.status,
      updatedAt: getTodayLabel(),
      schedule: [
        {
          id: 'bootstrap',
          label: 'Configuración inicial',
          dueDate: getTodayLabel(),
          status: 'active',
        },
      ],
      modules: [],
    }),
    auditLog: [],
  });
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

function makeAlertRecord(input: AlertMutationInput): Alert {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    courseSlug: input.courseSlug,
    tone: input.tone,
    owner: input.owner,
    detail: input.detail,
  };
}

function getStageIndex(stageId: string) {
  return mockAppData.stages.findIndex((stage) => stage.id === stageId);
}

function deriveCourseStatusFromChecklist(
  currentStatus: Course['status'],
  stageChecklist: StageCheckpoint[],
) {
  if (stageChecklist.some((item) => item.status === 'blocked')) {
    return 'Bloqueado';
  }

  if (stageChecklist.every((item) => item.status === 'done')) {
    return 'Listo';
  }

  if (currentStatus === 'Bloqueado' || currentStatus === 'Listo') {
    return 'En revisión';
  }

  return currentStatus;
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
        assistants JSONB NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        audit_log JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `;

    await sql`
      ALTER TABLE maturity_courses
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `;

    await sql`
      ALTER TABLE maturity_courses
      ADD COLUMN IF NOT EXISTS audit_log JSONB NOT NULL DEFAULT '[]'::jsonb
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
  return normalizeCourse({
    ...row,
    pulse: parseJson<Course['pulse']>(row.pulse),
    team: parseJson<Course['team']>(row.team),
    deliverables: parseJson<Course['deliverables']>(row.deliverables),
    modules: parseJson<Course['modules']>(row.modules),
    observations: parseJson<Course['observations']>(row.observations),
    schedule: parseJson<Course['schedule']>(row.schedule),
    stageChecklist: parseJson<Course['stageChecklist']>(row.stageChecklist),
    assistants: parseJson<Course['assistants']>(row.assistants),
    metadata: parseJson<Course['metadata']>(row.metadata),
    auditLog: parseJson<Course['auditLog']>(row.auditLog),
  });
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
      assistants,
      metadata,
      audit_log
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
      ${JSON.stringify(course.assistants)}::jsonb,
      ${JSON.stringify(course.metadata)}::jsonb,
      ${JSON.stringify(course.auditLog)}::jsonb
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
      assistants = EXCLUDED.assistants,
      metadata = EXCLUDED.metadata,
      audit_log = EXCLUDED.audit_log
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

async function persistAlert(alert: Alert) {
  const sql = getSql();

  await sql`
    INSERT INTO maturity_alerts (
      id,
      title,
      course_slug,
      tone,
      owner,
      detail
    )
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
      assistants,
      metadata,
      audit_log AS "auditLog"
    FROM maturity_courses
    WHERE slug = ${slug}
    LIMIT 1
  `) as CourseRow[];

  return rows[0] ? serializeCourseRow(rows[0]) : null;
}

function mergeCourseMetadata(
  course: Course,
  metadata: Partial<CourseMetadataMutationInput>,
): Course['metadata'] {
  return {
    ...buildDefaultCourseMetadata(course),
    ...course.metadata,
    ...metadata,
    route: buildCourseRoute(course),
  };
}

function deriveNextMilestoneFromSchedule(schedule: TimelineItem[], fallback: string) {
  const nextItem = schedule
    .slice()
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .find((item) => item.status !== 'done');

  if (!nextItem) {
    return fallback;
  }

  return `${nextItem.label} · ${nextItem.dueDate}`;
}

async function appendAuditEntryByCourseSlug(
  courseSlug: string,
  title: string,
  detail: string,
  type: CourseAuditEntry['type'],
) {
  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const nextCourse = appendAuditEntry(course, title, detail, type);
  await persistCourse(nextCourse);
  return nextCourse;
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
      assistants,
      metadata,
      audit_log AS "auditLog"
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

export async function findCourseRecordBySlug(slug: string) {
  await ensureSchema();
  await ensureSeedData();
  return readCourseBySlug(slug);
}

export async function findAlertById(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      title,
      course_slug AS "courseSlug",
      tone,
      owner,
      detail
    FROM maturity_alerts
    WHERE id = ${id}
    LIMIT 1
  `) as Alert[];

  return rows[0] ?? null;
}

export async function createAlertRecord(input: AlertMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const alert = makeAlertRecord(input);
  await persistAlert(alert);
  return alert;
}

export async function deleteAlertRecord(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM maturity_alerts
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
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
      assistants,
      metadata,
      audit_log AS "auditLog"
    FROM maturity_courses
    WHERE slug = ${slug}
    LIMIT 1
  `) as CourseRow[];

  const current = rows[0] ? serializeCourseRow(rows[0]) : null;

  if (!current) {
    return null;
  }

  const nextCourse: Course = {
    ...appendAuditEntry(
      current,
      'Ficha general actualizada',
      `Se ajustó la identidad del curso a ${input.title} (${input.code}) dentro de ${input.program}.`,
      'course',
    ),
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
    metadata: mergeCourseMetadata(
      {
        ...current,
        title: input.title,
        code: input.code,
        faculty: input.faculty,
        program: input.program,
        modality: input.modality,
        summary: input.summary,
        status: input.status,
        stageId: input.stageId,
        updatedAt: getTodayLabel(),
      },
      {},
    ),
  };

  await persistCourse(nextCourse);
  return nextCourse;
}

export async function updateCourseMetadataRecord(
  courseSlug: string,
  input: CourseMetadataMutationInput,
) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const nextCourse = appendAuditEntry(
    {
      ...course,
      metadata: mergeCourseMetadata(course, input),
    },
    'Ficha operativa actualizada',
    `Se ajustaron metadatos, resultados de aprendizaje y criterios de seguimiento del curso ${course.title}.`,
    'course',
  );

  await persistCourse(nextCourse);
  return nextCourse;
}

export async function createTimelineItemRecord(courseSlug: string, input: TimelineItemMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const timelineItem: TimelineItem = {
    id: crypto.randomUUID(),
    label: input.label,
    dueDate: input.dueDate,
    status: input.status,
  };

  const nextSchedule = [
    ...course.schedule,
    timelineItem,
  ].sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  const nextCourse = appendAuditEntry(
    {
      ...course,
      schedule: nextSchedule,
      nextMilestone: deriveNextMilestoneFromSchedule(nextSchedule, course.nextMilestone),
    },
    'Hito agregado al cronograma',
    `Se registró el hito "${input.label}" para ${input.dueDate} con estado ${input.status}.`,
    'planning',
  );

  await persistCourse(nextCourse);
  return timelineItem;
}

export async function updateTimelineItemRecord(
  courseSlug: string,
  timelineItemId: string,
  input: Partial<TimelineItemMutationInput>,
) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  let updatedTimelineItem: TimelineItem | null = null;
  const nextSchedule = course.schedule
    .map((item) => {
      if (item.id !== timelineItemId) {
        return item;
      }

      updatedTimelineItem = {
        ...item,
        ...input,
      };

      return updatedTimelineItem;
    })
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  if (!updatedTimelineItem) {
    return null;
  }

  const finalTimelineItem = updatedTimelineItem as TimelineItem;

  const nextCourse = appendAuditEntry(
    {
      ...course,
      schedule: nextSchedule,
      nextMilestone: deriveNextMilestoneFromSchedule(nextSchedule, course.nextMilestone),
    },
    'Hito actualizado',
    `Se actualizó "${finalTimelineItem.label}" y ahora figura como ${finalTimelineItem.status}.`,
    'planning',
  );

  await persistCourse(nextCourse);
  return finalTimelineItem;
}

export async function deleteTimelineItemRecord(courseSlug: string, timelineItemId: string) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return false;
  }

  const deletedTimelineItem = course.schedule.find((item) => item.id === timelineItemId);
  const nextSchedule = course.schedule.filter((item) => item.id !== timelineItemId);

  if (!deletedTimelineItem || nextSchedule.length === course.schedule.length) {
    return false;
  }

  const nextCourse = appendAuditEntry(
    {
      ...course,
      schedule: nextSchedule,
      nextMilestone: deriveNextMilestoneFromSchedule(nextSchedule, course.nextMilestone),
    },
    'Hito retirado del cronograma',
    `Se retiró "${deletedTimelineItem.label}" de la planeación visible del curso.`,
    'planning',
  );

  await persistCourse(nextCourse);
  return true;
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
  await appendAuditEntryByCourseSlug(
    input.courseSlug,
    'Tarea creada',
    `Se asignó "${task.title}" a ${task.role} con vencimiento ${task.dueDate}.`,
    'planning',
  );
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
  await appendAuditEntryByCourseSlug(
    nextTask.courseSlug,
    'Tarea actualizada',
    `La tarea "${nextTask.title}" quedó en estado ${nextTask.status}.`,
    'planning',
  );
  return nextTask;
}

export async function deleteTaskRecord(id: string) {
  await ensureSchema();
  const sql = getSql();
  const current = await findTaskById(id);
  const result = (await sql`
    DELETE FROM maturity_tasks
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  if (result.length > 0 && current) {
    await appendAuditEntryByCourseSlug(
      current.courseSlug,
      'Tarea eliminada',
      `Se retiró la tarea "${current.title}" del tablero operativo del curso.`,
      'planning',
    );
  }

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

export async function updateStageCheckpointRecord(
  courseSlug: string,
  checkpointIndex: number,
  input: StageCheckpointMutationInput,
) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const currentCheckpoint = course.stageChecklist[checkpointIndex];

  if (!currentCheckpoint) {
    return null;
  }

  const nextStageChecklist = course.stageChecklist.map((checkpoint, index) =>
    index === checkpointIndex
      ? {
          ...checkpoint,
          status: input.status,
        }
      : checkpoint,
  );

  const nextCourse: Course = {
    ...appendAuditEntry(
      course,
      'Checkpoint actualizado',
      `El punto "${currentCheckpoint.label}" quedó en estado ${input.status}.`,
      input.status === 'blocked' ? 'qa' : 'planning',
    ),
    updatedAt: getTodayLabel(),
    status: deriveCourseStatusFromChecklist(course.status, nextStageChecklist),
    stageChecklist: nextStageChecklist,
  };

  await persistCourse(nextCourse);

  let alert: Alert | null = null;

  if (input.status === 'blocked') {
    alert = await createAlertRecord({
      title: `${course.title} tiene un bloqueo en ${currentCheckpoint.label}`,
      courseSlug: course.slug,
      tone: 'coral',
      owner: currentCheckpoint.owner,
      detail: `La etapa ${currentCheckpoint.label} quedó bloqueada y requiere intervención para continuar el flujo.`,
    });
  }

  return {
    course: nextCourse,
    alert,
  };
}

export async function advanceCourseStageRecord(courseSlug: string) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return {
      error: 'Curso no encontrado.',
    };
  }

  const currentStageIndex = getStageIndex(course.stageId);

  if (currentStageIndex < 0) {
    return {
      error: 'La etapa actual del curso no es válida.',
    };
  }

  const currentCheckpoint = course.stageChecklist[currentStageIndex];

  if (!currentCheckpoint || currentCheckpoint.status !== 'done') {
    return {
      error: 'Marca la etapa actual como completada antes de transferir el curso.',
    };
  }

  const hasBlockedCheckpoints = course.stageChecklist
    .slice(0, currentStageIndex + 1)
    .some((checkpoint) => checkpoint.status === 'blocked');
  const hasCriticalObservations = course.observations.some(
    (observation) => observation.status !== 'Resuelta' && observation.severity === 'Alta',
  );

  if (hasBlockedCheckpoints || hasCriticalObservations) {
    return {
      error:
        'No es posible hacer el handoff mientras existan bloqueos o observaciones críticas pendientes.',
    };
  }

  const isLastStage = currentStageIndex >= mockAppData.stages.length - 1;
  const nextStage = isLastStage ? null : mockAppData.stages[currentStageIndex + 1];
  const nextStageChecklist = course.stageChecklist.map((checkpoint, index) => {
    if (index < currentStageIndex) {
      return {
        ...checkpoint,
        status: 'done' as const,
      };
    }

    if (index === currentStageIndex) {
      return {
        ...checkpoint,
        status: 'done' as const,
      };
    }

    if (!isLastStage && index === currentStageIndex + 1) {
      return {
        ...checkpoint,
        status: 'active' as const,
      };
    }

    return {
      ...checkpoint,
      status: checkpoint.status === 'done' ? checkpoint.status : ('pending' as const),
    };
  });

  const nextCourse: Course = {
    ...appendAuditEntry(
      course,
      isLastStage ? 'Curso cerrado' : 'Handoff ejecutado',
      isLastStage
        ? 'Todas las etapas quedaron completadas y el curso pasó a cierre o publicación.'
        : `El curso pasó desde ${mockAppData.stages[currentStageIndex]?.name ?? 'la etapa actual'} hacia ${nextStage?.name ?? 'la siguiente etapa'}.`,
      'handoff',
    ),
    stageId: nextStage?.id ?? course.stageId,
    updatedAt: getTodayLabel(),
    progress: isLastStage
      ? 100
      : Math.max(course.progress, Math.round(((currentStageIndex + 2) / mockAppData.stages.length) * 100)),
    status: isLastStage ? 'Listo' : 'En revisión',
    nextMilestone: isLastStage
      ? `Curso listo para publicación · ${getTodayLabel()}`
      : `Handoff hacia ${nextStage?.name ?? 'siguiente etapa'} · ${getTodayLabel()}`,
    stageChecklist: nextStageChecklist,
  };

  await persistCourse(nextCourse);

  const alert = await createAlertRecord({
    title: isLastStage
      ? `${course.title} quedó listo para publicación`
      : `${course.title} pasó a ${nextStage?.name ?? 'la siguiente etapa'}`,
    courseSlug: course.slug,
    tone: isLastStage ? 'sage' : nextStage?.tone ?? 'ocean',
    owner: isLastStage ? 'Coordinador' : nextStage?.owner ?? 'Coordinador',
    detail: isLastStage
      ? 'Todas las etapas quedaron completadas y el proyecto puede pasar a publicación o activación.'
      : `Se liberó el handoff desde ${mockAppData.stages[currentStageIndex]?.name ?? 'la etapa anterior'} y el siguiente responsable ya puede iniciar trabajo.`,
  });

  let task: Task | null = null;

  if (nextStage) {
    task = makeTaskRecord({
      title: `Tomar handoff de ${nextStage.name}`,
      courseSlug: course.slug,
      role: nextStage.owner,
      stageId: nextStage.id,
      dueDate: addDays(2),
      priority: 'Alta',
      status: 'Pendiente',
      summary: `Revisar el curso transferido y activar las acciones iniciales de ${nextStage.name.toLowerCase()}.`,
    });

    await persistTask(task);
  }

  return {
    course: nextCourse,
    alert,
    task,
    error: null,
  };
}

export async function createDeliverableRecord(courseSlug: string, input: DeliverableMutationInput) {
  await ensureSchema();
  await ensureSeedData();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const nextCourse: Course = {
    ...appendAuditEntry(
      course,
      'Entregable creado',
      `Se agregó "${input.title}" para ${input.owner} con vencimiento ${input.dueDate}.`,
      'production',
    ),
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

  const finalDeliverable = updatedDeliverable as Deliverable;

  const nextCourse: Course = {
    ...appendAuditEntry(
      course,
      'Entregable actualizado',
      `El entregable "${finalDeliverable.title}" quedó en estado ${finalDeliverable.status}.`,
      'production',
    ),
    deliverables: nextDeliverables,
  };

  await persistCourse(nextCourse);
  return finalDeliverable;
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
    ...appendAuditEntry(
      course,
      'Entregable retirado',
      `Se retiró "${course.deliverables.find((deliverable) => deliverable.id === deliverableId)?.title ?? 'un entregable'}" del expediente.`,
      'production',
    ),
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
    ...appendAuditEntry(
      course,
      'Observación registrada',
      `Se abrió "${input.title}" desde ${input.role} con severidad ${input.severity}.`,
      'qa',
    ),
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

  const finalObservation = updatedObservation as Observation;

  const nextCourse: Course = {
    ...appendAuditEntry(
      course,
      'Observación actualizada',
      `La observación "${finalObservation.title}" quedó en estado ${finalObservation.status}.`,
      'qa',
    ),
    observations: nextObservations,
  };

  await persistCourse(nextCourse);
  return finalObservation;
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
    ...appendAuditEntry(
      course,
      'Observación retirada',
      `Se retiró "${course.observations.find((observation) => observation.id === observationId)?.title ?? 'una observación'}" del expediente.`,
      'qa',
    ),
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
  await appendAuditEntryByCourseSlug(
    input.courseSlug,
    'Recurso vinculado',
    `Se agregó "${resource.title}" como recurso ${resource.kind.toLowerCase()} del curso.`,
    'resource',
  );
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
  await appendAuditEntryByCourseSlug(
    resource.courseSlug,
    'Recurso actualizado',
    `El recurso "${resource.title}" quedó en estado ${resource.status}.`,
    'resource',
  );
  return resource;
}

export async function deleteLibraryResourceRecord(id: string) {
  await ensureSchema();
  const sql = getSql();
  const current = await findLibraryResourceById(id);
  const rows = (await sql`
    DELETE FROM maturity_library_resources
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  if (rows.length > 0 && current) {
    await appendAuditEntryByCourseSlug(
      current.courseSlug,
      'Recurso retirado',
      `Se eliminó "${current.title}" de la biblioteca vinculada del curso.`,
      'resource',
    );
  }

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
