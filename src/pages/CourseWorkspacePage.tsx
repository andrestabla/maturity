import {
  Bot,
  CircleAlert,
  Compass,
  Flag,
  Layers3,
  MoveRight,
  PencilLine,
  Plus,
  Save,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ModalFrame } from '../components/ModalFrame.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { ProgressRing } from '../components/ProgressRing.js';
import { StageRail } from '../components/StageRail.js';
import type {
  AppData,
  Course,
  CourseMetadataMutationInput,
  CourseProduct,
  CourseProductMutationInput,
  CourseProductStage,
  CourseStageNoteKey,
  CourseStageNoteMutationInput,
  CourseMutationInput,
  Deliverable,
  DeliverableMutationInput,
  LearningModule,
  LearningModuleMutationInput,
  Observation,
  ObservationMutationInput,
  Role,
  StageCheckpointStatus,
  Task,
  TaskMutationInput,
  TeamMember,
  TeamMemberMutationInput,
  TimelineItem,
  TimelineItemMutationInput,
} from '../types.js';
import { formatDate, formatLongDate } from '../utils/format.js';
import { getCourseBySlug, getStageMeta } from '../utils/domain.js';
import {
  getFirstInstitutionStructure,
  getInstitutionAcademicPeriods,
  getInstitutionCourseTypes,
  getInstitutionFaculties,
  getInstitutionPedagogicalGuidelines,
  getInstitutionPrograms,
} from '../utils/institutions.js';
import {
  canCreateDeliverables,
  canCreateObservations,
  canCreateCourseProducts,
  canCreateTasks,
  canDeleteCourseProducts,
  canDeleteDeliverables,
  canEditCourseProduct,
  canEditCourseModules,
  canEditStageNote,
  canDeleteObservations,
  canDeleteTasks,
  canEditDeliverable,
  canEditObservation,
  canEditTask,
  canManageHandoffs,
  canManageCourseTeam,
  canManageCourses,
  canOperateStageCheckpoint,
} from '../utils/permissions.js';

interface CourseWorkspacePageProps {
  role: Role;
  userRole: Role;
  appData: AppData;
  refreshAppData: () => void;
}

type CourseSection =
  | 'summary'
  | 'general'
  | 'architecture'
  | 'planning'
  | 'production'
  | 'resources'
  | 'lms'
  | 'qa'
  | 'history';

const validCourseSections: CourseSection[] = [
  'summary',
  'general',
  'architecture',
  'planning',
  'production',
  'resources',
  'lms',
  'qa',
  'history',
];

function isCourseSection(value: string | undefined): value is CourseSection {
  return Boolean(value && validCourseSections.includes(value as CourseSection));
}

function buildCourseSectionPath(slug: string, section: CourseSection) {
  return section === 'summary' ? `/courses/${slug}` : `/courses/${slug}/${section}`;
}

function badgeClass(status: string) {
  switch (status) {
    case 'Listo':
    case 'En ritmo':
    case 'Resuelta':
      return 'badge badge--sage';
    case 'En revisión':
    case 'En ajuste':
      return 'badge badge--gold';
    case 'Pendiente':
    case 'Riesgo':
    case 'En curso':
      return 'badge badge--ocean';
    case 'Bloqueado':
      return 'badge badge--coral';
    default:
      return 'badge badge--outline';
  }
}

function checkpointStatusLabel(status: StageCheckpointStatus) {
  switch (status) {
    case 'done':
      return 'Completada';
    case 'active':
      return 'Activa';
    case 'blocked':
      return 'Bloqueada';
    default:
      return 'Pendiente';
  }
}

function checkpointBadgeClass(status: StageCheckpointStatus) {
  switch (status) {
    case 'done':
      return 'badge badge--sage';
    case 'active':
      return 'badge badge--gold';
    case 'blocked':
      return 'badge badge--coral';
    default:
      return 'badge badge--outline';
  }
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'es'),
  );
}

function syncCourseStructureFields(
  appData: AppData,
  form: CourseMutationInput,
): CourseMutationInput {
  const fallbackStructure = getFirstInstitutionStructure(appData.institution);
  const institution =
    form.institution.trim() ||
    fallbackStructure?.institution ||
    appData.institution.institutions[0] ||
    appData.institution.displayName ||
    '';
  const facultyOptions = getInstitutionFaculties(appData.institution, institution);
  const programOptions = getInstitutionPrograms(appData.institution, institution);
  const academicPeriodOptions = getInstitutionAcademicPeriods(appData.institution, institution);
  const courseTypeOptions = getInstitutionCourseTypes(appData.institution, institution);

  return {
    ...form,
    institution,
    faculty:
      facultyOptions.includes(form.faculty) || !form.faculty.trim()
        ? form.faculty.trim() || facultyOptions[0] || ''
        : facultyOptions[0] || '',
    program:
      programOptions.includes(form.program) || !form.program.trim()
        ? form.program.trim() || programOptions[0] || ''
        : programOptions[0] || '',
    academicPeriod:
      academicPeriodOptions.includes(form.academicPeriod) || !form.academicPeriod.trim()
        ? form.academicPeriod.trim() || academicPeriodOptions[0] || ''
        : academicPeriodOptions[0] || '',
    courseType:
      courseTypeOptions.includes(form.courseType) || !form.courseType.trim()
        ? form.courseType.trim() || courseTypeOptions[0] || ''
        : courseTypeOptions[0] || '',
  };
}

function makeCourseForm(course: Course): CourseMutationInput {
  return {
    title: course.title,
    code: course.code,
    institution: course.metadata.institution,
    faculty: course.faculty,
    program: course.program,
    academicPeriod: course.metadata.academicPeriod,
    courseType: course.metadata.courseType,
    modality: course.modality,
    credits: course.credits,
    stageId: course.stageId,
    status: course.status,
    summary: course.summary,
    nextMilestone: course.nextMilestone,
  };
}

function buildEmptyCourseForm(stageId: string): CourseMutationInput {
  return {
    title: '',
    code: '',
    institution: '',
    faculty: '',
    program: '',
    academicPeriod: '',
    courseType: '',
    modality: '',
    credits: 1,
    stageId,
    status: 'En ritmo',
    summary: '',
    nextMilestone: '',
  };
}

function makeTaskForm(courseSlug: string, stageId: string): TaskMutationInput {
  return {
    title: '',
    courseSlug,
    role: 'Experto',
    stageId,
    dueDate: new Date().toISOString().slice(0, 10),
    priority: 'Media',
    status: 'Pendiente',
    summary: '',
  };
}

function makeTaskDrafts(tasks: Task[]) {
  return Object.fromEntries(
    tasks.map((task) => [
      task.id,
      {
        title: task.title,
        courseSlug: task.courseSlug,
        role: task.role,
        stageId: task.stageId,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        summary: task.summary,
      },
    ]),
  ) as Record<string, TaskMutationInput>;
}

function makeDeliverableForm(owner: Role): DeliverableMutationInput {
  return {
    title: '',
    owner,
    status: 'En curso',
    dueDate: new Date().toISOString().slice(0, 10),
    note: '',
  };
}

function makeDeliverableDrafts(deliverables: Deliverable[]) {
  return Object.fromEntries(
    deliverables.map((deliverable) => [
      deliverable.id,
      {
        title: deliverable.title,
        owner: deliverable.owner,
        status: deliverable.status,
        dueDate: deliverable.dueDate,
        note: deliverable.note,
      },
    ]),
  ) as Record<string, DeliverableMutationInput>;
}

function makeObservationForm(role: Role): ObservationMutationInput {
  return {
    title: '',
    role,
    severity: 'Media',
    status: 'Pendiente',
    detail: '',
  };
}

function makeObservationDrafts(observations: Observation[]) {
  return Object.fromEntries(
    observations.map((observation) => [
      observation.id,
      {
        title: observation.title,
        role: observation.role,
        severity: observation.severity,
        status: observation.status,
        detail: observation.detail,
      },
    ]),
  ) as Record<string, ObservationMutationInput>;
}

function makeMetadataForm(course: Course): CourseMetadataMutationInput {
  return {
    institution: course.metadata.institution,
    shortName: course.metadata.shortName,
    semester: course.metadata.semester,
    academicPeriod: course.metadata.academicPeriod,
    courseType: course.metadata.courseType,
    learningOutcomes: course.metadata.learningOutcomes,
    topics: course.metadata.topics,
    methodology: course.metadata.methodology,
    evaluation: course.metadata.evaluation,
    bibliography: course.metadata.bibliography,
    targetCloseDate: course.metadata.targetCloseDate,
    currentVersion: course.metadata.currentVersion,
    priority: course.metadata.priority,
    riskLevel: course.metadata.riskLevel,
  };
}

function makeTimelineForm(): TimelineItemMutationInput {
  return {
    label: '',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'pending',
  };
}

function makeTimelineDrafts(schedule: TimelineItem[]) {
  return Object.fromEntries(
    schedule.map((item) => [
      item.id,
      {
        label: item.label,
        dueDate: item.dueDate,
        status: item.status,
      },
    ]),
  ) as Record<string, TimelineItemMutationInput>;
}

function makeTeamMemberForm(): TeamMemberMutationInput {
  return {
    name: '',
    role: 'Coordinador',
    focus: '',
    initials: '',
  };
}

function makeTeamMemberDrafts(team: TeamMember[]) {
  return Object.fromEntries(
    team.map((member) => [
      member.id,
      {
        name: member.name,
        role: member.role,
        focus: member.focus,
        initials: member.initials,
      },
    ]),
  ) as Record<string, TeamMemberMutationInput>;
}

function makeLearningModuleForm(): LearningModuleMutationInput {
  return {
    title: '',
    learningGoal: '',
    activities: 1,
    ownResources: 0,
    curatedResources: 0,
    completion: 0,
  };
}

function makeLearningModuleDrafts(modules: LearningModule[]) {
  return Object.fromEntries(
    modules.map((module) => [
      module.id,
      {
        title: module.title,
        learningGoal: module.learningGoal,
        activities: module.activities,
        ownResources: module.ownResources,
        curatedResources: module.curatedResources,
        completion: module.completion,
      },
    ]),
  ) as Record<string, LearningModuleMutationInput>;
}

function defaultProductFormat(stage: CourseProductStage): CourseProductMutationInput['format'] {
  switch (stage) {
    case 'general':
      return 'Sílabus';
    case 'architecture':
      return 'Lineamiento';
    case 'production':
      return 'Actividad';
    case 'curation':
      return 'Documento';
    case 'multimedia':
      return 'HTML';
    case 'qa':
      return 'Rúbrica';
    default:
      return 'Documento';
  }
}

function defaultProductOwner(stage: CourseProductStage): Role {
  switch (stage) {
    case 'general':
      return 'Coordinador';
    case 'architecture':
      return 'Diseñador instruccional';
    case 'production':
    case 'curation':
      return 'Experto';
    case 'multimedia':
      return 'Diseñador multimedia';
    case 'qa':
      return 'Analista QA';
    default:
      return 'Coordinador';
  }
}

function makeCourseProductForm(stage: CourseProductStage = 'general'): CourseProductMutationInput {
  return {
    title: '',
    stage,
    format: defaultProductFormat(stage),
    owner: defaultProductOwner(stage),
    status: 'Borrador',
    summary: '',
    body: '',
    tags: [],
    version: 'v0.1',
  };
}

function makeCourseProductDrafts(products: CourseProduct[]) {
  return Object.fromEntries(
    products.map((product) => [
      product.id,
      {
        title: product.title,
        stage: product.stage,
        format: product.format,
        owner: product.owner,
        status: product.status,
        summary: product.summary,
        body: product.body,
        tags: product.tags,
        version: product.version,
      },
    ]),
  ) as Record<string, CourseProductMutationInput>;
}

function productStageLabel(stage: CourseProductStage) {
  switch (stage) {
    case 'general':
      return 'Microcurrículo';
    case 'architecture':
      return 'Arquitectura';
    case 'production':
      return 'Producción';
    case 'curation':
      return 'Curación';
    case 'multimedia':
      return 'Multimedia';
    case 'qa':
      return 'QA';
    default:
      return 'Producto';
  }
}

function productStatusBadgeClass(status: CourseProduct['status']) {
  switch (status) {
    case 'Aprobado':
      return 'badge badge--sage';
    case 'En revisión':
      return 'badge badge--gold';
    default:
      return 'badge badge--outline';
  }
}

function productFormatsForStage(
  stage: CourseProductStage,
): CourseProductMutationInput['format'][] {
  switch (stage) {
    case 'general':
      return ['Sílabus', 'Documento'];
    case 'architecture':
      return ['Lineamiento', 'Documento'];
    case 'production':
      return ['Actividad', 'Recurso', 'Documento'];
    case 'curation':
      return ['Recurso', 'Lectura', 'Documento'];
    case 'multimedia':
      return ['HTML', 'Pódcast', 'Lectura', 'Infografía'];
    case 'qa':
      return ['Rúbrica', 'Documento'];
    default:
      return ['Documento'];
  }
}

function joinTags(tags: string[]) {
  return tags.join(', ');
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeStageNoteDrafts(course: Course | undefined) {
  if (!course) {
    return {
      architecture: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      production: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      curation: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      multimedia: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      lms: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      qa: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
    } satisfies Record<CourseStageNoteKey, CourseStageNoteMutationInput>;
  }

  return {
    architecture: {
      status: course.stageNotes.architecture.status,
      summary: course.stageNotes.architecture.summary,
      evidence: course.stageNotes.architecture.evidence,
      blockers: course.stageNotes.architecture.blockers,
    },
    production: {
      status: course.stageNotes.production.status,
      summary: course.stageNotes.production.summary,
      evidence: course.stageNotes.production.evidence,
      blockers: course.stageNotes.production.blockers,
    },
    curation: {
      status: course.stageNotes.curation.status,
      summary: course.stageNotes.curation.summary,
      evidence: course.stageNotes.curation.evidence,
      blockers: course.stageNotes.curation.blockers,
    },
    multimedia: {
      status: course.stageNotes.multimedia.status,
      summary: course.stageNotes.multimedia.summary,
      evidence: course.stageNotes.multimedia.evidence,
      blockers: course.stageNotes.multimedia.blockers,
    },
    lms: {
      status: course.stageNotes.lms.status,
      summary: course.stageNotes.lms.summary,
      evidence: course.stageNotes.lms.evidence,
      blockers: course.stageNotes.lms.blockers,
    },
    qa: {
      status: course.stageNotes.qa.status,
      summary: course.stageNotes.qa.summary,
      evidence: course.stageNotes.qa.evidence,
      blockers: course.stageNotes.qa.blockers,
    },
  } satisfies Record<CourseStageNoteKey, CourseStageNoteMutationInput>;
}

function joinLines(values: string[]) {
  return values.join('\n');
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function historyTypeBadge(type: string) {
  switch (type) {
    case 'course':
      return 'badge badge--ocean';
    case 'planning':
      return 'badge badge--gold';
    case 'production':
      return 'badge badge--sage';
    case 'resource':
      return 'badge badge--outline';
    case 'qa':
      return 'badge badge--coral';
    case 'handoff':
      return 'badge badge--ocean';
    default:
      return 'badge badge--outline';
  }
}

function historyTypeLabel(type: string) {
  switch (type) {
    case 'course':
      return 'Ficha';
    case 'planning':
      return 'Planeación';
    case 'production':
      return 'Producción';
    case 'resource':
      return 'Recursos';
    case 'qa':
      return 'QA';
    case 'handoff':
      return 'Handoff';
    default:
      return 'Historial';
  }
}

export function CourseWorkspacePage({
  role,
  userRole,
  appData,
  refreshAppData,
}: CourseWorkspacePageProps) {
  const { slug = '', section: sectionParam } = useParams<{ slug?: string; section?: string }>();
  const { showAlert, showConfirm } = useSystemDialog();
  const navigate = useNavigate();
  const course = getCourseBySlug(appData, slug);
  const fallbackStageId = appData.stages[0]?.id ?? 'configuracion';
  const currentStageId = course?.stageId ?? fallbackStageId;
  const currentCourseSlug = course?.slug ?? slug;
  const activeSection: CourseSection = isCourseSection(sectionParam) ? sectionParam : 'summary';
  const stage = course ? getStageMeta(appData, course.stageId) : undefined;
  const relatedTasks = course
    ? appData.tasks.filter((task) => task.courseSlug === course.slug)
    : [];
  const myTasks =
    role === 'Administrador' || role === 'Auditor'
      ? relatedTasks
      : relatedTasks.filter((task) => task.role === role);
  const visibleTasks = canCreateTasks(userRole) ? relatedTasks : myTasks;
  const defaultDeliverableOwner = stage?.owner ?? role;
  const defaultObservationRole = role;
  const relatedAlerts = course
    ? appData.alerts.filter((alert) => alert.courseSlug === course.slug)
    : [];

  const [isCourseEditorOpen, setIsCourseEditorOpen] = useState(false);
  const [isTaskComposerOpen, setIsTaskComposerOpen] = useState(false);
  const [isTeamComposerOpen, setIsTeamComposerOpen] = useState(false);
  const [isModuleComposerOpen, setIsModuleComposerOpen] = useState(false);
  const [productComposerStage, setProductComposerStage] = useState<CourseProductStage | null>(null);
  const [isDeliverableComposerOpen, setIsDeliverableComposerOpen] = useState(false);
  const [isObservationComposerOpen, setIsObservationComposerOpen] = useState(false);
  const [isTimelineComposerOpen, setIsTimelineComposerOpen] = useState(false);
  const [activeWorkspaceOverlay, setActiveWorkspaceOverlay] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [stageNoteError, setStageNoteError] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [deliverableError, setDeliverableError] = useState<string | null>(null);
  const [observationError, setObservationError] = useState<string | null>(null);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [isCourseSaving, setIsCourseSaving] = useState(false);
  const [isMetadataSaving, setIsMetadataSaving] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [isTeamSaving, setIsTeamSaving] = useState<string | null>(null);
  const [isModuleSaving, setIsModuleSaving] = useState<string | null>(null);
  const [isProductSaving, setIsProductSaving] = useState<string | null>(null);
  const [isStageNoteSaving, setIsStageNoteSaving] = useState<CourseStageNoteKey | null>(null);
  const [isTimelineSaving, setIsTimelineSaving] = useState<string | null>(null);
  const [isDeliverableSaving, setIsDeliverableSaving] = useState(false);
  const [isObservationSaving, setIsObservationSaving] = useState(false);
  const [isCheckpointSaving, setIsCheckpointSaving] = useState<number | null>(null);
  const [isHandoffSaving, setIsHandoffSaving] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    course
      ? syncCourseStructureFields(appData, makeCourseForm(course))
      : syncCourseStructureFields(appData, buildEmptyCourseForm(currentStageId)),
  );
  const [newTaskForm, setNewTaskForm] = useState<TaskMutationInput>(() =>
    makeTaskForm(currentCourseSlug, currentStageId),
  );
  const [metadataForm, setMetadataForm] = useState<CourseMetadataMutationInput>(() =>
    course ? makeMetadataForm(course) : makeMetadataForm({
      id: '',
      slug: '',
      title: '',
      code: '',
      faculty: '',
      program: '',
      modality: '',
      credits: 0,
      stageId: fallbackStageId,
      status: 'En ritmo',
      progress: 0,
      summary: '',
      nextMilestone: '',
      updatedAt: new Date().toISOString().slice(0, 10),
      pulse: { velocity: 0, quality: 0, alignment: 0 },
      team: [],
      deliverables: [],
      modules: [],
      observations: [],
      schedule: [],
      stageChecklist: [],
      assistants: [],
      metadata: {
        institution: '',
        shortName: '',
        semester: '',
        academicPeriod: '',
        courseType: '',
        learningOutcomes: [],
        topics: [],
        methodology: '',
        evaluation: '',
        bibliography: [],
        targetCloseDate: new Date().toISOString().slice(0, 10),
        currentVersion: 'v1.0',
        priority: 'Media',
        riskLevel: 'Bajo',
        route: '',
      },
      auditLog: [],
      stageNotes: {
        architecture: {
          owner: 'Diseñador instruccional',
          heading: 'Arquitectura de aprendizaje',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        production: {
          owner: 'Experto',
          heading: 'Producción académica',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        curation: {
          owner: 'Experto',
          heading: 'Curación de contenidos',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        multimedia: {
          owner: 'Diseñador multimedia',
          heading: 'Multimedia',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        lms: {
          owner: 'Gestor LMS',
          heading: 'Montaje LMS',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        qa: {
          owner: 'Analista QA',
          heading: 'QA y validación',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
      },
      products: [],
    }),
  );
  const [newTimelineForm, setNewTimelineForm] = useState<TimelineItemMutationInput>(() =>
    makeTimelineForm(),
  );
  const [newTeamMemberForm, setNewTeamMemberForm] = useState<TeamMemberMutationInput>(() =>
    makeTeamMemberForm(),
  );
  const [newLearningModuleForm, setNewLearningModuleForm] = useState<LearningModuleMutationInput>(
    () => makeLearningModuleForm(),
  );
  const [newProductForm, setNewProductForm] = useState<CourseProductMutationInput>(() =>
    makeCourseProductForm(),
  );
  const [newDeliverableForm, setNewDeliverableForm] = useState<DeliverableMutationInput>(() =>
    makeDeliverableForm(defaultDeliverableOwner),
  );
  const [newObservationForm, setNewObservationForm] = useState<ObservationMutationInput>(() =>
    makeObservationForm(defaultObservationRole),
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskMutationInput>>(() =>
    makeTaskDrafts(relatedTasks),
  );
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamMemberMutationInput>>(() =>
    makeTeamMemberDrafts(course?.team ?? []),
  );
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, LearningModuleMutationInput>>(() =>
    makeLearningModuleDrafts(course?.modules ?? []),
  );
  const [productDrafts, setProductDrafts] = useState<Record<string, CourseProductMutationInput>>(() =>
    makeCourseProductDrafts(course?.products ?? []),
  );
  const [stageNoteDrafts, setStageNoteDrafts] = useState<
    Record<CourseStageNoteKey, CourseStageNoteMutationInput>
  >(() => makeStageNoteDrafts(course));
  const [timelineDrafts, setTimelineDrafts] = useState<Record<string, TimelineItemMutationInput>>(() =>
    makeTimelineDrafts(course?.schedule ?? []),
  );
  const [deliverableDrafts, setDeliverableDrafts] = useState<
    Record<string, DeliverableMutationInput>
  >(() => makeDeliverableDrafts(course?.deliverables ?? []));
  const [observationDrafts, setObservationDrafts] = useState<
    Record<string, ObservationMutationInput>
  >(() => makeObservationDrafts(course?.observations ?? []));
  const [checkpointDrafts, setCheckpointDrafts] = useState<Record<number, StageCheckpointStatus>>(() =>
    Object.fromEntries(
      (course?.stageChecklist ?? []).map((checkpoint, index) => [index, checkpoint.status]),
    ) as Record<number, StageCheckpointStatus>,
  );
  const currentInstitution =
    courseForm.institution ||
    course?.metadata.institution ||
    getFirstInstitutionStructure(appData.institution)?.institution ||
    appData.institution.displayName;
  const institutionOptions = uniqueOptions(
    appData.institution.institutions.length > 0
      ? appData.institution.institutions
      : appData.courses.map((item) => item.metadata.institution || ''),
  );
  const facultyOptions = uniqueOptions(
    getInstitutionFaculties(appData.institution, currentInstitution),
  );
  const programOptions = uniqueOptions(
    getInstitutionPrograms(appData.institution, currentInstitution),
  );
  const academicPeriodOptions = uniqueOptions(
    getInstitutionAcademicPeriods(appData.institution, currentInstitution),
  );
  const courseTypeOptions = uniqueOptions(
    getInstitutionCourseTypes(appData.institution, currentInstitution),
  );
  const institutionGuidelines = getInstitutionPedagogicalGuidelines(
    appData.institution,
    currentInstitution,
  );

  function updateCourseDraftField<Key extends keyof CourseMutationInput>(
    key: Key,
    value: CourseMutationInput[Key],
  ) {
    setCourseForm((current) => {
      const nextForm =
        key === 'institution'
          ? syncCourseStructureFields(appData, {
              ...current,
              institution: value as CourseMutationInput['institution'],
              faculty: '',
              program: '',
              academicPeriod: '',
              courseType: '',
            })
          : {
              ...current,
              [key]: value,
            };

      setMetadataForm((currentMetadata) => ({
        ...currentMetadata,
        institution: nextForm.institution,
        academicPeriod: nextForm.academicPeriod,
        courseType: nextForm.courseType,
      }));

      return nextForm;
    });
  }

  function toggleProductComposer(stageId: CourseProductStage) {
    setProductError(null);

    if (productComposerStage === stageId) {
      setProductComposerStage(null);
      return;
    }

    setNewProductForm(makeCourseProductForm(stageId));
    setProductComposerStage(stageId);
  }

  function closeWorkspaceOverlay() {
    setActiveWorkspaceOverlay(null);
    setIsTaskComposerOpen(false);
    setIsTeamComposerOpen(false);
    setIsModuleComposerOpen(false);
    setProductComposerStage(null);
    setIsDeliverableComposerOpen(false);
    setIsObservationComposerOpen(false);
    setIsTimelineComposerOpen(false);
  }

  useEffect(() => {
    if (!course) {
      const fallbackInstitution =
        getFirstInstitutionStructure(appData.institution)?.institution ||
        appData.institution.displayName ||
        '';

      setCourseForm(syncCourseStructureFields(appData, buildEmptyCourseForm(currentStageId)));
      setMetadataForm((current) => ({
        ...current,
        institution: fallbackInstitution,
        shortName: '',
        semester: '',
        academicPeriod:
          getInstitutionAcademicPeriods(appData.institution, fallbackInstitution)[0] || '',
        courseType: getInstitutionCourseTypes(appData.institution, fallbackInstitution)[0] || '',
        learningOutcomes: [],
        topics: [],
        methodology: '',
        evaluation: '',
        bibliography: [],
        targetCloseDate: new Date().toISOString().slice(0, 10),
        currentVersion: 'v1.0',
        priority: 'Media',
        riskLevel: 'Bajo',
      }));
      setNewTaskForm(makeTaskForm(currentCourseSlug, currentStageId));
      setNewTimelineForm(makeTimelineForm());
      setNewTeamMemberForm(makeTeamMemberForm());
      setNewLearningModuleForm(makeLearningModuleForm());
      setNewProductForm(makeCourseProductForm());
      setNewDeliverableForm(makeDeliverableForm(defaultDeliverableOwner));
      setNewObservationForm(makeObservationForm(defaultObservationRole));
      setTaskDrafts({});
      setTeamDrafts({});
      setModuleDrafts({});
      setProductDrafts({});
      setProductComposerStage(null);
      setActiveWorkspaceOverlay(null);
      setStageNoteDrafts(makeStageNoteDrafts(undefined));
      setTimelineDrafts({});
      setDeliverableDrafts({});
      setObservationDrafts({});
      setCheckpointDrafts({});
      return;
    }

    setCourseForm(syncCourseStructureFields(appData, makeCourseForm(course)));
    setMetadataForm(makeMetadataForm(course));
    setNewTaskForm(makeTaskForm(course.slug, course.stageId));
    setNewTimelineForm(makeTimelineForm());
    setNewTeamMemberForm(makeTeamMemberForm());
    setNewLearningModuleForm(makeLearningModuleForm());
    setNewProductForm(makeCourseProductForm());
    setNewDeliverableForm(makeDeliverableForm(defaultDeliverableOwner));
    setNewObservationForm(makeObservationForm(defaultObservationRole));
    setTaskDrafts(makeTaskDrafts(relatedTasks));
    setTeamDrafts(makeTeamMemberDrafts(course.team));
    setModuleDrafts(makeLearningModuleDrafts(course.modules));
    setProductDrafts(makeCourseProductDrafts(course.products));
    setProductComposerStage(null);
    setActiveWorkspaceOverlay(null);
    setStageNoteDrafts(makeStageNoteDrafts(course));
    setTimelineDrafts(makeTimelineDrafts(course.schedule));
    setDeliverableDrafts(makeDeliverableDrafts(course.deliverables));
    setObservationDrafts(makeObservationDrafts(course.observations));
    setCheckpointDrafts(
      Object.fromEntries(
        course.stageChecklist.map((checkpoint, index) => [index, checkpoint.status]),
      ) as Record<number, StageCheckpointStatus>,
    );
  }, [
    appData,
    appData.tasks,
    course,
    currentCourseSlug,
    currentStageId,
    defaultDeliverableOwner,
    defaultObservationRole,
  ]);

  useEffect(() => {
    setCourseForm((current) => syncCourseStructureFields(appData, current));
  }, [appData]);

  useEffect(() => {
    if (!sectionParam) {
      return;
    }

    if (!isCourseSection(sectionParam)) {
      navigate(buildCourseSectionPath(currentCourseSlug, 'summary'), { replace: true });
    }
  }, [currentCourseSlug, navigate, sectionParam]);

  useEffect(() => {
    const nextError = courseError
      ? {
          title: 'No fue posible actualizar el curso',
          message: courseError,
          clear: () => setCourseError(null),
        }
      : metadataError
        ? {
            title: 'No fue posible guardar la ficha operativa',
            message: metadataError,
            clear: () => setMetadataError(null),
          }
        : taskError
          ? {
              title: 'No fue posible completar la operación sobre la tarea',
              message: taskError,
              clear: () => setTaskError(null),
            }
          : teamError
            ? {
                title: 'No fue posible completar la operación sobre el equipo',
                message: teamError,
                clear: () => setTeamError(null),
              }
            : moduleError
              ? {
                  title: 'No fue posible completar la operación sobre el módulo',
                  message: moduleError,
                  clear: () => setModuleError(null),
                }
              : productError
                ? {
                    title: 'No fue posible completar la operación sobre el producto',
                    message: productError,
                    clear: () => setProductError(null),
                  }
                : stageNoteError
                  ? {
                      title: 'No fue posible guardar la bitácora de etapa',
                      message: stageNoteError,
                      clear: () => setStageNoteError(null),
                    }
                  : timelineError
                    ? {
                        title: 'No fue posible completar la operación sobre el cronograma',
                        message: timelineError,
                        clear: () => setTimelineError(null),
                      }
                    : deliverableError
                      ? {
                          title: 'No fue posible completar la operación sobre el entregable',
                          message: deliverableError,
                          clear: () => setDeliverableError(null),
                        }
                      : observationError
                        ? {
                            title: 'No fue posible completar la operación sobre la observación',
                            message: observationError,
                            clear: () => setObservationError(null),
                          }
                        : checkpointError
                          ? {
                              title: 'No fue posible actualizar el checkpoint',
                              message: checkpointError,
                              clear: () => setCheckpointError(null),
                            }
                          : handoffError
                            ? {
                                title: 'No fue posible transferir el curso',
                                message: handoffError,
                                clear: () => setHandoffError(null),
                              }
                            : null;

    if (!nextError) {
      return;
    }

    let active = true;

    void showAlert({
      title: nextError.title,
      message: nextError.message,
      tone: 'error',
      confirmLabel: 'Entendido',
    }).then(() => {
      if (active) {
        nextError.clear();
      }
    });

    return () => {
      active = false;
    };
  }, [
    checkpointError,
    courseError,
    deliverableError,
    handoffError,
    metadataError,
    moduleError,
    observationError,
    productError,
    showAlert,
    stageNoteError,
    taskError,
    teamError,
    timelineError,
  ]);

  if (!course) {
    return (
      <section className="surface empty-state">
        <strong>Curso no encontrado</strong>
        <p>La ruta solicitada todavía no existe dentro del MVP actual.</p>
        <Link to="/courses" className="cta-button">
          <span>Volver al portafolio</span>
          <MoveRight size={16} />
        </Link>
      </section>
    );
  }

  const currentCourse = course;
  const experienceSettings = appData.experience;
  const workflowSettings = appData.workflow;
  const currentStageIndex = appData.stages.findIndex((item) => item.id === currentCourse.stageId);
  const currentCheckpoint = currentCourse.stageChecklist[currentStageIndex];
  const nextStage = currentStageIndex >= 0 ? appData.stages[currentStageIndex + 1] : undefined;
  const relatedResources = appData.libraryResources.filter(
    (resource) => resource.courseSlug === currentCourse.slug,
  );
  const courseRouteLabel = currentCourse.metadata.route;
  const blockingCheckpoints = currentCourse.stageChecklist.filter(
    (checkpoint, index) => index <= currentStageIndex && checkpoint.status === 'blocked',
  );
  const criticalObservations = currentCourse.observations.filter(
    (observation) => observation.status !== 'Resuelta' && observation.severity === 'Alta',
  );
  const checkpointRequirementMet = workflowSettings.handoffRequiresCheckpoint
    ? Boolean(currentCheckpoint && currentCheckpoint.status === 'done')
    : true;
  const blockedCheckpointRequirementMet = workflowSettings.handoffBlocksOnBlockedCheckpoints
    ? blockingCheckpoints.length === 0
    : true;
  const criticalObservationRequirementMet = workflowSettings.handoffBlocksOnCriticalObservations
    ? criticalObservations.length === 0
    : true;
  const handoffBlockingReason =
    workflowSettings.handoffBlocksOnBlockedCheckpoints && blockingCheckpoints.length > 0
      ? `Hay ${blockingCheckpoints.length} checkpoint(s) bloqueado(s) antes de avanzar.`
      : workflowSettings.handoffBlocksOnCriticalObservations && criticalObservations.length > 0
        ? `Hay ${criticalObservations.length} observación(es) crítica(s) pendiente(s) por resolver.`
        : null;
  const handoffBlockingCount =
    (workflowSettings.handoffBlocksOnBlockedCheckpoints ? blockingCheckpoints.length : 0) +
    (workflowSettings.handoffBlocksOnCriticalObservations ? criticalObservations.length : 0);
  const handoffReadinessReason = !checkpointRequirementMet
    ? 'La etapa activa todavía no está marcada como completada.'
    : handoffBlockingReason;
  const isHandoffReady =
    checkpointRequirementMet &&
    blockedCheckpointRequirementMet &&
    criticalObservationRequirementMet;
  const currentOwner = currentCheckpoint?.owner ?? stage?.owner ?? 'Coordinador';
  const deliverablesReadyCount = currentCourse.deliverables.filter(
    (deliverable) => deliverable.status === 'Listo',
  ).length;
  const deliverablesOpenCount = currentCourse.deliverables.filter(
    (deliverable) => deliverable.status !== 'Listo',
  ).length;
  const totalActivities = currentCourse.modules.reduce((sum, module) => sum + module.activities, 0);
  const pendingTasksCount = relatedTasks.filter((task) => task.status !== 'Lista').length;
  const pendingObservationsCount = currentCourse.observations.filter(
    (observation) => observation.status !== 'Resuelta',
  ).length;
  const resolvedObservationsCount = currentCourse.observations.length - pendingObservationsCount;
  const totalProductsCount = currentCourse.products.length;
  const approvedProductsCount = currentCourse.products.filter(
    (product) => product.status === 'Aprobado',
  ).length;
  const curatedResources = relatedResources.filter((resource) => resource.kind === 'Curado');
  const ownedResources = relatedResources.filter((resource) => resource.kind === 'Propio');
  const upcomingMilestones = currentCourse.schedule
    .slice()
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 4);
  const teamCoverage = appData.roles
    .map((roleName) => ({
      role: roleName,
      member: currentCourse.team.find((member) => member.role === roleName),
    }))
    .filter((item) => item.member);
  const historyFeed = currentCourse.auditLog
    .slice()
    .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt));

  function countProductsByStage(stageId: CourseProductStage) {
    return currentCourse.products.filter((product) => product.stage === stageId).length;
  }

  const planningStatus =
    currentCourse.team.length === 0
      ? 'Pendiente'
      : upcomingMilestones.length === 0
        ? 'En curso'
        : teamCoverage.length >= 3
          ? 'Listo'
          : 'En curso';
  const notificationStatus =
    currentCourse.status === 'Listo'
      ? 'Listo'
      : isHandoffReady
        ? 'En curso'
        : !checkpointRequirementMet || handoffBlockingCount > 0
          ? 'Pendiente'
          : 'En curso';
  const workflowStages = [
    {
      key: 'architecture',
      stageId: 'arquitectura',
      section: 'architecture' as CourseSection,
      title: 'Crear arquitectura',
      owner: 'Diseñador instruccional',
      status: currentCourse.stageNotes.architecture.status,
      summary: `${currentCourse.modules.length} módulos y ${countProductsByStage('architecture')} artefactos instruccionales`,
      description:
        'Define la estructura pedagógica del curso, el mapa de módulos, las actividades y la secuencia didáctica.',
      checklist: ['Mapa modular', 'Actividades y rúbricas', 'Blueprint instruccional'],
      actionLabel: 'Abrir arquitectura',
    },
    {
      key: 'planning',
      stageId: 'planeacion',
      section: 'planning' as CourseSection,
      title: 'Asignar equipo',
      owner: 'Coordinador',
      status: planningStatus,
      summary: `${currentCourse.team.length} miembros y ${upcomingMilestones.length} hitos visibles`,
      description:
        'Asigna responsables, distribuye carga operativa y deja listo el cronograma con dependencias y fechas.',
      checklist: ['Cobertura de roles', 'Cronograma', 'Tareas críticas'],
      actionLabel: 'Abrir planeación',
    },
    {
      key: 'production',
      stageId: 'produccion',
      section: 'production' as CourseSection,
      title: 'Producir curso',
      owner: 'Experto y equipo de producción',
      status: currentCourse.stageNotes.production.status,
      summary: `${countProductsByStage('production') + countProductsByStage('curation') + countProductsByStage('multimedia')} productos entre autoría, validación y multimedia`,
      description:
        'Aquí vive la producción real del curso: escribir actividades, validar recursos y desarrollar piezas multimedia.',
      checklist: ['Escribir', 'Validar', 'Desarrollar multimedia'],
      actionLabel: 'Abrir producción',
    },
    {
      key: 'lms',
      stageId: 'lms',
      section: 'lms' as CourseSection,
      title: 'Realizar montaje',
      owner: 'Gestor LMS',
      status: currentCourse.stageNotes.lms.status,
      summary: `${currentCourse.stageNotes.lms.evidence.length} evidencias y ${currentCourse.stageNotes.lms.blockers.length} bloqueos`,
      description:
        'Implementa la navegación, los recursos y el comportamiento técnico del curso dentro del LMS.',
      checklist: ['Montaje técnico', 'Validación de navegación', 'Ajustes de plataforma'],
      actionLabel: 'Abrir montaje',
    },
    {
      key: 'qa',
      stageId: 'calidad',
      section: 'qa' as CourseSection,
      title: 'Realizar QA',
      owner: 'Analista QA',
      status: currentCourse.stageNotes.qa.status,
      summary: `${pendingObservationsCount} observaciones pendientes y ${resolvedObservationsCount} resueltas`,
      description:
        'Revisa integridad, calidad y coherencia final del curso antes de habilitar el cierre operativo.',
      checklist: ['Checklist final', 'Hallazgos', 'Aprobación o devolución'],
      actionLabel: 'Abrir QA',
    },
    {
      key: 'notify',
      stageId: null,
      section: 'history' as CourseSection,
      title: 'Notificar',
      owner: 'Coordinador',
      status: notificationStatus,
      summary: `${relatedAlerts.length} alertas y ${historyFeed.length} eventos auditados`,
      description:
        'Cierra handoffs, deja trazabilidad y notifica al siguiente responsable o al coordinador del cierre.',
      checklist: ['Transferencia', 'Auditoría', 'Notificación'],
      actionLabel: 'Abrir historial',
    },
  ];

  const isWorkflowPage = activeSection === 'summary';
  const isFocusedStudio =
    !isWorkflowPage && experienceSettings.studioMode === 'Profundo';
  const showSummaryHero = isWorkflowPage && experienceSettings.showSummaryHero;
  const showStageRailInSummary =
    experienceSettings.stageRailVisibility === 'Solo workflow' ||
    experienceSettings.stageRailVisibility === 'Siempre';
  const showStageRailOutsideSummary = experienceSettings.stageRailVisibility === 'Siempre';
  const focusedStageMeta =
    activeSection === 'summary'
      ? null
      : activeSection === 'general'
        ? {
            eyebrow: 'Microcurrículo',
            title: 'Zona dedicada del microcurrículo',
            description:
              'Trabaja la base curricular del curso sin distraerte con indicadores globales. Aquí viven sílabus, resultados, metodología y referencias.',
            stats: [
              { label: 'Resultados', value: String(currentCourse.metadata.learningOutcomes.length) },
              { label: 'Temas', value: String(currentCourse.metadata.topics.length) },
              { label: 'Versión', value: currentCourse.metadata.currentVersion },
            ],
          }
        : activeSection === 'architecture'
          ? {
              eyebrow: 'Arquitectura',
              title: 'Zona dedicada de arquitectura',
              description:
                'Diseña módulos, actividades y la lógica instruccional del curso desde una sola capa de trabajo.',
              stats: [
                { label: 'Módulos', value: String(currentCourse.modules.length) },
                { label: 'Actividades', value: String(totalActivities) },
                { label: 'Blueprints', value: String(countProductsByStage('architecture')) },
              ],
            }
          : activeSection === 'planning'
            ? {
                eyebrow: 'Planeación',
                title: 'Zona dedicada de planeación',
                description:
                  'Asigna responsables, organiza hitos y mueve el trabajo del curso con foco operativo.',
                stats: [
                  { label: 'Equipo', value: String(currentCourse.team.length) },
                  { label: 'Tareas', value: String(pendingTasksCount) },
                  { label: 'Hitos', value: String(upcomingMilestones.length) },
                ],
              }
            : activeSection === 'production'
              ? {
                  eyebrow: 'Producción',
                  title: 'Zona dedicada de producción',
                  description:
                    'Escribe actividades, gestiona entregables y consolida productos de autoría dentro del curso.',
                  stats: [
                    { label: 'Entregables', value: String(deliverablesOpenCount) },
                    { label: 'Actividades', value: String(totalActivities) },
                    { label: 'Productos', value: String(countProductsByStage('production')) },
                  ],
                }
              : activeSection === 'resources'
                ? {
                    eyebrow: 'Recursos',
                    title: 'Zona dedicada de recursos',
                    description:
                      'Curación, multimedia y biblioteca asociada en una sola vista para trabajo editorial y documental.',
                    stats: [
                      { label: 'Curados', value: String(curatedResources.length) },
                      { label: 'Propios', value: String(ownedResources.length) },
                      {
                        label: 'Productos',
                        value: String(
                          countProductsByStage('curation') + countProductsByStage('multimedia'),
                        ),
                      },
                    ],
                  }
                : activeSection === 'lms'
                  ? {
                      eyebrow: 'LMS',
                      title: 'Zona dedicada de montaje',
                      description:
                        'Implementa y documenta el montaje técnico del curso con evidencias, checklist y ajustes de plataforma.',
                      stats: [
                        {
                          label: 'Checkpoints',
                          value: String(
                            currentCourse.stageChecklist.filter(
                              (checkpoint) => checkpoint.owner === 'Gestor LMS',
                            ).length,
                          ),
                        },
                        { label: 'Bloqueos', value: String(currentCourse.stageNotes.lms.blockers.length) },
                        { label: 'Evidencias', value: String(currentCourse.stageNotes.lms.evidence.length) },
                      ],
                    }
                  : activeSection === 'qa'
                    ? {
                        eyebrow: 'QA y validación',
                        title: 'Zona dedicada de QA',
                        description:
                          'Gestiona hallazgos, checkpoints y criterios de aprobación antes del cierre del curso.',
                        stats: [
                          { label: 'Observaciones', value: String(pendingObservationsCount) },
                          { label: 'Bloqueos', value: String(blockingCheckpoints.length) },
                          { label: 'Rúbricas', value: String(countProductsByStage('qa')) },
                        ],
                      }
                    : {
                        eyebrow: 'Historial',
                        title: 'Zona dedicada de historial',
                        description:
                          'Consulta la trazabilidad del expediente y revisa cómo evolucionó el curso a lo largo del flujo.',
                        stats: [
                          { label: 'Movimientos', value: String(historyFeed.length) },
                          { label: 'Versión', value: currentCourse.metadata.currentVersion },
                          { label: 'Cierre', value: formatDate(currentCourse.metadata.targetCloseDate) },
                        ],
                      };
  const showFocusedStageHeader =
    !isWorkflowPage && experienceSettings.showFocusedStageHeader && Boolean(focusedStageMeta);

  function goToSection(section: CourseSection) {
    navigate(buildCourseSectionPath(currentCourseSlug, section));
  }

  function cleanPreviewLine(line: string) {
    return line
      .replace(/^#+\s*/, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim();
  }

  function extractPreviewItems(body: string) {
    const lines = splitLines(body);
    const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line));
    const source = bulletLines.length > 0 ? bulletLines : lines;

    return source.map(cleanPreviewLine).filter(Boolean);
  }

  function productTemplateActionLabel(stageId: CourseProductStage) {
    switch (stageId) {
      case 'general':
        return 'Cargar sílabus base';
      case 'architecture':
        return 'Cargar blueprint';
      case 'production':
        return 'Construir por módulos';
      case 'curation':
        return 'Cargar inventario';
      case 'multimedia':
        return 'Cargar storyboard';
      case 'qa':
        return 'Cargar rúbrica base';
      default:
        return 'Cargar base';
    }
  }

  function defaultProductSummary(stageId: CourseProductStage) {
    switch (stageId) {
      case 'general':
        return 'Documento marco del curso con ficha académica, resultados, metodología y referencias.';
      case 'architecture':
        return 'Define la experiencia de aprendizaje, la secuencia pedagógica y la lógica modular del curso.';
      case 'production':
        return 'Agrupa la autoría del curso: actividades, instrucciones, recursos y materiales de trabajo.';
      case 'curation':
        return 'Consolida el inventario curado y su pertinencia pedagógica por módulo.';
      case 'multimedia':
        return 'Organiza piezas propias como HTML, audio, lecturas e infografías listas para producción.';
      case 'qa':
        return 'Establece los criterios de revisión, control de calidad y cierre del curso.';
      default:
        return 'Producto editable del expediente del curso.';
    }
  }

  function buildProductTemplate(
    stageId: CourseProductStage,
    format: CourseProductMutationInput['format'],
  ) {
    switch (stageId) {
      case 'general':
        return [
          '# Identificación del curso',
          `Institución: ${currentCourse.metadata.institution}`,
          `Programa: ${currentCourse.program}`,
          `Curso: ${currentCourse.title}`,
          `Código: ${currentCourse.code}`,
          `Modalidad: ${currentCourse.modality}`,
          `Créditos: ${currentCourse.credits}`,
          '',
          '# Resultados de aprendizaje',
          ...currentCourse.metadata.learningOutcomes.map((item) => `- ${item}`),
          '',
          '# Temas clave',
          ...currentCourse.metadata.topics.map((item) => `- ${item}`),
          '',
          '# Metodología',
          currentCourse.metadata.methodology,
          '',
          '# Evaluación',
          currentCourse.metadata.evaluation,
          '',
          '# Bibliografía base',
          ...currentCourse.metadata.bibliography.map((item) => `- ${item}`),
        ].join('\n');
      case 'architecture':
        return currentCourse.modules
          .map(
            (module, index) =>
              [
                `# Unidad ${index + 1}: ${module.title}`,
                `Objetivo de aprendizaje: ${module.learningGoal}`,
                `Actividades previstas: ${module.activities}`,
                `Recursos propios previstos: ${module.ownResources}`,
                `Recursos curados previstos: ${module.curatedResources}`,
                `Avance actual: ${module.completion}%`,
              ].join('\n'),
          )
          .join('\n\n');
      case 'production':
        return currentCourse.modules
          .map((module, index) => {
            const activities = Array.from(
              { length: Math.max(module.activities, 1) },
              (_, activityIndex) => `- Actividad ${activityIndex + 1}: describir propósito, instrucción y evidencia`,
            );

            return [
              `# Módulo ${index + 1}: ${module.title}`,
              `Objetivo: ${module.learningGoal}`,
              'Actividades:',
              ...activities,
              `Recursos propios de apoyo: ${module.ownResources}`,
              `Recursos curados de apoyo: ${module.curatedResources}`,
            ].join('\n');
          })
          .join('\n\n');
      case 'curation':
        return currentCourse.modules
          .map(
            (module, index) =>
              [
                `# Unidad ${index + 1}: ${module.title}`,
                `Propósito pedagógico: ${module.learningGoal}`,
                `Recursos curados estimados: ${module.curatedResources}`,
                '- Fuente 1:',
                '- Tipo de recurso:',
                '- Justificación didáctica:',
              ].join('\n'),
          )
          .join('\n\n');
      case 'multimedia': {
        const multimediaPieces =
          format === 'HTML'
            ? [
                '- HTML interactivo: experiencia principal',
                '- Lectura extendida: apoyo descargable',
                '- Infografía: resumen visual',
              ]
            : format === 'Pódcast'
              ? [
                  '- Pódcast principal: guion narrativo',
                  '- Cápsula de audio: refuerzo conceptual',
                  '- Pieza visual de portada: pendiente',
                ]
              : format === 'Infografía'
                ? [
                    '- Infografía vertical: estructura principal',
                    '- Pieza social complementaria: pendiente',
                    '- Texto alternativo accesible: pendiente',
                  ]
                : [
                    '- Lectura central',
                    '- Pieza complementaria',
                    '- Adaptación móvil',
                  ];

        return [
          `# Paquete ${format}`,
          'Objetivo de la pieza:',
          `${currentCourse.summary}`,
          '',
          '# Componentes',
          ...multimediaPieces,
          '',
          '# Consideraciones de experiencia',
          '- Legibilidad móvil',
          '- Coherencia con arquitectura del curso',
          '- Accesibilidad y contraste',
        ].join('\n');
      }
      case 'qa':
        return [
          '# Rúbrica de validación',
          '- Coherencia entre resultados, actividades y evaluación',
          '- Calidad instruccional y claridad de instrucciones',
          '- Uso pertinente de recursos curados y propios',
          '- Legibilidad, accesibilidad y consistencia visual',
          '- Preparación del curso para cierre y handoff',
        ].join('\n');
      default:
        return '';
    }
  }

  function applyTemplateToComposer(stageId: CourseProductStage) {
    setNewProductForm((current) => ({
      ...current,
      stage: stageId,
      summary: current.summary.trim() || defaultProductSummary(stageId),
      body: buildProductTemplate(stageId, current.format),
    }));
  }

  function applyTemplateToDraft(productId: string) {
    const draft = productDrafts[productId];

    if (!draft) {
      return;
    }

    setProductDrafts((current) => ({
      ...current,
      [productId]: {
        ...draft,
        summary: draft.summary.trim() || defaultProductSummary(draft.stage),
        body: buildProductTemplate(draft.stage, draft.format),
      },
    }));
  }

  function renderProductSupportPanel(
    product: Pick<CourseProductMutationInput, 'stage' | 'format' | 'body'>,
    onLoadTemplate?: () => void,
  ) {
    const previewItems = extractPreviewItems(product.body).slice(0, 6);

    return (
      <div className="surface-muted product-guide">
        <div className="section-heading section-heading--compact">
          <div>
            <span className="eyebrow">Guía estructurada</span>
            <h3>Edición asistida del producto</h3>
          </div>

          {onLoadTemplate ? (
            <button type="button" className="ghost-button" onClick={onLoadTemplate}>
              <span>{productTemplateActionLabel(product.stage)}</span>
            </button>
          ) : null}
        </div>

        {product.stage === 'general' ? (
          <>
            <div className="module-grid module-grid--summary">
              <div className="module-card">
                <div className="module-card__top">
                  <strong>{currentCourse.metadata.institution}</strong>
                  <span>institución</span>
                </div>
                <p>{currentCourse.program} · {currentCourse.code}</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{currentCourse.metadata.learningOutcomes.length}</strong>
                  <span>resultados</span>
                </div>
                <p>La ficha operativa ya entrega la base curricular para el sílabus.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{currentCourse.metadata.topics.length}</strong>
                  <span>temas clave</span>
                </div>
                <p>Los temas y referencias pueden convertirse en una versión completa del documento base.</p>
              </div>
            </div>

            <div className="list-stack">
              <div className="list-item">
                <div>
                  <strong>Metodología vigente</strong>
                  <p>{currentCourse.metadata.methodology}</p>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {product.stage === 'architecture' ? (
          <div className="list-stack">
            {currentCourse.modules.map((module) => (
              <div key={module.id} className="list-item">
                <div>
                  <strong>{module.title}</strong>
                  <p>{module.learningGoal}</p>
                </div>
                <div className="list-item__meta">
                  <span>{module.activities} actividades</span>
                  <span>{module.completion}% avance</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {product.stage === 'production' ? (
          <div className="list-stack">
            {currentCourse.modules.map((module) => (
              <div key={module.id} className="list-item">
                <div>
                  <strong>{module.title}</strong>
                  <p>{module.learningGoal}</p>
                </div>
                <div className="list-item__meta">
                  <span>{module.activities} actividades</span>
                  <span>{module.ownResources} propios · {module.curatedResources} curados</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {product.stage === 'curation' ? (
          <div className="list-stack">
            {currentCourse.modules.map((module) => (
              <div key={module.id} className="list-item">
                <div>
                  <strong>{module.title}</strong>
                  <p>Curación prevista para reforzar {module.learningGoal.toLowerCase()}.</p>
                </div>
                <div className="list-item__meta">
                  <span>{module.curatedResources} recursos curados</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {product.stage === 'multimedia' ? (
          <>
            <div className="module-grid module-grid--summary">
              <div className="module-card">
                <div className="module-card__top">
                  <strong>{product.format}</strong>
                  <span>salida principal</span>
                </div>
                <p>La pieza se piensa para experiencia tecnológica, legible y adaptable a móvil.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{previewItems.length}</strong>
                  <span>bloques detectados</span>
                </div>
                <p>La vista previa identifica componentes del paquete antes de pasar a LMS.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{ownedResources.length}</strong>
                  <span>activos propios</span>
                </div>
                <p>El expediente combina recursos del curso con entregables multimedia específicos.</p>
              </div>
            </div>

            <div className="module-grid module-grid--summary">
              {previewItems.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin preview disponible todavía</strong>
                  <p>Carga un storyboard base para visualizar las piezas previstas.</p>
                </div>
              ) : (
                previewItems.map((item, index) => (
                  <div key={`${product.format}-${index}`} className="module-card">
                    <div className="module-card__top">
                      <strong>Pieza {index + 1}</strong>
                      <span>{product.format}</span>
                    </div>
                    <p>{item}</p>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}

        {product.stage === 'qa' ? (
          <>
            <div className="module-grid module-grid--summary">
              <div className="module-card">
                <div className="module-card__top">
                  <strong>{pendingObservationsCount}</strong>
                  <span>hallazgos abiertos</span>
                </div>
                <p>La rúbrica dialoga con el estado real del curso y sus observaciones vivas.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{blockingCheckpoints.length}</strong>
                  <span>bloqueos</span>
                </div>
                <p>Los criterios de validación ayudan a destrabar el paso hacia el cierre o el handoff.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{previewItems.length}</strong>
                  <span>criterios</span>
                </div>
                <p>La rúbrica se visualiza como checklist vivo dentro del expediente del curso.</p>
              </div>
            </div>

            <div className="list-stack">
              {previewItems.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin criterios visibles todavía</strong>
                  <p>Carga una rúbrica base para empezar la validación estructurada del curso.</p>
                </div>
              ) : (
                previewItems.map((item, index) => (
                  <div key={`qa-${index}`} className="list-item">
                    <div>
                      <strong>Criterio {index + 1}</strong>
                      <p>{item}</p>
                    </div>
                    <div className="list-item__meta">
                      <span>{index < resolvedObservationsCount ? 'Revisado' : 'Pendiente'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  function parseHeadingSections(body: string) {
    const sections: Record<string, string[]> = {};
    let currentHeading: string | null = null;

    body.split('\n').forEach((rawLine) => {
      const line = rawLine.trimEnd();

      if (/^#\s+/.test(line)) {
        currentHeading = cleanPreviewLine(line);
        sections[currentHeading] = [];
        return;
      }

      if (currentHeading) {
        sections[currentHeading].push(line);
      }
    });

    return sections;
  }

  function parseGeneralStructuredProduct(body: string) {
    const sections = parseHeadingSections(body);
    const parsedOutcomes = extractPreviewItems(sections['Resultados de aprendizaje']?.join('\n') ?? '');
    const parsedTopics = extractPreviewItems(sections['Temas clave']?.join('\n') ?? '');
    const parsedBibliography = extractPreviewItems(sections['Bibliografía base']?.join('\n') ?? '');

    return {
      outcomes: parsedOutcomes.length > 0 ? parsedOutcomes : currentCourse.metadata.learningOutcomes,
      topics: parsedTopics.length > 0 ? parsedTopics : currentCourse.metadata.topics,
      methodology:
        sections['Metodología']?.join('\n').trim() || currentCourse.metadata.methodology,
      evaluation:
        sections['Evaluación']?.join('\n').trim() || currentCourse.metadata.evaluation,
      bibliography:
        parsedBibliography.length > 0 ? parsedBibliography : currentCourse.metadata.bibliography,
    };
  }

  function buildGeneralStructuredBody(input: {
    outcomes: string[];
    topics: string[];
    methodology: string;
    evaluation: string;
    bibliography: string[];
  }) {
    return [
      '# Identificación del curso',
      `Institución: ${currentCourse.metadata.institution}`,
      `Programa: ${currentCourse.program}`,
      `Curso: ${currentCourse.title}`,
      `Código: ${currentCourse.code}`,
      `Modalidad: ${currentCourse.modality}`,
      `Créditos: ${currentCourse.credits}`,
      '',
      '# Resultados de aprendizaje',
      ...input.outcomes.map((item) => `- ${item}`),
      '',
      '# Temas clave',
      ...input.topics.map((item) => `- ${item}`),
      '',
      '# Metodología',
      input.methodology,
      '',
      '# Evaluación',
      input.evaluation,
      '',
      '# Bibliografía base',
      ...input.bibliography.map((item) => `- ${item}`),
    ].join('\n');
  }

  function parseProductionStructuredProduct(body: string) {
    const blocks = body
      .split(/\n(?=#\s+(?:Módulo|Unidad)\s+\d+:)/)
      .map((block) => block.trim())
      .filter(Boolean);

    return currentCourse.modules.map((module, index) => {
      const block = blocks[index] ?? '';
      const lines = splitLines(block);
      const activitiesStart = lines.findIndex((line) => line.startsWith('Actividades:'));
      const activities = lines
        .slice(activitiesStart >= 0 ? activitiesStart + 1 : 0)
        .filter((line) => /^[-*]\s+/.test(line))
        .map((line) =>
          cleanPreviewLine(line)
            .replace(/^Actividad\s+\d+:\s*/i, '')
            .trim(),
        )
        .filter(Boolean);

      return {
        moduleId: module.id,
        title: module.title,
        objective: module.learningGoal,
        ownResources: module.ownResources,
        curatedResources: module.curatedResources,
        activities:
          activities.length > 0
            ? activities
            : Array.from({ length: Math.max(module.activities, 1) }, (_, activityIndex) =>
                `Actividad ${activityIndex + 1} por desarrollar`,
              ),
      };
    });
  }

  function buildProductionStructuredBody(
    modules: Array<{
      title: string;
      objective: string;
      ownResources: number;
      curatedResources: number;
      activities: string[];
    }>,
  ) {
    return modules
      .map((module, index) =>
        [
          `# Módulo ${index + 1}: ${module.title}`,
          `Objetivo: ${module.objective}`,
          'Actividades:',
          ...module.activities.map((activity) => `- ${activity}`),
          `Recursos propios de apoyo: ${module.ownResources}`,
          `Recursos curados de apoyo: ${module.curatedResources}`,
        ].join('\n'),
      )
      .join('\n\n');
  }

  type QaCriterionStatus = 'Pendiente' | 'Ajuste' | 'Cumple';

  function parseQaStructuredProduct(body: string) {
    const criteria = splitLines(body)
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => {
        const cleaned = line.replace(/^[-*]\s*/, '').trim();
        const match = cleaned.match(/^\[(Pendiente|Ajuste|Cumple)\|([0-4])\]\s+(.+)$/);

        if (match) {
          return {
            status: match[1] as QaCriterionStatus,
            score: Number.parseInt(match[2], 10),
            label: match[3].trim(),
          };
        }

        return {
          status: 'Pendiente' as QaCriterionStatus,
          score: 0,
          label: cleaned,
        };
      })
      .filter((criterion) => criterion.label);

    return criteria.length > 0
      ? criteria
      : [
          { status: 'Pendiente' as QaCriterionStatus, score: 0, label: 'Coherencia pedagógica' },
          { status: 'Pendiente' as QaCriterionStatus, score: 0, label: 'Calidad de actividades y recursos' },
          { status: 'Pendiente' as QaCriterionStatus, score: 0, label: 'Legibilidad y accesibilidad' },
        ];
  }

  function buildQaStructuredBody(
    criteria: Array<{
      status: QaCriterionStatus;
      score: number;
      label: string;
    }>,
  ) {
    return [
      '# Rúbrica de validación',
      ...criteria.map((criterion) => `- [${criterion.status}|${criterion.score}] ${criterion.label}`),
    ].join('\n');
  }

  function renderStructuredProductEditor(
    product: CourseProductMutationInput,
    onPatch: (patch: Partial<CourseProductMutationInput>) => void,
  ) {
    if (product.stage === 'general') {
      const structured = parseGeneralStructuredProduct(product.body);

      return (
        <div className="surface-muted structured-editor">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Editor nativo</span>
              <h3>Sílabus por secciones</h3>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item">
              <div>
                <strong>Identificación institucional</strong>
                <p>
                  {currentCourse.metadata.institution} · {currentCourse.program} · {currentCourse.code}
                </p>
              </div>
              <div className="list-item__meta">
                <span>{currentCourse.modality}</span>
                <span>{currentCourse.credits} créditos</span>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field field--full">
              <span>Resultados de aprendizaje</span>
              <div className="field__control field__control--textarea">
                <textarea
                  rows={4}
                  value={joinLines(structured.outcomes)}
                  onChange={(event) =>
                    onPatch({
                      body: buildGeneralStructuredBody({
                        ...structured,
                        outcomes: splitLines(event.target.value),
                      }),
                    })
                  }
                />
              </div>
            </label>

            <label className="field field--full">
              <span>Temas clave</span>
              <div className="field__control field__control--textarea">
                <textarea
                  rows={4}
                  value={joinLines(structured.topics)}
                  onChange={(event) =>
                    onPatch({
                      body: buildGeneralStructuredBody({
                        ...structured,
                        topics: splitLines(event.target.value),
                      }),
                    })
                  }
                />
              </div>
            </label>

            <label className="field field--full">
              <span>Metodología</span>
              <div className="field__control field__control--textarea">
                <textarea
                  rows={4}
                  value={structured.methodology}
                  onChange={(event) =>
                    onPatch({
                      body: buildGeneralStructuredBody({
                        ...structured,
                        methodology: event.target.value,
                      }),
                    })
                  }
                />
              </div>
            </label>

            <label className="field field--full">
              <span>Evaluación</span>
              <div className="field__control field__control--textarea">
                <textarea
                  rows={4}
                  value={structured.evaluation}
                  onChange={(event) =>
                    onPatch({
                      body: buildGeneralStructuredBody({
                        ...structured,
                        evaluation: event.target.value,
                      }),
                    })
                  }
                />
              </div>
            </label>

            <label className="field field--full">
              <span>Bibliografía base</span>
              <div className="field__control field__control--textarea">
                <textarea
                  rows={4}
                  value={joinLines(structured.bibliography)}
                  onChange={(event) =>
                    onPatch({
                      body: buildGeneralStructuredBody({
                        ...structured,
                        bibliography: splitLines(event.target.value),
                      }),
                    })
                  }
                />
              </div>
            </label>
          </div>
        </div>
      );
    }

    if (product.stage === 'production') {
      const modules = parseProductionStructuredProduct(product.body);

      return (
        <div className="surface-muted structured-editor">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Editor nativo</span>
              <h3>Actividades por módulo</h3>
            </div>
          </div>

          <div className="structured-editor__stack">
            {modules.map((module, moduleIndex) => (
              <article key={module.moduleId} className="structured-module-card">
                <div className="structured-module-card__head">
                  <div>
                    <strong>{module.title}</strong>
                    <p>{module.objective}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{module.ownResources} propios</span>
                    <span>{module.curatedResources} curados</span>
                  </div>
                </div>

                <div className="structured-editor__stack">
                  {module.activities.map((activity, activityIndex) => (
                    <div key={`${module.moduleId}-${activityIndex}`} className="task-editor task-editor--timeline">
                      <label className="field field--full">
                        <span>Actividad {activityIndex + 1}</span>
                        <div className="field__control field__control--textarea">
                          <textarea
                            rows={3}
                            value={activity}
                            onChange={(event) => {
                              const nextModules = modules.map((currentModule, currentIndex) =>
                                currentIndex === moduleIndex
                                  ? {
                                      ...currentModule,
                                      activities: currentModule.activities.map((item, currentActivityIndex) =>
                                        currentActivityIndex === activityIndex ? event.target.value : item,
                                      ),
                                    }
                                  : currentModule,
                              );

                              onPatch({
                                body: buildProductionStructuredBody(nextModules),
                              });
                            }}
                          />
                        </div>
                      </label>

                      <div className="task-editor__sidebar">
                        <button
                          type="button"
                          className="danger-button danger-button--ghost"
                          disabled={module.activities.length <= 1}
                          onClick={() => {
                            const nextModules = modules.map((currentModule, currentIndex) =>
                              currentIndex === moduleIndex
                                ? {
                                    ...currentModule,
                                    activities: currentModule.activities.filter(
                                      (_, currentActivityIndex) => currentActivityIndex !== activityIndex,
                                    ),
                                  }
                                : currentModule,
                            );

                            onPatch({
                              body: buildProductionStructuredBody(nextModules),
                            });
                          }}
                        >
                          <Trash2 size={16} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      const nextModules = modules.map((currentModule, currentIndex) =>
                        currentIndex === moduleIndex
                          ? {
                              ...currentModule,
                              activities: [
                                ...currentModule.activities,
                                `Nueva actividad ${currentModule.activities.length + 1}`,
                              ],
                            }
                          : currentModule,
                      );

                      onPatch({
                        body: buildProductionStructuredBody(nextModules),
                      });
                    }}
                  >
                    <Plus size={16} />
                    <span>Agregar actividad</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      );
    }

    if (product.stage === 'qa') {
      const criteria = parseQaStructuredProduct(product.body);
      const averageScore =
        criteria.length > 0
          ? (criteria.reduce((sum, criterion) => sum + criterion.score, 0) / criteria.length).toFixed(1)
          : '0.0';

      return (
        <div className="surface-muted structured-editor">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Editor nativo</span>
              <h3>Rúbrica por criterio</h3>
            </div>
            <span className="badge badge--outline">Promedio {averageScore}/4</span>
          </div>

          <div className="criteria-grid">
            {criteria.map((criterion, index) => (
              <article key={`criterion-${index}`} className="criteria-card">
                <label className="field field--full">
                  <span>Criterio {index + 1}</span>
                  <div className="field__control">
                    <input
                      value={criterion.label}
                      onChange={(event) => {
                        const nextCriteria = criteria.map((item, currentIndex) =>
                          currentIndex === index ? { ...item, label: event.target.value } : item,
                        );

                        onPatch({
                          body: buildQaStructuredBody(nextCriteria),
                        });
                      }}
                    />
                  </div>
                </label>

                <div className="criteria-card__meta">
                  <label className="field">
                    <span>Estado</span>
                    <div className="field__control">
                      <select
                        value={criterion.status}
                        onChange={(event) => {
                          const nextCriteria = criteria.map((item, currentIndex) =>
                            currentIndex === index
                              ? { ...item, status: event.target.value as QaCriterionStatus }
                              : item,
                          );

                          onPatch({
                            body: buildQaStructuredBody(nextCriteria),
                          });
                        }}
                      >
                        {['Pendiente', 'Ajuste', 'Cumple'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="field">
                    <span>Puntaje</span>
                    <div className="field__control">
                      <select
                        value={criterion.score}
                        onChange={(event) => {
                          const nextCriteria = criteria.map((item, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...item,
                                  score: Number.parseInt(event.target.value, 10) || 0,
                                }
                              : item,
                          );

                          onPatch({
                            body: buildQaStructuredBody(nextCriteria),
                          });
                        }}
                      >
                        {[0, 1, 2, 3, 4].map((score) => (
                          <option key={score} value={score}>
                            {score}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="danger-button danger-button--ghost"
                    disabled={criteria.length <= 1}
                    onClick={() => {
                      const nextCriteria = criteria.filter((_, currentIndex) => currentIndex !== index);

                      onPatch({
                        body: buildQaStructuredBody(nextCriteria),
                      });
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Eliminar criterio</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="action-row">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onPatch({
                  body: buildQaStructuredBody([
                    ...criteria,
                    {
                      status: 'Pendiente',
                      score: 0,
                      label: `Nuevo criterio ${criteria.length + 1}`,
                    },
                  ]),
                });
              }}
            >
              <Plus size={16} />
              <span>Agregar criterio</span>
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  async function handleCourseSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCourseSaving(true);
    setCourseError(null);

    try {
      const response = await fetch(`/api/courses?slug=${encodeURIComponent(currentCourse.slug)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(courseForm),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar el curso.');
      }

      refreshAppData();
      setIsCourseEditorOpen(false);
    } catch (error) {
      setCourseError(error instanceof Error ? error.message : 'No fue posible actualizar el curso.');
    } finally {
      setIsCourseSaving(false);
    }
  }

  async function handleMetadataSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMetadataSaving(true);
    setMetadataError(null);

    try {
      const response = await fetch(
        `/api/course-metadata?slug=${encodeURIComponent(currentCourse.slug)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(metadataForm),
        },
      );

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar la ficha operativa.');
      }

      refreshAppData();
    } catch (error) {
      setMetadataError(
        error instanceof Error ? error.message : 'No fue posible actualizar la ficha operativa.',
      );
    } finally {
      setIsMetadataSaving(false);
    }
  }

  async function handleCourseDelete() {
    const confirmed = await showConfirm({
      title: `Eliminar ${currentCourse.title}`,
      message: `Vas a eliminar el curso "${currentCourse.title}" y sus tareas asociadas. Esta acción no se puede deshacer.`,
      tone: 'warning',
      confirmLabel: 'Eliminar curso',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/courses', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slug: currentCourse.slug,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setCourseError(payload.error ?? 'No fue posible eliminar el curso.');
      return;
    }

    refreshAppData();
    window.location.assign('/courses');
  }

  async function handleTaskCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsTaskSaving(true);
    setTaskError(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(newTaskForm),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear la tarea.');
      }

      refreshAppData();
      setNewTaskForm(makeTaskForm(currentCourse.slug, currentCourse.stageId));
      setIsTaskComposerOpen(false);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'No fue posible crear la tarea.');
    } finally {
      setIsTaskSaving(false);
    }
  }

  async function handleTaskSave(taskId: string) {
    const draft = taskDrafts[taskId];

    if (!draft) {
      return;
    }

    setTaskError(null);

    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: taskId,
        ...draft,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setTaskError(payload.error ?? 'No fue posible guardar la tarea.');
      return;
    }

    refreshAppData();
  }

  async function handleTaskDelete(taskId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar tarea',
      message: 'La tarea será eliminada permanentemente. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Eliminar tarea',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/tasks', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: taskId,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setTaskError(payload.error ?? 'No fue posible eliminar la tarea.');
      return;
    }

    refreshAppData();
  }

  function updateTaskDraft<Key extends keyof TaskMutationInput>(
    taskId: string,
    key: Key,
    value: TaskMutationInput[Key],
  ) {
    setTaskDrafts((current) => ({
      ...current,
      [taskId]: {
        ...current[taskId],
        [key]: value,
      },
    }));
  }

  async function handleTimelineCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTimelineError(null);
    setIsTimelineSaving('new');

    try {
      const response = await fetch('/api/timeline', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newTimelineForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el hito.');
      }

      refreshAppData();
      setNewTimelineForm(makeTimelineForm());
      setIsTimelineComposerOpen(false);
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : 'No fue posible crear el hito.');
    } finally {
      setIsTimelineSaving(null);
    }
  }

  async function handleTimelineSave(timelineItemId: string) {
    const draft = timelineDrafts[timelineItemId];

    if (!draft) {
      return;
    }

    setTimelineError(null);
    setIsTimelineSaving(timelineItemId);

    try {
      const response = await fetch('/api/timeline', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: timelineItemId,
          ...draft,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar el hito.');
      }

      refreshAppData();
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : 'No fue posible guardar el hito.');
    } finally {
      setIsTimelineSaving(null);
    }
  }

  async function handleTimelineDelete(timelineItemId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar hito',
      message: 'El hito será retirado del cronograma visible del curso. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Eliminar hito',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setTimelineError(null);
    setIsTimelineSaving(timelineItemId);

    try {
      const response = await fetch('/api/timeline', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: timelineItemId,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible eliminar el hito.');
      }

      refreshAppData();
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : 'No fue posible eliminar el hito.');
    } finally {
      setIsTimelineSaving(null);
    }
  }

  function updateTimelineDraft<Key extends keyof TimelineItemMutationInput>(
    timelineItemId: string,
    key: Key,
    value: TimelineItemMutationInput[Key],
  ) {
    setTimelineDrafts((current) => ({
      ...current,
      [timelineItemId]: {
        ...current[timelineItemId],
        [key]: value,
      },
    }));
  }

  async function handleTeamMemberCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTeamError(null);
    setIsTeamSaving('new');

    try {
      const response = await fetch('/api/team-members', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newTeamMemberForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible agregar el responsable.');
      }

      refreshAppData();
      setNewTeamMemberForm(makeTeamMemberForm());
      setIsTeamComposerOpen(false);
    } catch (error) {
      setTeamError(
        error instanceof Error ? error.message : 'No fue posible agregar el responsable.',
      );
    } finally {
      setIsTeamSaving(null);
    }
  }

  async function handleTeamMemberSave(memberId: string) {
    const draft = teamDrafts[memberId];

    if (!draft) {
      return;
    }

    setTeamError(null);
    setIsTeamSaving(memberId);

    try {
      const response = await fetch('/api/team-members', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: memberId,
          ...draft,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar el responsable.');
      }

      refreshAppData();
    } catch (error) {
      setTeamError(
        error instanceof Error ? error.message : 'No fue posible guardar el responsable.',
      );
    } finally {
      setIsTeamSaving(null);
    }
  }

  async function handleTeamMemberDelete(memberId: string) {
    const confirmed = await showConfirm({
      title: 'Retirar responsable',
      message: 'Este responsable será retirado del equipo visible del curso. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Retirar responsable',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setTeamError(null);
    setIsTeamSaving(memberId);

    try {
      const response = await fetch('/api/team-members', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: memberId,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible retirar el responsable.');
      }

      refreshAppData();
    } catch (error) {
      setTeamError(
        error instanceof Error ? error.message : 'No fue posible retirar el responsable.',
      );
    } finally {
      setIsTeamSaving(null);
    }
  }

  function updateTeamDraft<Key extends keyof TeamMemberMutationInput>(
    memberId: string,
    key: Key,
    value: TeamMemberMutationInput[Key],
  ) {
    setTeamDrafts((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        [key]: value,
      },
    }));
  }

  async function handleModuleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModuleError(null);
    setIsModuleSaving('new');

    try {
      const response = await fetch('/api/learning-modules', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newLearningModuleForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el módulo.');
      }

      refreshAppData();
      setNewLearningModuleForm(makeLearningModuleForm());
      setIsModuleComposerOpen(false);
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'No fue posible crear el módulo.');
    } finally {
      setIsModuleSaving(null);
    }
  }

  async function handleModuleSave(moduleId: string) {
    const draft = moduleDrafts[moduleId];

    if (!draft) {
      return;
    }

    setModuleError(null);
    setIsModuleSaving(moduleId);

    try {
      const response = await fetch('/api/learning-modules', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: moduleId,
          ...draft,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar el módulo.');
      }

      refreshAppData();
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'No fue posible guardar el módulo.');
    } finally {
      setIsModuleSaving(null);
    }
  }

  async function handleModuleDelete(moduleId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar módulo',
      message: 'El módulo será retirado de la arquitectura del curso. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Eliminar módulo',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setModuleError(null);
    setIsModuleSaving(moduleId);

    try {
      const response = await fetch('/api/learning-modules', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: moduleId,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible eliminar el módulo.');
      }

      refreshAppData();
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'No fue posible eliminar el módulo.');
    } finally {
      setIsModuleSaving(null);
    }
  }

  function updateModuleDraft<Key extends keyof LearningModuleMutationInput>(
    moduleId: string,
    key: Key,
    value: LearningModuleMutationInput[Key],
  ) {
    setModuleDrafts((current) => ({
      ...current,
      [moduleId]: {
        ...current[moduleId],
        [key]: value,
      },
    }));
  }

  async function handleProductCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductError(null);
    setIsProductSaving('new');

    try {
      const response = await fetch('/api/course-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newProductForm,
          tags: newProductForm.tags.map((tag) => tag.trim()).filter(Boolean),
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el producto.');
      }

      refreshAppData();
      setProductComposerStage(null);
      setNewProductForm(makeCourseProductForm());
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'No fue posible crear el producto.');
    } finally {
      setIsProductSaving(null);
    }
  }

  async function handleProductSave(productId: string) {
    const draft = productDrafts[productId];

    if (!draft) {
      return;
    }

    setProductError(null);
    setIsProductSaving(productId);

    try {
      const response = await fetch('/api/course-products', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: productId,
          ...draft,
          tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar el producto.');
      }

      refreshAppData();
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No fue posible guardar el producto.',
      );
    } finally {
      setIsProductSaving(null);
    }
  }

  async function handleProductDelete(productId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar producto',
      message: 'Este producto será retirado del expediente editable del curso. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Eliminar producto',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setProductError(null);
    setIsProductSaving(productId);

    try {
      const response = await fetch('/api/course-products', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: productId,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible eliminar el producto.');
      }

      refreshAppData();
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No fue posible eliminar el producto.',
      );
    } finally {
      setIsProductSaving(null);
    }
  }

  function updateProductDraft<Key extends keyof CourseProductMutationInput>(
    productId: string,
    key: Key,
    value: CourseProductMutationInput[Key],
  ) {
    setProductDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [key]: value,
      },
    }));
  }

  async function handleStageNoteSave(key: CourseStageNoteKey) {
    const draft = stageNoteDrafts[key];

    if (!draft) {
      return;
    }

    setStageNoteError(null);
    setIsStageNoteSaving(key);

    try {
      const response = await fetch('/api/stage-notes', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          key,
          ...draft,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar la bitácora de etapa.');
      }

      refreshAppData();
    } catch (error) {
      setStageNoteError(
        error instanceof Error ? error.message : 'No fue posible guardar la bitácora de etapa.',
      );
    } finally {
      setIsStageNoteSaving(null);
    }
  }

  function updateStageNoteDraft<Key extends keyof CourseStageNoteMutationInput>(
    noteKey: CourseStageNoteKey,
    key: Key,
    value: CourseStageNoteMutationInput[Key],
  ) {
    setStageNoteDrafts((current) => ({
      ...current,
      [noteKey]: {
        ...current[noteKey],
        [key]: value,
      },
    }));
  }

  async function handleCheckpointSave(checkpointIndex: number) {
    const status = checkpointDrafts[checkpointIndex];

    if (!status) {
      return;
    }

    setCheckpointError(null);
    setIsCheckpointSaving(checkpointIndex);

    try {
      const response = await fetch('/api/checkpoints', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          checkpointIndex,
          status,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar el checkpoint.');
      }

      refreshAppData();
    } catch (error) {
      setCheckpointError(
        error instanceof Error ? error.message : 'No fue posible actualizar el checkpoint.',
      );
    } finally {
      setIsCheckpointSaving(null);
    }
  }

  async function handleHandoff() {
    setHandoffError(null);
    setIsHandoffSaving(true);

    try {
      const response = await fetch('/api/handoffs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible transferir el curso.');
      }

      refreshAppData();
    } catch (error) {
      setHandoffError(error instanceof Error ? error.message : 'No fue posible transferir el curso.');
    } finally {
      setIsHandoffSaving(false);
    }
  }

  function updateCheckpointDraft(index: number, status: StageCheckpointStatus) {
    setCheckpointDrafts((current) => ({
      ...current,
      [index]: status,
    }));
  }

  async function handleDeliverableCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDeliverableSaving(true);
    setDeliverableError(null);

    try {
      const response = await fetch('/api/deliverables', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newDeliverableForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el entregable.');
      }

      refreshAppData();
      setNewDeliverableForm(makeDeliverableForm(defaultDeliverableOwner));
      setIsDeliverableComposerOpen(false);
    } catch (error) {
      setDeliverableError(
        error instanceof Error ? error.message : 'No fue posible crear el entregable.',
      );
    } finally {
      setIsDeliverableSaving(false);
    }
  }

  async function handleDeliverableSave(deliverableId: string) {
    const draft = deliverableDrafts[deliverableId];

    if (!draft) {
      return;
    }

    setDeliverableError(null);

    const response = await fetch('/api/deliverables', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        courseSlug: currentCourse.slug,
        id: deliverableId,
        ...draft,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setDeliverableError(payload.error ?? 'No fue posible guardar el entregable.');
      return;
    }

    refreshAppData();
  }

  async function handleDeliverableDelete(deliverableId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar entregable',
      message: 'El entregable será eliminado del curso. Esta acción no se puede deshacer.',
      tone: 'warning',
      confirmLabel: 'Eliminar entregable',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/deliverables', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        courseSlug: currentCourse.slug,
        id: deliverableId,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setDeliverableError(payload.error ?? 'No fue posible eliminar el entregable.');
      return;
    }

    refreshAppData();
  }

  function updateDeliverableDraft<Key extends keyof DeliverableMutationInput>(
    deliverableId: string,
    key: Key,
    value: DeliverableMutationInput[Key],
  ) {
    setDeliverableDrafts((current) => ({
      ...current,
      [deliverableId]: {
        ...current[deliverableId],
        [key]: value,
      },
    }));
  }

  async function handleObservationCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsObservationSaving(true);
    setObservationError(null);

    try {
      const response = await fetch('/api/observations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newObservationForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible registrar la observación.');
      }

      refreshAppData();
      setNewObservationForm(makeObservationForm(defaultObservationRole));
      setIsObservationComposerOpen(false);
    } catch (error) {
      setObservationError(
        error instanceof Error ? error.message : 'No fue posible registrar la observación.',
      );
    } finally {
      setIsObservationSaving(false);
    }
  }

  async function handleObservationSave(observationId: string) {
    const draft = observationDrafts[observationId];

    if (!draft) {
      return;
    }

    setObservationError(null);

    const response = await fetch('/api/observations', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        courseSlug: currentCourse.slug,
        id: observationId,
        ...draft,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setObservationError(payload.error ?? 'No fue posible guardar la observación.');
      return;
    }

    refreshAppData();
  }

  async function handleObservationDelete(observationId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar observación',
      message: 'La observación será eliminada del seguimiento del curso. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Eliminar observación',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/observations', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        courseSlug: currentCourse.slug,
        id: observationId,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setObservationError(payload.error ?? 'No fue posible eliminar la observación.');
      return;
    }

    refreshAppData();
  }

  function updateObservationDraft<Key extends keyof ObservationMutationInput>(
    observationId: string,
    key: Key,
    value: ObservationMutationInput[Key],
  ) {
    setObservationDrafts((current) => ({
      ...current,
      [observationId]: {
        ...current[observationId],
        [key]: value,
      },
    }));
  }

  function renderStageNoteEditor(
    noteKey: CourseStageNoteKey,
    eyebrow: string,
    title: string,
    description: string,
  ) {
    const note = currentCourse.stageNotes[noteKey];
    const draft = stageNoteDrafts[noteKey];
    const canEdit = canEditStageNote(userRole, note.owner);
    const isEditorOpen = activeWorkspaceOverlay === `stage-note:${noteKey}`;

    return (
      <>
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h3>{title}</h3>
            </div>
            <div className="action-row">
              <span className={badgeClass(draft.status)}>{draft.status}</span>
              {canEdit ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setActiveWorkspaceOverlay(`stage-note:${noteKey}`)}
                >
                  <PencilLine size={16} />
                  <span>Editar bitácora</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item">
              <div>
                <strong>Responsable de etapa</strong>
                <p>{note.owner}</p>
              </div>
              <div className="list-item__meta">
                <span>Último ajuste {formatDate(note.updatedAt)}</span>
                <span>{note.heading}</span>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Lectura operativa</strong>
                <p>{description}</p>
              </div>
              <div className="list-item__meta">
                <span>{draft.evidence.length} evidencias</span>
                <span>{draft.blockers.length} bloqueos</span>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Resumen vigente</strong>
                <p>{draft.summary}</p>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Evidencias</strong>
                <p>{draft.evidence.join(' · ') || 'Sin evidencias registradas todavía.'}</p>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Bloqueos</strong>
                <p>{draft.blockers.join(' · ') || 'Sin bloqueos activos.'}</p>
              </div>
            </div>
          </div>
        </article>

        {canEdit && isEditorOpen ? (
          <ModalFrame
            eyebrow={eyebrow}
            title={title}
            description="La bitácora se edita en modal para preservar el foco de la página principal."
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="editor-card editor-card--task">
              <div className="form-grid">
                <label className="field">
                  <span>Estado</span>
                  <div className="field__control">
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        updateStageNoteDraft(
                          noteKey,
                          'status',
                          event.target.value as CourseStageNoteMutationInput['status'],
                        )
                      }
                    >
                      {['Pendiente', 'En curso', 'Listo'].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field field--full">
                  <span>Resumen</span>
                  <div className="field__control field__control--textarea">
                    <textarea
                      rows={4}
                      value={draft.summary}
                      onChange={(event) => updateStageNoteDraft(noteKey, 'summary', event.target.value)}
                    />
                  </div>
                </label>

                <label className="field field--full">
                  <span>Evidencias</span>
                  <div className="field__control field__control--textarea">
                    <textarea
                      rows={4}
                      value={joinLines(draft.evidence)}
                      onChange={(event) =>
                        updateStageNoteDraft(noteKey, 'evidence', splitLines(event.target.value))
                      }
                      placeholder="Una evidencia por línea"
                    />
                  </div>
                </label>

                <label className="field field--full">
                  <span>Bloqueos o dependencias</span>
                  <div className="field__control field__control--textarea">
                    <textarea
                      rows={3}
                      value={joinLines(draft.blockers)}
                      onChange={(event) =>
                        updateStageNoteDraft(noteKey, 'blockers', splitLines(event.target.value))
                      }
                      placeholder="Un bloqueo por línea"
                    />
                  </div>
                </label>
              </div>

              {stageNoteError && isStageNoteSaving === null ? (
                <p className="form-error">{stageNoteError}</p>
              ) : null}

              <div className="action-row">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={isStageNoteSaving === noteKey}
                  onClick={() => void handleStageNoteSave(noteKey)}
                >
                  <Save size={16} />
                  <span>{isStageNoteSaving === noteKey ? 'Guardando…' : 'Guardar bitácora'}</span>
                </button>
                <button type="button" className="filter-chip" onClick={closeWorkspaceOverlay}>
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          </ModalFrame>
        ) : null}
      </>
    );
  }

  function renderProductStudio(
    productStage: CourseProductStage,
    eyebrow: string,
    title: string,
    description: string,
  ) {
    const stageProducts = currentCourse.products.filter((product) => product.stage === productStage);
    const stageFormats = productFormatsForStage(productStage);
    const overlayId = `products:${productStage}`;
    const isOverlayOpen = activeWorkspaceOverlay === overlayId;
    const isComposerOpen = isOverlayOpen && productComposerStage === productStage;
    const stageApprovedCount = stageProducts.filter((product) => product.status === 'Aprobado').length;

    return (
      <>
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h3>{title}</h3>
            </div>
            <div className="action-row">
              {canCreateCourseProducts(userRole) ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setProductError(null);
                    setProductComposerStage(null);
                    setActiveWorkspaceOverlay(overlayId);
                  }}
                >
                  <PencilLine size={16} />
                  <span>Gestionar productos</span>
                </button>
              ) : null}
              <span className="badge badge--outline">
                {stageApprovedCount}/{stageProducts.length} aprobados
              </span>
            </div>
          </div>

          <p className="handoff-copy">{description}</p>

          <div className="module-grid module-grid--summary">
            <div className="module-card">
              <div className="module-card__top">
                <strong>{stageProducts.length}</strong>
                <span>productos</span>
              </div>
              <p>Esta etapa produce artefactos editables y trazables dentro del expediente del curso.</p>
            </div>

            <div className="module-card">
              <div className="module-card__top">
                <strong>{stageApprovedCount}</strong>
                <span>aprobados</span>
              </div>
              <p>La validación queda registrada por versión, responsable y estado del contenido.</p>
            </div>
          </div>

          <div className="list-stack">
            {stageProducts.length === 0 ? (
              <div className="empty-state">
                <strong>Sin productos registrados en esta etapa</strong>
                <p>Cuando el equipo empiece a producir artefactos, aparecerán aquí como resumen compacto.</p>
              </div>
            ) : (
              stageProducts.map((product) => (
                <div key={product.id} className="list-item">
                  <div>
                    <span className={productStatusBadgeClass(product.status)}>{product.status}</span>
                    <strong>{product.title}</strong>
                    <p>{product.summary}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{product.owner}</span>
                    <span>{product.version}</span>
                    <span>{product.format}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        {isOverlayOpen ? (
          <ModalFrame
            eyebrow={eyebrow}
            title={title}
            description="La edición detallada de productos vive en modal para mantener limpia la vista operativa."
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="page-stack">
              {canCreateCourseProducts(userRole) ? (
                <div className="toolbar-header">
                  <button
                    type="button"
                    className={isComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                    onClick={() => toggleProductComposer(productStage)}
                  >
                    <Plus size={16} />
                    <span>{isComposerOpen ? 'Cerrar formulario' : 'Nuevo producto'}</span>
                  </button>
                </div>
              ) : null}

              {isComposerOpen ? (
                <form className="editor-card editor-card--task" onSubmit={handleProductCreate}>
                  {renderProductSupportPanel(newProductForm, () => applyTemplateToComposer(productStage))}
                  {renderStructuredProductEditor(newProductForm, (patch) =>
                    setNewProductForm((current) => ({
                      ...current,
                      stage: productStage,
                      ...patch,
                    }))
                  )}

                  <div className="form-grid">
                    <label className="field">
                      <span>Título</span>
                      <div className="field__control">
                        <input
                          value={newProductForm.title}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Formato</span>
                      <div className="field__control">
                        <select
                          value={newProductForm.format}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              stage: productStage,
                              format: event.target.value as CourseProductMutationInput['format'],
                            }))
                          }
                        >
                          {stageFormats.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Responsable</span>
                      <div className="field__control">
                        <select
                          value={newProductForm.owner}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              stage: productStage,
                              owner: event.target.value as Role,
                            }))
                          }
                        >
                          {appData.roles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Estado</span>
                      <div className="field__control">
                        <select
                          value={newProductForm.status}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              stage: productStage,
                              status: event.target.value as CourseProductMutationInput['status'],
                            }))
                          }
                        >
                          {['Borrador', 'En revisión', 'Aprobado'].map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Versión</span>
                      <div className="field__control">
                        <input
                          value={newProductForm.version}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              stage: productStage,
                              version: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field field--full">
                      <span>Etiquetas</span>
                      <div className="field__control">
                        <input
                          value={joinTags(newProductForm.tags)}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              stage: productStage,
                              tags: splitTags(event.target.value),
                            }))
                          }
                          placeholder="sílabus, currículo, recursos"
                        />
                      </div>
                    </label>

                    <label className="field field--full">
                      <span>Resumen</span>
                      <div className="field__control field__control--textarea">
                        <textarea
                          rows={3}
                          value={newProductForm.summary}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              stage: productStage,
                              summary: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field field--full">
                      <span>Contenido del producto</span>
                      <div className="field__control field__control--textarea">
                        <textarea
                          rows={10}
                          value={newProductForm.body}
                          onChange={(event) =>
                            setNewProductForm((current) => ({
                              ...current,
                              stage: productStage,
                              body: event.target.value,
                            }))
                          }
                          placeholder="Desarrolla aquí el contenido base del producto."
                          required
                        />
                      </div>
                    </label>
                  </div>

                  <div className="action-row">
                    <button type="submit" className="cta-button" disabled={isProductSaving === 'new'}>
                      <span>{isProductSaving === 'new' ? 'Creando…' : 'Crear producto'}</span>
                    </button>
                  </div>
                </form>
              ) : null}

              {productError && isProductSaving !== 'new' ? <p className="form-error">{productError}</p> : null}

              <div className="list-stack">
                {stageProducts.length === 0 ? (
                  <div className="empty-state">
                    <strong>Sin productos registrados en esta etapa</strong>
                    <p>Cuando el equipo empiece a producir artefactos, aparecerán aquí como contenido editable.</p>
                  </div>
                ) : (
                  stageProducts.map((product) => {
                    const draft = productDrafts[product.id];
                    const isEditable = canEditCourseProduct(userRole, product.owner);

                    if (!draft || !isEditable) {
                      return (
                        <div key={product.id} className="task-editor">
                          <div>
                            <div className="task-editor__header">
                              <span className={productStatusBadgeClass(product.status)}>{product.status}</span>
                              <strong>{product.title}</strong>
                            </div>

                            {renderProductSupportPanel(product)}

                            <div className="list-stack">
                              <div className="list-item">
                                <div>
                                  <strong>Resumen</strong>
                                  <p>{product.summary}</p>
                                </div>
                                <div className="list-item__meta">
                                  <span>{product.format}</span>
                                  <span>{product.version}</span>
                                </div>
                              </div>

                              <div className="list-item">
                                <div>
                                  <strong>Contenido</strong>
                                  <p style={{ whiteSpace: 'pre-wrap' }}>{product.body}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="task-editor__sidebar">
                            <div className="task-item__meta">
                              <span>{product.owner}</span>
                              <span>{formatDate(product.updatedAt)}</span>
                            </div>
                            <div className="task-item__meta">
                              <span>{productStageLabel(product.stage)}</span>
                              <span>{joinTags(product.tags) || 'Sin tags'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={product.id} className="task-editor">
                        <div>
                          <div className="task-editor__header">
                            <span className={productStatusBadgeClass(draft.status)}>{draft.status}</span>
                            <strong>{product.title}</strong>
                          </div>

                          {renderProductSupportPanel(draft, () => applyTemplateToDraft(product.id))}
                          {renderStructuredProductEditor(draft, (patch) =>
                            setProductDrafts((current) => ({
                              ...current,
                              [product.id]: {
                                ...current[product.id],
                                ...patch,
                              },
                            }))
                          )}

                          <div className="form-grid">
                            <label className="field">
                              <span>Título</span>
                              <div className="field__control">
                                <input
                                  value={draft.title}
                                  onChange={(event) =>
                                    updateProductDraft(product.id, 'title', event.target.value)
                                  }
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span>Formato</span>
                              <div className="field__control">
                                <select
                                  value={draft.format}
                                  onChange={(event) =>
                                    updateProductDraft(
                                      product.id,
                                      'format',
                                      event.target.value as CourseProductMutationInput['format'],
                                    )
                                  }
                                >
                                  {stageFormats.map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field">
                              <span>Responsable</span>
                              <div className="field__control">
                                <select
                                  value={draft.owner}
                                  onChange={(event) =>
                                    updateProductDraft(
                                      product.id,
                                      'owner',
                                      event.target.value as Role,
                                    )
                                  }
                                >
                                  {appData.roles.map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field">
                              <span>Estado</span>
                              <div className="field__control">
                                <select
                                  value={draft.status}
                                  onChange={(event) =>
                                    updateProductDraft(
                                      product.id,
                                      'status',
                                      event.target.value as CourseProductMutationInput['status'],
                                    )
                                  }
                                >
                                  {['Borrador', 'En revisión', 'Aprobado'].map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field">
                              <span>Versión</span>
                              <div className="field__control">
                                <input
                                  value={draft.version}
                                  onChange={(event) =>
                                    updateProductDraft(product.id, 'version', event.target.value)
                                  }
                                />
                              </div>
                            </label>

                            <label className="field field--full">
                              <span>Etiquetas</span>
                              <div className="field__control">
                                <input
                                  value={joinTags(draft.tags)}
                                  onChange={(event) =>
                                    updateProductDraft(product.id, 'tags', splitTags(event.target.value))
                                  }
                                />
                              </div>
                            </label>

                            <label className="field field--full">
                              <span>Resumen</span>
                              <div className="field__control field__control--textarea">
                                <textarea
                                  rows={3}
                                  value={draft.summary}
                                  onChange={(event) =>
                                    updateProductDraft(product.id, 'summary', event.target.value)
                                  }
                                />
                              </div>
                            </label>

                            <label className="field field--full">
                              <span>Contenido del producto</span>
                              <div className="field__control field__control--textarea">
                                <textarea
                                  rows={10}
                                  value={draft.body}
                                  onChange={(event) =>
                                    updateProductDraft(product.id, 'body', event.target.value)
                                  }
                                />
                              </div>
                            </label>
                          </div>
                        </div>

                        <div className="task-editor__sidebar">
                          <div className="task-item__meta">
                            <span>{draft.owner}</span>
                            <span>{formatDate(product.updatedAt)}</span>
                          </div>
                          <div className="task-item__meta">
                            <span>{productStageLabel(draft.stage)}</span>
                            <span>{draft.format}</span>
                          </div>

                          <button
                            type="button"
                            className="ghost-button"
                            disabled={isProductSaving === product.id}
                            onClick={() => void handleProductSave(product.id)}
                          >
                            <Save size={16} />
                            <span>{isProductSaving === product.id ? 'Guardando…' : 'Guardar'}</span>
                          </button>

                          {canDeleteCourseProducts(userRole) ? (
                            <button
                              type="button"
                              className="danger-button danger-button--ghost"
                              disabled={isProductSaving === product.id}
                              onClick={() => void handleProductDelete(product.id)}
                            >
                              <Trash2 size={16} />
                              <span>Eliminar</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </ModalFrame>
        ) : null}
      </>
    );
  }

  return (
    <div className={isFocusedStudio ? 'page-stack workspace-page workspace-page--focus' : 'page-stack workspace-page'}>
      {showSummaryHero ? (
      <section className="surface workspace-hero">
        <div className="workspace-hero__copy">
          <div className="workspace-hero__badges">
            <span className={badgeClass(course.status)}>{course.status}</span>
            <span className={`badge badge--${stage?.tone ?? 'ink'}`}>{stage?.name ?? course.stageId}</span>
          </div>

          <span className="eyebrow">{course.code}</span>
          <h3>{course.title}</h3>
          <p>{course.summary}</p>

          <div className="course-meta-strip">
            <span>{course.faculty}</span>
            <span>{course.program}</span>
            <span>{course.modality}</span>
            <span>{course.credits} créditos</span>
          </div>

          <div className="hero-points">
            <div>
              <strong>{course.pulse.velocity}%</strong>
              <span>velocidad</span>
            </div>
            <div>
              <strong>{course.pulse.quality}%</strong>
              <span>calidad</span>
            </div>
            <div>
              <strong>{course.pulse.alignment}%</strong>
              <span>alineación</span>
            </div>
          </div>

          {canManageCourses(userRole) ? (
            <div className="hero-actions">
              <button
                type="button"
                className={isCourseEditorOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsCourseEditorOpen(true)}
              >
                <PencilLine size={16} />
                <span>Editar curso</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="workspace-hero__summary">
          <ProgressRing
            value={course.progress}
            label="Avance del curso"
            detail={course.nextMilestone}
          />
          <div className="hero-mini surface-muted">
            <span className="eyebrow">Último movimiento</span>
            <strong>{formatLongDate(course.updatedAt)}</strong>
            <p>El flujo está en {stage?.name?.toLowerCase() ?? 'curso'} y el siguiente paso depende del equipo actual.</p>
          </div>
        </div>
      </section>
      ) : null}

      <section
        className={
          isWorkflowPage
            ? 'surface section-card section-card--compact course-sections'
            : isFocusedStudio
              ? 'course-sections course-sections--focus'
              : 'surface section-card section-card--compact course-sections'
        }
      >
      {isWorkflowPage ? (
        <div className="section-heading section-heading--compact">
          <div>
            <span className="eyebrow">Workflow</span>
            <h3>Ruta operativa y expediente del curso</h3>
          </div>
        </div>
        ) : null}

        <div className="segmented-control segmented-control--wide">
          {[
            ['summary', 'Workflow'],
            ['general', 'Microcurrículo'],
            ['architecture', 'Arquitectura'],
            ['planning', 'Planeación'],
            ['production', 'Producción'],
            ['resources', 'Recursos'],
            ['lms', 'LMS'],
            ['qa', 'QA y validación'],
            ['history', 'Historial'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                activeSection === value
                  ? 'segmented-control__button is-active'
                  : 'segmented-control__button'
              }
              onClick={() => goToSection(value as CourseSection)}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {showFocusedStageHeader && focusedStageMeta ? (
        <section className="surface section-card section-card--compact workspace-focus-head">
          <div className="workspace-focus-head__top">
            <div className="workspace-focus-head__copy">
              <div className="workspace-focus-head__badges">
                <span className="eyebrow">{focusedStageMeta.eyebrow}</span>
                <span className={badgeClass(currentCourse.status)}>{currentCourse.status}</span>
                <span className={`badge badge--${stage?.tone ?? 'ink'}`}>
                  {stage?.name ?? currentCourse.stageId}
                </span>
              </div>
              <h3>{focusedStageMeta.title}</h3>
            </div>

            <div className="workspace-focus-head__actions">
              {activeSection === 'general' && canManageCourses(userRole) ? (
                <button
                  type="button"
                  className={isCourseEditorOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                  onClick={() => setIsCourseEditorOpen(true)}
                >
                  <PencilLine size={16} />
                  <span>Editar microcurrículo</span>
                </button>
              ) : null}

              <Link to={`/courses/${currentCourse.slug}`} className="ghost-button">
                <span>Volver al workflow</span>
              </Link>
            </div>
          </div>

          <div className="workspace-focus-head__meta">
            <span className="badge badge--outline">{currentCourse.code}</span>
            <span>{currentCourse.title}</span>
            <span>{currentCourse.faculty}</span>
            <span>{currentCourse.program}</span>
            {focusedStageMeta.stats.map((item) => (
              <span key={item.label}>
                {item.label}: <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {activeSection === 'general' && isCourseEditorOpen ? (
        <ModalFrame
          eyebrow="Curso"
          title={`Editar microcurrículo · ${currentCourse.title}`}
          description="La edición se resuelve en modal para mantener la página como zona de trabajo enfocada."
          width="xl"
          onClose={() => setIsCourseEditorOpen(false)}
        >
          <div className="page-stack">
          <form className="editor-card" onSubmit={handleCourseSave}>
            <div className="editor-card__header">
              <div>
                <span className="eyebrow">Edición</span>
                <h3>Ajustar ficha del curso</h3>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Título</span>
                <div className="field__control">
                  <input
                    value={courseForm.title}
                    onChange={(event) => updateCourseDraftField('title', event.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Código</span>
                <div className="field__control">
                  <input
                    value={courseForm.code}
                    onChange={(event) => updateCourseDraftField('code', event.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Institución</span>
                <div className="field__control">
                  <select
                    value={courseForm.institution}
                    onChange={(event) => updateCourseDraftField('institution', event.target.value)}
                    required
                  >
                    {institutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Facultad</span>
                <div className="field__control">
                  <select
                    value={courseForm.faculty}
                    onChange={(event) => updateCourseDraftField('faculty', event.target.value)}
                    required
                  >
                    {facultyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Programa</span>
                <div className="field__control">
                  <select
                    value={courseForm.program}
                    onChange={(event) => updateCourseDraftField('program', event.target.value)}
                    required
                  >
                    {programOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Periodo académico</span>
                <div className="field__control">
                  <select
                    value={courseForm.academicPeriod}
                    onChange={(event) => updateCourseDraftField('academicPeriod', event.target.value)}
                    required
                  >
                    {academicPeriodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Tipo de curso</span>
                <div className="field__control">
                  <select
                    value={courseForm.courseType}
                    onChange={(event) => updateCourseDraftField('courseType', event.target.value)}
                    required
                  >
                    {courseTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Modalidad</span>
                <div className="field__control">
                  <input
                    value={courseForm.modality}
                    onChange={(event) => updateCourseDraftField('modality', event.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Créditos</span>
                <div className="field__control">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={courseForm.credits}
                    onChange={(event) =>
                      updateCourseDraftField(
                        'credits',
                        Number.parseInt(event.target.value, 10) || 1,
                      )
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Etapa</span>
                <div className="field__control">
                  <select
                    value={courseForm.stageId}
                    onChange={(event) => updateCourseDraftField('stageId', event.target.value)}
                  >
                    {appData.stages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Estado</span>
                <div className="field__control">
                  <select
                    value={courseForm.status}
                    onChange={(event) =>
                      updateCourseDraftField(
                        'status',
                        event.target.value as CourseMutationInput['status'],
                      )
                    }
                  >
                    {['En ritmo', 'En revisión', 'Riesgo', 'Bloqueado', 'Listo'].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--full">
                <span>Próximo hito</span>
                <div className="field__control">
                  <input
                    value={courseForm.nextMilestone}
                    onChange={(event) => updateCourseDraftField('nextMilestone', event.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Resumen</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={4}
                    value={courseForm.summary}
                    onChange={(event) => updateCourseDraftField('summary', event.target.value)}
                    required
                  />
                </div>
              </label>
            </div>

            {courseError ? <p className="form-error">{courseError}</p> : null}

            <div className="action-row">
              <button type="submit" className="cta-button" disabled={isCourseSaving}>
                <span>{isCourseSaving ? 'Guardando…' : 'Guardar cambios'}</span>
              </button>
              <button type="button" className="filter-chip" onClick={() => setIsCourseEditorOpen(false)}>
                <span>Cancelar</span>
              </button>

              <button type="button" className="danger-button" onClick={() => void handleCourseDelete()}>
                <Trash2 size={16} />
                <span>Eliminar curso</span>
              </button>
            </div>
          </form>

          <form className="editor-card" onSubmit={handleMetadataSave}>
            <div className="editor-card__header">
              <div>
                <span className="eyebrow">Ficha operativa</span>
                <h3>Metadatos y criterios académicos</h3>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Institución</span>
                <div className="field__control">
                  <select
                    value={metadataForm.institution}
                    onChange={(event) => {
                      updateCourseDraftField('institution', event.target.value);
                      setMetadataForm((current) => ({
                        ...current,
                        institution: event.target.value,
                      }));
                    }}
                    required
                  >
                    {institutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Nombre corto</span>
                <div className="field__control">
                  <input
                    value={metadataForm.shortName}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        shortName: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Semestre</span>
                <div className="field__control">
                  <input
                    value={metadataForm.semester}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        semester: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Periodo académico</span>
                <div className="field__control">
                  <select
                    value={metadataForm.academicPeriod}
                    onChange={(event) => {
                      updateCourseDraftField('academicPeriod', event.target.value);
                      setMetadataForm((current) => ({
                        ...current,
                        academicPeriod: event.target.value,
                      }));
                    }}
                    required
                  >
                    {academicPeriodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Tipo de curso</span>
                <div className="field__control">
                  <select
                    value={metadataForm.courseType}
                    onChange={(event) => {
                      updateCourseDraftField('courseType', event.target.value);
                      setMetadataForm((current) => ({
                        ...current,
                        courseType: event.target.value,
                      }));
                    }}
                    required
                  >
                    {courseTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Cierre objetivo</span>
                <div className="field__control">
                  <input
                    type="date"
                    value={metadataForm.targetCloseDate}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        targetCloseDate: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Versión</span>
                <div className="field__control">
                  <input
                    value={metadataForm.currentVersion}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        currentVersion: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Prioridad</span>
                <div className="field__control">
                  <select
                    value={metadataForm.priority}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        priority: event.target.value as CourseMetadataMutationInput['priority'],
                      }))
                    }
                  >
                    {['Alta', 'Media', 'Baja'].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Riesgo</span>
                <div className="field__control">
                  <select
                    value={metadataForm.riskLevel}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        riskLevel: event.target.value as CourseMetadataMutationInput['riskLevel'],
                      }))
                    }
                  >
                    {['Bajo', 'Medio', 'Alto'].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <div className="field field--full">
                <span>Lineamientos pedagógicos activos</span>
                <div className="list-stack">
                  {institutionGuidelines.length > 0 ? (
                    institutionGuidelines.map((guideline) => (
                      <p key={guideline} className="institution-structure-summary">
                        {guideline}
                      </p>
                    ))
                  ) : (
                    <p className="institution-structure-summary">
                      Esta institución no tiene lineamientos pedagógicos configurados todavía.
                    </p>
                  )}
                </div>
              </div>

              <label className="field field--full">
                <span>Metodología</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={3}
                    value={metadataForm.methodology}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        methodology: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Evaluación</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={3}
                    value={metadataForm.evaluation}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        evaluation: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Resultados de aprendizaje</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={4}
                    value={joinLines(metadataForm.learningOutcomes)}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        learningOutcomes: splitLines(event.target.value),
                      }))
                    }
                    placeholder="Un resultado por línea"
                    required
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Temas clave</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={3}
                    value={joinLines(metadataForm.topics)}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        topics: splitLines(event.target.value),
                      }))
                    }
                    placeholder="Un tema por línea"
                    required
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Bibliografía base</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={4}
                    value={joinLines(metadataForm.bibliography)}
                    onChange={(event) =>
                      setMetadataForm((current) => ({
                        ...current,
                        bibliography: splitLines(event.target.value),
                      }))
                    }
                    placeholder="Una referencia por línea"
                    required
                  />
                </div>
              </label>
            </div>

            {metadataError ? <p className="form-error">{metadataError}</p> : null}

            <div className="action-row">
              <button type="submit" className="cta-button" disabled={isMetadataSaving}>
                <span>{isMetadataSaving ? 'Guardando…' : 'Guardar ficha operativa'}</span>
              </button>
              <button type="button" className="filter-chip" onClick={() => setIsCourseEditorOpen(false)}>
                <span>Cerrar</span>
              </button>
            </div>
          </form>
          </div>
        </ModalFrame>
      ) : null}

      {activeSection === 'summary' ? (
        <section className="surface section-card section-card--compact">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Workflow del curso</span>
              <h3>Etapas operativas desde arquitectura hasta notificación</h3>
            </div>
          </div>

          <p className="section-lead">
            Entra al flujo de trabajo real del curso y avanza por etapas: arquitectura, equipo,
            producción, montaje, QA y cierre con notificación.
          </p>

          {workflowSettings.showWorkflowStageCards ? (
            <div className="workflow-stage-grid">
              {workflowStages.map((item) => {
                const isCurrentStage = item.stageId ? currentCourse.stageId === item.stageId : false;

                return (
                  <article
                    key={item.key}
                    className={
                      activeSection === item.section
                        ? 'surface-muted workflow-stage-card workflow-stage-card--active'
                        : 'surface-muted workflow-stage-card'
                    }
                  >
                    <div className="workflow-stage-card__top">
                      <div>
                        <span className="eyebrow">{item.owner}</span>
                        <h4>{item.title}</h4>
                      </div>

                      <div className="workflow-stage-card__badges">
                        <span className={badgeClass(item.status)}>{item.status}</span>
                        {isCurrentStage ? <span className="badge badge--outline">Actual</span> : null}
                      </div>
                    </div>

                    <p>{item.description}</p>

                    <div className="workflow-stage-card__meta">
                      <span>{item.summary}</span>
                      <span>{item.owner}</span>
                    </div>

                    <ul className="workflow-stage-card__list">
                      {item.checklist.map((checkpoint) => (
                        <li key={checkpoint}>{checkpoint}</li>
                      ))}
                    </ul>

                    <div className="workflow-stage-card__actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => goToSection(item.section)}
                      >
                        <span>{item.actionLabel}</span>
                        <MoveRight size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {showStageRailInSummary ? <StageRail items={currentCourse.stageChecklist} /> : null}

          <div className="module-grid module-grid--summary">
            <div className="module-card">
              <div className="module-card__top">
                <strong>{currentCourse.code}</strong>
                <span>ID operativo</span>
              </div>
              <p>{courseRouteLabel}</p>
            </div>

            <div className="module-card">
              <div className="module-card__top">
                <strong>{relatedAlerts.length}</strong>
                <span>alertas abiertas</span>
              </div>
              <p>Las alertas activas acompañan el curso y orientan la siguiente intervención del equipo.</p>
            </div>

            <div className="module-card">
              <div className="module-card__top">
                <strong>{relatedTasks.length}</strong>
                <span>tareas asociadas</span>
              </div>
              <p>La cola operativa del curso se mantiene trazada por etapa, responsable y fecha objetivo.</p>
            </div>

            <div className="module-card">
              <div className="module-card__top">
                <strong>{totalProductsCount}</strong>
                <span>productos editables</span>
              </div>
              <p>El curso ya concentra sílabus, guías, recursos y rúbricas dentro del mismo expediente.</p>
            </div>

            <div className="module-card">
              <div className="module-card__top">
                <strong>{currentOwner}</strong>
                <span>responsable actual</span>
              </div>
              <p>El expediente del curso conserva responsables, handoffs y continuidad del proceso.</p>
            </div>
          </div>

          <div className="workspace-grid workspace-grid--summary">
            <article className="surface section-card">
              <div className="section-heading section-heading--compact">
                <div>
                  <span className="eyebrow">Pendientes clave</span>
                  <h3>Qué requiere atención ahora</h3>
                </div>
              </div>

              <div className="list-stack">
                <div className="list-item">
                  <div>
                    <strong>{pendingTasksCount} tareas abiertas</strong>
                    <p>La planeación y el seguimiento operativo del curso siguen activos.</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{deliverablesOpenCount} entregables en curso</span>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <strong>{pendingObservationsCount} observaciones pendientes</strong>
                    <p>Las devoluciones y hallazgos todavía vigentes afectan el avance del expediente.</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{criticalObservations.length} críticas</span>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <strong>{upcomingMilestones[0]?.label ?? 'Sin hito inmediato'}</strong>
                    <p>{upcomingMilestones[0] ? formatLongDate(upcomingMilestones[0].dueDate) : 'Configura un cronograma para el curso.'}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{stage?.name ?? currentCourse.stageId}</span>
                  </div>
                </div>
              </div>
            </article>

            {workflowSettings.showQuickAccessPanel ? (
              <article className="surface section-card">
                <div className="section-heading section-heading--compact">
                  <div>
                    <span className="eyebrow">Acceso rápido</span>
                    <h3>Ir directo a la siguiente operación</h3>
                  </div>
                </div>

                <div className="chip-row">
                  <button type="button" className="filter-chip" onClick={() => goToSection('planning')}>
                    Planeación
                  </button>
                  <button type="button" className="filter-chip" onClick={() => goToSection('production')}>
                    Producción
                  </button>
                  <button type="button" className="filter-chip" onClick={() => goToSection('resources')}>
                    Recursos
                  </button>
                  <button type="button" className="filter-chip" onClick={() => goToSection('qa')}>
                    QA y validación
                  </button>
                  <button type="button" className="filter-chip" onClick={() => goToSection('history')}>
                    Historial
                  </button>
                </div>

                <div className="flow-glance flow-glance--compact">
                  <div className="flow-glance__item">
                    <strong>{deliverablesReadyCount}/{currentCourse.deliverables.length || 1}</strong>
                    <span>entregables listos</span>
                    <p>La producción académica y multimedia ya deja rastro de avance dentro del curso.</p>
                  </div>
                  <div className="flow-glance__item">
                    <strong>{ownedResources.length + curatedResources.length}</strong>
                    <span>recursos vinculados</span>
                    <p>Los recursos propios y curados acompañan el expediente y la arquitectura del curso.</p>
                  </div>
                  <div className="flow-glance__item">
                    <strong>{approvedProductsCount}/{totalProductsCount || 1}</strong>
                    <span>productos aprobados</span>
                    <p>El curso ya combina seguimiento operativo con producción real de artefactos dentro de la plataforma.</p>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeSection === 'general' ? (
        <section className="workspace-grid">
          {renderProductStudio(
            'general',
            'Microcurrículo y base curricular',
            'Productos nucleares del curso',
            'Aquí se crean, editan y versionan el sílabus, microcurrículo y demás documentos fundacionales del curso.',
          )}
        </section>
      ) : null}

      {activeSection === 'qa' ? (
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Flujo</span>
            <h3>Ruta completa del curso</h3>
          </div>
          <Compass size={18} />
        </div>

        {showStageRailOutsideSummary ? <StageRail items={currentCourse.stageChecklist} /> : null}

        <div className="handoff-grid">
          <article className="surface-muted handoff-card">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">HANDOFF</span>
                <h3>Transferencia entre etapas</h3>
              </div>
            </div>

            <div className="handoff-metrics">
              <div className="handoff-metric">
                <span>Etapa actual</span>
                <strong>{stage?.name ?? currentCourse.stageId}</strong>
              </div>
              <div className="handoff-metric">
                <span>Siguiente responsable</span>
                <strong>{nextStage?.owner ?? 'Cierre final'}</strong>
              </div>
              <div className="handoff-metric">
                <span>Bloqueos</span>
                <strong>{handoffBlockingCount}</strong>
              </div>
              <div className="handoff-metric">
                <span>Alertas del curso</span>
                <strong>{relatedAlerts.length}</strong>
              </div>
            </div>

            <p className="handoff-copy">
              {nextStage
                ? `Cuando la etapa actual quede completa, el curso puede transferirse a ${nextStage.name} y se notificará al siguiente responsable.`
                : 'Este curso está en la última etapa. Al cerrar el handoff quedará listo para publicación o activación.'}
            </p>

            {handoffReadinessReason ? (
              <div className="empty-state handoff-state">
                <strong>El handoff todavía no está listo</strong>
                <p>{handoffReadinessReason}</p>
              </div>
            ) : (
              <div className="empty-state handoff-state">
                <strong>Ruta despejada para la transferencia</strong>
                <p>
                  Marca la etapa activa como completada y luego transfiere el curso para generar la siguiente activación.
                </p>
              </div>
            )}

            {handoffError ? <p className="form-error">{handoffError}</p> : null}

            {canManageHandoffs(userRole) ? (
              <div className="action-row">
                <button
                  type="button"
                  className="cta-button"
                  disabled={!isHandoffReady || isHandoffSaving}
                  onClick={() => void handleHandoff()}
                >
                  <span>
                    {isHandoffSaving
                      ? 'Transfiriendo…'
                      : nextStage
                        ? `Transferir a ${nextStage.name}`
                        : 'Cerrar curso'}
                  </span>
                </button>
              </div>
            ) : null}
          </article>

          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Checkpoints</span>
              <h3>Control por etapa</h3>
            </div>
            {currentCourse.stageChecklist.some((checkpoint) =>
              canOperateStageCheckpoint(userRole, checkpoint.owner),
            ) ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setActiveWorkspaceOverlay('checkpoints')}
              >
                <PencilLine size={16} />
                <span>Gestionar checkpoints</span>
              </button>
            ) : null}
          </div>

          <div className="list-stack checkpoint-stack">
            {currentCourse.stageChecklist.map((checkpoint, index) => {
              const draftStatus = checkpointDrafts[index] ?? checkpoint.status;
              const stageMeta = appData.stages[index];

              return (
                <div key={checkpoint.id} className="list-item">
                  <div>
                    <span className={checkpointBadgeClass(draftStatus)}>
                      {checkpointStatusLabel(draftStatus)}
                    </span>
                    <strong>{checkpoint.label}</strong>
                    <p>{stageMeta?.description ?? 'Punto de control de la etapa actual del curso.'}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{checkpoint.owner}</span>
                    <span>Fase {index + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {checkpointError ? <p className="form-error">{checkpointError}</p> : null}

        {activeWorkspaceOverlay === 'checkpoints' ? (
          <ModalFrame
            eyebrow="Workflow"
            title="Gestionar checkpoints"
            description="Los puntos de control se administran en modal para no recargar la vista principal del curso."
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="list-stack checkpoint-stack">
              {currentCourse.stageChecklist.map((checkpoint, index) => {
                const draftStatus = checkpointDrafts[index] ?? checkpoint.status;
                const isEditable = canOperateStageCheckpoint(userRole, checkpoint.owner);
                const stageMeta = appData.stages[index];

                return (
                  <div key={checkpoint.id} className="task-editor checkpoint-editor">
                    <div>
                      <div className="task-editor__header">
                        <span className={checkpointBadgeClass(draftStatus)}>
                          {checkpointStatusLabel(draftStatus)}
                        </span>
                        <strong>{checkpoint.label}</strong>
                      </div>

                      <p>{stageMeta?.description ?? 'Punto de control de la etapa actual del curso.'}</p>

                      <div className="list-item__meta">
                        <span>{checkpoint.owner}</span>
                        <span>Fase {index + 1}</span>
                      </div>
                    </div>

                    <div className="task-editor__sidebar">
                      {isEditable ? (
                        <>
                          <label className="field">
                            <span>Estado</span>
                            <div className="field__control">
                              <select
                                value={draftStatus}
                                onChange={(event) =>
                                  updateCheckpointDraft(
                                    index,
                                    event.target.value as StageCheckpointStatus,
                                  )
                                }
                              >
                                {[
                                  ['pending', 'Pendiente'],
                                  ['active', 'Activa'],
                                  ['done', 'Completada'],
                                  ['blocked', 'Bloqueada'],
                                ].map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>

                          <button
                            type="button"
                            className="ghost-button"
                            disabled={isCheckpointSaving === index}
                            onClick={() => void handleCheckpointSave(index)}
                          >
                            <Save size={16} />
                            <span>{isCheckpointSaving === index ? 'Guardando…' : 'Guardar'}</span>
                          </button>
                        </>
                      ) : (
                        <div className="task-item__meta">
                          <span>{checkpoint.owner}</span>
                          <span>{checkpointStatusLabel(draftStatus)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ModalFrame>
        ) : null}
      </section>
      ) : null}

      {['architecture', 'planning', 'production', 'resources', 'lms', 'qa'].includes(activeSection) ? (
      <section className="workspace-grid">
        {activeSection === 'production' ? (
        <>
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Entrega</span>
              <h3>Entregables activos</h3>
            </div>
            <div className="action-row">
              {canCreateDeliverables(userRole) ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setActiveWorkspaceOverlay('deliverables')}
                >
                  <PencilLine size={16} />
                  <span>Gestionar entregables</span>
                </button>
              ) : null}
              <Flag size={18} />
            </div>
          </div>

          <div className="list-stack">
            {course.deliverables.length === 0 ? (
              <div className="empty-state">
                <strong>Sin entregables registrados</strong>
                <p>Cuando el curso tenga piezas activas, aparecerán aquí con responsable y fecha.</p>
              </div>
            ) : (
              course.deliverables.map((deliverable) => {
                return (
                  <div key={deliverable.id} className="list-item">
                    <div>
                      <span className={badgeClass(deliverable.status)}>{deliverable.status}</span>
                      <strong>{deliverable.title}</strong>
                      <p>{deliverable.note}</p>
                    </div>
                    <div className="list-item__meta">
                      <span>{deliverable.owner}</span>
                      <span>Vence {formatDate(deliverable.dueDate)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        {activeWorkspaceOverlay === 'deliverables' ? (
          <ModalFrame
            eyebrow="Producción"
            title="Gestionar entregables"
            description="Los entregables se crean y editan en modal para no saturar la vista operativa."
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="page-stack">
              <div className="toolbar-header">
                <button
                  type="button"
                  className={
                    isDeliverableComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'
                  }
                  onClick={() => setIsDeliverableComposerOpen((current) => !current)}
                >
                  <Plus size={16} />
                  <span>{isDeliverableComposerOpen ? 'Ocultar formulario' : 'Nuevo entregable'}</span>
                </button>
              </div>

              {isDeliverableComposerOpen ? (
                <form className="editor-card editor-card--task" onSubmit={handleDeliverableCreate}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Título</span>
                      <div className="field__control">
                        <input
                          value={newDeliverableForm.title}
                          onChange={(event) =>
                            setNewDeliverableForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Responsable</span>
                      <div className="field__control">
                        <select
                          value={newDeliverableForm.owner}
                          onChange={(event) =>
                            setNewDeliverableForm((current) => ({
                              ...current,
                              owner: event.target.value as Role,
                            }))
                          }
                        >
                          {appData.roles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Estado</span>
                      <div className="field__control">
                        <select
                          value={newDeliverableForm.status}
                          onChange={(event) =>
                            setNewDeliverableForm((current) => ({
                              ...current,
                              status: event.target.value as DeliverableMutationInput['status'],
                            }))
                          }
                        >
                          {['En curso', 'En revisión', 'Listo', 'Bloqueado'].map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Vence</span>
                      <div className="field__control">
                        <input
                          type="date"
                          value={newDeliverableForm.dueDate}
                          onChange={(event) =>
                            setNewDeliverableForm((current) => ({
                              ...current,
                              dueDate: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field field--full">
                      <span>Nota operativa</span>
                      <div className="field__control field__control--textarea">
                        <textarea
                          rows={3}
                          value={newDeliverableForm.note}
                          onChange={(event) =>
                            setNewDeliverableForm((current) => ({
                              ...current,
                              note: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>
                  </div>

                  <div className="action-row">
                    <button type="submit" className="cta-button" disabled={isDeliverableSaving}>
                      <span>{isDeliverableSaving ? 'Creando…' : 'Crear entregable'}</span>
                    </button>
                  </div>
                </form>
              ) : null}

              {deliverableError ? <p className="form-error">{deliverableError}</p> : null}

              <div className="list-stack">
                {course.deliverables.map((deliverable) => {
                  const draft = deliverableDrafts[deliverable.id];
                  const isEditable = canEditDeliverable(userRole, deliverable.owner);

                  if (!isEditable || !draft) {
                    return (
                      <div key={deliverable.id} className="list-item">
                        <div>
                          <span className={badgeClass(deliverable.status)}>{deliverable.status}</span>
                          <strong>{deliverable.title}</strong>
                          <p>{deliverable.note}</p>
                        </div>
                        <div className="list-item__meta">
                          <span>{deliverable.owner}</span>
                          <span>Vence {formatDate(deliverable.dueDate)}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={deliverable.id} className="task-editor">
                      <div>
                        <div className="task-editor__header">
                          <span className={badgeClass(draft.status)}>{draft.status}</span>
                          <strong>{deliverable.title}</strong>
                        </div>

                        <div className="form-grid">
                          <label className="field">
                            <span>Título</span>
                            <div className="field__control">
                              <input
                                value={draft.title}
                                onChange={(event) =>
                                  updateDeliverableDraft(deliverable.id, 'title', event.target.value)
                                }
                              />
                            </div>
                          </label>

                          <label className="field">
                            <span>Responsable</span>
                            <div className="field__control">
                              <select
                                value={draft.owner}
                                onChange={(event) =>
                                  updateDeliverableDraft(
                                    deliverable.id,
                                    'owner',
                                    event.target.value as Role,
                                  )
                                }
                              >
                                {appData.roles.map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>

                          <label className="field">
                            <span>Estado</span>
                            <div className="field__control">
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  updateDeliverableDraft(
                                    deliverable.id,
                                    'status',
                                    event.target.value as DeliverableMutationInput['status'],
                                  )
                                }
                              >
                                {['En curso', 'En revisión', 'Listo', 'Bloqueado'].map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>

                          <label className="field">
                            <span>Vence</span>
                            <div className="field__control">
                              <input
                                type="date"
                                value={draft.dueDate}
                                onChange={(event) =>
                                  updateDeliverableDraft(
                                    deliverable.id,
                                    'dueDate',
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </label>

                          <label className="field field--full">
                            <span>Nota operativa</span>
                            <div className="field__control field__control--textarea">
                              <textarea
                                rows={3}
                                value={draft.note}
                                onChange={(event) =>
                                  updateDeliverableDraft(deliverable.id, 'note', event.target.value)
                                }
                              />
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="task-editor__sidebar">
                        <div className="task-item__meta">
                          <span>{draft.owner}</span>
                          <span>Vence {formatDate(draft.dueDate)}</span>
                        </div>

                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleDeliverableSave(deliverable.id)}
                        >
                          <Save size={16} />
                          <span>Guardar</span>
                        </button>

                        {canDeleteDeliverables(userRole) ? (
                          <button
                            type="button"
                            className="danger-button danger-button--ghost"
                            onClick={() => void handleDeliverableDelete(deliverable.id)}
                          >
                            <Trash2 size={16} />
                            <span>Eliminar</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalFrame>
        ) : null}
        </>
        ) : null}

        {activeSection === 'qa'
          ? renderStageNoteEditor(
              'qa',
              'QA',
              'Revisión, hallazgos y aprobación',
              'La bitácora de QA concentra control de calidad, devoluciones y criterio de cierre.',
            )
          : null}

        {activeSection === 'qa' ? (
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Alertas</span>
              <h3>Riesgos y bloqueos del curso</h3>
            </div>
            <CircleAlert size={18} />
          </div>

          <div className="list-stack">
            {relatedAlerts.length === 0 ? (
              <div className="empty-state">
                <strong>Sin alertas activas</strong>
                <p>Los riesgos operativos y llamados de atención aparecerán aquí cuando existan.</p>
              </div>
            ) : (
              relatedAlerts.map((alert) => (
                <div key={alert.id} className="list-item">
                  <div>
                    <span className={`badge badge--${alert.tone}`}>{alert.owner}</span>
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{stage?.name ?? currentCourse.stageId}</span>
                    <span>{currentCourse.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
        ) : null}

        {activeSection === 'planning' ? (
        <div className="page-stack">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Agenda</span>
              <h3>Cronograma operativo</h3>
            </div>
            <div className="action-row">
              {canCreateTasks(userRole) ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setActiveWorkspaceOverlay('timeline')}
                >
                  <PencilLine size={16} />
                  <span>Gestionar cronograma</span>
                </button>
              ) : null}
              <Compass size={18} />
            </div>
          </div>

          <div className="timeline-stack">
            {course.schedule.length === 0 ? (
              <div className="empty-state">
                <strong>Sin hitos registrados</strong>
                <p>La planeación del curso todavía no tiene cronograma visible.</p>
              </div>
            ) : (
              course.schedule.map((item) => {
                return (
                  <div key={item.id} className={`timeline-item timeline-item--${item.status}`}>
                    <span className="timeline-item__dot" />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{formatLongDate(item.dueDate)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        {activeWorkspaceOverlay === 'timeline' ? (
          <ModalFrame
            eyebrow="Planeación"
            title="Gestionar cronograma operativo"
            description="Los hitos y fechas objetivo se administran en un modal dedicado."
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="page-stack">
              <div className="toolbar-header">
                <button
                  type="button"
                  className={isTimelineComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                  onClick={() => setIsTimelineComposerOpen((current) => !current)}
                >
                  <Plus size={16} />
                  <span>{isTimelineComposerOpen ? 'Ocultar formulario' : 'Nuevo hito'}</span>
                </button>
              </div>

              {isTimelineComposerOpen ? (
                <form className="editor-card editor-card--task" onSubmit={handleTimelineCreate}>
                  <div className="form-grid">
                    <label className="field field--full">
                      <span>Nombre del hito</span>
                      <div className="field__control">
                        <input
                          value={newTimelineForm.label}
                          onChange={(event) =>
                            setNewTimelineForm((current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Fecha objetivo</span>
                      <div className="field__control">
                        <input
                          type="date"
                          value={newTimelineForm.dueDate}
                          onChange={(event) =>
                            setNewTimelineForm((current) => ({
                              ...current,
                              dueDate: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Estado</span>
                      <div className="field__control">
                        <select
                          value={newTimelineForm.status}
                          onChange={(event) =>
                            setNewTimelineForm((current) => ({
                              ...current,
                              status: event.target.value as TimelineItemMutationInput['status'],
                            }))
                          }
                        >
                          {[
                            ['pending', 'Pendiente'],
                            ['active', 'Activo'],
                            ['done', 'Completado'],
                          ].map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>

                  <div className="action-row">
                    <button type="submit" className="cta-button" disabled={isTimelineSaving === 'new'}>
                      <span>{isTimelineSaving === 'new' ? 'Creando…' : 'Agregar hito'}</span>
                    </button>
                  </div>
                </form>
              ) : null}

              {timelineError ? <p className="form-error">{timelineError}</p> : null}

              <div className="timeline-stack">
                {course.schedule.map((item) => {
                  const draft = timelineDrafts[item.id];

                  if (!draft) {
                    return null;
                  }

                  if (!canCreateTasks(userRole)) {
                    return (
                      <div key={item.id} className={`timeline-item timeline-item--${item.status}`}>
                        <span className="timeline-item__dot" />
                        <div>
                          <strong>{item.label}</strong>
                          <p>{formatLongDate(item.dueDate)}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} className="task-editor task-editor--timeline">
                      <div className="form-grid">
                        <label className="field field--full">
                          <span>Hito</span>
                          <div className="field__control">
                            <input
                              value={draft.label}
                              onChange={(event) =>
                                updateTimelineDraft(item.id, 'label', event.target.value)
                              }
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Fecha</span>
                          <div className="field__control">
                            <input
                              type="date"
                              value={draft.dueDate}
                              onChange={(event) =>
                                updateTimelineDraft(item.id, 'dueDate', event.target.value)
                              }
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Estado</span>
                          <div className="field__control">
                            <select
                              value={draft.status}
                              onChange={(event) =>
                                updateTimelineDraft(
                                  item.id,
                                  'status',
                                  event.target.value as TimelineItemMutationInput['status'],
                                )
                              }
                            >
                              {[
                                ['pending', 'Pendiente'],
                                ['active', 'Activo'],
                                ['done', 'Completado'],
                              ].map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>
                      </div>

                      <div className="task-editor__sidebar">
                        <div className="task-item__meta">
                          <span>{formatDate(draft.dueDate)}</span>
                          <span>{draft.status}</span>
                        </div>

                        <button
                          type="button"
                          className="ghost-button"
                          disabled={isTimelineSaving === item.id}
                          onClick={() => void handleTimelineSave(item.id)}
                        >
                          <Save size={16} />
                          <span>{isTimelineSaving === item.id ? 'Guardando…' : 'Guardar'}</span>
                        </button>

                        <button
                          type="button"
                          className="danger-button danger-button--ghost"
                          disabled={isTimelineSaving === item.id}
                          onClick={() => void handleTimelineDelete(item.id)}
                        >
                          <Trash2 size={16} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalFrame>
        ) : null}
        </div>
        ) : null}

        {activeSection === 'architecture' ? (
        <>
          {renderProductStudio(
            'architecture',
            'Producto pedagógico',
            'Lineamientos y diseño instruccional',
            'La arquitectura del curso se expresa aquí como documentos y lineamientos editables por versión.',
          )}

          {renderStageNoteEditor(
            'architecture',
            'Arquitectura',
            'Lectura de diseño instruccional',
            'Aquí vive la intención de diseño del curso: módulos, progresión, actividades y criterio pedagógico.',
          )}

          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Módulos</span>
                <h3>Mapa de experiencia</h3>
              </div>
              <div className="action-row">
                {canEditCourseModules(userRole) ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setActiveWorkspaceOverlay('modules')}
                  >
                    <PencilLine size={16} />
                    <span>Gestionar módulos</span>
                  </button>
                ) : null}
                <Layers3 size={18} />
              </div>
            </div>

            <div className="list-stack">
              {currentCourse.modules.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin módulos registrados</strong>
                  <p>La arquitectura del curso todavía no tiene unidades o módulos visibles.</p>
                </div>
              ) : (
                currentCourse.modules.map((module) => {
                  return (
                    <div key={module.id} className="module-card">
                      <div className="module-card__top">
                        <strong>{module.title}</strong>
                        <span>{module.completion}%</span>
                      </div>
                      <p>{module.learningGoal}</p>
                      <div className="module-card__meta">
                        <span>{module.activities} actividades</span>
                        <span>{module.ownResources} propios</span>
                        <span>{module.curatedResources} curados</span>
                      </div>
                      <div className="progress-bar">
                        <span style={{ width: `${module.completion}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          {activeWorkspaceOverlay === 'modules' ? (
            <ModalFrame
              eyebrow="Arquitectura"
              title="Gestionar módulos"
              description="La edición detallada de módulos se resuelve en modal."
              width="xl"
              onClose={closeWorkspaceOverlay}
            >
              <div className="page-stack">
                <div className="toolbar-header">
                  <button
                    type="button"
                    className={isModuleComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                    onClick={() => setIsModuleComposerOpen((current) => !current)}
                  >
                    <Plus size={16} />
                    <span>{isModuleComposerOpen ? 'Ocultar formulario' : 'Nuevo módulo'}</span>
                  </button>
                </div>

                {isModuleComposerOpen ? (
                  <form className="editor-card editor-card--task" onSubmit={handleModuleCreate}>
                    <div className="form-grid">
                      <label className="field">
                        <span>Título</span>
                        <div className="field__control">
                          <input
                            value={newLearningModuleForm.title}
                            onChange={(event) =>
                              setNewLearningModuleForm((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                      </label>

                      <label className="field">
                        <span>Avance</span>
                        <div className="field__control">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={newLearningModuleForm.completion}
                            onChange={(event) =>
                              setNewLearningModuleForm((current) => ({
                                ...current,
                                completion: Number.parseInt(event.target.value, 10) || 0,
                              }))
                            }
                            required
                          />
                        </div>
                      </label>

                      <label className="field field--full">
                        <span>Objetivo de aprendizaje</span>
                        <div className="field__control field__control--textarea">
                          <textarea
                            rows={3}
                            value={newLearningModuleForm.learningGoal}
                            onChange={(event) =>
                              setNewLearningModuleForm((current) => ({
                                ...current,
                                learningGoal: event.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                      </label>

                      <label className="field">
                        <span>Actividades</span>
                        <div className="field__control">
                          <input
                            type="number"
                            min={0}
                            value={newLearningModuleForm.activities}
                            onChange={(event) =>
                              setNewLearningModuleForm((current) => ({
                                ...current,
                                activities: Number.parseInt(event.target.value, 10) || 0,
                              }))
                            }
                            required
                          />
                        </div>
                      </label>

                      <label className="field">
                        <span>Recursos propios</span>
                        <div className="field__control">
                          <input
                            type="number"
                            min={0}
                            value={newLearningModuleForm.ownResources}
                            onChange={(event) =>
                              setNewLearningModuleForm((current) => ({
                                ...current,
                                ownResources: Number.parseInt(event.target.value, 10) || 0,
                              }))
                            }
                            required
                          />
                        </div>
                      </label>

                      <label className="field">
                        <span>Recursos curados</span>
                        <div className="field__control">
                          <input
                            type="number"
                            min={0}
                            value={newLearningModuleForm.curatedResources}
                            onChange={(event) =>
                              setNewLearningModuleForm((current) => ({
                                ...current,
                                curatedResources: Number.parseInt(event.target.value, 10) || 0,
                              }))
                            }
                            required
                          />
                        </div>
                      </label>
                    </div>

                    <div className="action-row">
                      <button type="submit" className="cta-button" disabled={isModuleSaving === 'new'}>
                        <span>{isModuleSaving === 'new' ? 'Creando…' : 'Crear módulo'}</span>
                      </button>
                    </div>
                  </form>
                ) : null}

                {moduleError ? <p className="form-error">{moduleError}</p> : null}

                <div className="list-stack">
                  {currentCourse.modules.map((module) => {
                    const draft = moduleDrafts[module.id];

                    if (!draft) {
                      return null;
                    }

                    return (
                      <div key={module.id} className="task-editor">
                        <div>
                          <div className="task-editor__header">
                            <span className="badge badge--outline">{draft.completion}%</span>
                            <strong>{module.title}</strong>
                          </div>

                          <div className="form-grid">
                            <label className="field">
                              <span>Título</span>
                              <div className="field__control">
                                <input
                                  value={draft.title}
                                  onChange={(event) =>
                                    updateModuleDraft(module.id, 'title', event.target.value)
                                  }
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span>Avance</span>
                              <div className="field__control">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={draft.completion}
                                  onChange={(event) =>
                                    updateModuleDraft(
                                      module.id,
                                      'completion',
                                      Number.parseInt(event.target.value, 10) || 0,
                                    )
                                  }
                                />
                              </div>
                            </label>

                            <label className="field field--full">
                              <span>Objetivo de aprendizaje</span>
                              <div className="field__control field__control--textarea">
                                <textarea
                                  rows={3}
                                  value={draft.learningGoal}
                                  onChange={(event) =>
                                    updateModuleDraft(module.id, 'learningGoal', event.target.value)
                                  }
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span>Actividades</span>
                              <div className="field__control">
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.activities}
                                  onChange={(event) =>
                                    updateModuleDraft(
                                      module.id,
                                      'activities',
                                      Number.parseInt(event.target.value, 10) || 0,
                                    )
                                  }
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span>Propios</span>
                              <div className="field__control">
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.ownResources}
                                  onChange={(event) =>
                                    updateModuleDraft(
                                      module.id,
                                      'ownResources',
                                      Number.parseInt(event.target.value, 10) || 0,
                                    )
                                  }
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span>Curados</span>
                              <div className="field__control">
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.curatedResources}
                                  onChange={(event) =>
                                    updateModuleDraft(
                                      module.id,
                                      'curatedResources',
                                      Number.parseInt(event.target.value, 10) || 0,
                                    )
                                  }
                                />
                              </div>
                            </label>
                          </div>
                        </div>

                        <div className="task-editor__sidebar">
                          <div className="task-item__meta">
                            <span>{draft.activities} actividades</span>
                            <span>{draft.ownResources + draft.curatedResources} recursos</span>
                          </div>

                          <button
                            type="button"
                            className="ghost-button"
                            disabled={isModuleSaving === module.id}
                            onClick={() => void handleModuleSave(module.id)}
                          >
                            <Save size={16} />
                            <span>{isModuleSaving === module.id ? 'Guardando…' : 'Guardar'}</span>
                          </button>

                          <button
                            type="button"
                            className="danger-button danger-button--ghost"
                            disabled={isModuleSaving === module.id}
                            onClick={() => void handleModuleDelete(module.id)}
                          >
                            <Trash2 size={16} />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ModalFrame>
          ) : null}
        </>
        ) : null}

        {activeSection === 'production'
          ? renderStageNoteEditor(
              'production',
              'Producción',
              'Autoría, entregables y desarrollo académico',
              'Esta bitácora concentra el estado de autoría y producción académica del curso.',
            )
          : null}

        {activeSection === 'production'
          ? renderProductStudio(
              'production',
              'Producto de autoría',
              'Actividades, guías y recursos propios',
              'La etapa de producción ahora permite desarrollar directamente los materiales académicos dentro del expediente.',
            )
          : null}

        {activeSection === 'qa' ? (
          <>
            <article className="surface section-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Observaciones</span>
                  <h3>Puntos abiertos</h3>
                </div>
                <div className="action-row">
                  {canCreateObservations(userRole) ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setObservationError(null);
                        setIsObservationComposerOpen(false);
                        setActiveWorkspaceOverlay('observations');
                      }}
                    >
                      <PencilLine size={16} />
                      <span>Gestionar observaciones</span>
                    </button>
                  ) : null}
                  <CircleAlert size={18} />
                </div>
              </div>

              <div className="module-grid module-grid--summary">
                <div className="module-card">
                  <div className="module-card__top">
                    <strong>{pendingObservationsCount}</strong>
                    <span>pendientes</span>
                  </div>
                  <p>QA y equipo visualizan aquí los puntos abiertos sin entrar al detalle de edición.</p>
                </div>

                <div className="module-card">
                  <div className="module-card__top">
                    <strong>{resolvedObservationsCount}</strong>
                    <span>resueltas</span>
                  </div>
                  <p>El cierre queda trazado por severidad, emisor y estado de la observación.</p>
                </div>
              </div>

              <div className="list-stack">
                {course.observations.length === 0 ? (
                  <div className="empty-state">
                    <strong>Sin observaciones abiertas</strong>
                    <p>Las alertas, hallazgos y devoluciones aparecerán aquí para darles seguimiento.</p>
                  </div>
                ) : (
                  course.observations.map((observation) => (
                    <div key={observation.id} className="list-item">
                      <div>
                        <span className={badgeClass(observation.status)}>{observation.status}</span>
                        <strong>{observation.title}</strong>
                        <p>{observation.detail}</p>
                      </div>
                      <div className="list-item__meta">
                        <span>{observation.role}</span>
                        <span>{observation.severity}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            {activeWorkspaceOverlay === 'observations' ? (
              <ModalFrame
                eyebrow="QA"
                title="Gestionar observaciones"
                description="Las observaciones y devoluciones se editan fuera de la página principal."
                width="xl"
                onClose={closeWorkspaceOverlay}
              >
                <div className="page-stack">
                  {canCreateObservations(userRole) ? (
                    <div className="toolbar-header">
                      <button
                        type="button"
                        className={
                          isObservationComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'
                        }
                        onClick={() => setIsObservationComposerOpen((current) => !current)}
                      >
                        <Plus size={16} />
                        <span>{isObservationComposerOpen ? 'Cerrar formulario' : 'Nueva observación'}</span>
                      </button>
                    </div>
                  ) : null}

                  {isObservationComposerOpen ? (
                    <form className="editor-card editor-card--task" onSubmit={handleObservationCreate}>
                      <div className="form-grid">
                        <label className="field">
                          <span>Título</span>
                          <div className="field__control">
                            <input
                              value={newObservationForm.title}
                              onChange={(event) =>
                                setNewObservationForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Rol emisor</span>
                          <div className="field__control">
                            <select
                              value={newObservationForm.role}
                              onChange={(event) =>
                                setNewObservationForm((current) => ({
                                  ...current,
                                  role: event.target.value as Role,
                                }))
                              }
                            >
                              {appData.roles.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Severidad</span>
                          <div className="field__control">
                            <select
                              value={newObservationForm.severity}
                              onChange={(event) =>
                                setNewObservationForm((current) => ({
                                  ...current,
                                  severity: event.target.value as ObservationMutationInput['severity'],
                                }))
                              }
                            >
                              {['Alta', 'Media', 'Baja'].map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Estado</span>
                          <div className="field__control">
                            <select
                              value={newObservationForm.status}
                              onChange={(event) =>
                                setNewObservationForm((current) => ({
                                  ...current,
                                  status: event.target.value as ObservationMutationInput['status'],
                                }))
                              }
                            >
                              {['Pendiente', 'En ajuste', 'Resuelta'].map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field field--full">
                          <span>Detalle</span>
                          <div className="field__control field__control--textarea">
                            <textarea
                              rows={3}
                              value={newObservationForm.detail}
                              onChange={(event) =>
                                setNewObservationForm((current) => ({
                                  ...current,
                                  detail: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                        </label>
                      </div>

                      <div className="action-row">
                        <button type="submit" className="cta-button" disabled={isObservationSaving}>
                          <span>{isObservationSaving ? 'Registrando…' : 'Registrar observación'}</span>
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {observationError ? <p className="form-error">{observationError}</p> : null}

                  <div className="list-stack">
                    {course.observations.length === 0 ? (
                      <div className="empty-state">
                        <strong>Sin observaciones abiertas</strong>
                        <p>Las alertas, hallazgos y devoluciones aparecerán aquí para darles seguimiento.</p>
                      </div>
                    ) : (
                      course.observations.map((observation) => {
                        const draft = observationDrafts[observation.id];
                        const isEditable = canEditObservation(userRole, observation.role);

                        if (!isEditable || !draft) {
                          return (
                            <div key={observation.id} className="list-item">
                              <div>
                                <span className={badgeClass(observation.status)}>{observation.status}</span>
                                <strong>{observation.title}</strong>
                                <p>{observation.detail}</p>
                              </div>
                              <div className="list-item__meta">
                                <span>{observation.role}</span>
                                <span>{observation.severity}</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={observation.id} className="task-editor">
                            <div>
                              <div className="task-editor__header">
                                <span className={badgeClass(draft.status)}>{draft.status}</span>
                                <strong>{observation.title}</strong>
                              </div>

                              <div className="form-grid">
                                <label className="field">
                                  <span>Título</span>
                                  <div className="field__control">
                                    <input
                                      value={draft.title}
                                      onChange={(event) =>
                                        updateObservationDraft(observation.id, 'title', event.target.value)
                                      }
                                    />
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Rol emisor</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.role}
                                      onChange={(event) =>
                                        updateObservationDraft(
                                          observation.id,
                                          'role',
                                          event.target.value as Role,
                                        )
                                      }
                                    >
                                      {appData.roles.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Severidad</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.severity}
                                      onChange={(event) =>
                                        updateObservationDraft(
                                          observation.id,
                                          'severity',
                                          event.target.value as ObservationMutationInput['severity'],
                                        )
                                      }
                                    >
                                      {['Alta', 'Media', 'Baja'].map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Estado</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.status}
                                      onChange={(event) =>
                                        updateObservationDraft(
                                          observation.id,
                                          'status',
                                          event.target.value as ObservationMutationInput['status'],
                                        )
                                      }
                                    >
                                      {['Pendiente', 'En ajuste', 'Resuelta'].map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field field--full">
                                  <span>Detalle</span>
                                  <div className="field__control field__control--textarea">
                                    <textarea
                                      rows={3}
                                      value={draft.detail}
                                      onChange={(event) =>
                                        updateObservationDraft(
                                          observation.id,
                                          'detail',
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                </label>
                              </div>
                            </div>

                            <div className="task-editor__sidebar">
                              <div className="task-item__meta">
                                <span>{draft.role}</span>
                                <span>{draft.severity}</span>
                              </div>

                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => void handleObservationSave(observation.id)}
                              >
                                <Save size={16} />
                                <span>Guardar</span>
                              </button>

                              {canDeleteObservations(userRole) ? (
                                <button
                                  type="button"
                                  className="danger-button danger-button--ghost"
                                  onClick={() => void handleObservationDelete(observation.id)}
                                >
                                  <Trash2 size={16} />
                                  <span>Eliminar</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </ModalFrame>
            ) : null}
          </>
        ) : null}

        {activeSection === 'planning' ? (
        <div className="page-stack">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Equipo</span>
              <h3>Núcleo del proyecto</h3>
            </div>
            <div className="action-row">
              {canManageCourseTeam(userRole) ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setActiveWorkspaceOverlay('team')}
                >
                  <PencilLine size={16} />
                  <span>Gestionar equipo</span>
                </button>
              ) : null}
              <UsersRound size={18} />
            </div>
          </div>

          <div className="list-stack">
            {course.team.length === 0 ? (
              <div className="empty-state">
                <strong>Sin responsables asignados</strong>
                <p>La planeación del curso todavía no tiene equipo visible.</p>
              </div>
            ) : (
              course.team.map((member) => {
                return (
                  <div key={member.id} className="team-list__item">
                    <span className="avatar-pill">{member.initials}</span>
                    <div>
                      <strong>{member.name}</strong>
                      <p>{member.role}</p>
                    </div>
                    <span>{member.focus}</span>
                  </div>
                );
              })
            )}
          </div>
        </article>

        {activeWorkspaceOverlay === 'team' ? (
          <ModalFrame
            eyebrow="Planeación"
            title="Gestionar equipo del curso"
            description="La asignación y edición de responsables se resuelve en modal para mantener la vista principal limpia."
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="page-stack">
              <div className="toolbar-header">
                <button
                  type="button"
                  className={isTeamComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                  onClick={() => setIsTeamComposerOpen((current) => !current)}
                >
                  <Plus size={16} />
                  <span>{isTeamComposerOpen ? 'Ocultar formulario' : 'Agregar responsable'}</span>
                </button>
              </div>

              {isTeamComposerOpen ? (
                <form className="editor-card editor-card--task" onSubmit={handleTeamMemberCreate}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Nombre</span>
                      <div className="field__control">
                        <input
                          value={newTeamMemberForm.name}
                          onChange={(event) =>
                            setNewTeamMemberForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Rol</span>
                      <div className="field__control">
                        <select
                          value={newTeamMemberForm.role}
                          onChange={(event) =>
                            setNewTeamMemberForm((current) => ({
                              ...current,
                              role: event.target.value as Role,
                            }))
                          }
                        >
                          {appData.roles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Iniciales</span>
                      <div className="field__control">
                        <input
                          value={newTeamMemberForm.initials}
                          onChange={(event) =>
                            setNewTeamMemberForm((current) => ({
                              ...current,
                              initials: event.target.value,
                            }))
                          }
                          placeholder="Ej. AT"
                        />
                      </div>
                    </label>

                    <label className="field field--full">
                      <span>Foco de trabajo</span>
                      <div className="field__control">
                        <input
                          value={newTeamMemberForm.focus}
                          onChange={(event) =>
                            setNewTeamMemberForm((current) => ({
                              ...current,
                              focus: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </label>
                  </div>

                  <div className="action-row">
                    <button type="submit" className="cta-button" disabled={isTeamSaving === 'new'}>
                      <span>{isTeamSaving === 'new' ? 'Agregando…' : 'Agregar responsable'}</span>
                    </button>
                  </div>
                </form>
              ) : null}

              {teamError ? <p className="form-error">{teamError}</p> : null}

              <div className="list-stack">
                {course.team.map((member) => {
                  const draft = teamDrafts[member.id];

                  if (!draft) {
                    return null;
                  }

                  return (
                    <div key={member.id} className="task-editor">
                      <div>
                        <div className="task-editor__header">
                          <span className="avatar-pill">{draft.initials || member.initials}</span>
                          <strong>{member.name}</strong>
                        </div>

                        <div className="form-grid">
                          <label className="field">
                            <span>Nombre</span>
                            <div className="field__control">
                              <input
                                value={draft.name}
                                onChange={(event) =>
                                  updateTeamDraft(member.id, 'name', event.target.value)
                                }
                              />
                            </div>
                          </label>

                          <label className="field">
                            <span>Rol</span>
                            <div className="field__control">
                              <select
                                value={draft.role}
                                onChange={(event) =>
                                  updateTeamDraft(member.id, 'role', event.target.value as Role)
                                }
                              >
                                {appData.roles.map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>

                          <label className="field">
                            <span>Iniciales</span>
                            <div className="field__control">
                              <input
                                value={draft.initials}
                                onChange={(event) =>
                                  updateTeamDraft(member.id, 'initials', event.target.value)
                                }
                              />
                            </div>
                          </label>

                          <label className="field field--full">
                            <span>Foco</span>
                            <div className="field__control">
                              <input
                                value={draft.focus}
                                onChange={(event) =>
                                  updateTeamDraft(member.id, 'focus', event.target.value)
                                }
                              />
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="task-editor__sidebar">
                        <div className="task-item__meta">
                          <span>{draft.role}</span>
                          <span>{draft.focus}</span>
                        </div>

                        <button
                          type="button"
                          className="ghost-button"
                          disabled={isTeamSaving === member.id}
                          onClick={() => void handleTeamMemberSave(member.id)}
                        >
                          <Save size={16} />
                          <span>{isTeamSaving === member.id ? 'Guardando…' : 'Guardar'}</span>
                        </button>

                        <button
                          type="button"
                          className="danger-button danger-button--ghost"
                          disabled={isTeamSaving === member.id}
                          onClick={() => void handleTeamMemberDelete(member.id)}
                        >
                          <Trash2 size={16} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalFrame>
        ) : null}
        </div>
        ) : null}

        {activeSection === 'resources' ? (
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Recursos</span>
              <h3>Curación y biblioteca asociada</h3>
            </div>
            <Layers3 size={18} />
          </div>

          <div className="list-stack">
            {relatedResources.length === 0 ? (
              <div className="empty-state">
                <strong>Sin recursos asociados todavía</strong>
                <p>La curación y los recursos propios vinculados al curso aparecerán aquí.</p>
              </div>
            ) : (
              relatedResources.map((resource) => (
                <div key={resource.id} className="list-item">
                  <div>
                    <span className={resource.kind === 'Curado' ? 'badge badge--ocean' : 'badge badge--sage'}>
                      {resource.kind}
                    </span>
                    <strong>{resource.title}</strong>
                    <p>{resource.summary}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{resource.unit}</span>
                    <span>{resource.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="action-row">
            <Link to="/library" className="ghost-button">
              <span>Ir a biblioteca</span>
            </Link>
          </div>
        </article>
        ) : null}

        {activeSection === 'resources' ? (
        <>
          {renderProductStudio(
            'curation',
            'Producto curado',
            'Inventario y validación de recursos curados',
            'Esta etapa conserva el inventario curado, las lecturas seleccionadas y su justificación de uso dentro del curso.',
          )}

          {renderStageNoteEditor(
            'curation',
            'Curación',
            'Fuentes y referentes',
            'La curación documenta qué fuentes externas entran al curso y por qué.',
          )}

          {renderProductStudio(
            'multimedia',
            'Producto multimedia',
            'Piezas propias para desarrollo del curso',
            'Aquí se desarrollan HTML, pódcast, lecturas extendidas e infografías como productos internos del expediente.',
          )}

          {renderStageNoteEditor(
            'multimedia',
            'Multimedia',
            'Piezas, versiones y observaciones',
            'La capa multimedia conserva recursos propios, observaciones y avances para móvil y LMS.',
          )}

          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">IA especializada</span>
                <h3>Asistentes sugeridos</h3>
              </div>
              <Bot size={18} />
            </div>

            <div className="assistant-grid">
              {course.assistants.map((assistant) => (
                <div key={assistant.id} className={`assistant-card assistant-card--${assistant.tone}`}>
                  <strong>{assistant.name}</strong>
                  <p>{assistant.mission}</p>
                </div>
              ))}
            </div>
          </article>
        </>
        ) : null}

        {activeSection === 'lms' ? (
        <>
          {renderStageNoteEditor(
            'lms',
            'LMS',
            'Montaje e implementación',
            'Esta bitácora conserva incidencias, evidencias de implementación y checklist del entorno LMS.',
          )}

          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Checklist técnico</span>
                <h3>Puntos de control LMS</h3>
              </div>
              <Flag size={18} />
            </div>

            <div className="list-stack">
              {currentCourse.stageChecklist
                .filter((checkpoint) => checkpoint.owner === 'Gestor LMS')
                .map((checkpoint) => (
                  <div key={checkpoint.id} className="list-item">
                    <div>
                      <span className={checkpointBadgeClass(checkpoint.status)}>
                        {checkpointStatusLabel(checkpoint.status)}
                      </span>
                      <strong>{checkpoint.label}</strong>
                      <p>El punto técnico permanece asociado al flujo general del curso.</p>
                    </div>
                    <div className="list-item__meta">
                      <span>{checkpoint.owner}</span>
                      <span>{stage?.name ?? currentCourse.stageId}</span>
                    </div>
                  </div>
                ))}
            </div>
          </article>
        </>
        ) : null}

        {activeSection === 'qa'
          ? renderProductStudio(
              'qa',
              'Producto QA',
              'Rúbricas y criterio de aprobación',
              'La validación final ya no depende solo de observaciones: aquí también se construyen y versionan las rúbricas de calidad.',
            )
          : null}
      </section>
      ) : null}

      {activeSection === 'planning' ? (
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Tareas</span>
            <h3>Tablero operativo del curso</h3>
          </div>
          <div className="action-row">
            {canCreateTasks(userRole) ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setActiveWorkspaceOverlay('tasks')}
              >
                <PencilLine size={16} />
                <span>Gestionar tareas</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="list-stack">
          {visibleTasks.length === 0 ? (
            <div className="empty-state">
              <strong>Sin tareas visibles en este curso</strong>
              <p>Cuando el flujo avance o se registren nuevas asignaciones aparecerán aquí.</p>
            </div>
          ) : (
            visibleTasks.map((task) => {
              const draft = taskDrafts[task.id];
              const isEditable = canEditTask(userRole, task.role);

              if (!draft) {
                return null;
              }

              return (
                <div key={task.id} className="list-item">
                  <div>
                    <span className={badgeClass(draft.status)}>{draft.status}</span>
                    <strong>{task.title}</strong>
                    <p>{draft.summary}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{task.role}</span>
                    <span>{draft.priority}</span>
                    <span>Vence {formatDate(task.dueDate)}</span>
                    {!canCreateTasks(userRole) ? <span>{isEditable ? 'Editable' : 'Solo seguimiento'}</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {activeWorkspaceOverlay === 'tasks' ? (
          <ModalFrame
            eyebrow="Planeación"
            title="Gestionar tareas"
            description="Las tareas se crean y editan fuera de la página principal para reducir la carga cognitiva."
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="page-stack">
              <div className="toolbar-header">
                <button
                  type="button"
                  className={isTaskComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                  onClick={() => setIsTaskComposerOpen((current) => !current)}
                >
                  <Plus size={16} />
                  <span>{isTaskComposerOpen ? 'Ocultar formulario' : 'Nueva tarea'}</span>
                </button>
              </div>

              {isTaskComposerOpen ? (
                <form className="editor-card editor-card--task" onSubmit={handleTaskCreate}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Título</span>
                      <div className="field__control">
                        <input
                          value={newTaskForm.title}
                          onChange={(event) =>
                            setNewTaskForm((current) => ({ ...current, title: event.target.value }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Rol responsable</span>
                      <div className="field__control">
                        <select
                          value={newTaskForm.role}
                          onChange={(event) =>
                            setNewTaskForm((current) => ({
                              ...current,
                              role: event.target.value as Role,
                            }))
                          }
                        >
                          {appData.roles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Etapa</span>
                      <div className="field__control">
                        <select
                          value={newTaskForm.stageId}
                          onChange={(event) =>
                            setNewTaskForm((current) => ({ ...current, stageId: event.target.value }))
                          }
                        >
                          {appData.stages.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Vence</span>
                      <div className="field__control">
                        <input
                          type="date"
                          value={newTaskForm.dueDate}
                          onChange={(event) =>
                            setNewTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Prioridad</span>
                      <div className="field__control">
                        <select
                          value={newTaskForm.priority}
                          onChange={(event) =>
                            setNewTaskForm((current) => ({
                              ...current,
                              priority: event.target.value as TaskMutationInput['priority'],
                            }))
                          }
                        >
                          {['Alta', 'Media', 'Baja'].map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Estado</span>
                      <div className="field__control">
                        <select
                          value={newTaskForm.status}
                          onChange={(event) =>
                            setNewTaskForm((current) => ({
                              ...current,
                              status: event.target.value as TaskMutationInput['status'],
                            }))
                          }
                        >
                          {['Pendiente', 'En revisión', 'Bloqueada', 'Lista'].map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field field--full">
                      <span>Resumen</span>
                      <div className="field__control field__control--textarea">
                        <textarea
                          rows={3}
                          value={newTaskForm.summary}
                          onChange={(event) =>
                            setNewTaskForm((current) => ({ ...current, summary: event.target.value }))
                          }
                          required
                        />
                      </div>
                    </label>
                  </div>

                  <div className="action-row">
                    <button type="submit" className="cta-button" disabled={isTaskSaving}>
                      <span>{isTaskSaving ? 'Creando…' : 'Crear tarea'}</span>
                    </button>
                  </div>
                </form>
              ) : null}

              {taskError ? <p className="form-error">{taskError}</p> : null}

              <div className="list-stack">
                {visibleTasks.map((task) => {
                  const draft = taskDrafts[task.id];
                  const isEditable = canEditTask(userRole, task.role);

                  if (!draft) {
                    return null;
                  }

                  return (
                    <div key={task.id} className="task-editor">
                      <div>
                        <div className="task-editor__header">
                          <span className={badgeClass(draft.status)}>{draft.status}</span>
                          <strong>{task.title}</strong>
                        </div>

                        {canCreateTasks(userRole) ? (
                          <div className="form-grid">
                            <label className="field">
                              <span>Título</span>
                              <div className="field__control">
                                <input
                                  value={draft.title}
                                  onChange={(event) => updateTaskDraft(task.id, 'title', event.target.value)}
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span>Rol</span>
                              <div className="field__control">
                                <select
                                  value={draft.role}
                                  onChange={(event) =>
                                    updateTaskDraft(task.id, 'role', event.target.value as Role)
                                  }
                                >
                                  {appData.roles.map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field">
                              <span>Etapa</span>
                              <div className="field__control">
                                <select
                                  value={draft.stageId}
                                  onChange={(event) =>
                                    updateTaskDraft(task.id, 'stageId', event.target.value)
                                  }
                                >
                                  {appData.stages.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field">
                              <span>Vence</span>
                              <div className="field__control">
                                <input
                                  type="date"
                                  value={draft.dueDate}
                                  onChange={(event) =>
                                    updateTaskDraft(task.id, 'dueDate', event.target.value)
                                  }
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span>Prioridad</span>
                              <div className="field__control">
                                <select
                                  value={draft.priority}
                                  onChange={(event) =>
                                    updateTaskDraft(
                                      task.id,
                                      'priority',
                                      event.target.value as TaskMutationInput['priority'],
                                    )
                                  }
                                >
                                  {['Alta', 'Media', 'Baja'].map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field">
                              <span>Estado</span>
                              <div className="field__control">
                                <select
                                  value={draft.status}
                                  onChange={(event) =>
                                    updateTaskDraft(
                                      task.id,
                                      'status',
                                      event.target.value as TaskMutationInput['status'],
                                    )
                                  }
                                >
                                  {['Pendiente', 'En revisión', 'Bloqueada', 'Lista'].map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field field--full">
                              <span>Resumen</span>
                              <div className="field__control field__control--textarea">
                                <textarea
                                  rows={3}
                                  value={draft.summary}
                                  onChange={(event) =>
                                    updateTaskDraft(task.id, 'summary', event.target.value)
                                  }
                                />
                              </div>
                            </label>
                          </div>
                        ) : (
                          <div className="form-grid">
                            <label className="field">
                              <span>Estado</span>
                              <div className="field__control">
                                <select
                                  value={draft.status}
                                  onChange={(event) =>
                                    updateTaskDraft(
                                      task.id,
                                      'status',
                                      event.target.value as TaskMutationInput['status'],
                                    )
                                  }
                                  disabled={!isEditable}
                                >
                                  {['Pendiente', 'En revisión', 'Bloqueada', 'Lista'].map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </label>

                            <label className="field field--full">
                              <span>Resumen</span>
                              <div className="field__control field__control--textarea">
                                <textarea
                                  rows={3}
                                  value={draft.summary}
                                  onChange={(event) =>
                                    updateTaskDraft(task.id, 'summary', event.target.value)
                                  }
                                  disabled={!isEditable}
                                />
                              </div>
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="task-editor__sidebar">
                        <div className="task-item__meta">
                          <span>{task.role}</span>
                          <span>Vence {formatDate(task.dueDate)}</span>
                        </div>

                        {isEditable ? (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void handleTaskSave(task.id)}
                          >
                            <Save size={16} />
                            <span>Guardar</span>
                          </button>
                        ) : null}

                        {canDeleteTasks(userRole) ? (
                          <button
                            type="button"
                            className="danger-button danger-button--ghost"
                            onClick={() => void handleTaskDelete(task.id)}
                          >
                            <Trash2 size={16} />
                            <span>Eliminar</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalFrame>
        ) : null}
      </section>
      ) : null}

      {activeSection === 'history' ? (
        <section className="surface section-card section-card--compact">
          <div className="timeline-stack timeline-stack--history">
            {historyFeed.map((event) => (
              <div key={event.id} className="timeline-item timeline-item--active">
                <span className="timeline-item__dot" />
                <div>
                  <span className={historyTypeBadge(event.type)}>{historyTypeLabel(event.type)}</span>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                  <span className="timeline-item__meta">
                    Fecha de referencia: {formatDate(event.happenedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
