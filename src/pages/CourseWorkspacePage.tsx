import {
  Flag,
  MoveRight,
  PencilLine,
  Plus,
  Save,
  Settings,
  Trash2,
  History,
  FileUp,
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileText,
  RefreshCcw,
  Layers,
  BarChart3,
  Globe,
  PenTool,
  BookOpen,
  Target,
  File,
  AlertCircle,
  Video,
  Mic,
  MonitorPlay,
  ClipboardCheck,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SidePanel } from '../components/SidePanel.js';
import { useModalStore } from '../store/modalStore.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { ProgressRing } from '../components/ProgressRing.js';
import { VerticalStageTimeline } from '../components/VerticalStageTimeline.js';
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
  Role,
  StageCheckpointStatus,
  Task,
  TaskMutationInput,
  TeamMember,
  TeamMemberMutationInput,
} from '../types.js';
import { formatDate } from '../utils/format.js';
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
  canCreateCourseProducts,
  canCreateTasks,
  canDeleteCourseProducts,
  canDeleteTasks,
  canEditCourseProduct,
  canEditStageNote,
  canEditTask,
  canManageCourses,
} from '../utils/permissions.js';

interface CourseWorkspacePageProps {
  role: Role;
  userRole: Role;
  appData: AppData;
  isLoading?: boolean;
  refreshAppData: () => void;
  mutateAppData: (nextData: AppData | ((current: AppData) => AppData)) => void;
}

type CourseSection =
  | 'summary'
  | 'microcurriculo'
  | 'arquitectura'
  | 'planeacion'
  | 'escritura'
  | 'validacion'
  | 'multimedia'
  | 'lms'
  | 'qa'
  | 'entrega'
  | 'history';

const validCourseSections: CourseSection[] = [
  'summary',
  'microcurriculo',
  'arquitectura',
  'planeacion',
  'escritura',
  'validacion',
  'multimedia',
  'lms',
  'qa',
  'entrega',
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
  const facultyOptions = uniqueOptions(getInstitutionFaculties(appData.institution, institution));
  const programOptions = uniqueOptions(getInstitutionPrograms(appData.institution, institution));
  const academicPeriodOptions = uniqueOptions(
    getInstitutionAcademicPeriods(appData.institution, institution),
  );
  const courseTypeOptions = uniqueOptions(getInstitutionCourseTypes(appData.institution, institution));

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
    status: 'En curso',
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



function makeMetadataForm(course: Course): CourseMetadataMutationInput {
  return {
    institution: course.metadata.institution,
    shortName: course.metadata.shortName,
    semester: course.metadata.semester,
    academicPeriod: course.metadata.academicPeriod,
    courseType: course.metadata.courseType,
    learningOutcomes: course.metadata.learningOutcomes,
    topics: course.metadata.topics,
    units: Array.isArray(course.metadata.units) ? course.metadata.units : [],
    methodology: course.metadata.methodology,
    evaluation: Array.isArray(course.metadata.evaluation) ? course.metadata.evaluation : typeof course.metadata.evaluation === 'string' ? [course.metadata.evaluation] : [],
    bibliography: course.metadata.bibliography,
    targetCloseDate: course.metadata.targetCloseDate,
    currentVersion: course.metadata.currentVersion,
    priority: course.metadata.priority,
    riskLevel: course.metadata.riskLevel,
  };
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



function defaultProductFormat(stage: CourseProductStage): CourseProductMutationInput['format'] {
  switch (stage) {
    case 'microcurriculo':
      return 'Sílabus';
    case 'arquitectura':
      return 'Lineamiento';
    case 'escritura':
      return 'Actividad';
    case 'validacion':
      return 'Documento';
    case 'multimedia':
      return 'HTML';
    case 'qa':
      return 'Rúbrica';
    case 'entrega':
      return 'Documento';
    default:
      return 'Documento';
  }
}

function defaultProductOwner(stage: CourseProductStage): Role {
  switch (stage) {
    case 'microcurriculo':
      return 'Coordinador';
    case 'arquitectura':
      return 'Diseñador instruccional';
    case 'escritura':
      return 'Experto';
    case 'validacion':
      return 'Diseñador instruccional';
    case 'multimedia':
      return 'Diseñador multimedia';
    case 'qa':
      return 'Analista QA';
    case 'entrega':
      return 'Coordinador';
    default:
      return 'Coordinador';
  }
}

function makeCourseProductForm(stage: CourseProductStage = 'microcurriculo'): CourseProductMutationInput {
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
    case 'microcurriculo':
      return 'Microcurrículo';
    case 'arquitectura':
      return 'Arquitectura';
    case 'planeacion':
      return 'Planeación';
    case 'escritura':
      return 'Escritura';
    case 'validacion':
      return 'Validación';
    case 'multimedia':
      return 'Multimedia';
    case 'qa':
      return 'QA';
    case 'entrega':
      return 'Entrega';
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
    case 'microcurriculo':
      return ['Sílabus', 'Documento'];
    case 'arquitectura':
      return ['Lineamiento', 'Documento'];
    case 'escritura':
      return ['Actividad', 'Recurso', 'Documento'];
    case 'validacion':
      return ['Lectura', 'Documento'];
    case 'multimedia':
      return ['HTML', 'Pódcast', 'Lectura', 'Infografía'];
    case 'qa':
      return ['Rúbrica', 'Documento'];
    case 'entrega':
      return ['Documento'];
    default:
      return ['Documento'];
  }
}

function joinTags(tags: string[]) {
  return tags.join(', ');
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function makeStageNoteDrafts(course: Course | undefined) {
  if (!course) {
    return {
      microcurriculo: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      arquitectura: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      planeacion: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      escritura: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      validacion: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      multimedia: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      lms: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      qa: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      entrega: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
    } satisfies Record<CourseStageNoteKey, CourseStageNoteMutationInput>;
  }

  return {
    microcurriculo: {
      status: 'Listo',
      summary: 'Base curricular consolidada',
      evidence: [],
      blockers: [],
    },
    arquitectura: {
      status: course.stageNotes.arquitectura?.status ?? 'Pendiente',
      summary: course.stageNotes.arquitectura?.summary ?? '',
      evidence: course.stageNotes.arquitectura?.evidence ?? [],
      blockers: course.stageNotes.arquitectura?.blockers ?? [],
    },
    planeacion: {
      status: course.stageNotes.planeacion?.status ?? 'Pendiente',
      summary: course.stageNotes.planeacion?.summary ?? '',
      evidence: course.stageNotes.planeacion?.evidence ?? [],
      blockers: course.stageNotes.planeacion?.blockers ?? [],
    },
    escritura: {
      status: course.stageNotes.escritura?.status ?? 'Pendiente',
      summary: course.stageNotes.escritura?.summary ?? '',
      evidence: course.stageNotes.escritura?.evidence ?? [],
      blockers: course.stageNotes.escritura?.blockers ?? [],
    },
    validacion: {
      status: course.stageNotes.validacion?.status ?? 'Pendiente',
      summary: course.stageNotes.validacion?.summary ?? '',
      evidence: course.stageNotes.validacion?.evidence ?? [],
      blockers: course.stageNotes.validacion?.blockers ?? [],
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
      status: course.stageNotes.qa?.status ?? 'Pendiente',
      summary: course.stageNotes.qa?.summary ?? '',
      evidence: course.stageNotes.qa?.evidence ?? [],
      blockers: course.stageNotes.qa?.blockers ?? [],
    },
    entrega: {
      status: course.stageNotes.entrega?.status ?? 'Pendiente',
      summary: course.stageNotes.entrega?.summary ?? '',
      evidence: course.stageNotes.entrega?.evidence ?? [],
      blockers: course.stageNotes.entrega?.blockers ?? [],
    },
  } satisfies Record<CourseStageNoteKey, CourseStageNoteMutationInput>;
}

function joinLines(values: string[]): string {
  return values.join('\n');
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item: string) => item.trim())
    .filter(Boolean);
}




export function CourseWorkspacePage({
  role,
  userRole,
  appData,
  isLoading,
  refreshAppData,
  mutateAppData,
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


  const { activeModal, isOpen: isGlobalModalOpen, open: openModal, close: closeModal } = useModalStore();
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [isEditingCourseMetadata, setIsEditingCourseMetadata] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isTeamComposerOpen, setIsTeamComposerOpen] = useState(false);
  const [productComposerStage, setProductComposerStage] = useState<CourseProductStage | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [stageNoteError, setStageNoteError] = useState<string | null>(null);
  const [isCourseSaving, setIsCourseSaving] = useState(false);
  const [isMetadataSaving, setIsMetadataSaving] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [isTeamSaving, setIsTeamSaving] = useState<string | null>(null);
  const [isProductSaving, setIsProductSaving] = useState<string | null>(null);
  const [isStageNoteSaving, setIsStageNoteSaving] = useState<CourseStageNoteKey | null>(null);
  const [stageNoteDrafts, setStageNoteDrafts] = useState<
    Record<CourseStageNoteKey, CourseStageNoteMutationInput>
  >(() => makeStageNoteDrafts(course));
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    course
      ? syncCourseStructureFields(appData, makeCourseForm(course))
      : syncCourseStructureFields(appData, buildEmptyCourseForm(currentStageId)),
  );

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [activeAddSection, setActiveAddSection] = useState<string>('');
  const [newTaskForm, setNewTaskForm] = useState<TaskMutationInput>(() =>
    makeTaskForm(currentCourseSlug, currentStageId),
  );

  // Microcurriculo Assistant States
  const [microStep, setMicroStep] = useState<1 | 2 | 3>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; key: string } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [hasRestartedAnalysis, setHasRestartedAnalysis] = useState(false);
  const [isVerifyingAnalysis, setIsVerifyingAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [isGeneratingArchitecture, setIsGeneratingArchitecture] = useState(false);
  const [architectureStep, setArchitectureStep] = useState('');
  const [architectureProgress, setArchitectureProgress] = useState(0);
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
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
      status: 'En curso',
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
        units: [],
        methodology: '',
        evaluation: [],
        bibliography: [],
        targetCloseDate: new Date().toISOString().slice(0, 10),
        currentVersion: 'v1.0',
        priority: 'Media',
        riskLevel: 'Bajo',
        route: '',
      },
      auditLog: [],
      stageNotes: {
        microcurriculo: {
          owner: 'Diseñador instruccional',
          heading: 'Microcurrículo y base curricular',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        arquitectura: {
          owner: 'Diseñador instruccional',
          heading: 'Arquitectura de aprendizaje',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        planeacion: {
          owner: 'Coordinador',
          heading: 'Planeación operativa',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        escritura: {
          owner: 'Experto',
          heading: 'Escritura y autoría',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        validacion: {
          owner: 'Diseñador instruccional',
          heading: 'Validación instruccional',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        multimedia: {
          owner: 'Diseñador multimedia',
          heading: 'Producción multimedia',
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
          heading: 'QA y validación final',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        entrega: {
          owner: 'Coordinador',
          heading: 'Entrega final y cierre',
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
  const [newTeamMemberForm, setNewTeamMemberForm] = useState<TeamMemberMutationInput>(() =>
    makeTeamMemberForm(),
  );
  const [newProductForm, setNewProductForm] = useState<CourseProductMutationInput>(() =>
    makeCourseProductForm(),
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskMutationInput>>(() =>
    makeTaskDrafts(relatedTasks),
  );
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamMemberMutationInput>>(() =>
    makeTeamMemberDrafts(course?.team ?? []),
  );
  const [productDrafts, setProductDrafts] = useState<Record<string, CourseProductMutationInput>>(() =>
    makeCourseProductDrafts(course?.products ?? []),
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
  const academicPeriodOptions = uniqueOptions(
    getInstitutionAcademicPeriods(appData.institution, currentInstitution),
  );
  const courseTypeOptions = uniqueOptions(
    getInstitutionCourseTypes(appData.institution, currentInstitution),
  );
  getInstitutionPedagogicalGuidelines(
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
    closeModal();
    closeModal();
    setIsTeamComposerOpen(false);
    setProductComposerStage(null);
  }

  useEffect(() => {
    if (activeSection === 'microcurriculo' && course && !analysisResult && !hasRestartedAnalysis) {
      if (
        (course.metadata.learningOutcomes && course.metadata.learningOutcomes.length > 0) ||
        (course.metadata.units && course.metadata.units.length > 0) ||
        (course.summary && course.summary.trim() !== '')
      ) {
        setMicroStep(3);
        setAnalysisResult({
          facultad: course.faculty || '',
          programa: course.program || '',
          semestre: course.metadata.semester || '',
          tipoCurso: course.metadata.courseType || '',
          creditos: course.credits || 0,
          descripcionCurso: course.summary || '',
          resultadosAprendizaje: Array.isArray(course.metadata.learningOutcomes) ? course.metadata.learningOutcomes : [],
          unidades: Array.isArray(course.metadata.units) ? course.metadata.units : [],
          metodologia: course.metadata.methodology || '',
          evaluacion: Array.isArray(course.metadata.evaluation) ? course.metadata.evaluation : [],
          bibliografia: Array.isArray(course.metadata.bibliography) ? course.metadata.bibliography : [],
        });
      }
    }
  }, [activeSection, course, analysisResult, hasRestartedAnalysis]);

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
        units: [],
        methodology: '',
        evaluation: [],
        bibliography: [],
        targetCloseDate: new Date().toISOString().slice(0, 10),
        currentVersion: 'v1.0',
        priority: 'Media',
        riskLevel: 'Bajo',
      }));
      setTaskDrafts({});
      setTeamDrafts({});
      setProductDrafts({});
      setProductComposerStage(null);
      closeModal();
      setStageNoteDrafts(makeStageNoteDrafts(undefined));
      return;
    }

    setCourseForm(syncCourseStructureFields(appData, makeCourseForm(course)));
    setMetadataForm(makeMetadataForm(course));
    setTaskDrafts(makeTaskDrafts(relatedTasks));
    setTeamDrafts(makeTeamMemberDrafts(course.team));
    setProductDrafts(makeCourseProductDrafts(course.products));
    setProductComposerStage(null);
    closeModal();
    setStageNoteDrafts(makeStageNoteDrafts(course));
  }, [
    appData,
    appData.tasks,
    course,
    currentCourseSlug,
    currentStageId,
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
    courseError,
    metadataError,
    productError,
    showAlert,
    stageNoteError,
    taskError,
    teamError,
  ]);

  if (!course) {
    if (isLoading) {
      return (
        <div className="page-stack h-full min-h-[80vh] flex flex-col items-center justify-center">
          <section className="flex w-full flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-500">
            <Loader2 className="animate-spin text-ocean w-12 h-12" />
            <div className="flex flex-col gap-1">
              <h3 className="font-medium text-lg text-primary">Cargando expediente del curso...</h3>
              <p className="text-sm text-secondary max-w-[300px]">Conectando de forma segura con la base de datos.</p>
            </div>
          </section>
        </div>
      );
    }

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
  const relatedResources = appData.libraryResources.filter(
    (resource) => resource.courseSlug === currentCourse.slug,
  );
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
  const handoffBlockingCount =
    (workflowSettings.handoffBlocksOnBlockedCheckpoints ? blockingCheckpoints.length : 0) +
    (workflowSettings.handoffBlocksOnCriticalObservations ? criticalObservations.length : 0);
  const isHandoffReady =
    checkpointRequirementMet &&
    blockedCheckpointRequirementMet &&
    criticalObservationRequirementMet;
  const deliverablesOpenCount = currentCourse.deliverables.filter(
    (deliverable) => deliverable.status !== 'Listo',
  ).length;
  const totalActivities = currentCourse.modules.reduce((sum, module) => sum + module.activities, 0);
  const pendingTasksCount = relatedTasks.filter((task) => task.status !== 'Lista').length;
  const pendingObservationsCount = currentCourse.observations.filter(
    (observation) => observation.status !== 'Resuelta',
  ).length;
  const resolvedObservationsCount = currentCourse.observations.length - pendingObservationsCount;
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

  function countProductsByStage(stageId: CourseProductStage) {
    return currentCourse.products.filter((product) => product.stage === stageId).length;
  }

  const planeacionStatus =
    currentCourse.team.length === 0
      ? 'Pendiente'
      : upcomingMilestones.length === 0
        ? 'En curso'
        : teamCoverage.length >= 3
          ? 'Completado'
          : 'En curso';
  const notificationStatus =
    currentCourse.status === 'Entregado'
      ? 'Completado'
      : isHandoffReady
        ? 'En curso'
        : !checkpointRequirementMet || handoffBlockingCount > 0
          ? 'Pendiente'
          : 'En curso';
  const workflowStages = [
    {
      key: 'microcurriculum',
      stageId: 'microcurriculo',
      section: 'microcurriculo' as CourseSection,
      title: 'Microcurrículo',
      owner: 'Diseñador instruccional',
      status: 'Completado',
      summary: 'Base curricular y sílabus',
      actionLabel: 'Abrir microcurrículo',
    },
    {
      key: 'arquitectura',
      stageId: 'arquitectura',
      section: 'arquitectura' as CourseSection,
      title: 'Arquitectura',
      owner: 'Diseñador instruccional',
      status: currentCourse.stageNotes.arquitectura?.status ?? 'Pendiente',
      summary: 'Estructura modular y blueprints',
      actionLabel: 'Abrir arquitectura',
    },
    {
      key: 'planeacion',
      stageId: 'planeacion',
      section: 'planeacion' as CourseSection,
      title: 'Planeación',
      owner: 'Coordinador',
      status: planeacionStatus,
      summary: 'Hitos y asignaciones de equipo',
      actionLabel: 'Abrir planeación',
    },
    {
      key: 'writing',
      stageId: 'escritura',
      section: 'escritura' as CourseSection,
      title: 'Escritura',
      owner: 'Experto / Autor',
      status: currentCourse.stageNotes.escritura?.status ?? 'En curso',
      summary: 'Producción de contenidos base',
      actionLabel: 'Abrir fase escritura',
    },
    {
      key: 'validation',
      stageId: 'validacion',
      section: 'validacion' as CourseSection,
      title: 'Validación instruccional',
      owner: 'Diseñador instruccional',
      status: currentCourse.stageNotes.validacion?.status ?? 'Pendiente',
      summary: 'Revisión pedagógica',
      actionLabel: 'Abrir validación',
    },
    {
      key: 'multimedia',
      stageId: 'multimedia',
      section: 'multimedia' as CourseSection,
      title: 'Producción multimedia',
      owner: 'Diseñador gráfico / Realizador',
      status: currentCourse.stageNotes.multimedia?.status ?? 'Pendiente',
      summary: 'Diseño y piezas audiovisuales',
      actionLabel: 'Abrir multimedia',
    },
    {
      key: 'lms',
      stageId: 'lms',
      section: 'lms' as CourseSection,
      title: 'LMS',
      owner: 'Gestor LMS',
      status: currentCourse.stageNotes.lms?.status ?? 'Pendiente',
      summary: 'Montaje en plataforma',
      actionLabel: 'Abrir montaje',
    },
    {
      key: 'qa',
      stageId: 'qa',
      section: 'qa' as CourseSection,
      title: 'QA',
      owner: 'Analista QA',
      status: currentCourse.stageNotes.qa?.status ?? 'Pendiente',
      summary: 'Control de calidad final',
      actionLabel: 'Abrir QA',
    },
    {
      key: 'delivery',
      stageId: 'entrega',
      section: 'entrega' as CourseSection,
      title: 'Entrega',
      owner: 'Coordinador',
      status: currentCourse.stageNotes.entrega?.status ?? notificationStatus,
      summary: 'Cierre y notificación',
      actionLabel: 'Abrir entrega',
    },
  ];

  const isWorkflowPage = activeSection === 'summary';
  const isFocusedStudio =
    !isWorkflowPage && experienceSettings.studioMode === 'Profundo';
  const focusedStageMeta =
    activeSection === 'summary'
      ? null
      : activeSection === 'microcurriculo'
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
        : activeSection === 'arquitectura'
          ? {
              eyebrow: 'Arquitectura',
              title: 'Zona dedicada de arquitectura',
              description:
                'Diseña módulos, actividades y la lógica instruccional del curso desde una sola capa de trabajo.',
              stats: [
                { label: 'Módulos', value: String(currentCourse.modules.length) },
                { label: 'Actividades', value: String(totalActivities) },
                { label: 'Blueprints', value: String(countProductsByStage('arquitectura')) },
              ],
            }
          : activeSection === 'planeacion'
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
          : activeSection === 'escritura'
            ? {
                eyebrow: 'Escritura',
                title: 'Zona dedicada de escritura',
                description:
                  'Fase de redacción y desarrollo de contenidos instruccionales detallados.',
                stats: [
                  { label: 'Entregables', value: String(deliverablesOpenCount) },
                  { label: 'Hitos', value: String(upcomingMilestones.length) },
                  { label: 'Tareas', value: String(pendingTasksCount) },
                ],
              }
          : activeSection === 'validacion'
            ? {
                eyebrow: 'Validación instruccional',
                title: 'Zona dedicada de validación',
                description:
                  'Revisión pedagógica y de estilo para asegurar la calidad instruccional del contenido.',
                stats: [
                  { label: 'Observaciones', value: String(pendingObservationsCount) },
                  { label: 'Correcciones', value: String(deliverablesOpenCount) },
                  { label: 'Checkpoints', value: 'Revisado' },
                ],
              }
          : activeSection === 'multimedia'
            ? {
                eyebrow: 'Producción multimedia',
                title: 'Zona dedicada de producción',
                description:
                  'Diseño gráfico, piezas audiovisuales y recursos multimedia asociados al curso.',
                stats: [
                  { label: 'Recursos', value: String(curatedResources.length + ownedResources.length) },
                  { label: 'Entregables', value: String(deliverablesOpenCount) },
                  { label: 'Productos', value: String(countProductsByStage('escritura')) },
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
                eyebrow: 'QA',
                title: 'Zona dedicada de control de calidad',
                description:
                  'Gestión de hallazgos finales y pruebas de usuario antes del lanzamiento oficial.',
                stats: [
                  { label: 'Observaciones', value: String(pendingObservationsCount) },
                  { label: 'Bloqueos', value: String(blockingCheckpoints.length) },
                  { label: 'Check', value: 'Auditado' },
                ],
              }
          : activeSection === 'entrega'
            ? {
                eyebrow: 'Entrega',
                title: 'Zona de entrega final',
                description:
                  'Cierre del proyecto, transferencia al cliente y notificación de culminación.',
                stats: [
                  { label: 'Estado', value: currentCourse.status },
                  { label: 'Cierre', value: currentCourse.metadata.targetCloseDate },
                  { label: 'Historial', value: 'Disponible' },
                ],
              }
          : null;
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

  function extractPreviewItems(body: string): string[] {
    const lines: string[] = splitLines(body);
    const bulletLines: string[] = lines.filter((line: string) => /^[-*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line));
    const source: string[] = bulletLines.length > 0 ? bulletLines : lines;

    return source.map((line: string) => cleanPreviewLine(line)).filter(Boolean);
  }

  function productTemplateActionLabel(stageId: CourseProductStage) {
    switch (stageId) {
      case 'microcurriculo':
        return 'Cargar sílabus base';
      case 'arquitectura':
        return 'Cargar blueprint';
      case 'escritura':
        return 'Construir por módulos';
      case 'validacion':
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
      case 'microcurriculo':
        return 'Documento marco del curso con ficha académica, resultados, metodología y referencias.';
      case 'arquitectura':
        return 'Define la experiencia de aprendizaje, la secuencia pedagógica y la lógica modular del curso.';
      case 'escritura':
        return 'Agrupa la autoría del curso: actividades, instrucciones, recursos y materiales de trabajo.';
      case 'validacion':
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
  ): string {
    switch (stageId) {
      case 'microcurriculo':
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
          ...currentCourse.metadata.learningOutcomes.map((item: string) => `- ${item}`),
          '',
          '# Temas clave',
          ...currentCourse.metadata.topics.map((item: string) => `- ${item}`),
          '',
          '# Metodología',
          currentCourse.metadata.methodology,
          '',
          '# Evaluación',
          currentCourse.metadata.evaluation,
          '',
          '# Bibliografía base',
          ...currentCourse.metadata.bibliography.map((item: string) => `- ${item}`),
        ].join('\n');
      case 'arquitectura':
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
      case 'escritura':
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
      case 'validacion':
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

        {product.stage === 'microcurriculo' ? (
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

        {product.stage === 'arquitectura' ? (
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

        {product.stage === 'escritura' ? (
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

        {product.stage === 'validacion' ? (
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
        extractPreviewItems(sections['Evaluación']?.join('\n') ?? '').length > 0
          ? extractPreviewItems(sections['Evaluación']?.join('\n') ?? '')
          : Array.isArray(currentCourse.metadata.evaluation) ? currentCourse.metadata.evaluation : typeof currentCourse.metadata.evaluation === 'string' ? [currentCourse.metadata.evaluation] : [],
      bibliography:
        parsedBibliography.length > 0 ? parsedBibliography : currentCourse.metadata.bibliography,
    };
  }

  function buildGeneralStructuredBody(input: {
    outcomes: string[];
    topics: string[];
    methodology: string;
    evaluation: string[];
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
      ...input.evaluation.map((item) => `- ${item}`),
      '',
      '# Bibliografía base',
      ...input.bibliography.map((item) => `- ${item}`),
    ].join('\n');
  }

  function parseProductionStructuredProduct(body: string) {
    const blocks = body
      .split(/\n(?=#\s+(?:Módulo|Unidad)\s+\d+:)/)
      .map((block: string) => block.trim())
      .filter(Boolean);

    return currentCourse.modules.map((module, index: number) => {
      const block = blocks[index] ?? '';
      const lines = splitLines(block);
      const activitiesStart = lines.findIndex((line: string) => line.startsWith('Actividades:'));
      const activities = lines
        .slice(activitiesStart >= 0 ? activitiesStart + 1 : 0)
        .filter((line: string) => /^[-*]\s+/.test(line))
        .map((line: string) =>
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
            : Array.from({ length: Math.max(module.activities, 1) }, (_: unknown, activityIndex: number) =>
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
      .map((module: { title: string; objective: string; ownResources: number; curatedResources: number; activities: string[] }, index: number) =>
        [
          `# Módulo ${index + 1}: ${module.title}`,
          `Objetivo: ${module.objective}`,
          'Actividades:',
          ...module.activities.map((activity: string) => `- ${activity}`),
          `Recursos propios de apoyo: ${module.ownResources}`,
          `Recursos curados de apoyo: ${module.curatedResources}`,
        ].join('\n'),
      )
      .join('\n\n');
  }

  type QaCriterionStatus = 'Pendiente' | 'Ajuste' | 'Cumple';

  function parseQaStructuredProduct(body: string) {
    const criteria = splitLines(body)
      .filter((line: string) => /^[-*]\s+/.test(line))
      .map((line: string) => {
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
      .filter((criterion: { label: string }) => criterion.label);

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
      ...criteria.map((criterion: { status: QaCriterionStatus; score: number; label: string }) => `- [${criterion.status}|${criterion.score}] ${criterion.label}`),
    ].join('\n');
  }

  function renderStructuredProductEditor(
    product: CourseProductMutationInput,
    onPatch: (patch: Partial<CourseProductMutationInput>) => void,
  ) {
    if (product.stage === 'microcurriculo') {
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

          <div className="space-y-6">
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <Target size={14} className="text-coral" />
                <span>Resultados de aprendizaje</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={joinLines(structured.outcomes)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      outcomes: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Un resultado por línea..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <Layers size={14} className="text-ocean" />
                <span>Temas clave / Núcleos temáticos</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={joinLines(structured.topics)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      topics: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Un tema por línea..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <PenTool size={14} className="text-sage" />
                <span>Metodología pedagógica</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={structured.methodology}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      methodology: event.target.value,
                    }),
                  })
                }
                placeholder="Descripción de la estrategia de enseñanza..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <ClipboardCheck size={14} className="text-gold" />
                <span>Evaluación y seguimiento</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={joinLines(structured.evaluation)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      evaluation: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Criterios y momentos de evaluación..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <BookOpen size={14} className="text-ink" />
                <span>Bibliografía base</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea italic"
                value={joinLines(structured.bibliography)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      bibliography: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Referencias principales..."
              />
            </div>
          </div>
        </div>
      );
    }

    if (product.stage === 'escritura') {
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
                              const nextModules = modules.map((currentModule: { moduleId: string; title: string; objective: string; ownResources: number; curatedResources: number; activities: string[] }, currentIndex: number) =>
                                currentIndex === moduleIndex
                                  ? {
                                      ...currentModule,
                                      activities: currentModule.activities.map((item: string, currentActivityIndex: number) =>
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
                            const nextModules = modules.map((currentModule: { moduleId: string; title: string; objective: string; ownResources: number; curatedResources: number; activities: string[] }, currentIndex: number) =>
                              currentIndex === moduleIndex
                                ? {
                                    ...currentModule,
                                    activities: currentModule.activities.filter(
                                      (_: string, currentActivityIndex: number) => currentActivityIndex !== activityIndex,
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
          ? (criteria.reduce((sum: number, criterion: { score: number }) => sum + criterion.score, 0) / criteria.length).toFixed(1)
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
                        const nextCriteria = criteria.map((item: { label: string; status: QaCriterionStatus; score: number }, currentIndex: number) =>
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
                          const nextCriteria = criteria.map((item: { label: string; status: QaCriterionStatus; score: number }, currentIndex: number) =>
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
                          const nextCriteria = criteria.map((item: { label: string; status: QaCriterionStatus; score: number }, currentIndex: number) =>
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
                      const nextCriteria = criteria.filter((_: unknown, currentIndex: number) => currentIndex !== index);

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

    const originalAppData = { ...appData };

    try {
      // Optimistic update
      mutateAppData((current) => ({
        ...current,
        courses: current.courses.map((c) =>
          c.slug === currentCourse.slug
            ? {
                ...c,
                ...courseForm,
                metadata: { ...c.metadata, ...courseForm },
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : c,
        ),
      }));

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
      setIsEditingCourse(false);
    } catch (error) {
      // Rollback
      mutateAppData(originalAppData);
      setCourseError(error instanceof Error ? error.message : 'No fue posible actualizar el curso.');
    } finally {
      setIsCourseSaving(false);
    }
  }

  async function handleMetadataSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMetadataSaving(true);
    setMetadataError(null);

    const originalAppData = { ...appData };

    try {
      // Optimistic update
      mutateAppData((current) => ({
        ...current,
        courses: current.courses.map((c) =>
          c.slug === currentCourse.slug
            ? {
                ...c,
                metadata: { ...c.metadata, ...metadataForm },
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : c,
        ),
      }));

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
      // Rollback
      mutateAppData(originalAppData);
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
      closeModal();
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

  async function handleGenerateArchitecture() {
    if (!currentCourse) return;

    const confirmed = await showConfirm({
      title: 'Actualizar arquitectura con IA',
      message: 'La IA analizará el microcurrículo y los lineamientos pedagógicos para proponer una estructura de productos. Los productos actuales se mantendrán y se añadirán los nuevos sugeridos.',
      tone: 'default',
      confirmLabel: 'Generar Arquitectura',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) return;

    setIsGeneratingArchitecture(true);
    setArchitectureProgress(5);
    setArchitectureStep('Iniciando diseño instruccional...');

    try {
      const response = await fetch('/api/generate-architecture', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          courseSlug: currentCourse.slug,
          institutionStructureId: currentCourse.institutionStructureId 
        }),
      });

      if (!response.ok) {
        let message = 'Error al conectar con el Arquitecto IA.';

        try {
          const payload = (await response.json()) as { error?: string; message?: string };
          message = payload.error ?? payload.message ?? message;
        } catch {
          try {
            const text = await response.text();
            if (text.trim()) {
              message = text.trim();
            }
          } catch {
            // Conserva el mensaje por defecto cuando no haya cuerpo legible.
          }
        }

        throw new Error(message);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No fue posible abrir el canal de la IA.');

      let streamBuffer = '';
      let generatedCount = 0;

      const processArchitectureEvent = async (rawChunk: string) => {
        if (!rawChunk.trim()) {
          return;
        }

        const dataLine = rawChunk
          .split('\n')
          .find((line) => line.startsWith('data: '));

        if (!dataLine) {
          return;
        }

        let payload: {
          progress?: number;
          step?: string;
          complete?: boolean;
          data?: {
            introduccion?: Array<Record<string, unknown>>;
            unidades?: Array<Record<string, unknown>>;
            cierre?: Array<Record<string, unknown>>;
          };
          error?: string;
        };

        try {
          payload = JSON.parse(dataLine.slice(6).trim());
        } catch (error) {
          console.error('Architecture event parse error:', error);
          return;
        }

        if (typeof payload.progress === 'number') {
          setArchitectureProgress(payload.progress);
        }

        if (payload.step) {
          setArchitectureStep(payload.step);
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        if (payload.complete && payload.data) {
          const suggested = payload.data;
          const allSuggested = [
            ...(suggested.introduccion ?? []),
            ...(suggested.unidades ?? []),
            ...(suggested.cierre ?? []),
          ];

          generatedCount = allSuggested.length;

          for (const item of allSuggested) {
            await fetch('/api/course-products', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                courseSlug: currentCourse.slug,
                title: String(item.title ?? '').trim(),
                summary: String(item.summary ?? '').trim(),
                format: String(item.format ?? '').trim(),
                stage: 'arquitectura',
                owner: userRole,
                status: 'Borrador',
                version: '1.0',
                section: String(item.section ?? '').trim(),
              })
            }).then(async (createResponse) => {
              if (!createResponse.ok) {
                const payload = (await createResponse.json().catch(() => null)) as { error?: string } | null;
                throw new Error(payload?.error ?? 'No fue posible guardar uno de los productos sugeridos.');
              }
            });
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        streamBuffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const chunks = streamBuffer.split('\n\n');
        streamBuffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          await processArchitectureEvent(chunk);
        }

        if (done) {
          if (streamBuffer.trim()) {
            await processArchitectureEvent(streamBuffer);
          }
          break;
        }
      }

      refreshAppData();
      await showAlert({
        tone: 'success',
        title: 'Arquitectura actualizada',
        message:
          generatedCount > 0
            ? `Se integraron ${generatedCount} productos sugeridos a la arquitectura del curso.`
            : 'La IA completó la revisión, pero no propuso productos nuevos para integrar.',
      });
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Falla crítica en el Arquitecto IA.';
       await showAlert({ tone: 'error', title: 'Error de Arquitectura', message });
    } finally {
      setIsGeneratingArchitecture(false);
      setArchitectureStep('');
      setArchitectureProgress(0);
    }
  }

  function handleQuickAddProduct(sectionName: string) {
    if (!currentCourse) return;

    setNewProductForm({
      title: '',
      summary: '',
      format: 'Video',
      stage: 'arquitectura',
      owner: userRole,
      status: 'Borrador',
      body: '',
      tags: [],
      version: '1.0',
      section: sectionName,
    });
    setActiveAddSection(sectionName);
    setIsAddProductModalOpen(true);
  }

  async function handleCreateProduct() {
     if (!currentCourse || !newProductForm.title) return;

     setIsProductSaving('new');
     try {
       const response = await fetch('/api/course-products', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           courseSlug: currentCourse.slug,
           ...newProductForm,
         })
       });

       if (!response.ok) throw new Error('Error al crear el producto');
       
       setIsAddProductModalOpen(false);
       refreshAppData();
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Error al crear producto';
       setProductError(message);
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





  function renderStageNoteEditor(
    noteKey: CourseStageNoteKey,
    eyebrow: string,
    title: string,
    description: string,
  ) {
    const note = currentCourse.stageNotes[noteKey];
    const draft = stageNoteDrafts[noteKey];
    const canEdit = canEditStageNote(userRole, note.owner);
    const isEditorOpen = activeModal === `stage-note:${noteKey}`;

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
                  onClick={() => openModal(`stage-note:${noteKey}`)}
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
          <SidePanel
            isOpen={canEdit && isEditorOpen}
            title={title}
            description="La bitácora se edita en un panel lateral para preservar el foco de la página principal."
            sideLabel="Ficha"
            sideDescription="OPERATIVA"
            width="xl"
            onClose={closeWorkspaceOverlay}
            footer={
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="cta-button"
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
            }
          >
            <div className="editor-card editor-card--task modal-stack-clean">
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
            </div>
          </SidePanel>
        ) : null}
      </>
    );
  }

  async function handleMicroFileDelete() {
    if (!uploadedFile) return;
    try {
      await fetch(`/api/files?key=${encodeURIComponent(uploadedFile.key)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      setUploadedFile(null);
      setMicroStep(1);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  async function handleMicroAnalysis() {
    if (!uploadedFile) return;
    setIsAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisStatus('Estableciendo conexión segura...');
    
    try {
      const response = await fetch('/api/analyze-microcurriculo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: uploadedFile.key }),
      });

      if (!response.ok || !response.body) {
        throw new Error('El servidor devolvió un error inesperado al conectar el stream de datos.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; 

        for (const msg of messages) {
          if (msg.startsWith('data: ')) {
            const payload = JSON.parse(msg.substring(6));
            
            if (payload.error) throw new Error(payload.error);
            
            if (payload.complete || payload.progress === 100) {
              setAnalysisResult(payload.data);
              setMicroStep(3);
            } else if (payload.progress) {
              setAnalysisProgress(payload.progress);
              setAnalysisStatus(payload.step);
            }
          }
        }
      }
    } catch (error) {
      showAlert({
        title: 'Error de Análisis',
        message: error instanceof Error ? error.message : 'No fue posible analizar el archivo.',
        tone: 'error'
      });
      setMicroStep(1);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function renderMicrocurriculoWizard() {
    if (!course) return null;

    return (
      <div className="surface section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Paso {microStep} de 3</span>
            <h3>Configuración del Microcurrículo</h3>
          </div>
          <div className="wizard-stepper">
            <button 
              type="button"
              className={`step-dot ${microStep >= 1 ? 'is-active' : ''} cursor-pointer transition-transform hover:scale-110`} 
              onClick={() => setMicroStep(1)} 
            />
            <div className={`step-line ${microStep >= 2 ? 'is-active' : ''}`} />
            <button 
              type="button"
              className={`step-dot ${microStep >= 2 ? 'is-active' : ''} ${uploadedFile ? 'cursor-pointer transition-transform hover:scale-110' : 'opacity-50 cursor-not-allowed'}`} 
              disabled={!uploadedFile}
              onClick={() => { if (uploadedFile) setMicroStep(2); }} 
            />
            <div className={`step-line ${microStep >= 3 ? 'is-active' : ''}`} />
            <button 
              type="button"
              className={`step-dot ${microStep >= 3 ? 'is-active' : ''} ${analysisResult ? 'cursor-pointer transition-transform hover:scale-110' : 'opacity-50 cursor-not-allowed'}`} 
              disabled={!analysisResult}
              onClick={() => { if (analysisResult) setMicroStep(3); }} 
            />
          </div>
        </div>

        <div className="wizard-content py-8">
          {microStep === 1 && (
            <div className="assistant-dropzone">
              <input
                type="file"
                id="micro-upload"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('scope', 'course');
                  formData.append('folder', course.slug);

                  try {
                    setIsAnalyzing(true);
                    const res = await fetch('/api/uploads', {
                      method: 'POST',
                      body: formData
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    
                    setUploadedFile({ url: data.url, key: data.key });
                    setMicroStep(2);
                  } catch (err: any) {
                    showAlert({ title: 'Error de Carga', message: err.message, tone: 'error' });
                  } finally {
                    setIsAnalyzing(false);
                  }
                }}
              />
              <label htmlFor="micro-upload" className="dropzone-label">
                <div className="dropzone-icon">
                  <FileUp size={48} className="text-ocean" />
                </div>
                <strong>Arrastre aquí o cargue el microcurrículo del curso</strong>
                <p className="text-muted text-sm mt-2">Soporta PDF, Word (DOC/DOCX) y Excel (XLS/XLSX)</p>
              </label>
            </div>
          )}

          {microStep === 2 && uploadedFile && (
            <div className="analysis-board">
              <div className="analysis-card">
                <FileText size={32} className="text-ocean" />
                <div className="flex-1">
                  <strong>Documento cargado correctamente</strong>
                  <p className="text-xs text-muted font-mono">{uploadedFile.key.split('/').pop()}</p>
                </div>
                <button className="danger-button danger-button--ghost" onClick={handleMicroFileDelete}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center py-12 gap-6 w-full">
                {analysisResult && !isAnalyzing ? (
                  <div className="w-full max-w-sm mb-4 animate-in fade-in py-6 px-4 bg-sage/10 rounded-xl border border-sage/20 text-center flex flex-col items-center">
                    <CheckCircle2 size={32} className="mb-2 text-sage" />
                    <strong className="text-secondary text-lg">Análisis estructurado listo</strong>
                    <p className="text-sm text-muted mt-1 mb-6">El documento ya fue analizado previamente.</p>
                    <button className="cta-button w-full justify-center" onClick={() => setMicroStep(3)}>
                      Continuar a revisión final <MoveRight size={16} className="ml-2" />
                    </button>
                    <button className="ghost-button w-full justify-center mt-3 text-xs" onClick={handleMicroAnalysis}>
                      <RefreshCcw size={14} className="mr-1 inline-block" /> Extraer de nuevo
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-muted max-w-md">
                      {isAnalyzing ? 'El sistema está procesando el archivo en tiempo real. Por favor, manten la ventana abierta.' : 'El asistente de IA está listo para extraer la información académica, resultados de aprendizaje y unidades del documento.'}
                    </p>
                    
                    {isAnalyzing && (
                      <div className="w-full max-w-sm mb-2 animate-in fade-in duration-500">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-ocean font-medium">{analysisStatus}</span>
                          <span className="text-ocean font-bold">{analysisProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div 
                            className="bg-ocean h-full rounded-full transition-all duration-300 ease-out" 
                            style={{ width: `${analysisProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <button 
                      className="cta-button cta-button--large outline-none" 
                      onClick={handleMicroAnalysis}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                      <span>{isAnalyzing ? analysisStatus : 'Importar y Analizar Datos'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {microStep === 3 && analysisResult && (
            <div className="success-board flex items-center justify-center min-h-[400px] w-full bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col items-center justify-center py-12 gap-5 w-full max-w-md animate-in zoom-in-95 duration-500">
                <div className="flex justify-center w-full mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-sage rounded-full opacity-20 animate-ping"></div>
                    <CheckCircle2 size={96} className="text-sage relative z-10 animate-bounce" />
                  </div>
                </div>
                <div className="text-center">
                  <h4 className="text-2xl text-secondary mb-2">Análisis Completado</h4>
                  <p className="text-muted leading-relaxed">Se ha extraído, depurado y validado la información académica del microcurrículo exitosamente.</p>
                </div>
                <div className="flex gap-4 mt-6">
                   <button 
                     className="ghost-button" 
                     onClick={async () => {
                       const confirmed = await showConfirm({
                         title: 'Reiniciar Análisis',
                         message: 'El análisis actual se eliminará de forma permanente y se iniciará un proceso nuevo en el paso 1. ¿Estás seguro que deseas continuar?',
                         confirmLabel: 'Aceptar',
                         tone: 'warning'
                       });
                       if (confirmed) {
                         setHasRestartedAnalysis(true);
                         setMicroStep(1);
                         setAnalysisResult(null);
                         setUploadedFile(null);
                       }
                     }}
                   >
                    Reiniciar análisis
                  </button>
                   <button className="ghost-button" onClick={() => setMicroStep(2)}>
                    Revisar archivo
                  </button>
                  <button className="cta-button" onClick={() => setIsVerifyingAnalysis(true)}>
                    <Search size={16} />
                    <span>Verificar / Editar Información</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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
    const isOverlayOpen = activeModal === overlayId;
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
                    openModal(overlayId);
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
          <SidePanel
            isOpen={isOverlayOpen}
            title={title}
            description="La edición detallada de productos vive en un panel lateral para mantener limpia la vista operativa."
            sideLabel="Prod"
            sideDescription="ESTUDIO"
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="page-stack modal-stack-clean">
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
                          )
                          }

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
          </SidePanel>
        ) : null}
      </>
    );
  }

  function renderArchitectureVisualizer() {
    if (!currentCourse) return null;

    const products = currentCourse.products || [];
    const units = currentCourse.metadata.units || [];
    
    // Categorización de productos estricta
    // Categorización de productos estricta por campo 'section'
    const introProducts = products.filter(p => 
      p.section === 'Introducción' || 
      (!p.section && (
        p.title.toLocaleLowerCase().includes('introducción') || 
        p.title.toLocaleLowerCase().includes('bienvenida') ||
        p.title.toLocaleLowerCase().includes('[introducción]')
      ))
    );
    
    const closureProducts = products.filter(p => 
      p.section === 'Cierre' || 
      (!p.section && (
        p.title.toLocaleLowerCase().includes('cierre') || 
        p.title.toLocaleLowerCase().includes('final') || 
        p.title.toLocaleLowerCase().includes('examen') ||
        p.title.toLocaleLowerCase().includes('[cierre]')
      ))
    );

    const unitProductsMap = units.map((unit, idx) => {
       const uNumber = idx + 1;
       const unitLabel = `Unidad ${uNumber}`;
       return {
         unit,
         products: products.filter(p => 
           p.section === unitLabel || 
           (!p.section && (
             p.title.toLocaleLowerCase().includes(`unidad ${uNumber}`) || 
             p.title.toLocaleLowerCase().includes(`[unidad ${uNumber}]`)
           ))
         )
       };
    });

    const institutionStructure = appData.institution.structures.find(
      (s) => s.id === currentCourse.institutionStructureId,
    );
    const guidelines = institutionStructure?.pedagogicalGuidelines || [];

    return (
      <div className="architecture-viewport-full architecture-map animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="architecture-header">
          <div className="flex items-center gap-4">
             <button 
               type="button"
               className="action-pill action-pill--guidelines" 
               onClick={() => setIsGuidelinesModalOpen(true)}
             >
               <ClipboardCheck size={16} />
               <span>Lineamientos Institucionales</span>
             </button>

             <div className="h-6 w-px bg-border/40 mx-2" />

             <button 
               type="button"
               className="cta-button shadow-lg shadow-ocean/20" 
               onClick={() => void handleGenerateArchitecture()}
               disabled={isGeneratingArchitecture}
             >
               {isGeneratingArchitecture ? (
                 <RefreshCcw size={16} className="animate-spin" />
               ) : (
                 <Sparkles size={16} />
               )}
               <span>{isGeneratingArchitecture ? 'Generando arquitectura...' : 'Propuesta IA (Lineamientos)'}</span>
             </button>

             <button 
               type="button"
               className="ghost-button ml-auto" 
               onClick={() => openModal(`products:arquitectura`)}
             >
               <PencilLine size={14} />
               <span>Inventario de productos</span>
             </button>
          </div>
        </header>

        <div className="architecture-grid architecture-grid--tripartite">
          {/* Columna 1: Introducción */}
          <div className="architecture-column">
            <div className="architecture-group">
              <div className="architecture-group__head">
                <h4 className="flex items-center"><BookOpen size={18} className="mr-2 text-ocean" /> Introducción</h4>
                <button className="icon-button icon-button--mini" onClick={() => handleQuickAddProduct('Introducción')}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                 {introProducts.length > 0 ? (
                   introProducts.map(product => renderArchitectureProductCard(product))
                 ) : (
                   <div className="empty-block">Sin recursos de inicio</div>
                 )}
              </div>
            </div>
          </div>

          {/* Columna 2: Desarrollo (Unidades Académicas) */}
          <div className="architecture-column architecture-column--main">
             <div className="grid grid-cols-2 gap-6">
                {unitProductsMap.map((entry, idx) => (
                    <div key={idx} className="architecture-group">
                      <div className="architecture-group__head">
                        <h4 className="flex items-center truncate">
                          <Layers size={18} className="mr-2 text-gold shrink-0" />
                          <span className="truncate">Unidad {idx + 1}</span>
                        </h4>
                        <button className="icon-button icon-button--mini" onClick={() => handleQuickAddProduct(`Unidad ${idx + 1}`)}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex flex-col gap-3">
                        {entry.products.length > 0 ? (
                          entry.products.map(product => renderArchitectureProductCard(product))
                        ) : (
                          <div className="empty-block">Pendiente recursos</div>
                        )}
                      </div>
                    </div>
                ))}
                {units.length === 0 && (
                   <div className="col-span-2 empty-state-block">
                      <Sparkles size={32} className="text-muted mb-4 opacity-40" />
                      <p>Extrae los datos del microcurrículo para mapear el desarrollo aquí.</p>
                   </div>
                )}
             </div>
          </div>

          {/* Columna 3: Cierre */}
          <div className="architecture-column">
            <div className="architecture-group">
              <div className="architecture-group__head">
                <h4 className="flex items-center"><MonitorPlay size={18} className="mr-2 text-sage" /> Cierre</h4>
                <button className="icon-button icon-button--mini" onClick={() => handleQuickAddProduct('Cierre')}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {closureProducts.length > 0 ? (
                   closureProducts.map(product => renderArchitectureProductCard(product))
                ) : (
                   <div className="empty-block">Pendiente cierre</div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {isGuidelinesModalOpen ? (
          <SidePanel
            isOpen={isGuidelinesModalOpen}
            title="Lineamientos institucionales"
            description="Marco normativo y pedagógico que rige el diseño de productos para este curso."
            sideLabel="Norma"
            sideDescription="PEDAGÓGICA"
            width="xl"
            onClose={() => setIsGuidelinesModalOpen(false)}
          >
            <div className="page-stack">
              <div className="list-stack">
                {guidelines.length > 0 ? (
                  guidelines.map((text, index) => (
                    <div key={index} className="list-item">
                      <div className="flex items-start gap-3">
                        <div className="status-dot status-dot--history mt-1" />
                        <p className="text-sm leading-relaxed">{text}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-block">
                    No hay lineamientos específicos configurados para esta institución.
                  </div>
                )}
              </div>
            </div>
          </SidePanel>
        ) : null}

        {/* Panel: Agregar Producto Manual */}
        {isAddProductModalOpen && (
          <SidePanel
            isOpen={isAddProductModalOpen}
            title={`Nuevo producto - ${activeAddSection}`}
            sideLabel="Prod"
            sideDescription="CREAR"
            width="xl"
            onClose={() => setIsAddProductModalOpen(false)}
            footer={
              <div className="flex justify-end gap-3 w-full">
                <button 
                  className="filter-chip" 
                  onClick={() => setIsAddProductModalOpen(false)}
                  disabled={isProductSaving === 'new'}
                >
                  Cancelar
                </button>
                <button 
                  className="cta-button" 
                  onClick={() => void handleCreateProduct()}
                  disabled={isProductSaving === 'new' || !newProductForm.title}
                >
                  {isProductSaving === 'new' ? (
                    <RefreshCcw size={16} className="animate-spin mr-2" />
                  ) : (
                    <Plus size={16} className="mr-2" />
                  )}
                  <span>Crear Producto</span>
                </button>
              </div>
            }
          >
            <div className="p-6 space-y-6">
              <div className="form-group">
                <label className="form-label">Nombre del producto</label>
                <input
                  type="text"
                  className="modern-input !text-lg"
                  value={newProductForm.title}
                  onChange={(e) => setNewProductForm({ ...newProductForm, title: e.target.value })}
                  placeholder="Ej: Video tutorial sobre X"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="form-label">Formato</label>
                  <div className="modern-select-wrapper">
                    <select
                      className="modern-select"
                      value={newProductForm.format}
                      onChange={(e) => setNewProductForm({ ...newProductForm, format: e.target.value as any })}
                    >
                      <option value="">Seleccionar formato</option>
                      <option value="Video">Video</option>
                      <option value="Pódcast">Pódcast</option>
                      <option value="Infografía">Infografía</option>
                      <option value="RED">RED</option>
                      <option value="Documento">Documento</option>
                      <option value="PDF">PDF</option>
                      <option value="Taller">Taller</option>
                      <option value="Lectura">Lectura</option>
                      <option value="Evaluación">Evaluación</option>
                    </select>
                    <ChevronDown className="modern-select-icon" size={18} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Estado Inicial</label>
                  <div className="modern-input bg-muted/5 font-bold text-muted/50 italic select-none">
                    Borrador (Predeterminado)
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción / Propósito</label>
                <textarea
                  rows={4}
                  className="modern-textarea"
                  value={newProductForm.summary}
                  onChange={(e) => setNewProductForm({ ...newProductForm, summary: e.target.value })}
                  placeholder="Describe brevemente qué se espera de este producto..."
                />
              </div>

              {productError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm flex items-center gap-3">
                  <AlertCircle size={18} />
                  <span>{productError}</span>
                </div>
              )}
            </div>
          </SidePanel>
        )}

        {isGeneratingArchitecture && (
          <div className="architecture-overlay animate-in fade-in duration-500">
             <div className="extraction-status-card surface shadow-2xl p-10 rounded-3xl flex flex-col items-center gap-8 max-w-md w-full">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-panel flex items-center justify-center">
                     <Sparkles size={40} className="text-ocean animate-pulse" />
                  </div>
                  <svg className="absolute top-0 left-0 w-24 h-24 -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      fill="none"
                      stroke="var(--ocean)"
                      strokeWidth="6"
                      strokeDasharray="276.46"
                      strokeDashoffset={276.46 - (276.46 * architectureProgress) / 100}
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="eyebrow block mb-2">Diseño Arquitectónico IA</span>
                  <h3 className="text-xl font-bold text-secondary mb-3">{architectureStep}</h3>
                  <p className="text-sm text-muted">Sincronizando productos con lineamientos pedagógicos institucionales.</p>
                </div>
                <div className="w-full bg-panel rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-ocean h-full transition-all duration-700" 
                    style={{ width: `${architectureProgress}%` }}
                  />
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  function renderProductFormatIcon(format: string, size = 16) {
    const f = format.toLocaleLowerCase();
    if (f.includes('video')) return <Video size={size} className="text-ocean" />;
    if (f.includes('pódcast')) return <Mic size={size} className="text-coral" />;
    if (f.includes('infografía')) return <BarChart3 size={size} className="text-gold" />;
    if (f.includes('red')) return <Globe size={size} className="text-ocean" />;
    if (f.includes('documento') || f.includes('pdf')) return <FileText size={size} className="text-muted" />;
    if (f.includes('actividad') || f.includes('taller')) return <PenTool size={size} className="text-sage" />;
    if (f.includes('lectura')) return <BookOpen size={size} className="text-ocean" />;
    if (f.includes('evaluación') || f.includes('examen')) return <Target size={size} className="text-coral" />;
    return <File size={size} className="text-muted" />;
  }

  function renderArchitectureProductCard(product: CourseProduct) {
    const isDone = product.status === 'Aprobado';
    const isActive = product.status === 'Borrador' || product.status === 'En revisión';
    
    return (
      <div 
        key={product.id} 
        className={`architecture-card group animate-in fade-in transition-all duration-300 cursor-pointer ${isDone ? 'opacity-70' : ''}`}
        onClick={() => {
           openModal(`products:arquitectura`);
        }}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 p-2.5 bg-white rounded-xl shadow-sm border border-line-strong group-hover:scale-110 transition-transform duration-300">
            {renderProductFormatIcon(product.format, 18)}
          </div>
          <div className="min-w-0 flex-grow">
            <div className="flex items-center justify-between gap-2 mb-1">
              <strong className="text-sm font-bold truncate group-hover:text-ocean transition-colors duration-300">
                {product.title}
              </strong>
              {isDone && <CheckCircle2 size={12} className="text-sage" />}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted/40">
                {product.format}
              </span>
              <div className="h-1 w-1 rounded-full bg-line" />
              <span className={`text-[10px] font-bold ${isActive ? 'text-ocean' : 'text-muted/60'}`}>
                {product.status}
              </span>
            </div>
            {product.summary && (
              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                {product.summary}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isFocusedStudio ? 'page-stack workspace-page workspace-page--focus' : 'page-stack workspace-page'}>

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
            ['microcurriculo', 'Microcurrículo'],
            ['arquitectura', 'Arquitectura'],
            ['planeacion', 'Planeación'],
            ['escritura', 'Escritura'],
            ['validacion', 'Validación instruccional'],
            ['multimedia', 'Producción multimedia'],
            ['lms', 'LMS'],
            ['qa', 'QA'],
            ['entrega', 'Entrega'],
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

      {activeSection !== 'arquitectura' && showFocusedStageHeader && focusedStageMeta ? (
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
              {activeSection === 'microcurriculo' && canManageCourses(userRole) ? (
                <button
                  type="button"
                  className={activeModal === "COURSE_EDITOR" ? 'filter-chip filter-chip--active' : 'filter-chip'}
                  onClick={() => openModal("COURSE_EDITOR")}
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


      {activeSection === 'summary' ? (
        <section className="summary-workspace-grid">
          <div className="surface section-card">
            <div className="section-heading mb-8">
              <div>
                <span className="eyebrow text-coral font-bold uppercase tracking-widest">Workflow Lineal</span>
                <h3 className="text-2xl mt-1">Evolución operativa del curso</h3>
              </div>
            </div>

            <div className="timeline-rail">
              <VerticalStageTimeline
                stages={workflowStages as any}
                currentStageId={currentStageId}
                courseSlug={currentCourseSlug}
                badgeClass={badgeClass}
              />
            </div>
          </div>

          <aside className="summary-sidebar">
            <div className="surface section-card summary-actions-card">
              <div className="section-heading mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-muted uppercase tracking-wider">Gestión</h4>
                </div>
              </div>

              <ProgressRing
                value={currentCourse.progress}
                label="Avance"
                detail="Sincronizado con hitos y entregables"
              />

              <div className="summary-actions-card__buttons">
                <button
                  type="button"
                  className="cta-button"
                  onClick={() => openModal("COURSE_EDITOR")}
                >
                  <Settings size={16} />
                  <span>Ver detalles</span>
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsHistoryModalOpen(true)}
                >
                  <History size={16} />
                  <span>Historial</span>
                </button>
              </div>
            </div>
          </aside>
        </section>
      ) : null}


      {activeSection === 'microcurriculo' ? (
        <section className="summary-workspace-grid">
          <div className="surface section-card">
            {renderMicrocurriculoWizard()}
          </div>
          <aside className="summary-sidebar">
             <div className="surface section-card section-card--compact">
               <div className="section-heading">
                 <h3>Asistencias de IA</h3>
               </div>
               <p className="text-sm text-muted">
                 El asistente de microcurrículo utiliza GPT-4o para extraer automáticamente la información base del curso desde tus documentos.
               </p>
             </div>
             {renderStageNoteEditor(
               'microcurriculo', 
               'Análisis', 
               'Bitácora pedagógica', 
               'Reflexiones sobre la coherencia del microcurrículo y hallazgos en la extracción de datos.'
             )}
          </aside>
        </section>
      ) : null}

      {activeSection === 'arquitectura' ? (
        <div className="architecture-viewport-full animate-in fade-in duration-700">
           {renderArchitectureVisualizer()}
        </div>
      ) : null}

      {activeSection === 'planeacion' ? (
        <section className="workspace-grid">
           {renderStageNoteEditor(
            'planeacion',
            'Operación',
            'Bitácora de planeación',
            'Seguimiento a hitos operativos y coordinación de recursos del equipo.',
          )}

          <article className="surface section-card section-card--compact">
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
                    onClick={() => openModal('tasks')}
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
          </article>
        </section>
      ) : null}

      {activeSection === 'escritura' ? (
        <section className="workspace-grid">
          {renderProductStudio(
            'escritura',
            'Escritura y autoría',
            'Desarrollo de contenidos y guías',
            'En esta etapa se redactan las actividades, guiones, instrucciones y materiales base para el curso.',
          )}
          {renderStageNoteEditor(
            'escritura',
            'Autoría',
            'Avances y borradores',
            'Registra aquí el progreso de la redacción académica y técnica.',
          )}
        </section>
      ) : null}

      {activeSection === 'validacion' ? (
        <section className="workspace-grid">
          {renderStageNoteEditor(
            'validacion',
            'Validación instruccional',
            'Ajustes y observaciones pedagógicas',
            'Esta bitácora captura la revisión experta sobre la pertinencia y calidad instruccional.',
          )}
          {renderProductStudio(
            'validacion',
            'Producto QA',
            'Rúbricas y criterio de aprobación',
            'La validación final ya no depende solo de observaciones: aquí también se construyen y versionan las rúbricas de calidad.',
          )}
        </section>
      ) : null}

      {activeSection === 'multimedia' ? (
        <section className="workspace-grid">
          {renderProductStudio(
            'multimedia',
            'Producción multimedia',
            'Piezas y recursos gráficos',
            'Gestión de la producción visual, audiovisual e interactiva del curso.',
          )}
          {renderStageNoteEditor(
            'multimedia',
            'Multimedia',
            'Avances de producción',
            'Reportes sobre la producción de piezas gráficas y video.',
          )}
        </section>
      ) : null}

      {activeSection === 'lms' ? (
        <section className="workspace-grid">
           {renderStageNoteEditor(
            'lms',
            'LMS',
            'Montaje técnico',
            'Registro técnico del despliegue en plataforma educativa.',
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
                    </div>
                    <div className="list-item__meta">
                      <span>{checkpoint.owner}</span>
                    </div>
                  </div>
                ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeSection === 'qa' ? (
        <section className="workspace-grid">
           {renderStageNoteEditor(
            'qa',
            'QA',
            'Validación final',
            'Control de errores, ajustes técnicos y validación instruccional previa al lanzamiento.',
          )}
          {renderProductStudio(
            'qa',
            'QA Lab',
            'Validación y rúbricas',
            'Gestión de criterios de calidad y versionamiento de rúbricas instruccionales.',
          )}
        </section>
      ) : null}

      {activeSection === 'entrega' ? (
        <section className="workspace-grid">
           {renderStageNoteEditor(
            'entrega',
            'Entrega',
            'Cierre del curso',
            'Documentación del expediente final y transferencia oficial del curso.',
          )}
        </section>
      ) : null}

      {isHistoryModalOpen ? (
        <SidePanel
          isOpen={isHistoryModalOpen}
          title={`Expediente de cambios · ${currentCourse.title}`}
          description="Historial detallado de acciones, responsables y cronología del curso."
          sideLabel="Historial"
          sideDescription="BITÁCORA"
          width="xl"
          onClose={() => setIsHistoryModalOpen(false)}
        >
          <div className="modal-stack-clean">
            <div className="table-container bg-white border border-line rounded-[32px] overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th>Detalle</th>
                    <th>Referencia</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCourse.auditLog.length > 0 ? (
                    currentCourse.auditLog
                      .slice()
                      .reverse()
                      .map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className={`status-dot status-dot--${entry.type}`} />
                              <span className="font-semibold">{entry.title}</span>
                            </div>
                          </td>
                          <td>
                            <p className="text-muted text-sm">{entry.detail}</p>
                          </td>
                          <td>
                             <span className="badge badge--outline capitalize">
                               {entry.type === 'history' ? 'Sistema' : entry.type}
                             </span>
                          </td>
                          <td className="whitespace-nowrap font-mono text-xs">
                            {formatDate(entry.happenedAt)}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted">
                        No hay registros de actividad para este curso todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SidePanel>
      ) : null}

      {activeModal === 'METADATA_EDITOR' && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title="Metadatos generales"
          description="Edita la información base del curso que alimenta reportes y buscadores."
          sideLabel="Metadatos"
          sideDescription="FICHA"
          width="xl"
          onClose={() => closeModal()}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <button
                type="button"
                className="filter-chip px-6 py-2.5"
                onClick={() => closeModal()}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cta-button"
                onClick={() => {
                  void handleMetadataSave(new Event('submit') as any);
                  closeModal();
                }}
              >
                Actualizar información
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 modal-stack-clean">
            <div className="form-field">
              <label htmlFor="inst">Institución</label>
              <input
                id="inst"
                value={metadataForm.institution}
                onChange={(e) => setMetadataForm({ ...metadataForm, institution: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="semester">Semestre</label>
              <input
                id="semester"
                value={metadataForm.semester}
                onChange={(e) => setMetadataForm({ ...metadataForm, semester: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="period">Periodo académico</label>
              <input
                id="period"
                value={metadataForm.academicPeriod}
                onChange={(e) => setMetadataForm({ ...metadataForm, academicPeriod: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ctype">Tipo de curso</label>
              <select
                id="ctype"
                value={metadataForm.courseType}
                onChange={(e) => setMetadataForm({ ...metadataForm, courseType: e.target.value })}
              >
                <option value="Pregrado">Pregrado</option>
                <option value="Posgrado">Posgrado</option>
                <option value="Diplomado">Diplomado</option>
                <option value="Extensión">Extensión</option>
              </select>
            </div>
          </div>
        </SidePanel>
      ) : null}


      {activeModal === 'TEAM_MANAGER' && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title="Responsables del curso"
          description="Asigna y coordina a los integrantes del equipo de maduración del curso."
          sideLabel="Equipo"
          sideDescription="GESTIÓN"
          width="xl"
          onClose={() => closeModal()}
        >
          <div className="page-stack modal-stack-clean">
            <div className="toolbar-header">
              <button
                type="button"
                className={isTeamComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsTeamComposerOpen((current) => !current)}
              >
                <Plus size={16} />
                <span>{isTeamComposerOpen ? 'Ocultar formulario' : 'Nuevo integrante'}</span>
              </button>
            </div>

            {isTeamComposerOpen ? (
              <form className="editor-card" onSubmit={handleTeamMemberCreate}>
                <div className="form-grid">
                  <label className="field">
                    <span>Nombre completo</span>
                    <div className="field__control">
                      <input
                        value={newTeamMemberForm.name}
                        onChange={(event) =>
                          setNewTeamMemberForm((current) => ({ ...current, name: event.target.value }))
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
                </div>

                <div className="action-row">
                  <button type="submit" className="cta-button" disabled={isTeamSaving === 'new'}>
                    <span>{isTeamSaving === 'new' ? 'Agregando…' : 'Agregar integrante'}</span>
                  </button>
                </div>
              </form>
            ) : null}

            {teamError ? <p className="form-error">{teamError}</p> : null}

            <div className="list-stack">
              {currentCourse.team.map((member) => {
                const draft = teamDrafts[member.id];

                if (!draft) {
                  return null;
                }

                return (
                  <div key={member.id} className="team-editor">
                    <div className="form-grid">
                      <label className="field">
                        <span>Nombre</span>
                        <div className="field__control">
                          <input
                            value={draft.name}
                            onChange={(event) => updateTeamDraft(member.id, 'name', event.target.value)}
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
                    </div>

                    <div className="team-editor__actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleTeamMemberSave(member.id)}
                        disabled={isTeamSaving === member.id}
                      >
                        <Save size={16} />
                        <span>{isTeamSaving === member.id ? 'Guardando…' : 'Guardar'}</span>
                      </button>

                      <button
                        type="button"
                        className="danger-button danger-button--ghost"
                        onClick={() => void handleTeamMemberDelete(member.id)}
                        disabled={isTeamSaving === member.id}
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
        </SidePanel>
      ) : null}

      {activeModal === 'TASK_COMPOSER' && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title="Gestión de tareas"
          description="Organiza y asigna el trabajo pendiente del curso para asegurar el avance por etapas."
          sideLabel="Tareas"
          sideDescription="OPERACIÓN"
          width="xl"
          onClose={closeModal}
        >
          <div className="page-stack">
            <div className="toolbar-header">
              <button
                type="button"
                className={isAddingTask ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsAddingTask((current) => !current)}
              >
                <Plus size={16} />
                <span>{isAddingTask ? 'Ocultar formulario' : 'Nueva tarea'}</span>
              </button>
            </div>

            {isAddingTask ? (
              <form className="editor-card animate-in fade-in slide-in-from-top-2" onSubmit={handleTaskCreate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="form-label">Título de la tarea</label>
                    <input
                      className="modern-input"
                      value={newTaskForm.title}
                      onChange={(event) =>
                        setNewTaskForm((current) => ({ ...current, title: event.target.value }))
                      }
                      required
                      placeholder="Ej: Revisar guiones finales"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Responsable (Rol)</label>
                    <div className="modern-select-wrapper">
                      <select
                        className="modern-select"
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
                      <ChevronDown className="modern-select-icon" size={16} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button type="submit" className="cta-button" disabled={isTaskSaving}>
                    <Plus size={18} />
                    <span>{isTaskSaving ? 'Creando…' : 'Crear tarea'}</span>
                  </button>
                </div>
              </form>
            ) : null}

            {taskError ? <p className="form-error">{taskError}</p> : null}

            <div className="list-stack">
              {visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin tareas registradas</strong>
                  <p>Presiona "Nueva tarea" para comenzar a organizar el trabajo.</p>
                </div>
              ) : (
                visibleTasks.map((task) => {
                  const draft = taskDrafts[task.id];

                  if (!draft) {
                    return null;
                  }

                  return (
                    <div key={task.id} className="task-editor">
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
                          <span>Estado</span>
                          <div className="field__control">
                            <select
                              value={draft.status}
                              onChange={(event) =>
                                updateTaskDraft(task.id, 'status', event.target.value as any)
                              }
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="En proceso">En proceso</option>
                              <option value="Completada">Completada</option>
                              <option value="Bloqueada">Bloqueada</option>
                            </select>
                          </div>
                        </label>
                      </div>

                      <div className="task-editor__actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleTaskSave(task.id)}
                        >
                          <Save size={16} />
                          <span>Guardar</span>
                        </button>

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
                })
              )}
            </div>
          </div>
        </SidePanel>
      ) : null}

      {activeModal === "COURSE_EDITOR" && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title={`Expediente: ${currentCourse.title}`}
          description="Consulta técnica de ficha operativa, criterios académicos e indicadores de avance."
          sideLabel="Expediente"
          sideDescription="CONSULTA"
          width="xl"
          onClose={closeModal}
        >
          <div className="page-stack">
            <div className="management-layout">
              <main className="page-stack gap-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-ocean/10 text-ocean rounded-lg">
                          <FileText size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Información principal</h3>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="form-group">
                        <label className="form-label">Título del curso</label>
                        <p className="text-2xl font-bold text-ink tracking-tight">{currentCourse.title}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="form-group">
                          <label className="form-label">Código</label>
                          <p className="font-mono text-ocean font-semibold bg-ocean/5 px-3 py-1 rounded-lg w-fit">{currentCourse.code}</p>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Institución</label>
                          <p className="font-medium">{currentCourse.metadata.institution}</p>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Resumen ejecutivo</label>
                        <p className="text-muted leading-relaxed italic border-l-4 border-line pl-4 py-2">{currentCourse.summary || "Sin resumen definido."}</p>
                      </div>
                    </div>
                  </article>

                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sage/10 text-sage rounded-lg">
                          <BarChart3 size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Perfil académico</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                      <div className="form-group">
                        <label className="form-label">Facultad</label>
                        <p className="font-medium">{currentCourse.faculty}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Programa</label>
                        <p className="font-medium">{currentCourse.program}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Créditos</label>
                        <p className="font-bold text-lg text-sage">{currentCourse.credits}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Semestre</label>
                        <p className="font-medium">{currentCourse.metadata.semester}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Modalidad</label>
                        <p className="font-medium">{currentCourse.modality}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Periodo</label>
                        <p className="font-medium">{currentCourse.metadata.academicPeriod}</p>
                      </div>
                    </div>
                  </article>
                </div>

                <article className="detail-section">
                  <div className="section-heading">
                    <h3>Contenido y Metodología</h3>
                  </div>
                  <div className="form-grid">
                    <div className="field field--full">
                      <span>Resultados de aprendizaje</span>
                      <div className="list-stack list-stack--compact mt-2">
                        {currentCourse.metadata.learningOutcomes.map((item, idx) => (
                          <p key={idx} className="text-sm">• {item}</p>
                        ))}
                      </div>
                    </div>

                    <div className="field field--full">
                      <span>Temas clave</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentCourse.metadata.topics.map((item, idx) => (
                          <span key={idx} className="badge badge--outline">{item}</span>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <span>Metodología</span>
                      <p>{currentCourse.metadata.methodology}</p>
                    </div>
                    <div className="field">
                      <span>Evaluación</span>
                      <p>{currentCourse.metadata.evaluation}</p>
                    </div>
                  </div>
                </article>

                <div className="flex gap-4 mt-8 pt-6 border-t border-line">
                  <button
                    type="button"
                    className="cta-button"
                    onClick={() => {
                      closeModal();
                      setIsEditingCourse(true);
                    }}
                  >
                    <PencilLine size={16} />
                    <span>Editar información profunda</span>
                  </button>
                  <button
                    type="button"
                    className="danger-button danger-button--ghost"
                    onClick={() => void handleCourseDelete()}
                  >
                    <Trash2 size={16} />
                    <span>Eliminar curso</span>
                  </button>
                  <button type="button" className="filter-chip px-6" onClick={() => closeModal()}>
                    <span>Cerrar expediente</span>
                  </button>
                </div>
              </main>

              <aside className="side-panel space-y-12">
                <div className="highlight-item bg-ink/5 border border-line p-8 rounded-[32px]">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted opacity-60 mb-2 block">Estado del proyecto</span>
                  <h4 className="text-xl font-bold">Plan operativo</h4>
                  <div className="form-grid mt-4">
                    <div className="field">
                      <span className="text-sm text-muted">Etapa</span>
                      <strong className="text-lg">{appData.stages.find(s => s.id === currentCourse.stageId)?.name || currentCourse.stageId}</strong>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Status</span>
                      <span className={badgeClass(currentCourse.status)}>{currentCourse.status}</span>
                    </div>
                  </div>
                </div>

                <div className="highlight-item bg-ink/5 border border-line p-8 rounded-[32px]">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted opacity-60 mb-2 block">Indicadores clave</span>
                  <div className="form-grid mt-4">
                    <div className="field">
                      <span className="text-sm text-muted">Prioridad</span>
                      <p className="font-semibold text-lg">{currentCourse.metadata.priority}</p>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Riesgo</span>
                      <p className="font-semibold text-lg">{currentCourse.metadata.riskLevel}</p>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Versión</span>
                      <p className="text-lg">{currentCourse.metadata.currentVersion}</p>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Cierre obj.</span>
                      <p className="text-lg">{formatDate(currentCourse.metadata.targetCloseDate)}</p>
                    </div>
                  </div>
                </div>

                <div className="highlight-item p-8 rounded-[32px]" style={{ background: "var(--coral-soft)", border: "1px solid rgba(199, 124, 86, 0.2)" }}>
                  <span className="text-xs font-mono font-bold uppercase tracking-widest opacity-60 mb-2 block" style={{ color: "#8d3f22" }}>Meta inmediata</span>
                  <h4 className="text-xl font-bold" style={{ color: "#8d3f22" }}>Próximo hito</h4>
                  <p className="mt-4 font-medium text-lg leading-relaxed" style={{ color: "#8d3f22" }}>{currentCourse.nextMilestone}</p>
                </div>
              </aside>
            </div>
          </div>
        </SidePanel>
      ) : null}
      {isEditingCourse && (
        <SidePanel
          isOpen={isEditingCourse}
          title={`Editar: ${courseForm.title}`}
          description="Gestión de metadatos profundos, criterios pedagógicos y parámetros operativos del curso."
          sideLabel="Ficha"
          sideDescription="MAESTRA"
          width="xl"
          onClose={() => setIsEditingCourse(false)}
        >
          <div className="page-stack">
            <div className="flex items-center gap-4 mb-8">
              <button
                type="button"
                className={!isEditingCourseMetadata ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsEditingCourseMetadata(false)}
              >
                Información básica
              </button>
              <button
                type="button"
                className={isEditingCourseMetadata ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsEditingCourseMetadata(true)}
              >
                Ficha operativa (Profunda)
              </button>
            </div>

            {!isEditingCourseMetadata ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <form className="page-stack gap-10" onSubmit={handleCourseSave}>
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-ocean/10 text-ocean rounded-lg">
                          <Settings size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Ajustes principales</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      <div className="form-group lg:col-span-2">
                        <label className="form-label">Nombre del curso</label>
                        <input
                          className="modern-input !text-lg font-bold"
                          value={courseForm.title}
                          onChange={(event) => updateCourseDraftField('title', event.target.value)}
                          placeholder="Ej: Introducción a la Inteligencia Artificial"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Código institucional</label>
                        <input
                          className="modern-input"
                          value={courseForm.code}
                          onChange={(event) => updateCourseDraftField('code', event.target.value)}
                          placeholder="Ej: IA-101"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Modalidad</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={courseForm.modality}
                            onChange={(event) => updateCourseDraftField('modality', event.target.value)}
                            required
                          >
                            {['Virtual', 'Presencial', 'Híbrida'].map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Etapa actual</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={courseForm.stageId}
                            onChange={(event) => updateCourseDraftField('stageId', event.target.value)}
                          >
                            {appData.stages.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Estado oficial</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={courseForm.status}
                            onChange={(event) =>
                              updateCourseDraftField(
                                'status',
                                event.target.value as CourseMutationInput['status'],
                              )
                            }
                          >
                            {['En curso', 'En QA', 'En riesgo', 'Bloqueado', 'Entregado'].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group lg:col-span-2">
                        <label className="form-label">Próximo hito o entrega</label>
                        <input
                          className="modern-input"
                          value={courseForm.nextMilestone}
                          onChange={(event) => updateCourseDraftField('nextMilestone', event.target.value)}
                          placeholder="Ej: Entrega de microcurrículo verificado"
                          required
                        />
                      </div>

                      <div className="form-group lg:col-span-3">
                        <label className="form-label">Resumen ejecutivo del curso</label>
                        <textarea
                          rows={4}
                          className="modern-textarea"
                          value={courseForm.summary}
                          onChange={(event) => updateCourseDraftField('summary', event.target.value)}
                          placeholder="Breve descripción del propósito y alcance del curso..."
                          required
                        />
                      </div>
                    </div>

                    {courseError ? <p className="form-error mt-4">{courseError}</p> : null}

                    <div className="flex gap-4 mt-8 pt-6 border-t border-line">
                      <button type="submit" className="cta-button" disabled={isCourseSaving}>
                        <Save size={18} />
                        <span>{isCourseSaving ? 'Guardando…' : 'Guardar cambios básicos'}</span>
                      </button>
                    </div>
                  </article>
                </form>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <form className="page-stack gap-10" onSubmit={handleMetadataSave}>
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gold/10 text-gold rounded-lg">
                          <ClipboardCheck size={20} />
                        </div>
                        <div>
                          <span className="eyebrow">Criterios Pedagógicos</span>
                          <h3 className="text-xl font-semibold tracking-tight">Ficha operativa profunda</h3>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      <div className="form-group">
                        <label className="form-label">Institución operativa</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
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
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nombre corto / Alias</label>
                        <input
                          className="modern-input"
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

                      <div className="form-group">
                        <label className="form-label">Semestre / Módulo</label>
                        <input
                          className="modern-input"
                          value={metadataForm.semester}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              semester: event.target.value,
                            }))
                          }
                          placeholder="Ej: 1er Semestre"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Periodo académico</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
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
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Tipo de curso</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
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
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Fecha de cierre objetivo</label>
                        <input
                          type="date"
                          className="modern-input"
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

                      <div className="form-group">
                        <label className="form-label">Versión de diseño</label>
                        <input
                          className="modern-input"
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

                      <div className="form-group">
                        <label className="form-label">Nivel de Prioridad</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
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
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Riesgo identificado</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={metadataForm.riskLevel}
                            onChange={(event) =>
                              setMetadataForm((current) => ({
                                ...current,
                                riskLevel: event.target.value as CourseMetadataMutationInput['riskLevel'],
                              }))
                            }
                          >
                            {['Bajo', 'Medio', 'Alto'].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-12">
                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <PenTool size={14} />
                           <span>Metodología pedagógica</span>
                        </label>
                        <textarea
                          rows={5}
                          className="modern-textarea"
                          value={metadataForm.methodology}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              methodology: event.target.value,
                            }))
                          }
                          placeholder="Estrategias de enseñanza, aprendizaje autónomo..."
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <ClipboardCheck size={14} />
                           <span>Criterios de Evaluación</span>
                        </label>
                        <textarea
                          rows={5}
                          className="modern-textarea"
                          value={joinLines(metadataForm.evaluation)}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              evaluation: splitLines(event.target.value),
                            }))
                          }
                          placeholder="Ponderación, rúbricas, momentos de evaluación... (uno por línea)"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <Target size={14} />
                           <span>Resultados de aprendizaje (RAE)</span>
                        </label>
                        <textarea
                          rows={6}
                          className="modern-textarea"
                          value={joinLines(metadataForm.learningOutcomes)}
                          onChange={(event) =>
                            setMetadataForm((current: CourseMetadataMutationInput) => ({
                              ...current,
                              learningOutcomes: splitLines(event.target.value),
                            }))
                          }
                          placeholder="Defina sus resultados esperados, uno por línea..."
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <Layers size={14} />
                           <span>Núcleos temáticos / Temas clave</span>
                        </label>
                        <textarea
                          rows={6}
                          className="modern-textarea"
                          value={joinLines(metadataForm.topics)}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              topics: splitLines(event.target.value),
                            }))
                          }
                          placeholder="Ejes de formación, módulos principales... (uno por línea)"
                          required
                        />
                      </div>

                      <div className="form-group lg:col-span-2">
                        <label className="form-label flex items-center gap-2">
                           <BookOpen size={14} />
                           <span>Bibliografía base y complementaria</span>
                        </label>
                        <textarea
                          rows={6}
                          className="modern-textarea italic"
                          value={joinLines(metadataForm.bibliography)}
                          onChange={(event) =>
                            setMetadataForm((current: CourseMetadataMutationInput) => ({
                              ...current,
                              bibliography: splitLines(event.target.value),
                            }))
                          }
                        placeholder="Normas APA, enlaces, recursos físicos... (uno por línea)"
                        required
                      />
                    </div>
                  </div>

                  {metadataError ? <p className="form-error mt-4">{metadataError}</p> : null}

                  <div className="flex gap-4 mt-8 pt-6 border-t border-line">
                      <button type="submit" className="cta-button" disabled={isMetadataSaving}>
                        <Save size={18} />
                        <span>{isMetadataSaving ? 'Guardando…' : 'Guardar ficha operativa'}</span>
                      </button>
                      <button type="button" className="filter-chip px-6 py-3" onClick={() => setIsEditingCourse(false)}>
                        <span>Terminar edición</span>
                      </button>
                    </div>
                  </article>
                </form>
              </div>
            )}
          </div>
        </SidePanel>
      )}

      {isVerifyingAnalysis && analysisResult ? (
        <SidePanel
          isOpen={isVerifyingAnalysis}
          title="Verificar Información Extraída"
          description="Asegura que los datos capturados del documento sean correctos antes de guardarlos."
          sideLabel="IA"
          sideDescription="EXTRACCIÓN"
          width="xl"
          onClose={() => setIsVerifyingAnalysis(false)}
          footer={
            <div className="flex justify-end gap-3 w-full">
               <button 
                type="button" 
                className="filter-chip px-6 py-2.5" 
                onClick={() => setIsVerifyingAnalysis(false)}
               >
                 <span>Cancelar</span>
               </button>
               <button 
                type="button" 
                className="cta-button shadow-lg shadow-ocean/20" 
                disabled={isMetadataSaving}
                onClick={async () => {
                  if (!currentCourse) return;
                  setIsMetadataSaving(true);
                  
                  const originalAppData = { ...appData };
                  const metadataUpdate = {
                    semester: analysisResult.semestre || '',
                    courseType: analysisResult.tipoCurso || '',
                    learningOutcomes: analysisResult.resultadosAprendizaje || [],
                    topics: (analysisResult.unidades || []).map((u: any) => u.tituloUnidad).filter(Boolean),
                    units: analysisResult.unidades || [],
                    methodology: analysisResult.metodologia || '',
                    evaluation: analysisResult.evaluacion || [],
                    bibliography: analysisResult.bibliografia || [],
                  };

                  try {
                    // 1. Optimistic update
                    mutateAppData((current) => ({
                      ...current,
                      courses: current.courses.map((c) =>
                        c.slug === currentCourse.slug
                          ? {
                              ...c,
                              faculty: analysisResult.facultad || c.faculty,
                              program: analysisResult.programa || c.program,
                              credits: Number(analysisResult.creditos) || c.credits,
                              summary: (analysisResult.descripcionCurso || c.summary).slice(0, 500), // Limit summary length
                              metadata: {
                                ...c.metadata,
                                ...metadataUpdate
                              }
                            }
                          : c
                      )
                    }));

                    // 2. Persist to API
                    const [resCourse, resMeta] = await Promise.all([
                      fetch(`/api/courses?slug=${encodeURIComponent(currentCourse.slug)}`, {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          faculty: analysisResult.facultad,
                          program: analysisResult.programa,
                          credits: Number(analysisResult.creditos),
                          summary: analysisResult.descripcionCurso
                        })
                      }),
                      fetch(`/api/course-metadata?slug=${encodeURIComponent(currentCourse.slug)}`, {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify(metadataUpdate)
                      })
                    ]);

                    if (!resCourse.ok || !resMeta.ok) throw new Error('Error al sincronizar con el servidor.');

                    refreshAppData();
                    setIsVerifyingAnalysis(false);
                    showAlert({
                      title: 'Expediente actualizado',
                      message: 'La información del microcurrículo se ha guardado correctamente.',
                      tone: 'success'
                    });
                  } catch (error) {
                    mutateAppData(originalAppData);
                    showAlert({ 
                      title: 'Error al guardar', 
                      message: 'No se pudo actualizar el expediente operativo. Verifique la conexión.', 
                      tone: 'error' 
                    });
                  } finally {
                    setIsMetadataSaving(false);
                  }
                }}
               >
                 {isMetadataSaving ? <RefreshCcw size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                 <span>{isMetadataSaving ? 'Guardando...' : 'Guardar en Expediente'}</span>
               </button>
            </div>
          }
        >
          <div className="page-stack max-w-5xl mx-auto py-4">
             <div className="management-layout">
                <main className="page-stack gap-10">
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-ocean/10 text-ocean rounded-lg">
                          <Settings size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Metodatos del curso</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="form-group">
                        <label className="form-label">Facultad / Escuela</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.facultad || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, facultad: e.target.value })} 
                          placeholder="Ej: Facultad de Ingeniería"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Programa Académico</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.programa || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, programa: e.target.value })} 
                          placeholder="Ej: Maestría en IA"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Semestre / Ciclo</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.semestre || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, semestre: e.target.value })} 
                          placeholder="Ej: Segundo Semestre"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tipo de curso</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.tipoCurso || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, tipoCurso: e.target.value })} 
                          placeholder="Ej: Teórico-Práctico"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Créditos Académicos</label>
                        <input 
                          type="number" 
                          className="modern-input"
                          value={analysisResult.creditos || 0} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, creditos: Number(e.target.value) })} 
                        />
                      </div>
                    </div>
                  </article>

                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sage/10 text-sage rounded-lg">
                          <Target size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Académico y Resultados de Aprendizaje</h3>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="form-group">
                        <label className="form-label">Descripción o Justificación del curso</label>
                        <textarea 
                          rows={4} 
                          className="modern-textarea"
                          value={analysisResult.descripcionCurso || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, descripcionCurso: e.target.value })} 
                          placeholder="Resumen del propósito del curso..."
                        />
                      </div>
                      <div className="form-group">
                         <label className="form-label">Resultados de aprendizaje esperados (RAE)</label>
                         <div className="grid gap-3">
                            {Array.isArray(analysisResult.resultadosAprendizaje) && analysisResult.resultadosAprendizaje.map((res: string, idx: number) => (
                              <div key={idx} className="flex gap-3 items-start group">
                                <textarea 
                                  rows={2} 
                                  className="modern-textarea flex-1 min-h-[70px] bg-white/50" 
                                  value={res} 
                                  onChange={(e) => {
                                    const arr = [...analysisResult.resultadosAprendizaje];
                                    arr[idx] = e.target.value;
                                    setAnalysisResult({ ...analysisResult, resultadosAprendizaje: arr });
                                  }} 
                                />
                                <button 
                                  className="p-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                  onClick={() => {
                                    const arr = [...analysisResult.resultadosAprendizaje];
                                    arr.splice(idx, 1);
                                    setAnalysisResult({ ...analysisResult, resultadosAprendizaje: arr });
                                  }}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}
                            <button 
                              className="filter-chip w-fit mt-2 border-dashed" 
                              onClick={() => setAnalysisResult({...analysisResult, resultadosAprendizaje: [...(analysisResult.resultadosAprendizaje||[]), '']})}
                            >
                              <Plus size={16} className="mr-2" /> 
                              <span>Agregar resultado</span>
                            </button>
                         </div>
                      </div>
                    </div>
                  </article>

                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gold/10 text-gold rounded-lg">
                          <ClipboardCheck size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Metodología y Evaluación</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div className="form-group">
                        <label className="form-label">Estrategia Metodológica</label>
                        <textarea 
                          rows={6} 
                          className="modern-textarea"
                          value={analysisResult.metodologia || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, metodologia: e.target.value })} 
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Esquema de Evaluación</label>
                        <div className="grid gap-2">
                            {Array.isArray(analysisResult.evaluacion) && analysisResult.evaluacion.map((ev: string, idx: number) => (
                              <div key={idx} className="flex gap-2 items-center group">
                                <input 
                                  className="modern-input flex-1 py-2" 
                                  value={ev} 
                                  onChange={(e) => {
                                    const arr = [...analysisResult.evaluacion];
                                    arr[idx] = e.target.value;
                                    setAnalysisResult({ ...analysisResult, evaluacion: arr });
                                  }} 
                                />
                                <button className="text-red-500 opacity-0 group-hover:opacity-100" onClick={() => {
                                  const arr = [...analysisResult.evaluacion];
                                  arr.splice(idx, 1);
                                  setAnalysisResult({ ...analysisResult, evaluacion: arr });
                                }}><Trash2 size={16} /></button>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </article>
                </main>
             </div>
          </div>
        </SidePanel>
      ) : null}
    </div>
  );
}
