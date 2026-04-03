import {
  defaultBranding,
  defaultExperienceSettings,
  defaultInstitutionSettings,
  defaultWorkflowSettings,
  defaultRoleProfiles,
  platformRoles,
  platformStages,
} from '../src/data/platformDefaults.js';
import type {
  Alert,
  AlertMutationInput,
  AppData,
  AuthUser,
  Course,
  CourseAuditEntry,
  CourseMetadata,
  CourseMetadataMutationInput,
  CourseProduct,
  CourseProductMutationInput,
  CourseProductStage,
  CourseMutationInput,
  CourseStageNoteMutationInput,
  CourseStageNoteKey,
  Deliverable,
  DeliverableMutationInput,
  LearningModule,
  LearningModuleMutationInput,
  InstitutionSettings,
  InstitutionStructure,
  LibraryResource,
  LibraryResourceMutationInput,
  Observation,
  ObservationMutationInput,
  PasswordChangeInput,
  ProductPhasePlan,
  ProductPlanningPhase,
  ProductWritingAsset,
  ProductWritingData,
  ProductWritingSection,
  Role,
  RoleProfile,
  StageCheckpoint,
  StageDefinition,
  StageCheckpointMutationInput,
  Task,
  TaskMutationInput,
  TeamMember,
  TeamMemberMutationInput,
  TimelineItem,
  TimelineItemMutationInput,
  UserAccountStatus,
  UserInstitutionMembership,
  UserMutationInput,
  UserProfileUpdateInput,
  UserUpdateInput,
} from '../src/types.js';
import { buildCourseDirectoryLabel, buildInstitutionStructureId } from '../src/utils/institutions.js';
import { getSql } from './db.js';
import { createPasswordHash, verifyPassword } from './security.js';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  code: string;
  institutionStructureId: string | null;
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
  stageNotes: JsonValue;
  products: JsonValue;
}

interface CourseProductRow {
  id: string;
  courseSlug: string;
  title: string;
  stage: CourseProductStage;
  format: CourseProduct['format'];
  owner: Role;
  status: CourseProduct['status'];
  summary: string;
  body: string;
  tags: JsonValue;
  version: string;
  section: string | null;
  phasePlan: JsonValue;
  writingData: JsonValue;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: string;
  title: string;
  courseSlug: string;
  productId: string | null;
  productTitle: string | null;
  role: Role;
  stageId: string;
  dueDate: string;
  priority: Task['priority'];
  status: Task['status'];
  summary: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles: JsonValue;
  status: UserAccountStatus;
  headline: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  institutionId: string | null;
  institution: string | null;
  facultyId: string | null;
  faculty: string | null;
  programId: string | null;
  program: string | null;
  institutionMembershipIds?: JsonValue | null;
  scope: string | null;
  statusReason: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  lastAccessAt: string | null;
  memberships: JsonValue | null;
  passwordHash: string;
}

interface PublicUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles: JsonValue;
  status: UserAccountStatus;
  headline: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  institutionId: string | null;
  institution: string | null;
  facultyId: string | null;
  faculty: string | null;
  programId: string | null;
  program: string | null;
  institutionMembershipIds?: JsonValue | null;
  scope: string | null;
  statusReason: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  lastAccessAt: string | null;
  memberships: JsonValue | null;
}

let initializationPromise: Promise<void> | null = null;

async function performInitialization() {
  try {
    await ensureSchema();
    await ensureSeedData();
  } catch (err) {
    initializationPromise = null;
    throw err;
  }
}

export async function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = performInitialization();
  }
  return initializationPromise;
}


interface SessionLookupRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles: JsonValue;
  status: UserAccountStatus;
  headline: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  institutionId: string | null;
  institution: string | null;
  facultyId: string | null;
  faculty: string | null;
  programId: string | null;
  program: string | null;
  institutionMembershipIds?: JsonValue | null;
  scope: string | null;
  statusReason: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  lastAccessAt: string | null;
  memberships: JsonValue | null;
  expiresAt: string;
}

function serializeUserRow(row: PublicUserRow | UserRow | SessionLookupRow): AuthUser {
  const secondaryRoles = parseJson<Role[]>(row.secondaryRoles ?? []);
  const memberships = parseJson<UserInstitutionMembership[]>(row.memberships ?? []);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    secondaryRoles: secondaryRoles.filter((item) => item !== row.role),
    status: row.status,
    headline: row.headline ?? '',
    phone: row.phone ?? '',
    location: row.location ?? '',
    bio: row.bio ?? '',
    institutionId: row.institutionId ?? '',
    institution: row.institution ?? '',
    facultyId: row.facultyId ?? '',
    faculty: row.faculty ?? '',
    programId: row.programId ?? '',
    program: row.program ?? '',
    scope: row.scope ?? '',
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    lastAccessAt: row.lastAccessAt,
    statusReason: row.statusReason,
    memberships,
  };
}

function normalizeRoleList(primaryRole: Role, secondaryRoles: Role[] | undefined) {
  return Array.from(new Set((secondaryRoles ?? []).filter((item) => item && item !== primaryRole)));
}

function normalizeInstitutionMembershipIds(
  institutionMembershipIds: string[] | undefined,
  primaryInstitutionId: string | null | undefined,
) {
  const uniqueIds = Array.from(
    new Set(
      (institutionMembershipIds ?? [])
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  if (primaryInstitutionId?.trim() && !uniqueIds.includes(primaryInstitutionId.trim())) {
    uniqueIds.unshift(primaryInstitutionId.trim());
  }

  return uniqueIds;
}

function normalizeUserStatus(status: UserAccountStatus | undefined) {
  return status ?? 'Pendiente';
}

function normalizeUserScopeValue(value: string | undefined) {
  return value?.trim() ?? '';
}

function assertCourseContextInput(input: CourseMutationInput) {
  if (!input.institution.trim()) {
    throw new Error('El curso debe pertenecer a una institución.');
  }

  if (!input.faculty.trim()) {
    throw new Error('El curso debe pertenecer a una facultad.');
  }

  if (!input.program.trim()) {
    throw new Error('El curso debe pertenecer a un programa.');
  }
}

function getTodayLabel() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'es'),
  );
}

function sanitizeInstitutionStructure(input: InstitutionStructure): InstitutionStructure {
  return {
    id: buildInstitutionStructureId(input.institution, input.id),
    institution: input.institution.trim() || 'Institución sin definir',
    faculties: uniqueValues(input.faculties),
    programs: uniqueValues(input.programs),
    academicPeriods: uniqueValues(input.academicPeriods),
    courseTypes: uniqueValues(input.courseTypes),
    pedagogicalGuidelines: uniqueValues(input.pedagogicalGuidelines),
    allowAutoProvisioning: Boolean(input.allowAutoProvisioning),
  };
}

function collectStructureValues(
  structures: InstitutionStructure[],
  key: 'faculties' | 'programs' | 'academicPeriods' | 'courseTypes',
) {
  return uniqueValues(
    structures.reduce<string[]>((accumulator, structure) => {
      accumulator.push(...structure[key]);
      return accumulator;
    }, []),
  );
}

function normalizeInstitutionSettingsFromStructures(
  structures: InstitutionStructure[],
  overrides?: Partial<
    Pick<InstitutionSettings, 'displayName' | 'supportEmail' | 'defaultDomain' | 'defaultUserState'>
  >,
): InstitutionSettings {
  const normalizedStructures = structures.length > 0
    ? structures
        .map(sanitizeInstitutionStructure)
        .sort((left, right) => left.institution.localeCompare(right.institution, 'es'))
    : defaultInstitutionSettings.structures.map((structure) => ({
        ...structure,
        faculties: [...structure.faculties],
        programs: [...structure.programs],
        academicPeriods: [...structure.academicPeriods],
        courseTypes: [...structure.courseTypes],
        pedagogicalGuidelines: [...structure.pedagogicalGuidelines],
      }));

  return {
    displayName:
      overrides?.displayName?.trim() ||
      normalizedStructures[0]?.institution ||
      defaultInstitutionSettings.displayName,
    structures: normalizedStructures,
    institutions: uniqueValues(normalizedStructures.map((structure) => structure.institution)),
    faculties: collectStructureValues(normalizedStructures, 'faculties'),
    programs: collectStructureValues(normalizedStructures, 'programs'),
    academicPeriods: collectStructureValues(normalizedStructures, 'academicPeriods'),
    courseTypes: collectStructureValues(normalizedStructures, 'courseTypes'),
    supportEmail: overrides?.supportEmail?.trim().toLowerCase() || defaultInstitutionSettings.supportEmail,
    defaultDomain: overrides?.defaultDomain?.trim().toLowerCase() || defaultInstitutionSettings.defaultDomain,
    defaultUserState: overrides?.defaultUserState ?? defaultInstitutionSettings.defaultUserState,
    allowAutoProvisioning: normalizedStructures.some((structure) => structure.allowAutoProvisioning),
  };
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
  const stageIndex = platformStages.findIndex((stage) => stage.id === stageId);

  return platformStages.map((stage, index) => ({
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

function buildCourseRoute(
  course: Pick<Course, 'faculty' | 'program' | 'title'> & {
    institution?: string;
    academicPeriod?: string;
    courseType?: string;
    metadata?: Partial<CourseMetadata>;
  },
) {
  return buildCourseDirectoryLabel({
    institution: course.metadata?.institution ?? course.institution,
    faculty: course.faculty,
    program: course.program,
    academicPeriod: course.metadata?.academicPeriod ?? course.academicPeriod,
    courseType: course.metadata?.courseType ?? course.courseType,
    title: course.title,
  });
}

const stageNoteDefinitions: Record<
  CourseStageNoteKey,
  {
    owner: Role;
    heading: string;
  }
> = {
  microcurriculo: {
    owner: 'Coordinador',
    heading: 'Microcurrículo y base curricular',
  },
  arquitectura: {
    owner: 'Diseñador instruccional',
    heading: 'Arquitectura de aprendizaje',
  },
  planeacion: {
    owner: 'Coordinador',
    heading: 'Planeación operativa',
  },
  escritura: {
    owner: 'Experto',
    heading: 'Escritura y autoría',
  },
  validacion: {
    owner: 'Diseñador instruccional',
    heading: 'Validación instruccional',
  },
  multimedia: {
    owner: 'Diseñador multimedia',
    heading: 'Producción multimedia',
  },
  lms: {
    owner: 'Gestor LMS',
    heading: 'Montaje LMS',
  },
  qa: {
    owner: 'Analista QA',
    heading: 'QA y validación final',
  },
  entrega: {
    owner: 'Coordinador',
    heading: 'Entrega final y cierre',
  },
};

const productStageOwners: Record<CourseProductStage, Role> = {
  microcurriculo: 'Coordinador',
  arquitectura: 'Diseñador instruccional',
  planeacion: 'Coordinador',
  escritura: 'Experto',
  validacion: 'Diseñador instruccional',
  multimedia: 'Diseñador multimedia',
  lms: 'Gestor LMS',
  qa: 'Analista QA',
  entrega: 'Coordinador',
};

const productPlanningPhases: ProductPlanningPhase[] = [
  'escritura',
  'validacion',
  'multimedia',
  'lms',
  'qa',
];

function deriveRiskLevel(status: Course['status']): CourseMetadata['riskLevel'] {
  if (status === 'Bloqueado' || status === 'En riesgo') {
    return 'Alto';
  }

  if (status === 'En QA') {
    return 'Medio';
  }

  return 'Bajo';
}

function derivePriority(status: Course['status']): CourseMetadata['priority'] {
  return status === 'Bloqueado' || status === 'En riesgo' ? 'Alta' : 'Media';
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
  > & {
    institution?: string;
    academicPeriod?: string;
    courseType?: string;
  },
): CourseMetadata {
  const targetCloseDate =
    course.schedule
      .slice()
      .sort((left, right) => right.dueDate.localeCompare(left.dueDate))[0]?.dueDate ?? course.updatedAt;

  return {
    institution: course.institution?.trim() || 'Maturity University',
    shortName: course.title,
    semester: 'Por definir',
    academicPeriod: course.academicPeriod?.trim() || '2026-1',
    courseType: course.courseType?.trim() || 'Curso',
    learningOutcomes: [course.summary],
    topics: course.modules.map((module) => module.title),
    units: [],
    methodology: `${course.modality} con seguimiento por etapas y expediente persistente.`,
    evaluation: [
      'Seguimiento por entregables, validación por etapa y observaciones trazables dentro del expediente.',
    ],
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
      `El curso mantiene una ficha consolidada en ${platformStages.find((stage) => stage.id === course.stageId)?.name ?? course.stageId}.`,
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

function buildDefaultCourseStageNotes(
  course: Pick<
    Course,
    | 'title'
    | 'stageId'
    | 'status'
    | 'updatedAt'
    | 'modules'
    | 'deliverables'
    | 'observations'
    | 'team'
    | 'stageChecklist'
  >,
): Course['stageNotes'] {
  return {
    microcurriculo: {
      owner: stageNoteDefinitions.microcurriculo.owner,
      heading: stageNoteDefinitions.microcurriculo.heading,
      status: 'Listo',
      summary: `Base curricular y sílabus consolidados para ${course.title}.`,
      evidence: [
        `${course.modules.length} módulo(s) definido(s)`,
      ],
      blockers: [],
      updatedAt: course.updatedAt,
    },
    arquitectura: {
      owner: stageNoteDefinitions.arquitectura.owner,
      heading: stageNoteDefinitions.arquitectura.heading,
      status: course.stageId === 'arquitectura' ? 'En curso' : 'Listo',
      summary: `La arquitectura del curso ${course.title} organiza módulos, actividades y secuencia de aprendizaje.`,
      evidence: [
        `${course.modules.length} módulo(s) estructurado(s)`,
        `${course.modules.reduce((sum, module) => sum + module.activities, 0)} actividad(es) mapeada(s)`,
      ],
      blockers: [],
      updatedAt: course.updatedAt,
    },
    planeacion: {
      owner: stageNoteDefinitions.planeacion.owner,
      heading: stageNoteDefinitions.planeacion.heading,
      status: course.stageId === 'planeacion' ? 'En curso' : 'Pendiente',
      summary: 'Hitos, cronograma y asignaciones de equipo definidos.',
      evidence: [],
      blockers: [],
      updatedAt: course.updatedAt,
    },
    escritura: {
      owner: stageNoteDefinitions.escritura.owner,
      heading: stageNoteDefinitions.escritura.heading,
      status:
        course.stageId === 'escritura'
          ? 'En curso'
          : course.stageId === 'validacion' || course.stageId === 'multimedia' || course.stageId === 'lms' || course.stageId === 'calidad'
            ? 'Listo'
            : 'Pendiente',
      summary: 'La escritura reúne contenidos, instrucciones y entregables listos para revisión.',
      evidence: course.deliverables.slice(0, 3).map((item) => item.title),
      blockers: course.deliverables
        .filter((item) => item.status === 'Bloqueado')
        .map((item) => item.title),
      updatedAt: course.updatedAt,
    },
    validacion: {
      owner: stageNoteDefinitions.validacion.owner,
      heading: stageNoteDefinitions.validacion.heading,
      status: course.stageId === 'validacion' ? 'En curso' : 'Pendiente',
      summary: 'Revisión pedagógica e instruccional antes de producción multimedia.',
      evidence: [],
      blockers: [],
      updatedAt: course.updatedAt,
    },
    multimedia: {
      owner: stageNoteDefinitions.multimedia.owner,
      heading: stageNoteDefinitions.multimedia.heading,
      status: course.team.some((member) => member.role === 'Diseñador multimedia') ? 'En curso' : 'Pendiente',
      summary: 'La capa multimedia gestiona piezas propias, observaciones y versiones listas para publicación.',
      evidence: course.deliverables
        .filter((item) => item.owner === 'Diseñador multimedia')
        .map((item) => item.title),
      blockers: course.observations
        .filter((item) => item.role === 'Analista QA' && item.status !== 'Resuelta')
        .map((item) => item.title),
      updatedAt: course.updatedAt,
    },
    lms: {
      owner: stageNoteDefinitions.lms.owner,
      heading: stageNoteDefinitions.lms.heading,
      status:
        course.stageId === 'lms'
          ? 'En curso'
          : course.stageId === 'calidad'
            ? 'Listo'
            : 'Pendiente',
      summary: 'La implementación en LMS conserva evidencias de montaje, incidencias y checklist técnico.',
      evidence: course.deliverables
        .filter((item) => item.owner === 'Gestor LMS')
        .map((item) => item.title),
      blockers: course.stageChecklist
        .filter((item) => item.owner === 'Gestor LMS' && item.status === 'blocked')
        .map((item) => item.label),
      updatedAt: course.updatedAt,
    },
    qa: {
      owner: stageNoteDefinitions.qa.owner,
      heading: stageNoteDefinitions.qa.heading,
      status:
        course.stageId === 'calidad'
          ? 'En curso'
          : course.status === 'Entregado'
            ? 'Listo'
            : 'Pendiente',
      summary: 'La validación consolida hallazgos, devoluciones y aprobaciones del curso antes del cierre.',
      evidence: course.observations.map((item) => item.title),
      blockers: course.observations
        .filter((item) => item.status !== 'Resuelta' && item.severity === 'Alta')
        .map((item) => item.title),
      updatedAt: course.updatedAt,
    },
    entrega: {
      owner: stageNoteDefinitions.entrega.owner,
      heading: stageNoteDefinitions.entrega.heading,
      status: course.status === 'Entregado' ? 'Listo' : 'Pendiente',
      summary: 'Cierre operativo, notificación y entrega final del curso.',
      evidence: [],
      blockers: [],
      updatedAt: course.updatedAt,
    },
  };
}

function buildDefaultCourseProducts(
  course: Pick<
    Course,
    | 'slug'
    | 'title'
    | 'code'
    | 'program'
    | 'modality'
    | 'summary'
    | 'updatedAt'
    | 'stageId'
    | 'team'
    | 'modules'
    | 'deliverables'
  >,
): CourseProduct[] {
  return [
    {
      id: `product-${course.slug}-microcurriculo`,
      title: 'Sílabus base del curso',
      stage: 'microcurriculo',
      format: 'Sílabus',
      owner: productStageOwners.microcurriculo,
      status: 'Aprobado',
      summary: 'Documento base con la configuración académica y curricular del curso.',
      body: [
        `Curso: ${course.title} (${course.code})`,
        `Programa: ${course.program}`,
        `Modalidad: ${course.modality}`,
        `Resumen: ${course.summary}`,
      ].join('\n'),
      tags: ['sílabus', 'base'],
      version: 'v1.0',
      phasePlan: [],
      writingData: normalizeProductWritingData(),
      updatedAt: course.updatedAt,
    },
    {
      id: `product-${course.slug}-arquitectura`,
      title: 'Lineamiento pedagógico',
      stage: 'arquitectura',
      format: 'Lineamiento',
      owner: productStageOwners.arquitectura,
      status: course.stageId === 'arquitectura' ? 'En revisión' : 'Aprobado',
      summary: 'Criterio pedagógico, módulos y ruta de experiencia del curso.',
      body: course.modules
        .map(
          (module, index) =>
            `Unidad ${index + 1}: ${module.title}\nObjetivo: ${module.learningGoal}\nActividades: ${module.activities}`,
        )
        .join('\n\n'),
      tags: ['pedagogía', 'módulos'],
      version: 'v1.1',
      phasePlan: [],
      writingData: normalizeProductWritingData(),
      updatedAt: course.updatedAt,
    },
    {
      id: `product-${course.slug}-escritura`,
      title: 'Guía de actividades y recursos',
      stage: 'escritura',
      format: 'Actividad',
      owner: productStageOwners.escritura,
      status: course.stageId === 'escritura' ? 'En revisión' : 'Borrador',
      summary: 'Documento vivo con actividades, instrucciones y recursos propios del curso.',
      body: course.deliverables
        .map(
          (item) =>
            `${item.title}\nResponsable: ${item.owner}\nEstado: ${item.status}\nNota: ${item.note}`,
        )
        .join('\n\n'),
      tags: ['autoría', 'actividades'],
      version: 'v0.9',
      phasePlan: [],
      writingData: normalizeProductWritingData(),
      updatedAt: course.updatedAt,
    },
    {
      id: `product-${course.slug}-validacion`,
      title: 'Informe de validación instruccional',
      stage: 'validacion',
      format: 'Documento',
      owner: productStageOwners.validacion,
      status: 'En revisión',
      summary: 'Consolida la revisión pedagógica e instruccional del curso.',
      body: course.modules
        .map(
          (module) =>
            `${module.title}\nObjetivo: ${module.learningGoal}\nActividades: ${module.activities}`,
        )
        .join('\n\n'),
      tags: ['validación', 'instruccional'],
      version: 'v0.8',
      phasePlan: [],
      writingData: normalizeProductWritingData(),
      updatedAt: course.updatedAt,
    },
    {
      id: `product-${course.slug}-multimedia`,
      title: 'Paquete multimedia',
      stage: 'multimedia',
      format: 'HTML',
      owner: productStageOwners.multimedia,
      status: course.team.some((member) => member.role === 'Diseñador multimedia')
        ? 'En revisión'
        : 'Borrador',
      summary: 'Agrupa piezas multimedia propias del curso listas para iteración.',
      body: ['HTML interactivo', 'Pódcast', 'Lectura extendida', 'Infografía'].join('\n'),
      tags: ['multimedia', 'html', 'propio'],
      version: 'v0.6',
      phasePlan: [],
      writingData: normalizeProductWritingData(),
      updatedAt: course.updatedAt,
    },
    {
      id: `product-${course.slug}-lms`,
      title: 'Reporte de montaje técnico',
      stage: 'lms',
      format: 'Documento',
      owner: productStageOwners.lms,
      status: course.stageId === 'lms' ? 'En revisión' : 'Borrador',
      summary: 'Consolida evidencias de implementación, navegación y comportamiento en plataforma.',
      body: ['Navegación verificada', 'Enlaces operativos', 'Actividades configuradas'].join('\n'),
      tags: ['lms', 'montaje', 'técnico'],
      version: 'v1.0',
      phasePlan: [],
      writingData: normalizeProductWritingData(),
      updatedAt: course.updatedAt,
    },
    {
      id: `product-${course.slug}-qa`,
      title: 'Rúbrica de validación',
      stage: 'qa',
      format: 'Rúbrica',
      owner: productStageOwners.qa,
      status: course.stageId === 'calidad' ? 'En revisión' : 'Borrador',
      summary: 'Checklist y criterio de cierre para revisión pedagógica y calidad.',
      body: ['Coherencia pedagógica', 'Calidad de recursos', 'Accesibilidad', 'Preparación para cierre'].join(
        '\n',
      ),
      tags: ['qa', 'quality-matters'],
      version: 'v1.0',
      phasePlan: [],
      writingData: normalizeProductWritingData(),
      updatedAt: course.updatedAt,
    },
  ];
}

function normalizeCourse(course: Course): Course {
  const normalizedMetadata = {
    ...buildDefaultCourseMetadata(course),
    ...(course.metadata ?? {}),
    route: buildCourseRoute(course),
  };
  const normalizedStageNotes = Object.entries(buildDefaultCourseStageNotes(course)).reduce(
    (accumulator, [key, value]) => ({
      ...accumulator,
      [key]: {
        ...value,
        ...(course.stageNotes?.[key as CourseStageNoteKey] ?? {}),
        owner: stageNoteDefinitions[key as CourseStageNoteKey].owner,
        heading: stageNoteDefinitions[key as CourseStageNoteKey].heading,
      },
    }),
    {} as Course['stageNotes'],
  );
  const defaultProducts = buildDefaultCourseProducts(course);
  const normalizedProducts =
    course.products.length > 0
      ? course.products
          .slice()
          .map((product) => ({
            ...product,
            phasePlan: normalizeProductPhasePlan(product.phasePlan),
            writingData: normalizeProductWritingData(product.writingData),
          }))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      : defaultProducts.map((product) => ({
          ...product,
          phasePlan: normalizeProductPhasePlan(product.phasePlan),
          writingData: normalizeProductWritingData(product.writingData),
        }));

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
    stageNotes: normalizedStageNotes,
    products: normalizedProducts,
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
      institution: input.institution,
      faculty: input.faculty,
      program: input.program,
      academicPeriod: input.academicPeriod,
      courseType: input.courseType,
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
    stageNotes: buildDefaultCourseStageNotes({
      title: input.title,
      stageId: input.stageId,
      status: input.status,
      updatedAt: getTodayLabel(),
      modules: [],
      deliverables: [],
      observations: [],
      team: [],
      stageChecklist: buildStageChecklist(input.stageId),
    }),
    products: buildDefaultCourseProducts({
      slug: slugBase,
      title: input.title,
      code: input.code,
      program: input.program,
      modality: input.modality,
      summary: input.summary,
      updatedAt: getTodayLabel(),
      stageId: input.stageId,
      team: [],
      modules: [],
      deliverables: [],
    }),
  });
}

function makeTaskRecord(input: TaskMutationInput): Task {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    courseSlug: input.courseSlug,
    productId: input.productId?.trim() || undefined,
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

function deriveInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('');
}

function makeTeamMemberRecord(input: TeamMemberMutationInput): TeamMember {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    role: input.role,
    focus: input.focus,
    initials: input.initials.trim().toUpperCase() || deriveInitials(input.name),
  };
}

function makeLearningModuleRecord(input: LearningModuleMutationInput): LearningModule {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    learningGoal: input.learningGoal,
    activities: input.activities,
    ownResources: input.ownResources,
    curatedResources: input.curatedResources,
    completion: input.completion,
  };
}

function normalizeProductPhasePlan(
  phasePlan?: ProductPhasePlan[],
): ProductPhasePlan[] {
  const planByPhase = new Map<ProductPlanningPhase, ProductPhasePlan>();

  for (const item of phasePlan ?? []) {
    if (!item?.phase || !productPlanningPhases.includes(item.phase)) {
      continue;
    }

    planByPhase.set(item.phase, {
      phase: item.phase,
      startDate: item.startDate?.trim?.() ?? '',
      endDate: item.endDate?.trim?.() ?? '',
      assigneeId: item.assigneeId?.trim?.() || undefined,
      assigneeName: item.assigneeName?.trim?.() || undefined,
    });
  }

  return productPlanningPhases.map((phase) => {
    const current = planByPhase.get(phase);
    return (
      current ?? {
        phase,
        startDate: '',
        endDate: '',
      }
    );
  });
}

function normalizeProductWritingAssets(assets?: ProductWritingAsset[]): ProductWritingAsset[] {
  return (assets ?? [])
    .filter((asset): asset is ProductWritingAsset => Boolean(asset?.key && asset?.url && asset?.name))
    .map((asset) => ({
      key: asset.key.trim(),
      url: asset.url.trim(),
      name: asset.name.trim(),
      contentType: asset.contentType?.trim() || undefined,
      size: typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : undefined,
      uploadedAt: asset.uploadedAt?.trim() || new Date().toISOString(),
    }));
}

function normalizeProductWritingSections(sections?: ProductWritingSection[]): ProductWritingSection[] {
  return (sections ?? [])
    .filter((section): section is ProductWritingSection => Boolean(section?.title))
    .map((section, index) => ({
      id: section.id?.trim() || `section-${index + 1}`,
      title: section.title.trim(),
      instructions: section.instructions?.trim?.() ?? '',
      content: section.content?.trim?.() ?? '',
      updatedAt: section.updatedAt?.trim() || undefined,
    }));
}

function normalizeProductWritingData(writingData?: ProductWritingData): ProductWritingData {
  return {
    mode:
      writingData?.mode === 'upload' || writingData?.mode === 'ai' || writingData?.mode === 'manual'
        ? writingData.mode
        : 'manual',
    submittedAsset:
      writingData?.submittedAsset?.key && writingData.submittedAsset.url && writingData.submittedAsset.name
        ? normalizeProductWritingAssets([writingData.submittedAsset])[0]
        : undefined,
    supportAssets: normalizeProductWritingAssets(writingData?.supportAssets),
    libraryResourceIds: (writingData?.libraryResourceIds ?? [])
      .map((item) => item?.trim?.() ?? '')
      .filter(Boolean),
    extractedText: writingData?.extractedText?.trim?.() ?? '',
    draftText: writingData?.draftText?.trim?.() ?? '',
    sections: normalizeProductWritingSections(writingData?.sections),
    lastSavedAt: writingData?.lastSavedAt?.trim() || undefined,
    lastGeneratedAt: writingData?.lastGeneratedAt?.trim() || undefined,
  };
}

function normalizeLongTextBlock(value?: string | null) {
  return (value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLegacyArchitectureText(summary?: string | null, body?: string | null) {
  const normalizedSummary = normalizeLongTextBlock(summary);
  const normalizedBody = normalizeLongTextBlock(body);

  if (!normalizedSummary && !normalizedBody) {
    return {
      summary: '',
      body: '',
    };
  }

  if (normalizedBody) {
    return {
      summary: normalizedSummary,
      body: normalizedBody,
    };
  }

  const markerMatches = [
    /caracteristicas/i,
    /características/i,
    /aspecto\s+lineamiento/i,
    /instrucciones para escribirlo/i,
    /formula practica/i,
    /fórmula práctica/i,
    /puedes pensarlo asi/i,
    /puedes pensarlo así/i,
    /en sintesis/i,
    /en síntesis/i,
  ]
    .map((pattern) => normalizedSummary.search(pattern))
    .filter((index) => index >= 0);

  const firstMarkerIndex = markerMatches.length > 0 ? Math.min(...markerMatches) : -1;

  if (firstMarkerIndex > 0) {
    const nextSummary = normalizeLongTextBlock(normalizedSummary.slice(0, firstMarkerIndex));
    const nextBody = normalizeLongTextBlock(normalizedSummary.slice(firstMarkerIndex));
    return {
      summary: nextSummary,
      body: nextBody,
    };
  }

  const summaryLooksOverloaded =
    normalizedSummary.length > 420 ||
    normalizedSummary.split('\n').length > 8 ||
    /caracteristicas|características|momento de aplicacion|momento de aplicación|tipo de cuestionario|numero de preguntas|número de preguntas|cobertura tematica|cobertura temática/i.test(
      normalizedSummary,
    );

  if (!summaryLooksOverloaded) {
    return {
      summary: normalizedSummary,
      body:
        normalizedSummary
          ? 'Desarrolla este producto siguiendo la descripción, la sección asignada y los lineamientos pedagógicos institucionales del curso.'
          : '',
    };
  }

  const sentenceMatches = normalizedSummary.match(/[^.!?\n]+[.!?]+(?:\s+|$)/g) ?? [];
  const descriptionSource =
    sentenceMatches.slice(0, 2).join(' ').trim() ||
    normalizedSummary.slice(0, 220).trim();
  const nextSummary = normalizeLongTextBlock(descriptionSource);
  const nextBody = normalizeLongTextBlock(
    normalizedSummary.slice(descriptionSource.length).trim() || normalizedSummary,
  );

  return {
    summary: nextSummary,
    body:
      nextBody ||
      'Desarrolla este producto siguiendo la descripción, la sección asignada y los lineamientos pedagógicos institucionales del curso.',
  };
}

function normalizeCourseProductTextFields(
  stage: CourseProductStage,
  summary?: string | null,
  body?: string | null,
) {
  if (stage === 'arquitectura') {
    return splitLegacyArchitectureText(summary, body);
  }

  return {
    summary: normalizeLongTextBlock(summary),
    body: normalizeLongTextBlock(body),
  };
}

function makeCourseProductRecord(input: CourseProductMutationInput): CourseProduct {
  const normalizedText = normalizeCourseProductTextFields(input.stage, input.summary, input.body);

  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    stage: input.stage,
    format: input.format,
    owner: input.owner,
    status: input.status,
    summary: normalizedText.summary,
    body: normalizedText.body,
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    version: input.version?.trim?.() || '1.0',
    section: input.section?.trim() || undefined,
    phasePlan: normalizeProductPhasePlan(input.phasePlan),
    writingData: normalizeProductWritingData(input.writingData),
    updatedAt: getTodayLabel(),
  };
}

function findCourseProduct(course: Course, productId: string) {
  return course.products.find((product) => product.id === productId) ?? null;
}

function serializeTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    courseSlug: row.courseSlug,
    productId: row.productId ?? undefined,
    productTitle: row.productTitle ?? undefined,
    role: row.role,
    stageId: row.stageId,
    dueDate: row.dueDate,
    priority: row.priority,
    status: row.status,
    summary: row.summary,
  };
}

async function resolveTaskProductSnapshot(courseSlug: string, productId?: string | null) {
  const normalizedProductId = productId?.trim();

  if (!normalizedProductId) {
    return {
      productId: undefined,
      productTitle: undefined,
    };
  }

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    throw new Error('El curso de la tarea ya no existe.');
  }

  const product = findCourseProduct(course, normalizedProductId);

  if (!product) {
    throw new Error('El producto asociado ya no existe dentro de este curso.');
  }

  return {
    productId: product.id,
    productTitle: product.title,
  };
}

async function syncTasksForProduct(product: CourseProduct) {
  const sql = getSql();

  await sql`
    UPDATE maturity_tasks
    SET product_title = ${product.title}
    WHERE product_id = ${product.id}
  `;
}

function mapProductStageToAuditType(stage: CourseProductStage): CourseAuditEntry['type'] {
  switch (stage) {
    case 'microcurriculo':
    case 'planeacion':
      return 'course';
    case 'arquitectura':
      return 'planning';
    case 'escritura':
    case 'validacion':
      return 'production';
    case 'multimedia':
    case 'entrega':
      return 'resource';
    case 'qa':
      return 'qa';
    default:
      return 'history';
  }
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
  return platformStages.findIndex((stage) => stage.id === stageId);
}

function deriveCourseStatusFromChecklist(
  currentStatus: Course['status'],
  stageChecklist: StageCheckpoint[],
) {
  if (stageChecklist.some((item) => item.status === 'blocked')) {
    return 'Bloqueado';
  }

  if (stageChecklist.every((item) => item.status === 'done')) {
    return 'Entregado';
  }

  if (currentStatus === 'Bloqueado' || currentStatus === 'Entregado') {
    return 'En QA';
  }

  return currentStatus;
}

function parseJson<T>(value: JsonValue): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
}

function hashValue(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(8, '0').slice(0, 8);
}

function buildScopedEntityId(prefix: string, scope: string, value: string) {
  const seed = `${scope}:${value.trim().toLowerCase()}`;
  return `${prefix}-${hashValue(seed)}`;
}

async function tableExists(tableName: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `) as Array<{ exists: boolean }>;

  return Boolean(rows[0]?.exists);
}

async function readLegacyInstitutionSettings(): Promise<InstitutionSettings | null> {
  if (!(await tableExists('maturity_admin_settings'))) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT value
    FROM maturity_admin_settings
    WHERE key = ${'institution'}
    LIMIT 1
  `) as Array<{ value: JsonValue }>;

  if (!rows[0]?.value) {
    return null;
  }

  const parsed = parseJson<Partial<InstitutionSettings>>(rows[0].value);
  const structures =
    parsed.structures && parsed.structures.length > 0
      ? parsed.structures.map(sanitizeInstitutionStructure)
      : defaultInstitutionSettings.structures.map((structure) => ({
          ...structure,
          faculties: [...structure.faculties],
          programs: [...structure.programs],
          academicPeriods: [...structure.academicPeriods],
          courseTypes: [...structure.courseTypes],
          pedagogicalGuidelines: [...structure.pedagogicalGuidelines],
        }));

  return normalizeInstitutionSettingsFromStructures(structures, {
    displayName: parsed.displayName,
    supportEmail: parsed.supportEmail,
    defaultDomain: parsed.defaultDomain,
    defaultUserState: parsed.defaultUserState,
  });
}

async function readInstitutionStructuresRecord() {
  const sql = getSql();
  const institutions = (await sql`
    SELECT
      id,
      name,
      allow_auto_provisioning AS "allowAutoProvisioning"
    FROM maturity_institutions
    ORDER BY name ASC
  `) as Array<{
    id: string;
    name: string;
    allowAutoProvisioning: boolean;
  }>;

  if (institutions.length === 0) {
    return [] as InstitutionStructure[];
  }

  const faculties = (await sql`
    SELECT institution_id AS "institutionId", name
    FROM maturity_institution_faculties
    ORDER BY sort_order ASC, name ASC
  `) as Array<{ institutionId: string; name: string }>;

  const programs = (await sql`
    SELECT institution_id AS "institutionId", name
    FROM maturity_institution_programs
    ORDER BY sort_order ASC, name ASC
  `) as Array<{ institutionId: string; name: string }>;

  const academicPeriods = (await sql`
    SELECT institution_id AS "institutionId", name
    FROM maturity_institution_academic_periods
    ORDER BY sort_order ASC, name ASC
  `) as Array<{ institutionId: string; name: string }>;

  const courseTypes = (await sql`
    SELECT institution_id AS "institutionId", name
    FROM maturity_institution_course_types
    ORDER BY sort_order ASC, name ASC
  `) as Array<{ institutionId: string; name: string }>;

  const guidelines = (await sql`
    SELECT institution_id AS "institutionId", guideline
    FROM maturity_institution_guidelines
    ORDER BY sort_order ASC, guideline ASC
  `) as Array<{ institutionId: string; guideline: string }>;

  return institutions.map((institution) =>
    sanitizeInstitutionStructure({
      id: institution.id,
      institution: institution.name,
      faculties: faculties
        .filter((item) => item.institutionId === institution.id)
        .map((item) => item.name),
      programs: programs
        .filter((item) => item.institutionId === institution.id)
        .map((item) => item.name),
      academicPeriods: academicPeriods
        .filter((item) => item.institutionId === institution.id)
        .map((item) => item.name),
      courseTypes: courseTypes
        .filter((item) => item.institutionId === institution.id)
        .map((item) => item.name),
      pedagogicalGuidelines: guidelines
        .filter((item) => item.institutionId === institution.id)
        .map((item) => item.guideline),
      allowAutoProvisioning: institution.allowAutoProvisioning,
    }),
  );
}

async function readInstitutionSettingsRecord(
  overrides?: Partial<
    Pick<InstitutionSettings, 'displayName' | 'supportEmail' | 'defaultDomain' | 'defaultUserState'>
  >,
) {
  const structures = await readInstitutionStructuresRecord();
  return normalizeInstitutionSettingsFromStructures(structures, overrides);
}

async function syncInstitutionCatalogValues(
  kind: 'faculty' | 'program' | 'academicPeriod' | 'courseType' | 'guideline',
  institutionId: string,
  values: string[],
) {
  const sql = getSql();
  const normalizedValues = uniqueValues(values);

  if (kind === 'faculty') {
    const existing = (await sql`
      SELECT id, name
      FROM maturity_institution_faculties
      WHERE institution_id = ${institutionId}
    `) as Array<{ id: string; name: string }>;
    const nextIds = new Set(normalizedValues.map((value) => buildScopedEntityId('fac', institutionId, value)));

    for (const [index, value] of normalizedValues.entries()) {
      await sql`
        INSERT INTO maturity_institution_faculties (id, institution_id, name, sort_order)
        VALUES (${buildScopedEntityId('fac', institutionId, value)}, ${institutionId}, ${value}, ${index})
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `;
    }

    for (const row of existing.filter((item) => !nextIds.has(item.id))) {
      const dependency = (await sql`
        SELECT
          (
            SELECT COUNT(*)::INT
            FROM maturity_courses
            WHERE faculty_id = ${row.id}
          ) AS "courseCount",
          (
            SELECT COUNT(*)::INT
            FROM maturity_users
            WHERE faculty_id = ${row.id}
          ) AS "userCount",
          (
            SELECT COUNT(*)::INT
            FROM maturity_user_institution_roles
            WHERE faculty_id = ${row.id}
          ) AS "membershipCount"
      `) as Array<{ courseCount: number; userCount: number; membershipCount: number }>;

      const counts = dependency[0] ?? { courseCount: 0, userCount: 0, membershipCount: 0 };

      if (counts.courseCount > 0 || counts.userCount > 0 || counts.membershipCount > 0) {
        throw new Error(`No puedes eliminar la facultad "${row.name}" porque ya tiene dependencias activas.`);
      }

      await sql`DELETE FROM maturity_institution_faculties WHERE id = ${row.id}`;
    }

    return;
  }

  if (kind === 'program') {
    const existing = (await sql`
      SELECT id, name
      FROM maturity_institution_programs
      WHERE institution_id = ${institutionId}
    `) as Array<{ id: string; name: string }>;
    const nextIds = new Set(normalizedValues.map((value) => buildScopedEntityId('prg', institutionId, value)));

    for (const [index, value] of normalizedValues.entries()) {
      await sql`
        INSERT INTO maturity_institution_programs (id, institution_id, name, sort_order)
        VALUES (${buildScopedEntityId('prg', institutionId, value)}, ${institutionId}, ${value}, ${index})
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `;
    }

    for (const row of existing.filter((item) => !nextIds.has(item.id))) {
      const dependency = (await sql`
        SELECT
          (
            SELECT COUNT(*)::INT
            FROM maturity_courses
            WHERE program_id = ${row.id}
          ) AS "courseCount",
          (
            SELECT COUNT(*)::INT
            FROM maturity_users
            WHERE program_id = ${row.id}
          ) AS "userCount",
          (
            SELECT COUNT(*)::INT
            FROM maturity_user_institution_roles
            WHERE program_id = ${row.id}
          ) AS "membershipCount"
      `) as Array<{ courseCount: number; userCount: number; membershipCount: number }>;

      const counts = dependency[0] ?? { courseCount: 0, userCount: 0, membershipCount: 0 };

      if (counts.courseCount > 0 || counts.userCount > 0 || counts.membershipCount > 0) {
        throw new Error(`No puedes eliminar el programa "${row.name}" porque ya tiene dependencias activas.`);
      }

      await sql`DELETE FROM maturity_institution_programs WHERE id = ${row.id}`;
    }

    return;
  }

  if (kind === 'academicPeriod') {
    const existing = (await sql`
      SELECT id, name
      FROM maturity_institution_academic_periods
      WHERE institution_id = ${institutionId}
    `) as Array<{ id: string; name: string }>;
    const nextIds = new Set(normalizedValues.map((value) => buildScopedEntityId('prd', institutionId, value)));

    for (const [index, value] of normalizedValues.entries()) {
      await sql`
        INSERT INTO maturity_institution_academic_periods (id, institution_id, name, sort_order)
        VALUES (${buildScopedEntityId('prd', institutionId, value)}, ${institutionId}, ${value}, ${index})
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `;
    }

    for (const row of existing.filter((item) => !nextIds.has(item.id))) {
      const dependency = (await sql`
        SELECT COUNT(*)::INT AS count
        FROM maturity_courses
        WHERE academic_period_id = ${row.id}
      `) as Array<{ count: number }>;

      if ((dependency[0]?.count ?? 0) > 0) {
        throw new Error(`No puedes eliminar el periodo "${row.name}" porque ya tiene cursos vinculados.`);
      }

      await sql`DELETE FROM maturity_institution_academic_periods WHERE id = ${row.id}`;
    }

    return;
  }

  if (kind === 'courseType') {
    const existing = (await sql`
      SELECT id, name
      FROM maturity_institution_course_types
      WHERE institution_id = ${institutionId}
    `) as Array<{ id: string; name: string }>;
    const nextIds = new Set(normalizedValues.map((value) => buildScopedEntityId('typ', institutionId, value)));

    for (const [index, value] of normalizedValues.entries()) {
      await sql`
        INSERT INTO maturity_institution_course_types (id, institution_id, name, sort_order)
        VALUES (${buildScopedEntityId('typ', institutionId, value)}, ${institutionId}, ${value}, ${index})
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
      `;
    }

    for (const row of existing.filter((item) => !nextIds.has(item.id))) {
      const dependency = (await sql`
        SELECT COUNT(*)::INT AS count
        FROM maturity_courses
        WHERE course_type_id = ${row.id}
      `) as Array<{ count: number }>;

      if ((dependency[0]?.count ?? 0) > 0) {
        throw new Error(`No puedes eliminar la tipología "${row.name}" porque ya tiene cursos vinculados.`);
      }

      await sql`DELETE FROM maturity_institution_course_types WHERE id = ${row.id}`;
    }

    return;
  }

  const existing = (await sql`
    SELECT id, guideline
    FROM maturity_institution_guidelines
    WHERE institution_id = ${institutionId}
  `) as Array<{ id: string; guideline: string }>;
  const nextIds = new Set(normalizedValues.map((value) => buildScopedEntityId('gdl', institutionId, value)));

  for (const [index, value] of normalizedValues.entries()) {
    await sql`
      INSERT INTO maturity_institution_guidelines (id, institution_id, guideline, sort_order)
      VALUES (${buildScopedEntityId('gdl', institutionId, value)}, ${institutionId}, ${value}, ${index})
      ON CONFLICT (id) DO UPDATE
      SET guideline = EXCLUDED.guideline, sort_order = EXCLUDED.sort_order
    `;
  }

  for (const row of existing.filter((item) => !nextIds.has(item.id))) {
    await sql`DELETE FROM maturity_institution_guidelines WHERE id = ${row.id}`;
  }
}

async function syncInstitutionDirectoryRecords(
  structures: InstitutionStructure[],
  options: {
    pruneMissing?: boolean;
  } = {},
) {
  const sql = getSql();
  const normalizedStructures = (structures.length > 0 ? structures : defaultInstitutionSettings.structures)
    .map(sanitizeInstitutionStructure)
    .sort((left, right) => left.institution.localeCompare(right.institution, 'es'));
  const nextInstitutionIds = new Set(normalizedStructures.map((structure) => structure.id));

  const existingRows = (await sql`
    SELECT id
    FROM maturity_institutions
  `) as Array<{ id: string }>;

  if (options.pruneMissing) {
    const removableIds = existingRows
      .map((row) => row.id)
      .filter((institutionId) => !nextInstitutionIds.has(institutionId));

    for (const institutionId of removableIds) {
      const dependentRows = (await sql`
        SELECT
          (
            SELECT COUNT(*)::INT
            FROM maturity_courses
            WHERE institution_structure_id = ${institutionId}
          ) AS "courseCount",
          (
            SELECT COUNT(*)::INT
            FROM maturity_user_institution_roles
            WHERE institution_id = ${institutionId}
          ) AS "membershipCount"
      `) as Array<{ courseCount: number; membershipCount: number }>;

      const dependency = dependentRows[0] ?? { courseCount: 0, membershipCount: 0 };

      if (dependency.courseCount > 0 || dependency.membershipCount > 0) {
        throw new Error('No puedes eliminar una estructura que ya tiene cursos o usuarios vinculados.');
      }

      await sql`
        DELETE FROM maturity_institutions
        WHERE id = ${institutionId}
      `;
    }
  }

  for (const structure of normalizedStructures) {
    const timestamp = new Date().toISOString();
    // Check if an institution with this name already exists (different ID can cause name constraint violation)
    const existingByName = (await sql`
      SELECT id FROM maturity_institutions WHERE name = ${structure.institution} LIMIT 1
    `) as Array<{ id: string }>;
    const effectiveId = existingByName[0]?.id ?? structure.id;

    await sql`
      INSERT INTO maturity_institutions (
        id,
        name,
        allow_auto_provisioning,
        created_at,
        updated_at
      )
      VALUES (
        ${effectiveId},
        ${structure.institution},
        ${structure.allowAutoProvisioning},
        ${timestamp},
        ${timestamp}
      )
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        allow_auto_provisioning = EXCLUDED.allow_auto_provisioning,
        updated_at = EXCLUDED.updated_at
    `;

    await syncInstitutionCatalogValues('faculty', effectiveId, structure.faculties);
    await syncInstitutionCatalogValues('program', effectiveId, structure.programs);
    await syncInstitutionCatalogValues('academicPeriod', effectiveId, structure.academicPeriods);
    await syncInstitutionCatalogValues('courseType', effectiveId, structure.courseTypes);
    await syncInstitutionCatalogValues('guideline', effectiveId, structure.pedagogicalGuidelines);
  }
}

async function ensureInstitutionDirectoryFromLegacySources() {
  const sql = getSql();
  const currentStructures = await readInstitutionStructuresRecord();
  const structureMap = new Map<string, InstitutionStructure>();

  for (const structure of currentStructures) {
    structureMap.set(structure.id, {
      ...structure,
      faculties: [...structure.faculties],
      programs: [...structure.programs],
      academicPeriods: [...structure.academicPeriods],
      courseTypes: [...structure.courseTypes],
      pedagogicalGuidelines: [...structure.pedagogicalGuidelines],
    });
  }

  const legacySettings = await readLegacyInstitutionSettings();
  for (const structure of legacySettings?.structures ?? []) {
    structureMap.set(structure.id, {
      ...structure,
      faculties: [...structure.faculties],
      programs: [...structure.programs],
      academicPeriods: [...structure.academicPeriods],
      courseTypes: [...structure.courseTypes],
      pedagogicalGuidelines: [...structure.pedagogicalGuidelines],
    });
  }

  const courseRows = (await sql`
    SELECT
      faculty,
      program,
      metadata
    FROM maturity_courses
  `) as Array<{
    faculty: string;
    program: string;
    metadata: JsonValue;
  }>;

  for (const row of courseRows) {
    const metadata = parseJson<Partial<CourseMetadata>>(row.metadata ?? {});
    const institutionName = metadata.institution?.trim() || legacySettings?.displayName || defaultInstitutionSettings.displayName;
    const structureId = buildInstitutionStructureId(institutionName);
    const current =
      structureMap.get(structureId) ??
      sanitizeInstitutionStructure({
        id: structureId,
        institution: institutionName,
        faculties: [],
        programs: [],
        academicPeriods: [],
        courseTypes: [],
        pedagogicalGuidelines:
          legacySettings?.structures.find((structure) => structure.id === structureId)?.pedagogicalGuidelines ??
          defaultInstitutionSettings.structures[0]?.pedagogicalGuidelines ??
          [],
        allowAutoProvisioning:
          legacySettings?.structures.find((structure) => structure.id === structureId)?.allowAutoProvisioning ?? false,
      });

    current.faculties = uniqueValues([...current.faculties, row.faculty]);
    current.programs = uniqueValues([...current.programs, row.program]);
    current.academicPeriods = uniqueValues([
      ...current.academicPeriods,
      metadata.academicPeriod?.trim() || '2026-1',
    ]);
    current.courseTypes = uniqueValues([
      ...current.courseTypes,
      metadata.courseType?.trim() || 'Curso',
    ]);
    structureMap.set(structureId, current);
  }

  const userRows = (await sql`
    SELECT institution, faculty, program
    FROM maturity_users
  `) as Array<{
    institution: string | null;
    faculty: string | null;
    program: string | null;
  }>;

  for (const row of userRows) {
    const institutionName = row.institution?.trim();

    if (!institutionName) {
      continue;
    }

    const structureId = buildInstitutionStructureId(institutionName);
    const current =
      structureMap.get(structureId) ??
      sanitizeInstitutionStructure({
        id: structureId,
        institution: institutionName,
        faculties: [],
        programs: [],
        academicPeriods: [],
        courseTypes: [],
        pedagogicalGuidelines:
          legacySettings?.structures.find((structure) => structure.id === structureId)?.pedagogicalGuidelines ??
          defaultInstitutionSettings.structures[0]?.pedagogicalGuidelines ??
          [],
        allowAutoProvisioning:
          legacySettings?.structures.find((structure) => structure.id === structureId)?.allowAutoProvisioning ?? false,
      });

    if (row.faculty?.trim()) {
      current.faculties = uniqueValues([...current.faculties, row.faculty]);
    }

    if (row.program?.trim()) {
      current.programs = uniqueValues([...current.programs, row.program]);
    }

    structureMap.set(structureId, current);
  }

  const structures = Array.from(structureMap.values());
  await syncInstitutionDirectoryRecords(
    structures.length > 0 ? structures : defaultInstitutionSettings.structures,
    { pruneMissing: false },
  );
}

function hasInstitutionCatalogValue(values: string[], target: string) {
  const normalizedTarget = target.trim().toLowerCase();

  if (!normalizedTarget) {
    return false;
  }

  return values.some((value) => value.trim().toLowerCase() === normalizedTarget);
}

async function resolveInstitutionReferenceContext(input: {
  institutionId?: string | null;
  institution: string;
  faculty?: string;
  program?: string;
  academicPeriod?: string;
  courseType?: string;
}, options?: {
  strict?: boolean;
}) {
  const strict = Boolean(options?.strict);
  const institutionName = input.institution.trim() || defaultInstitutionSettings.displayName;
  let structures = await readInstitutionStructuresRecord();
  let structure =
    structures.find((item) => item.id === input.institutionId) ??
    structures.find(
      (item) => item.institution.trim().toLowerCase() === institutionName.trim().toLowerCase(),
    ) ?? null;

  if (!structure) {
    if (strict) {
      throw new Error(
        `La institución "${institutionName}" no existe en Gobierno > Institución. Parametrízala antes de crear cursos.`,
      );
    }

    await syncInstitutionDirectoryRecords(
      [
        ...structures,
        sanitizeInstitutionStructure({
          id: buildInstitutionStructureId(institutionName),
          institution: institutionName,
          faculties: input.faculty?.trim() ? [input.faculty] : [],
          programs: input.program?.trim() ? [input.program] : [],
          academicPeriods: input.academicPeriod?.trim() ? [input.academicPeriod] : [],
          courseTypes: input.courseType?.trim() ? [input.courseType] : [],
          pedagogicalGuidelines:
            defaultInstitutionSettings.structures[0]?.pedagogicalGuidelines ?? [],
          allowAutoProvisioning: false,
        }),
      ],
      { pruneMissing: false },
    );
    structures = await readInstitutionStructuresRecord();
    structure =
      structures.find((item) => item.id === input.institutionId) ??
      structures.find(
        (item) => item.institution.trim().toLowerCase() === institutionName.trim().toLowerCase(),
      ) ?? null;
  }

  if (!structure) {
    throw new Error('No fue posible resolver la estructura institucional del contexto.');
  }

  if (strict && input.faculty?.trim() && !hasInstitutionCatalogValue(structure.faculties, input.faculty)) {
    throw new Error(
      `La facultad "${input.faculty.trim()}" no está parametrizada para ${structure.institution}.`,
    );
  }

  if (strict && input.program?.trim() && !hasInstitutionCatalogValue(structure.programs, input.program)) {
    throw new Error(
      `El programa "${input.program.trim()}" no está parametrizado para ${structure.institution}.`,
    );
  }

  if (
    strict &&
    input.academicPeriod?.trim() &&
    !hasInstitutionCatalogValue(structure.academicPeriods, input.academicPeriod)
  ) {
    throw new Error(
      `El periodo académico "${input.academicPeriod.trim()}" no está parametrizado para ${structure.institution}.`,
    );
  }

  if (strict && input.courseType?.trim() && !hasInstitutionCatalogValue(structure.courseTypes, input.courseType)) {
    throw new Error(
      `La tipología "${input.courseType.trim()}" no está parametrizada para ${structure.institution}.`,
    );
  }

  let changed = false;
  const nextStructure: InstitutionStructure = {
    ...structure,
    faculties: [...structure.faculties],
    programs: [...structure.programs],
    academicPeriods: [...structure.academicPeriods],
    courseTypes: [...structure.courseTypes],
    pedagogicalGuidelines: [...structure.pedagogicalGuidelines],
  };

  if (!strict && input.faculty?.trim() && !nextStructure.faculties.includes(input.faculty.trim())) {
    nextStructure.faculties = uniqueValues([...nextStructure.faculties, input.faculty]);
    changed = true;
  }

  if (!strict && input.program?.trim() && !nextStructure.programs.includes(input.program.trim())) {
    nextStructure.programs = uniqueValues([...nextStructure.programs, input.program]);
    changed = true;
  }

  if (
    !strict &&
    input.academicPeriod?.trim() &&
    !nextStructure.academicPeriods.includes(input.academicPeriod.trim())
  ) {
    nextStructure.academicPeriods = uniqueValues([...nextStructure.academicPeriods, input.academicPeriod]);
    changed = true;
  }

  if (!strict && input.courseType?.trim() && !nextStructure.courseTypes.includes(input.courseType.trim())) {
    nextStructure.courseTypes = uniqueValues([...nextStructure.courseTypes, input.courseType]);
    changed = true;
  }

  if (changed) {
    await syncInstitutionDirectoryRecords(
      structures.map((item) => (item.id === nextStructure.id ? nextStructure : item)),
      { pruneMissing: false },
    );
    structure = nextStructure;
  }

  const sql = getSql();
  const institutionRows = (await sql`
    SELECT id, name
    FROM maturity_institutions
    WHERE id = ${structure.id}
    LIMIT 1
  `) as Array<{ id: string; name: string }>;

  const facultyName = input.faculty?.trim() || structure.faculties[0] || '';
  const programName = input.program?.trim() || structure.programs[0] || '';
  const academicPeriodName = input.academicPeriod?.trim() || structure.academicPeriods[0] || '';
  const courseTypeName = input.courseType?.trim() || structure.courseTypes[0] || '';

  const facultyRows = facultyName
    ? ((await sql`
        SELECT id
        FROM maturity_institution_faculties
        WHERE institution_id = ${structure.id}
          AND name = ${facultyName}
        LIMIT 1
      `) as Array<{ id: string }>)
    : [];
  const programRows = programName
    ? ((await sql`
        SELECT id
        FROM maturity_institution_programs
        WHERE institution_id = ${structure.id}
          AND name = ${programName}
        LIMIT 1
      `) as Array<{ id: string }>)
    : [];
  const academicPeriodRows = academicPeriodName
    ? ((await sql`
        SELECT id
        FROM maturity_institution_academic_periods
        WHERE institution_id = ${structure.id}
          AND name = ${academicPeriodName}
        LIMIT 1
      `) as Array<{ id: string }>)
    : [];
  const courseTypeRows = courseTypeName
    ? ((await sql`
        SELECT id
        FROM maturity_institution_course_types
        WHERE institution_id = ${structure.id}
          AND name = ${courseTypeName}
        LIMIT 1
      `) as Array<{ id: string }>)
    : [];

  return {
    institutionId: institutionRows[0]?.id ?? structure.id,
    institutionName: (institutionRows[0]?.name ?? structure.institution).trim(),
    facultyId: facultyRows[0]?.id ?? null,
    facultyName: (facultyName || '').trim(),
    programId: programRows[0]?.id ?? null,
    programName: (programName || '').trim(),
    academicPeriodId: academicPeriodRows[0]?.id ?? null,
    academicPeriodName: (academicPeriodName || '').trim(),
    courseTypeId: courseTypeRows[0]?.id ?? null,
    courseTypeName: (courseTypeName || '').trim(),
  };
}

async function backfillCourseInstitutionRelations() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      title,
      institution_structure_id AS "institutionStructureId",
      faculty,
      program,
      metadata
    FROM maturity_courses
  `) as Array<{
    id: string;
    title: string;
    institutionStructureId: string | null;
    faculty: string;
    program: string;
    metadata: JsonValue;
  }>;

  for (const row of rows) {
    const metadata = parseJson<Partial<CourseMetadata>>(row.metadata ?? {});
    const context = await resolveInstitutionReferenceContext({
      institutionId: row.institutionStructureId,
      institution: metadata.institution || defaultInstitutionSettings.displayName,
      faculty: row.faculty,
      program: row.program,
      academicPeriod: metadata.academicPeriod || '2026-1',
      courseType: metadata.courseType || 'Curso',
    });

    const nextMetadata = {
      ...metadata,
      institution: context.institutionName,
      academicPeriod: context.academicPeriodName,
      courseType: context.courseTypeName,
      route: buildCourseRoute({
        institution: context.institutionName,
        faculty: context.facultyName || row.faculty,
        program: context.programName || row.program,
        academicPeriod: context.academicPeriodName,
        courseType: context.courseTypeName,
        title: row.title,
      }),
    };

    await sql`
      UPDATE maturity_courses
      SET
        institution_structure_id = ${context.institutionId},
        faculty_id = ${context.facultyId},
        program_id = ${context.programId},
        academic_period_id = ${context.academicPeriodId},
        course_type_id = ${context.courseTypeId},
        faculty = ${context.facultyName || row.faculty},
        program = ${context.programName || row.program},
        metadata = ${JSON.stringify(nextMetadata)}::jsonb
      WHERE id = ${row.id}
    `;
  }
}

async function rebuildUserInstitutionMemberships() {
  const sql = getSql();
  const users = (await sql`
    SELECT
      id,
      role,
      secondary_roles AS "secondaryRoles",
      institution_id AS "institutionId",
      institution,
      faculty,
      program,
      institution_membership_ids AS "institutionMembershipIds",
      scope
    FROM maturity_users
  `) as Array<{
    id: string;
    role: Role;
    secondaryRoles: JsonValue;
    institutionId: string | null;
    institution: string | null;
    faculty: string | null;
    program: string | null;
    institutionMembershipIds: JsonValue | null;
    scope: string | null;
  }>;

  for (const user of users) {
    try {
      const secondaryRoles = parseJson<Role[]>(user.secondaryRoles ?? []);
      const primaryContext = await resolveInstitutionReferenceContext({
        institutionId: user.institutionId,
        institution: user.institution?.trim() || defaultInstitutionSettings.displayName,
        faculty: user.faculty?.trim() || '',
        program: user.program?.trim() || '',
      });
      const requestedInstitutionIds = normalizeInstitutionMembershipIds(
        parseJson<string[]>(user.institutionMembershipIds ?? []),
        primaryContext.institutionId,
      );
      const contexts = await Promise.all(
        requestedInstitutionIds.map(async (institutionId, index) => {
          if (institutionId === primaryContext.institutionId) {
            return {
              ...primaryContext,
              isPrimaryInstitution: true,
            };
          }

          const context = await resolveInstitutionReferenceContext(
            {
              institutionId,
              institution:
                (
                  await readInstitutionStructuresRecord()
                ).find((item) => item.id === institutionId)?.institution ?? defaultInstitutionSettings.displayName,
              faculty: '',
              program: '',
            },
            { strict: true },
          );

          return {
            ...context,
            isPrimaryInstitution: index === 0,
          };
        }),
      );

      const memberships = contexts.flatMap((context) => [
        {
          id: buildScopedEntityId('mbr', `${user.id}:${context.institutionId}`, user.role),
          role: user.role,
          primary: context.institutionId === primaryContext.institutionId,
          institutionId: context.institutionId,
          facultyId: context.institutionId === primaryContext.institutionId ? context.facultyId : null,
          programId: context.institutionId === primaryContext.institutionId ? context.programId : null,
        },
        ...secondaryRoles
          .filter((role) => role && role !== user.role)
          .map((role) => ({
            id: buildScopedEntityId('mbr', `${user.id}:${context.institutionId}`, role),
            role,
            primary: false,
            institutionId: context.institutionId,
            facultyId: context.institutionId === primaryContext.institutionId ? context.facultyId : null,
            programId: context.institutionId === primaryContext.institutionId ? context.programId : null,
          })),
      ]);

      await sql`
        DELETE FROM maturity_user_institution_roles
        WHERE user_id = ${user.id}
      `;

      for (const membership of memberships) {
        await sql`
          INSERT INTO maturity_user_institution_roles (
            id,
            user_id,
            institution_id,
            faculty_id,
            program_id,
            role,
            scope,
            is_primary,
            created_at,
            updated_at
          )
          VALUES (
            ${membership.id},
            ${user.id},
            ${membership.institutionId},
            ${membership.facultyId},
            ${membership.programId},
            ${membership.role},
            ${user.scope?.trim() || null},
            ${membership.primary},
            ${new Date().toISOString()},
            ${new Date().toISOString()}
          )
        `;
      }

      await sql`
        UPDATE maturity_users
        SET
          institution_id = ${primaryContext.institutionId},
          faculty_id = ${primaryContext.facultyId},
          program_id = ${primaryContext.programId},
          institution = ${primaryContext.institutionName},
          faculty = ${primaryContext.facultyName || null},
          program = ${primaryContext.programName || null},
          institution_membership_ids = ${JSON.stringify(
            normalizeInstitutionMembershipIds(
              parseJson<string[]>(user.institutionMembershipIds ?? []),
              primaryContext.institutionId,
            ),
          )}::jsonb
        WHERE id = ${user.id}
      `;
    } catch {
      // Skip users whose institution context cannot be resolved — prevents crashing initialization
    }
  }
}

async function cleanupOrphanOperationalRows() {
  const sql = getSql();

  await sql`
    DELETE FROM maturity_tasks
    WHERE course_slug NOT IN (SELECT slug FROM maturity_courses)
  `;

  await sql`
    DELETE FROM maturity_alerts
    WHERE course_slug NOT IN (SELECT slug FROM maturity_courses)
  `;

  await sql`
    DELETE FROM maturity_library_resources
    WHERE course_slug NOT IN (SELECT slug FROM maturity_courses)
  `;

  await sql`
    DELETE FROM maturity_course_products
    WHERE course_slug NOT IN (SELECT slug FROM maturity_courses)
  `;

  await sql`
    DELETE FROM maturity_sessions
    WHERE user_id NOT IN (SELECT id FROM maturity_users)
  `;
}

async function backfillCourseProductsTable() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      slug,
      products
    FROM maturity_courses
  `) as Array<{
    slug: string;
    products: JsonValue;
  }>;

  for (const row of rows) {
    const products = parseJson<Course['products']>(row.products ?? []);

    for (const product of products) {
      await sql`
        INSERT INTO maturity_course_products (
          id,
          course_slug,
          title,
          stage,
          format,
          owner,
          status,
          summary,
          body,
          tags,
          version,
          section,
          phase_plan,
          writing_data,
          created_at,
          updated_at
        )
        VALUES (
          ${product.id},
          ${row.slug},
          ${product.title},
          ${product.stage},
          ${product.format},
          ${product.owner},
          ${product.status},
          ${product.summary},
          ${product.body},
          ${JSON.stringify(product.tags ?? [])}::jsonb,
          ${product.version},
          ${product.section ?? null},
          ${JSON.stringify(normalizeProductPhasePlan(product.phasePlan))}::jsonb,
          ${JSON.stringify(normalizeProductWritingData(product.writingData))}::jsonb,
          ${product.updatedAt},
          ${product.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE
        SET
          course_slug = EXCLUDED.course_slug,
          title = EXCLUDED.title,
          stage = EXCLUDED.stage,
          format = EXCLUDED.format,
          owner = EXCLUDED.owner,
          status = EXCLUDED.status,
          summary = EXCLUDED.summary,
          body = EXCLUDED.body,
          tags = EXCLUDED.tags,
          version = EXCLUDED.version,
          section = EXCLUDED.section,
          phase_plan = EXCLUDED.phase_plan,
          writing_data = EXCLUDED.writing_data,
          updated_at = EXCLUDED.updated_at
      `;
    }
  }
}

async function syncCourseProductsJsonSnapshot(courseSlug: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      title,
      stage,
      format,
      owner,
      status,
      summary,
      body,
      tags,
      version,
      section,
      phase_plan AS "phasePlan",
      writing_data AS "writingData",
      updated_at AS "updatedAt"
    FROM maturity_course_products
    WHERE course_slug = ${courseSlug}
    ORDER BY updated_at DESC, title ASC
  `) as CourseProductRow[];

  await sql`
    UPDATE maturity_courses
    SET products = ${JSON.stringify(rows.map(serializeCourseProductRow))}::jsonb
    WHERE slug = ${courseSlug}
  `;
}

async function backfillArchitectureProductTextFields() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      course_slug AS "courseSlug",
      stage,
      summary,
      body
    FROM maturity_course_products
    WHERE stage = 'arquitectura'
  `) as Array<{
    id: string;
    courseSlug: string;
    stage: CourseProductStage;
    summary: string;
    body: string;
  }>;

  const affectedCourseSlugs = new Set<string>();

  for (const row of rows) {
    const normalizedText = normalizeCourseProductTextFields(row.stage, row.summary, row.body);

    if (normalizedText.summary === row.summary && normalizedText.body === row.body) {
      continue;
    }

    await sql`
      UPDATE maturity_course_products
      SET
        summary = ${normalizedText.summary},
        body = ${normalizedText.body},
        updated_at = COALESCE(updated_at, ${getTodayLabel()})
      WHERE id = ${row.id}
    `;

    affectedCourseSlugs.add(row.courseSlug);
  }

  for (const courseSlug of affectedCourseSlugs) {
    await syncCourseProductsJsonSnapshot(courseSlug);
  }
}

async function syncCourseProductsTable(course: Course) {
  const sql = getSql();
  const nextIds = course.products.map((product) => product.id);

  if (nextIds.length > 0) {
    await sql`
      DELETE FROM maturity_course_products
      WHERE course_slug = ${course.slug}
        AND id NOT IN (${nextIds})
    `;
  } else {
    await sql`
      DELETE FROM maturity_course_products
      WHERE course_slug = ${course.slug}
    `;
  }

  for (const product of course.products) {
    await sql`
      INSERT INTO maturity_course_products (
        id,
        course_slug,
        title,
        stage,
        format,
        owner,
        status,
        summary,
        body,
        tags,
        version,
        section,
        phase_plan,
        writing_data,
        created_at,
        updated_at
      )
      VALUES (
        ${product.id},
        ${course.slug},
        ${product.title},
        ${product.stage},
        ${product.format},
        ${product.owner},
        ${product.status},
        ${product.summary},
        ${product.body},
        ${JSON.stringify(product.tags ?? [])}::jsonb,
        ${product.version},
        ${product.section ?? null},
        ${JSON.stringify(normalizeProductPhasePlan(product.phasePlan))}::jsonb,
        ${JSON.stringify(normalizeProductWritingData(product.writingData))}::jsonb,
        ${product.updatedAt},
        ${product.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE
      SET
        course_slug = EXCLUDED.course_slug,
        title = EXCLUDED.title,
        stage = EXCLUDED.stage,
        format = EXCLUDED.format,
        owner = EXCLUDED.owner,
        status = EXCLUDED.status,
        summary = EXCLUDED.summary,
        body = EXCLUDED.body,
        tags = EXCLUDED.tags,
        version = EXCLUDED.version,
        section = EXCLUDED.section,
        phase_plan = EXCLUDED.phase_plan,
        writing_data = EXCLUDED.writing_data,
        updated_at = EXCLUDED.updated_at
    `;
  }
}

async function readCourseProductsByCourseSlugs(courseSlugs: string[]) {
  if (courseSlugs.length === 0) {
    return new Map<string, Course['products']>();
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      course_slug AS "courseSlug",
      title,
      stage,
      format,
      owner,
      status,
      summary,
      body,
      tags,
      version,
      section,
      phase_plan AS "phasePlan",
      writing_data AS "writingData",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM maturity_course_products
    WHERE course_slug IN (${courseSlugs})
    ORDER BY updated_at DESC, title ASC
  `) as CourseProductRow[];

  const map = new Map<string, Course['products']>();

  for (const row of rows) {
    const nextProducts = map.get(row.courseSlug) ?? [];
    nextProducts.push(serializeCourseProductRow(row));
    map.set(row.courseSlug, nextProducts);
  }

  return map;
}

async function ensureSchema() {
  const sql = getSql();
  const CURRENT_SCHEMA_VERSION = 18; // Current version of schema initialization

  try {
    // 1. Minimum check: ensure metadata table exists
    await sql`
      CREATE TABLE IF NOT EXISTS maturity_system_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    // 2. Check if we can skip everything
    const versionRow = (await sql`
      SELECT value FROM maturity_system_metadata WHERE key = 'schema_version' LIMIT 1
    `) as Array<{ value: string }>;

    const currentVersion = versionRow[0]?.value ? parseInt(versionRow[0].value, 10) : 0;
    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
      return;
    }

    // 3. Perform original initialization sequence (only once per schema change)
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
        institution_structure_id TEXT,
        faculty_id TEXT,
        program_id TEXT,
        academic_period_id TEXT,
        course_type_id TEXT,
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
        audit_log JSONB NOT NULL DEFAULT '[]'::jsonb,
        stage_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
        products JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `;

    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS institution_structure_id TEXT`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS faculty_id TEXT`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS program_id TEXT`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS academic_period_id TEXT`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS course_type_id TEXT`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS audit_log JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS stage_notes JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE maturity_courses ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '[]'::jsonb`;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        course_slug TEXT NOT NULL,
        product_id TEXT,
        product_title TEXT,
        role TEXT NOT NULL,
        stage_id TEXT NOT NULL,
        due_date TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL
      )
    `;

    await sql`
      ALTER TABLE maturity_tasks
      ADD COLUMN IF NOT EXISTS product_id TEXT
    `;

    await sql`
      ALTER TABLE maturity_tasks
      ADD COLUMN IF NOT EXISTS product_title TEXT
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
        secondary_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'Pendiente',
        headline TEXT,
        phone TEXT,
        location TEXT,
        bio TEXT,
        institution_id TEXT,
        institution TEXT,
        faculty_id TEXT,
        faculty TEXT,
        program_id TEXT,
        program TEXT,
        institution_membership_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        scope TEXT,
        status_reason TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        last_access_at TEXT
      )
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS secondary_roles JSONB NOT NULL DEFAULT '[]'::jsonb
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pendiente'
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS headline TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS phone TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS location TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS bio TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS institution_id TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS institution TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS faculty_id TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS faculty TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS program_id TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS program TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS institution_membership_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS scope TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS status_reason TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS created_by TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS updated_at TEXT
    `;

    await sql`
      ALTER TABLE maturity_users
      ADD COLUMN IF NOT EXISTS last_access_at TEXT
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

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_institutions (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        allow_auto_provisioning BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_institution_faculties (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (institution_id, name)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_institution_programs (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (institution_id, name)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_institution_academic_periods (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (institution_id, name)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_institution_course_types (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (institution_id, name)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_institution_guidelines (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL,
        guideline TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (institution_id, guideline)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_user_institution_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        institution_id TEXT NOT NULL,
        faculty_id TEXT,
        program_id TEXT,
        role TEXT NOT NULL,
        scope TEXT,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maturity_course_products (
        id TEXT PRIMARY KEY,
        course_slug TEXT NOT NULL,
        title TEXT NOT NULL,
        stage TEXT NOT NULL,
        format TEXT NOT NULL,
        owner TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        version TEXT NOT NULL DEFAULT '1.0',
        section TEXT,
        phase_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
        writing_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

    await sql`
      ALTER TABLE maturity_course_products
      ADD COLUMN IF NOT EXISTS phase_plan JSONB NOT NULL DEFAULT '[]'::jsonb
    `;

    await sql`
      ALTER TABLE maturity_course_products
      ADD COLUMN IF NOT EXISTS writing_data JSONB NOT NULL DEFAULT '{}'::jsonb
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS maturity_course_products_course_idx
      ON maturity_course_products (course_slug, stage, updated_at DESC)
    `;

    for (const [position, role] of platformRoles.entries()) {
      await sql`
        INSERT INTO maturity_roles (role, position)
        VALUES (${role}, ${position})
        ON CONFLICT (role) DO UPDATE
        SET position = EXCLUDED.position
      `;
    }

    for (const stage of platformStages) {
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

    for (const profile of defaultRoleProfiles) {
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

    await ensureInstitutionDirectoryFromLegacySources();
    await backfillCourseInstitutionRelations();
    await backfillCourseProductsTable();
    await rebuildUserInstitutionMemberships();
    await cleanupOrphanOperationalRows();

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS maturity_user_primary_membership_idx
      ON maturity_user_institution_roles (user_id)
      WHERE is_primary = true
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_stages_owner_role_fk'
        ) THEN
          ALTER TABLE maturity_stages
          ADD CONSTRAINT maturity_stages_owner_role_fk
          FOREIGN KEY (owner) REFERENCES maturity_roles(role) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_course_products_course_fk'
        ) THEN
          ALTER TABLE maturity_course_products
          ADD CONSTRAINT maturity_course_products_course_fk
          FOREIGN KEY (course_slug) REFERENCES maturity_courses(slug) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_course_products_owner_fk'
        ) THEN
          ALTER TABLE maturity_course_products
          ADD CONSTRAINT maturity_course_products_owner_fk
          FOREIGN KEY (owner) REFERENCES maturity_roles(role) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_role_profiles_role_fk'
        ) THEN
          ALTER TABLE maturity_role_profiles
          ADD CONSTRAINT maturity_role_profiles_role_fk
          FOREIGN KEY (role) REFERENCES maturity_roles(role) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_courses_stage_fk'
        ) THEN
          ALTER TABLE maturity_courses
          ADD CONSTRAINT maturity_courses_stage_fk
          FOREIGN KEY (stage_id) REFERENCES maturity_stages(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_courses_institution_fk'
        ) THEN
          ALTER TABLE maturity_courses
          ADD CONSTRAINT maturity_courses_institution_fk
          FOREIGN KEY (institution_structure_id) REFERENCES maturity_institutions(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_courses_faculty_fk'
        ) THEN
          ALTER TABLE maturity_courses
          ADD CONSTRAINT maturity_courses_faculty_fk
          FOREIGN KEY (faculty_id) REFERENCES maturity_institution_faculties(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_courses_program_fk'
        ) THEN
          ALTER TABLE maturity_courses
          ADD CONSTRAINT maturity_courses_program_fk
          FOREIGN KEY (program_id) REFERENCES maturity_institution_programs(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_courses_academic_period_fk'
        ) THEN
          ALTER TABLE maturity_courses
          ADD CONSTRAINT maturity_courses_academic_period_fk
          FOREIGN KEY (academic_period_id) REFERENCES maturity_institution_academic_periods(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_courses_course_type_fk'
        ) THEN
          ALTER TABLE maturity_courses
          ADD CONSTRAINT maturity_courses_course_type_fk
          FOREIGN KEY (course_type_id) REFERENCES maturity_institution_course_types(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_tasks_course_fk'
        ) THEN
          ALTER TABLE maturity_tasks
          ADD CONSTRAINT maturity_tasks_course_fk
          FOREIGN KEY (course_slug) REFERENCES maturity_courses(slug) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_tasks_role_fk'
        ) THEN
          ALTER TABLE maturity_tasks
          ADD CONSTRAINT maturity_tasks_role_fk
          FOREIGN KEY (role) REFERENCES maturity_roles(role) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_tasks_stage_fk'
        ) THEN
          ALTER TABLE maturity_tasks
          ADD CONSTRAINT maturity_tasks_stage_fk
          FOREIGN KEY (stage_id) REFERENCES maturity_stages(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_tasks_product_fk'
        ) THEN
          ALTER TABLE maturity_tasks
          ADD CONSTRAINT maturity_tasks_product_fk
          FOREIGN KEY (product_id) REFERENCES maturity_course_products(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_alerts_course_fk'
        ) THEN
          ALTER TABLE maturity_alerts
          ADD CONSTRAINT maturity_alerts_course_fk
          FOREIGN KEY (course_slug) REFERENCES maturity_courses(slug) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_alerts_owner_fk'
        ) THEN
          ALTER TABLE maturity_alerts
          ADD CONSTRAINT maturity_alerts_owner_fk
          FOREIGN KEY (owner) REFERENCES maturity_roles(role) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_resources_course_fk'
        ) THEN
          ALTER TABLE maturity_library_resources
          ADD CONSTRAINT maturity_resources_course_fk
          FOREIGN KEY (course_slug) REFERENCES maturity_courses(slug) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_users_role_fk'
        ) THEN
          ALTER TABLE maturity_users
          ADD CONSTRAINT maturity_users_role_fk
          FOREIGN KEY (role) REFERENCES maturity_roles(role) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_users_institution_fk'
        ) THEN
          ALTER TABLE maturity_users
          ADD CONSTRAINT maturity_users_institution_fk
          FOREIGN KEY (institution_id) REFERENCES maturity_institutions(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_users_faculty_fk'
        ) THEN
          ALTER TABLE maturity_users
          ADD CONSTRAINT maturity_users_faculty_fk
          FOREIGN KEY (faculty_id) REFERENCES maturity_institution_faculties(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_users_program_fk'
        ) THEN
          ALTER TABLE maturity_users
          ADD CONSTRAINT maturity_users_program_fk
          FOREIGN KEY (program_id) REFERENCES maturity_institution_programs(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_sessions_user_fk'
        ) THEN
          ALTER TABLE maturity_sessions
          ADD CONSTRAINT maturity_sessions_user_fk
          FOREIGN KEY (user_id) REFERENCES maturity_users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_faculties_institution_fk'
        ) THEN
          ALTER TABLE maturity_institution_faculties
          ADD CONSTRAINT maturity_faculties_institution_fk
          FOREIGN KEY (institution_id) REFERENCES maturity_institutions(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_programs_institution_fk'
        ) THEN
          ALTER TABLE maturity_institution_programs
          ADD CONSTRAINT maturity_programs_institution_fk
          FOREIGN KEY (institution_id) REFERENCES maturity_institutions(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_periods_institution_fk'
        ) THEN
          ALTER TABLE maturity_institution_academic_periods
          ADD CONSTRAINT maturity_periods_institution_fk
          FOREIGN KEY (institution_id) REFERENCES maturity_institutions(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_course_types_institution_fk'
        ) THEN
          ALTER TABLE maturity_institution_course_types
          ADD CONSTRAINT maturity_course_types_institution_fk
          FOREIGN KEY (institution_id) REFERENCES maturity_institutions(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_guidelines_institution_fk'
        ) THEN
          ALTER TABLE maturity_institution_guidelines
          ADD CONSTRAINT maturity_guidelines_institution_fk
          FOREIGN KEY (institution_id) REFERENCES maturity_institutions(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_user_memberships_user_fk'
        ) THEN
          ALTER TABLE maturity_user_institution_roles
          ADD CONSTRAINT maturity_user_memberships_user_fk
          FOREIGN KEY (user_id) REFERENCES maturity_users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_user_memberships_institution_fk'
        ) THEN
          ALTER TABLE maturity_user_institution_roles
          ADD CONSTRAINT maturity_user_memberships_institution_fk
          FOREIGN KEY (institution_id) REFERENCES maturity_institutions(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_user_memberships_faculty_fk'
        ) THEN
          ALTER TABLE maturity_user_institution_roles
          ADD CONSTRAINT maturity_user_memberships_faculty_fk
          FOREIGN KEY (faculty_id) REFERENCES maturity_institution_faculties(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_user_memberships_program_fk'
        ) THEN
          ALTER TABLE maturity_user_institution_roles
          ADD CONSTRAINT maturity_user_memberships_program_fk
          FOREIGN KEY (program_id) REFERENCES maturity_institution_programs(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maturity_user_memberships_role_fk'
        ) THEN
          ALTER TABLE maturity_user_institution_roles
          ADD CONSTRAINT maturity_user_memberships_role_fk
          FOREIGN KEY (role) REFERENCES maturity_roles(role) ON DELETE RESTRICT;
        END IF;
      END $$;
    `;

    // Migration 11: Unify course status labels
    if (currentVersion < 11) {
      await sql`UPDATE maturity_courses SET status = 'En curso' WHERE status = 'En ritmo'`;
      await sql`UPDATE maturity_courses SET status = 'En QA' WHERE status = 'En revisión'`;
      await sql`UPDATE maturity_courses SET status = 'En riesgo' WHERE status = 'Riesgo'`;
      await sql`UPDATE maturity_courses SET status = 'Entregado' WHERE status = 'Listo'`;
    }

    // Migration 13: Link tasks to course products
    if (currentVersion < 13) {
      await sql`
        UPDATE maturity_tasks task
        SET product_title = product.title
        FROM maturity_course_products product
        WHERE task.product_id = product.id
      `;
    }

    // Migration 14: Add per-phase planning to course products
    if (currentVersion < 14) {
      await sql`
        UPDATE maturity_course_products
        SET phase_plan = '[]'::jsonb
        WHERE phase_plan IS NULL
      `;
    }

    // Migration 15: Persist multi-institution affiliations as source of truth
    if (currentVersion < 15) {
      await sql`
        UPDATE maturity_users
        SET institution_membership_ids =
          CASE
            WHEN institution_id IS NOT NULL AND institution_id <> ''
              THEN jsonb_build_array(institution_id)
            ELSE '[]'::jsonb
          END
        WHERE institution_membership_ids IS NULL
           OR institution_membership_ids = '[]'::jsonb
      `;

      await rebuildUserInstitutionMemberships();
    }

    // Migration 16: Persist product writing workspace state
    if (currentVersion < 16) {
      await sql`
        UPDATE maturity_course_products
        SET writing_data = '{}'::jsonb
        WHERE writing_data IS NULL
      `;
    }

    // Migration 17: Split architecture products into description and instructions
    if (currentVersion < 17) {
      await backfillArchitectureProductTextFields();
    }

    // Migration 18: Ensure architecture products always carry explicit instructions
    if (currentVersion < 18) {
      await backfillArchitectureProductTextFields();
    }

    // 4. Update the stored version to avoid running this again
    await sql`
      INSERT INTO maturity_system_metadata (key, value)
      VALUES ('schema_version', ${CURRENT_SCHEMA_VERSION.toString()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  } catch (err) {
    throw err;
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
    await sql`
      UPDATE maturity_users
      SET
        status = COALESCE(status, ${'Activo'}),
        headline = COALESCE(headline, ${'Gobierno funcional y técnico de la plataforma'}),
        institution = COALESCE(institution, ${'Maturity University'}),
        faculty = COALESCE(faculty, ${'Gobierno del sistema'}),
        program = COALESCE(program, ${'Operación central'}),
        scope = COALESCE(scope, ${'Global'}),
        updated_at = ${new Date().toISOString()}
      WHERE id = ${existingRows[0].id}
    `;
    await rebuildUserInstitutionMemberships();
    return;
  }

  const passwordHash = await createPasswordHash(password);

  const createdAt = new Date().toISOString();

  await sql`
    INSERT INTO maturity_users (
      id,
      name,
      email,
      role,
      password_hash,
      secondary_roles,
      status,
      headline,
      phone,
      location,
      bio,
      institution,
      faculty,
      program,
      scope,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${name},
      ${normalizedEmail},
      ${'Administrador'},
      ${passwordHash},
      ${JSON.stringify([])}::jsonb,
      ${'Activo'},
      ${'Gobierno funcional y técnico de la plataforma'},
      ${null},
      ${'Bogotá, Colombia'},
      ${'Administra la configuración central, accesos e integraciones de la operación.'},
      ${'Maturity University'},
      ${'Gobierno del sistema'},
      ${'Operación central'},
      ${'Global'},
      ${'system'},
      ${createdAt},
      ${createdAt}
    )
  `;

  await rebuildUserInstitutionMemberships();
}

function serializeCourseProductRow(row: CourseProductRow): CourseProduct {
  const normalizedText = normalizeCourseProductTextFields(row.stage, row.summary, row.body);

  return {
    id: row.id,
    title: row.title,
    stage: row.stage,
    format: row.format,
    owner: row.owner,
    status: row.status,
    summary: normalizedText.summary,
    body: normalizedText.body,
    tags: parseJson<CourseProduct['tags']>(row.tags ?? []),
    version: row.version,
    section: row.section ?? undefined,
    phasePlan: normalizeProductPhasePlan(parseJson<ProductPhasePlan[]>(row.phasePlan ?? [])),
    writingData: normalizeProductWritingData(parseJson<ProductWritingData>(row.writingData ?? {})),
    updatedAt: row.updatedAt,
  };
}

function serializeCourseRow(row: CourseRow, productsOverride?: Course['products']): Course {
  return normalizeCourse({
    ...row,
    institutionStructureId: row.institutionStructureId ?? undefined,
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
    stageNotes: parseJson<Course['stageNotes']>(row.stageNotes),
    products: productsOverride ?? parseJson<Course['products']>(row.products),
  });
}

async function prepareCourseForPersistence(course: Course) {
  const context = await resolveInstitutionReferenceContext({
    institutionId: course.institutionStructureId,
    institution: course.metadata.institution || defaultInstitutionSettings.displayName,
    faculty: course.faculty,
    program: course.program,
    academicPeriod: course.metadata.academicPeriod || '',
    courseType: course.metadata.courseType || '',
  }, {
    strict: false,
  });

  const nextCourse = normalizeCourse({
    ...course,
    institutionStructureId: context.institutionId,
    faculty: context.facultyName || course.faculty,
    program: context.programName || course.program,
    metadata: {
      ...course.metadata,
      institution: context.institutionName,
      academicPeriod: context.academicPeriodName,
      courseType: context.courseTypeName,
      route: buildCourseRoute({
        institution: context.institutionName,
        faculty: context.facultyName || course.faculty,
        program: context.programName || course.program,
        academicPeriod: context.academicPeriodName,
        courseType: context.courseTypeName,
        title: course.title,
      }),
    },
  });

  return {
    course: nextCourse,
    context,
  };
}

async function persistCourse(course: Course) {
  const sql = getSql();
  const prepared = await prepareCourseForPersistence(course);
  const nextCourse = prepared.course;
  const context = prepared.context;

  await sql`
    INSERT INTO maturity_courses (
      id,
      slug,
      title,
      code,
      institution_structure_id,
      faculty_id,
      program_id,
      academic_period_id,
      course_type_id,
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
      audit_log,
      stage_notes,
      products
    )
    VALUES (
      ${nextCourse.id},
      ${nextCourse.slug},
      ${nextCourse.title},
      ${nextCourse.code},
      ${context.institutionId},
      ${context.facultyId},
      ${context.programId},
      ${context.academicPeriodId},
      ${context.courseTypeId},
      ${nextCourse.faculty},
      ${nextCourse.program},
      ${nextCourse.modality},
      ${nextCourse.credits},
      ${nextCourse.stageId},
      ${nextCourse.status},
      ${nextCourse.progress},
      ${nextCourse.summary},
      ${nextCourse.nextMilestone},
      ${nextCourse.updatedAt},
      ${JSON.stringify(nextCourse.pulse)}::jsonb,
      ${JSON.stringify(nextCourse.team)}::jsonb,
      ${JSON.stringify(nextCourse.deliverables)}::jsonb,
      ${JSON.stringify(nextCourse.modules)}::jsonb,
      ${JSON.stringify(nextCourse.observations)}::jsonb,
      ${JSON.stringify(nextCourse.schedule)}::jsonb,
      ${JSON.stringify(nextCourse.stageChecklist)}::jsonb,
      ${JSON.stringify(nextCourse.assistants)}::jsonb,
      ${JSON.stringify(nextCourse.metadata)}::jsonb,
      ${JSON.stringify(nextCourse.auditLog)}::jsonb,
      ${JSON.stringify(nextCourse.stageNotes)}::jsonb,
      ${JSON.stringify(nextCourse.products)}::jsonb
    )
    ON CONFLICT (id) DO UPDATE
    SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      code = EXCLUDED.code,
      institution_structure_id = EXCLUDED.institution_structure_id,
      faculty_id = EXCLUDED.faculty_id,
      program_id = EXCLUDED.program_id,
      academic_period_id = EXCLUDED.academic_period_id,
      course_type_id = EXCLUDED.course_type_id,
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
      audit_log = EXCLUDED.audit_log,
      stage_notes = EXCLUDED.stage_notes,
      products = EXCLUDED.products
  `;

  await syncCourseProductsTable(nextCourse);

  return nextCourse;
}

async function persistTask(task: Task) {
  const sql = getSql();
  await sql`
    INSERT INTO maturity_tasks (
      id,
      title,
      course_slug,
      product_id,
      product_title,
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
      ${task.productId ?? null},
      ${task.productTitle ?? null},
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
      product_id = EXCLUDED.product_id,
      product_title = EXCLUDED.product_title,
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
      institution_structure_id AS "institutionStructureId",
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
      audit_log AS "auditLog",
      stage_notes AS "stageNotes",
      products
    FROM maturity_courses
    WHERE slug = ${slug}
    LIMIT 1
  `) as CourseRow[];

  if (!rows[0]) {
    return null;
  }

  const productsByCourseSlug = await readCourseProductsByCourseSlugs([slug]);
  return serializeCourseRow(rows[0], productsByCourseSlug.get(slug));
}

function mergeCourseMetadata(
  course: Course & {
    institution?: string;
    academicPeriod?: string;
    courseType?: string;
  },
  metadata: Partial<CourseMetadataMutationInput>,
): Course['metadata'] {
  return {
    ...buildDefaultCourseMetadata(course),
    ...course.metadata,
    ...metadata,
    route: buildCourseRoute(course),
  };
}

function mergeCourseStageNote(
  course: Course,
  key: CourseStageNoteKey,
  input: Partial<CourseStageNoteMutationInput>,
): Course['stageNotes'][CourseStageNoteKey] {
  const base = buildDefaultCourseStageNotes(course)[key];
  const current = course.stageNotes[key];

  return {
    ...base,
    ...current,
    ...input,
    owner: stageNoteDefinitions[key].owner,
    heading: stageNoteDefinitions[key].heading,
    updatedAt: getTodayLabel(),
  };
}

function findTeamMember(course: Course, memberId: string) {
  return course.team.find((member) => member.id === memberId) ?? null;
}

function findLearningModule(course: Course, moduleId: string) {
  return course.modules.find((module) => module.id === moduleId) ?? null;
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
  const sql = getSql();

  // Check if already seeded to avoid redundant checks
  const seededRow = (await sql`
    SELECT value FROM maturity_system_metadata WHERE key = 'system_seeded' LIMIT 1
  `) as Array<{ value: string }>;

  if (seededRow[0]?.value === 'true') {
    return { seeded: true, courses: -1 };
  }

  await ensureAdminUserSeed();

  const countRows = (await sql`
    SELECT COUNT(*)::INT AS count
    FROM maturity_courses
  `) as Array<{ count: number }>;

  await sql`
    INSERT INTO maturity_system_metadata (key, value)
    VALUES ('system_seeded', 'true')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  return {
    seeded: false,
    courses: countRows[0]?.count ?? 0,
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
      institution_structure_id AS "institutionStructureId",
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
      audit_log AS "auditLog",
      stage_notes AS "stageNotes",
      products
    FROM maturity_courses
    ORDER BY title ASC
  `) as CourseRow[];

  const productsByCourseSlug = await readCourseProductsByCourseSlugs(rows.map((row) => row.slug));
  return rows.map((row) => serializeCourseRow(row, productsByCourseSlug.get(row.slug)));
}

async function readTasks() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      title,
      course_slug AS "courseSlug",
      product_id AS "productId",
      product_title AS "productTitle",
      role,
      stage_id AS "stageId",
      due_date AS "dueDate",
      priority,
      status,
      summary
    FROM maturity_tasks
    ORDER BY due_date ASC, title ASC
  `) as TaskRow[];

  return rows.map(serializeTaskRow);
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
  const rows = (await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.secondary_roles AS "secondaryRoles",
      u.status,
      u.headline,
      u.phone,
      u.location,
      u.bio,
      u.institution_id AS "institutionId",
      u.institution,
      u.faculty_id AS "facultyId",
      u.faculty,
      u.program_id AS "programId",
      u.program,
      u.scope,
      u.status_reason AS "statusReason",
      u.created_by AS "createdBy",
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt",
      u.last_access_at AS "lastAccessAt",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', membership.id,
              'institutionId', membership.institution_id,
              'institution', institution.name,
              'role', membership.role,
              'faculty', COALESCE(faculty.name, ''),
              'program', COALESCE(program.name, ''),
              'scope', COALESCE(membership.scope, ''),
              'primary', membership.is_primary
            )
            ORDER BY membership.is_primary DESC, membership.created_at ASC
          ),
          '[]'::jsonb
        )
        FROM maturity_user_institution_roles membership
        INNER JOIN maturity_institutions institution
          ON institution.id = membership.institution_id
        LEFT JOIN maturity_institution_faculties faculty
          ON faculty.id = membership.faculty_id
        LEFT JOIN maturity_institution_programs program
          ON program.id = membership.program_id
        WHERE membership.user_id = u.id
      ) AS memberships
    FROM maturity_users u
    ORDER BY u.role ASC, u.name ASC
  `) as PublicUserRow[];

  return rows.map(serializeUserRow);
}

export async function prepareDatabase() {
  await ensureInitialized();
  const sql = getSql();
  const countRows = (await sql`
    SELECT COUNT(*)::INT AS count
    FROM maturity_courses
  `) as Array<{ count: number }>;

  return {
    seeded: false,
    courses: countRows[0]?.count ?? 0,
  };
}

export async function getInstitutionSettingsRecord(
  overrides?: Partial<
    Pick<InstitutionSettings, 'displayName' | 'supportEmail' | 'defaultDomain' | 'defaultUserState'>
  >,
) {
  await ensureInitialized();
  return readInstitutionSettingsRecord(overrides);
}

export async function syncInstitutionSettingsRecord(settings: InstitutionSettings) {
  await ensureInitialized();
  await syncInstitutionDirectoryRecords(settings.structures, { pruneMissing: true });
  await backfillCourseInstitutionRelations();
  await rebuildUserInstitutionMemberships();
  return readInstitutionSettingsRecord({
    displayName: settings.displayName,
    supportEmail: settings.supportEmail,
    defaultDomain: settings.defaultDomain,
    defaultUserState: settings.defaultUserState,
  });
}

export async function loadAppData(): Promise<AppData> {
  await ensureInitialized();

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
    institution: defaultInstitutionSettings,
    branding: defaultBranding,
    experience: defaultExperienceSettings,
    workflow: defaultWorkflowSettings,
  };
}

export async function findCourseRecordBySlug(slug: string) {
  await ensureInitialized();
  return readCourseBySlug(slug);
}

export async function findAlertById(id: string) {
  await ensureInitialized();
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
  await ensureInitialized();

  const alert = makeAlertRecord(input);
  await persistAlert(alert);
  return alert;
}

export async function deleteAlertRecord(id: string) {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM maturity_alerts
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function findUserByEmail(email: string) {
  await ensureInitialized();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.secondary_roles AS "secondaryRoles",
      u.status,
      u.headline,
      u.phone,
      u.location,
      u.bio,
      u.institution_id AS "institutionId",
      u.institution,
      u.faculty_id AS "facultyId",
      u.faculty,
      u.program_id AS "programId",
      u.program,
      u.scope,
      u.status_reason AS "statusReason",
      u.created_by AS "createdBy",
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt",
      u.last_access_at AS "lastAccessAt",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', membership.id,
              'institutionId', membership.institution_id,
              'institution', institution.name,
              'role', membership.role,
              'faculty', COALESCE(faculty.name, ''),
              'program', COALESCE(program.name, ''),
              'scope', COALESCE(membership.scope, ''),
              'primary', membership.is_primary
            )
            ORDER BY membership.is_primary DESC, membership.created_at ASC
          ),
          '[]'::jsonb
        )
        FROM maturity_user_institution_roles membership
        INNER JOIN maturity_institutions institution
          ON institution.id = membership.institution_id
        LEFT JOIN maturity_institution_faculties faculty
          ON faculty.id = membership.faculty_id
        LEFT JOIN maturity_institution_programs program
          ON program.id = membership.program_id
        WHERE membership.user_id = u.id
      ) AS memberships,
      u.password_hash AS "passwordHash"
    FROM maturity_users u
    WHERE u.email = ${email.trim().toLowerCase()}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function createSessionRecord(userId: string, tokenHash: string, expiresAt: string) {
  await ensureInitialized();
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
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.secondary_roles AS "secondaryRoles",
      u.status,
      u.headline,
      u.phone,
      u.location,
      u.bio,
      u.institution_id AS "institutionId",
      u.institution,
      u.faculty_id AS "facultyId",
      u.faculty,
      u.program_id AS "programId",
      u.program,
      u.scope,
      u.status_reason AS "statusReason",
      u.created_by AS "createdBy",
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt",
      u.last_access_at AS "lastAccessAt",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', membership.id,
              'institutionId', membership.institution_id,
              'institution', institution.name,
              'role', membership.role,
              'faculty', COALESCE(faculty.name, ''),
              'program', COALESCE(program.name, ''),
              'scope', COALESCE(membership.scope, ''),
              'primary', membership.is_primary
            )
            ORDER BY membership.is_primary DESC, membership.created_at ASC
          ),
          '[]'::jsonb
        )
        FROM maturity_user_institution_roles membership
        INNER JOIN maturity_institutions institution
          ON institution.id = membership.institution_id
        LEFT JOIN maturity_institution_faculties faculty
          ON faculty.id = membership.faculty_id
        LEFT JOIN maturity_institution_programs program
          ON program.id = membership.program_id
        WHERE membership.user_id = u.id
      ) AS memberships,
      s.expires_at AS "expiresAt"
    FROM maturity_sessions s
    INNER JOIN maturity_users u
      ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND u.status = ${'Activo'}
    LIMIT 1
  `) as SessionLookupRow[];

  return rows[0] ?? null;
}

export async function touchUserLastAccess(userId: string) {
  await ensureInitialized();
  const sql = getSql();

  await sql`
    UPDATE maturity_users
    SET
      last_access_at = ${new Date().toISOString()},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${userId}
  `;
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await ensureInitialized();
  const sql = getSql();

  await sql`
    DELETE FROM maturity_sessions
    WHERE token_hash = ${tokenHash}
  `;
}

export async function createCourseRecord(input: CourseMutationInput) {
  await ensureInitialized();
  assertCourseContextInput(input);

  const course = makeCourseRecord(input);
  const result = await persistCourse(course);

  // Provision initial folders/resources
  await provisionCourseFolders(course);

  return result;
}

async function provisionCourseFolders(course: Course) {
  const sql = getSql();
  const levels = [
    { unit: 'Institución', title: course.metadata.institution },
    { unit: 'Facultad', title: course.faculty },
    { unit: 'Programa', title: course.program },
    { unit: 'Periodo', title: course.metadata.academicPeriod },
    { unit: 'Tipología', title: course.metadata.courseType },
  ];

  for (const level of levels) {
    if (!level.title) continue;

    const id = `resource-folder-${course.slug}-${slugify(level.unit)}-${slugify(level.title)}`;
    
    // Check if it already exists (shouldn't for a new course, but just in case)
    const existing = await sql`
      SELECT id FROM maturity_library_resources WHERE id = ${id} LIMIT 1
    `;

    if (existing.length === 0) {
      await sql`
        INSERT INTO maturity_library_resources (
          id, title, kind, course_slug, unit, source, status, tags, summary
        ) VALUES (
          ${id},
          ${level.title},
          'Curado',
          ${course.slug},
          ${level.unit},
          'Estructura institucional',
          'Listo',
          ${JSON.stringify(['Carpeta', 'Estructura'])}::jsonb,
          ${`Nivel de carpeta para ${level.unit}: ${level.title}`}
        )
      `;
    }
  }
}


export async function updateCourseRecord(slug: string, input: CourseMutationInput) {
  await ensureInitialized();
  assertCourseContextInput(input);

  const current = await readCourseBySlug(slug);

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
        institution: input.institution,
        faculty: input.faculty,
        program: input.program,
        academicPeriod: input.academicPeriod,
        courseType: input.courseType,
        modality: input.modality,
        summary: input.summary,
        status: input.status,
        stageId: input.stageId,
        updatedAt: getTodayLabel(),
      },
      {
        institution: input.institution,
        academicPeriod: input.academicPeriod,
        courseType: input.courseType,
      },
    ),
  };

  return persistCourse(nextCourse);
}

export async function updateCourseMetadataRecord(
  courseSlug: string,
  input: CourseMetadataMutationInput,
) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const nextCourse = appendAuditEntry(
    {
      ...course,
      faculty: input.faculty ?? course.faculty,
      program: input.program ?? course.program,
      credits: input.credits ?? course.credits,
      summary: input.summary ?? course.summary,
      metadata: mergeCourseMetadata(course, input),
    },
    'Ficha operativa actualizada',
    `Se ajustaron metadatos, resultados de aprendizaje y criterios de seguimiento del curso ${course.title}.`,
    'course',
  );

  return persistCourse(nextCourse);
}

export async function createTimelineItemRecord(courseSlug: string, input: TimelineItemMutationInput) {
  await ensureInitialized();

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
  await ensureInitialized();

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
  await ensureInitialized();

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

export async function findTeamMemberById(courseSlug: string, memberId: string) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);
  return course ? findTeamMember(course, memberId) : null;
}

export async function createTeamMemberRecord(courseSlug: string, input: TeamMemberMutationInput) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const member = makeTeamMemberRecord(input);
  const nextCourse = appendAuditEntry(
    {
      ...course,
      team: [...course.team, member],
    },
    'Responsable agregado',
    `Se vinculó a ${member.name} como ${member.role} dentro del equipo del curso.`,
    'planning',
  );

  await persistCourse(nextCourse);
  return member;
}

export async function updateTeamMemberRecord(
  courseSlug: string,
  memberId: string,
  input: Partial<TeamMemberMutationInput>,
) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  let updatedMember: TeamMember | null = null;
  const nextTeam = course.team.map((member) => {
    if (member.id !== memberId) {
      return member;
    }

    updatedMember = {
      ...member,
      ...input,
      initials:
        input.initials?.trim().toUpperCase() ??
        member.initials ??
        deriveInitials(input.name ?? member.name),
    };

    return updatedMember;
  });

  if (!updatedMember) {
    return null;
  }

  const finalMember = updatedMember as TeamMember;
  const nextCourse = appendAuditEntry(
    {
      ...course,
      team: nextTeam,
    },
    'Responsable actualizado',
    `Se actualizó la asignación de ${finalMember.name} dentro del equipo del curso.`,
    'planning',
  );

  await persistCourse(nextCourse);
  return finalMember;
}

export async function deleteTeamMemberRecord(courseSlug: string, memberId: string) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return false;
  }

  const deletedMember = findTeamMember(course, memberId);
  const nextTeam = course.team.filter((member) => member.id !== memberId);

  if (!deletedMember || nextTeam.length === course.team.length) {
    return false;
  }

  const nextCourse = appendAuditEntry(
    {
      ...course,
      team: nextTeam,
    },
    'Responsable retirado',
    `Se retiró a ${deletedMember.name} del equipo visible del curso.`,
    'planning',
  );

  await persistCourse(nextCourse);
  return true;
}

export async function findLearningModuleById(courseSlug: string, moduleId: string) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);
  return course ? findLearningModule(course, moduleId) : null;
}

export async function createLearningModuleRecord(
  courseSlug: string,
  input: LearningModuleMutationInput,
) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const module = makeLearningModuleRecord(input);
  const nextCourse = appendAuditEntry(
    {
      ...course,
      modules: [...course.modules, module],
      metadata: {
        ...course.metadata,
        topics: [...new Set([...course.metadata.topics, module.title])],
      },
    },
    'Módulo agregado',
    `Se creó el módulo "${module.title}" dentro de la arquitectura del curso.`,
    'production',
  );

  await persistCourse(nextCourse);
  return module;
}

export async function updateLearningModuleRecord(
  courseSlug: string,
  moduleId: string,
  input: Partial<LearningModuleMutationInput>,
) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  let updatedModule: LearningModule | null = null;
  const nextModules = course.modules.map((module) => {
    if (module.id !== moduleId) {
      return module;
    }

    updatedModule = {
      ...module,
      ...input,
    };

    return updatedModule;
  });

  if (!updatedModule) {
    return null;
  }

  const finalModule = updatedModule as LearningModule;
  const nextCourse = appendAuditEntry(
    {
      ...course,
      modules: nextModules,
      metadata: {
        ...course.metadata,
        topics: nextModules.map((module) => module.title),
      },
    },
    'Módulo actualizado',
    `Se actualizó el módulo "${finalModule.title}" y su avance quedó en ${finalModule.completion}%.`,
    'production',
  );

  await persistCourse(nextCourse);
  return finalModule;
}

export async function deleteLearningModuleRecord(courseSlug: string, moduleId: string) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return false;
  }

  const deletedModule = findLearningModule(course, moduleId);
  const nextModules = course.modules.filter((module) => module.id !== moduleId);

  if (!deletedModule || nextModules.length === course.modules.length) {
    return false;
  }

  const nextCourse = appendAuditEntry(
    {
      ...course,
      modules: nextModules,
      metadata: {
        ...course.metadata,
        topics: nextModules.map((module) => module.title),
      },
    },
    'Módulo retirado',
    `Se retiró "${deletedModule.title}" de la arquitectura visible del curso.`,
    'production',
  );

  await persistCourse(nextCourse);
  return true;
}

export async function findCourseProductById(courseSlug: string, productId: string) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);
  return course ? findCourseProduct(course, productId) : null;
}

export async function createCourseProductRecord(
  courseSlug: string,
  input: CourseProductMutationInput,
) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const product = makeCourseProductRecord(input);
  const nextCourse = appendAuditEntry(
    {
      ...course,
      products: [product, ...course.products],
    },
    'Producto creado',
    `Se creó "${product.title}" como ${product.format.toLowerCase()} dentro de ${product.stage}.`,
    mapProductStageToAuditType(product.stage),
  );

  await persistCourse(nextCourse);
  return product;
}

export async function updateCourseProductRecord(
  courseSlug: string,
  productId: string,
  input: Partial<CourseProductMutationInput>,
) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  let updatedProduct: CourseProduct | null = null;
  const nextProducts = course.products.map((product) => {
    if (product.id !== productId) {
      return product;
    }

    const nextStage = input.stage ?? product.stage;
    const normalizedText = normalizeCourseProductTextFields(
      nextStage,
      input.summary ?? product.summary,
      input.body ?? product.body,
    );

    updatedProduct = {
      ...product,
      ...input,
      stage: nextStage,
      summary: normalizedText.summary,
      body: normalizedText.body,
      tags: input.tags ? (input.tags as string[]).map((tag) => tag.trim()).filter(Boolean) : product.tags,
      section: input.section ?? product.section,
      phasePlan:
        input.phasePlan !== undefined
          ? normalizeProductPhasePlan(input.phasePlan)
          : product.phasePlan,
      writingData:
        input.writingData !== undefined
          ? normalizeProductWritingData(input.writingData)
          : product.writingData,
      updatedAt: getTodayLabel(),
    };

    return updatedProduct;
  });

  if (!updatedProduct) {
    return null;
  }

  const finalProduct = updatedProduct as CourseProduct;
  const nextCourse = appendAuditEntry(
    {
      ...course,
      products: nextProducts,
    },
    'Producto actualizado',
    `Se actualizó "${finalProduct.title}" y quedó en estado ${finalProduct.status}.`,
    mapProductStageToAuditType(finalProduct.stage),
  );

  await persistCourse(nextCourse);
  await syncTasksForProduct(finalProduct);
  return finalProduct;
}

export async function deleteCourseProductRecord(courseSlug: string, productId: string) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return false;
  }

  const deletedProduct = findCourseProduct(course, productId);
  const nextProducts = course.products.filter((product) => product.id !== productId);

  if (!deletedProduct || nextProducts.length === course.products.length) {
    return false;
  }

  const nextCourse = appendAuditEntry(
    {
      ...course,
      products: nextProducts,
    },
    'Producto retirado',
    `Se retiró "${deletedProduct.title}" del expediente editable del curso.`,
    mapProductStageToAuditType(deletedProduct.stage),
  );

  await persistCourse(nextCourse);
  return true;
}

export async function updateCourseStageNoteRecord(
  courseSlug: string,
  key: CourseStageNoteKey,
  input: CourseStageNoteMutationInput,
) {
  await ensureInitialized();

  const course = await readCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const nextCourse = appendAuditEntry(
    {
      ...course,
      stageNotes: {
        ...course.stageNotes,
        [key]: mergeCourseStageNote(course, key, input),
      },
    },
    `${stageNoteDefinitions[key].heading} actualizada`,
    `Se actualizó la bitácora de ${stageNoteDefinitions[key].heading.toLowerCase()} con estado ${input.status}.`,
    key === 'qa'
      ? 'qa'
      : ['microcurriculo', 'arquitectura', 'planeacion'].includes(key)
        ? 'planning'
        : key === 'entrega'
          ? 'handoff'
          : 'production',
  );

  await persistCourse(nextCourse);
  return nextCourse.stageNotes[key];
}

export async function deleteCourseRecord(slug: string) {
  await ensureInitialized();
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
  await ensureInitialized();

  const productSnapshot = await resolveTaskProductSnapshot(input.courseSlug, input.productId);
  const task = {
    ...makeTaskRecord(input),
    ...productSnapshot,
  };
  await persistTask(task);
  await appendAuditEntryByCourseSlug(
    input.courseSlug,
    'Tarea creada',
    task.productTitle
      ? `Se asignó "${task.title}" a ${task.role} sobre el producto "${task.productTitle}" con vencimiento ${task.dueDate}.`
      : `Se asignó "${task.title}" a ${task.role} con vencimiento ${task.dueDate}.`,
    'planning',
  );
  return task;
}

export async function updateTaskRecord(id: string, input: Partial<TaskMutationInput>) {
  await ensureInitialized();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      id,
      title,
      course_slug AS "courseSlug",
      product_id AS "productId",
      product_title AS "productTitle",
      role,
      stage_id AS "stageId",
      due_date AS "dueDate",
      priority,
      status,
      summary
    FROM maturity_tasks
    WHERE id = ${id}
    LIMIT 1
  `) as TaskRow[];

  const current = rows[0] ? serializeTaskRow(rows[0]) : null;

  if (!current) {
    return null;
  }

  const nextCourseSlug = input.courseSlug ?? current.courseSlug;
  const nextProductLink =
    Object.prototype.hasOwnProperty.call(input, 'productId')
      ? await resolveTaskProductSnapshot(nextCourseSlug, input.productId)
      : {
          productId: current.productId,
          productTitle: current.productTitle,
        };

  const nextTask: Task = {
    ...current,
    ...input,
    ...nextProductLink,
    courseSlug: nextCourseSlug,
  };

  await persistTask(nextTask);
  await appendAuditEntryByCourseSlug(
    nextTask.courseSlug,
    'Tarea actualizada',
    nextTask.productTitle
      ? `La tarea "${nextTask.title}" quedó en estado ${nextTask.status} y sigue vinculada al producto "${nextTask.productTitle}".`
      : `La tarea "${nextTask.title}" quedó en estado ${nextTask.status}.`,
    'planning',
  );
  return nextTask;
}

export async function deleteTaskRecord(id: string) {
  await ensureInitialized();
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
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      title,
      course_slug AS "courseSlug",
      product_id AS "productId",
      product_title AS "productTitle",
      role,
      stage_id AS "stageId",
      due_date AS "dueDate",
      priority,
      status,
      summary
    FROM maturity_tasks
    WHERE id = ${id}
    LIMIT 1
  `) as TaskRow[];

  return rows[0] ? serializeTaskRow(rows[0]) : null;
}

export async function updateStageCheckpointRecord(
  courseSlug: string,
  checkpointIndex: number,
  input: StageCheckpointMutationInput,
) {
  await ensureInitialized();

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
  await ensureInitialized();

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

  const isLastStage = currentStageIndex >= platformStages.length - 1;
  const nextStage = isLastStage ? null : platformStages[currentStageIndex + 1];
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
        : `El curso pasó desde ${platformStages[currentStageIndex]?.name ?? 'la etapa actual'} hacia ${nextStage?.name ?? 'la siguiente etapa'}.`,
      'handoff',
    ),
    stageId: nextStage?.id ?? course.stageId,
    updatedAt: getTodayLabel(),
    progress: isLastStage
      ? 100
      : Math.max(course.progress, Math.round(((currentStageIndex + 2) / platformStages.length) * 100)),
    status: isLastStage ? 'Entregado' : 'En QA',
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
      : `Se liberó el handoff desde ${platformStages[currentStageIndex]?.name ?? 'la etapa anterior'} y el siguiente responsable ya puede iniciar trabajo.`,
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
  await ensureInitialized();

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
  return nextCourse.deliverables[nextCourse.deliverables.length - 1] ?? null;
}

export async function updateDeliverableRecord(
  courseSlug: string,
  deliverableId: string,
  input: Partial<DeliverableMutationInput>,
) {
  await ensureInitialized();

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
  await ensureInitialized();

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
  await ensureInitialized();
  const course = await readCourseBySlug(courseSlug);

  return course?.deliverables.find((deliverable) => deliverable.id === deliverableId) ?? null;
}

export async function createObservationRecord(courseSlug: string, input: ObservationMutationInput) {
  await ensureInitialized();

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
  return nextCourse.observations[nextCourse.observations.length - 1] ?? null;
}

export async function updateObservationRecord(
  courseSlug: string,
  observationId: string,
  input: Partial<ObservationMutationInput>,
) {
  await ensureInitialized();

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
  await ensureInitialized();

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
  await ensureInitialized();
  const course = await readCourseBySlug(courseSlug);

  return course?.observations.find((observation) => observation.id === observationId) ?? null;
}

export async function createLibraryResourceRecord(input: LibraryResourceMutationInput) {
  await ensureInitialized();

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
  await ensureInitialized();
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
  await ensureInitialized();

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
  await ensureInitialized();
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
  await ensureInitialized();
  return readUsers();
}

export async function findUserById(id: string) {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.secondary_roles AS "secondaryRoles",
      u.status,
      u.headline,
      u.phone,
      u.location,
      u.bio,
      u.institution_id AS "institutionId",
      u.institution,
      u.faculty_id AS "facultyId",
      u.faculty,
      u.program_id AS "programId",
      u.program,
      u.scope,
      u.status_reason AS "statusReason",
      u.created_by AS "createdBy",
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt",
      u.last_access_at AS "lastAccessAt",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', membership.id,
              'institutionId', membership.institution_id,
              'institution', institution.name,
              'role', membership.role,
              'faculty', COALESCE(faculty.name, ''),
              'program', COALESCE(program.name, ''),
              'scope', COALESCE(membership.scope, ''),
              'primary', membership.is_primary
            )
            ORDER BY membership.is_primary DESC, membership.created_at ASC
          ),
          '[]'::jsonb
        )
        FROM maturity_user_institution_roles membership
        INNER JOIN maturity_institutions institution
          ON institution.id = membership.institution_id
        LEFT JOIN maturity_institution_faculties faculty
          ON faculty.id = membership.faculty_id
        LEFT JOIN maturity_institution_programs program
          ON program.id = membership.program_id
        WHERE membership.user_id = u.id
      ) AS memberships,
      u.password_hash AS "passwordHash"
    FROM maturity_users u
    WHERE u.id = ${id}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function createUserRecord(input: UserMutationInput, actorId?: string | null) {
  await ensureInitialized();

  if (!normalizeUserScopeValue(input.institution)) {
    throw new Error('El usuario debe quedar vinculado a una institución.');
  }

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
  const timestamp = new Date().toISOString();
  const secondaryRoles = normalizeRoleList(input.role, input.secondaryRoles);
  const context = await resolveInstitutionReferenceContext(
    {
      institution: input.institution,
      faculty: input.faculty,
      program: input.program,
    },
    { strict: true },
  );
  const institutionMembershipIds = normalizeInstitutionMembershipIds(
    input.institutionMembershipIds,
    context.institutionId,
  );

  await sql`
    INSERT INTO maturity_users (
      id,
      name,
      email,
      role,
      password_hash,
      secondary_roles,
      status,
      headline,
      phone,
      location,
      bio,
      institution_id,
      institution,
      faculty_id,
      faculty,
      program_id,
      program,
      institution_membership_ids,
      scope,
      status_reason,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${input.name.trim()},
      ${normalizedEmail},
      ${input.role},
      ${passwordHash},
      ${JSON.stringify(secondaryRoles)}::jsonb,
      ${normalizeUserStatus(input.status)},
      ${input.headline?.trim() || null},
      ${input.phone?.trim() || null},
      ${input.location?.trim() || null},
      ${input.bio?.trim() || null},
      ${context.institutionId},
      ${context.institutionName},
      ${context.facultyId},
      ${context.facultyName || null},
      ${context.programId},
      ${context.programName || null},
      ${JSON.stringify(institutionMembershipIds)}::jsonb,
      ${normalizeUserScopeValue(input.scope)},
      ${input.statusReason.trim() || null},
      ${actorId ?? null},
      ${timestamp},
      ${timestamp}
    )
  `;

  await rebuildUserInstitutionMemberships();

  const created = await findUserById(id);

  if (!created) {
    throw new Error('No fue posible leer el usuario recién creado.');
  }

  return serializeUserRow(created);
}

export async function updateUserRecord(input: UserUpdateInput) {
  await ensureInitialized();

  if (!normalizeUserScopeValue(input.institution)) {
    throw new Error('El usuario debe quedar vinculado a una institución.');
  }

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
  const secondaryRoles = normalizeRoleList(input.role, input.secondaryRoles);
  const nextStatus = normalizeUserStatus(input.status);
  const context = await resolveInstitutionReferenceContext(
    {
      institutionId:
        current.institution?.trim().toLowerCase() === input.institution.trim().toLowerCase()
          ? current.institutionId ?? null
          : null,
      institution: input.institution,
      faculty: input.faculty,
      program: input.program,
    },
    { strict: true },
  );
  const institutionMembershipIds = normalizeInstitutionMembershipIds(
    input.institutionMembershipIds,
    context.institutionId,
  );

  await sql`
    UPDATE maturity_users
    SET
      name = ${input.name.trim()},
      email = ${normalizedEmail},
      role = ${input.role},
      password_hash = ${passwordHash},
      secondary_roles = ${JSON.stringify(secondaryRoles)}::jsonb,
      status = ${nextStatus},
      headline = ${input.headline?.trim() || null},
      phone = ${input.phone?.trim() || null},
      location = ${input.location?.trim() || null},
      bio = ${input.bio?.trim() || null},
      institution_id = ${context.institutionId},
      institution = ${context.institutionName},
      faculty_id = ${context.facultyId},
      faculty = ${context.facultyName || null},
      program_id = ${context.programId},
      program = ${context.programName || null},
      institution_membership_ids = ${JSON.stringify(institutionMembershipIds)}::jsonb,
      scope = ${normalizeUserScopeValue(input.scope) || null},
      status_reason = ${input.statusReason.trim() || null},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${input.id}
  `;

  if (nextStatus !== 'Activo') {
    await sql`
      DELETE FROM maturity_sessions
      WHERE user_id = ${input.id}
    `;
  }

  await rebuildUserInstitutionMemberships();

  const updated = await findUserById(input.id);
  return updated ? serializeUserRow(updated) : null;
}

export async function updateOwnProfileRecord(userId: string, input: UserProfileUpdateInput) {
  await ensureSchema();
  await ensureSeedData();
  const sql = getSql();
  const normalizedEmail = input.email.trim().toLowerCase();
  const current = await findUserById(userId);

  if (!current) {
    return null;
  }

  const conflictRows = (await sql`
    SELECT id
    FROM maturity_users
    WHERE email = ${normalizedEmail}
      AND id <> ${userId}
    LIMIT 1
  `) as Array<{ id: string }>;

  if (conflictRows.length > 0) {
    throw new Error('Ese correo ya está en uso por otro usuario.');
  }

  await sql`
    UPDATE maturity_users
    SET
      name = ${input.name.trim()},
      email = ${normalizedEmail},
      headline = ${input.headline.trim() || null},
      phone = ${input.phone.trim() || null},
      location = ${input.location.trim() || null},
      bio = ${input.bio.trim() || null},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${userId}
  `;

  const updated = await findUserById(userId);
  return updated ? serializeUserRow(updated) : null;
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
    SET
      password_hash = ${passwordHash},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${userId}
  `;
}
