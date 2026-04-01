import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  FolderClosed,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  Search,
  ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModalFrame } from '../components/ModalFrame.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { CourseCard } from '../components/CourseCard.js';
import type { AppData, Course, CourseMutationInput, CourseStatus, Role } from '../types.js';
import { getStageMeta, getVisibleCourses } from '../utils/domain.js';
import {
  buildCourseDirectoryLabel,
  courseRepositoryLabel,
  getFirstInstitutionStructure,
  getInstitutionAcademicPeriods,
  getInstitutionCourseTypes,
  getInstitutionFaculties,
  getInstitutionStructures,
  getInstitutionPrograms,
} from '../utils/institutions.js';
import { canManageCourses } from '../utils/permissions.js';

interface CoursesPageProps {
  role: Role;
  appData: AppData;
  userRole: Role;
  refreshAppData: () => void;
}

type ExplorerView = 'cards' | 'list';
type StatusFilter = 'Todos' | CourseStatus;
type SortMode = 'recent' | 'progress' | 'name';
type FolderNodeType = 'root' | 'institution' | 'faculty' | 'program' | 'academicPeriod' | 'courseType';

interface FolderEntry {
  key: string;
  label: string;
  description: string;
  count: number;
  type: Exclude<FolderNodeType, 'root'>;
}

const statusFilters: StatusFilter[] = [
  'Todos',
  'Sin iniciar',
  'En curso',
  'En QA',
  'Entregado',
  'Bloqueado',
  'En riesgo',
];

function uniqueOptions(values: string[]) {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      results.push(trimmed);
    }
  }

  return results.sort((left, right) => left.localeCompare(right, 'es'));
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

function createInitialCourseForm(appData: AppData): CourseMutationInput {
  return syncCourseStructureFields(appData, {
    title: '',
    code: '',
    institution: '',
    faculty: '',
    program: '',
    academicPeriod: '',
    courseType: '',
    modality: 'presencial',
    credits: 3,
    stageId: appData.stages[0]?.id ?? 'configuracion',
    status: 'Sin iniciar',
    summary: '',
    nextMilestone: '',
  });
}

function getInstitution(course: Course) {
  return course.metadata.institution?.trim() || 'Institución sin definir';
}

function getAcademicPeriod(course: Course) {
  return course.metadata.academicPeriod?.trim() || 'Periodo sin definir';
}

function getCourseType(course: Course) {
  return course.metadata.courseType?.trim() || 'Tipología sin definir';
}

function buildRouteLabel(course: Course) {
  return buildCourseDirectoryLabel(
    {
      institution: getInstitution(course),
      faculty: course.faculty,
      program: course.program,
      academicPeriod: getAcademicPeriod(course),
      courseType: getCourseType(course),
    },
    {
      includeCourseTitle: false,
    },
  );
}

function makeInstitutionKey(institution: string) {
  return `institution::${institution}`;
}

function makeFacultyKey(institution: string, faculty: string) {
  return `faculty::${institution}::${faculty}`;
}

function makeProgramKey(institution: string, faculty: string, program: string) {
  return `program::${institution}::${faculty}::${program}`;
}

function makeAcademicPeriodKey(
  institution: string,
  faculty: string,
  program: string,
  academicPeriod: string,
) {
  return `academicPeriod::${institution}::${faculty}::${program}::${academicPeriod}`;
}


function parseNode(selectedNode: string) {
  if (selectedNode === 'root') {
    return { type: 'root' as const };
  }

  const [type, institution, faculty, program, academicPeriod, courseType] = selectedNode.split('::');

  if (type === 'institution' && institution) {
    return {
      type: 'institution' as const,
      institution,
    };
  }

  if (type === 'faculty' && institution && faculty) {
    return {
      type: 'faculty' as const,
      institution,
      faculty,
    };
  }

  if (type === 'program' && institution && faculty && program) {
    return {
      type: 'program' as const,
      institution,
      faculty,
      program,
    };
  }

  if (type === 'academicPeriod' && institution && faculty && program && academicPeriod) {
    return {
      type: 'academicPeriod' as const,
      institution,
      faculty,
      program,
      academicPeriod,
    };
  }

  if (type === 'courseType' && institution && faculty && program && academicPeriod && courseType) {
    return {
      type: 'courseType' as const,
      institution,
      faculty,
      program,
      academicPeriod,
      courseType,
    };
  }

  return { type: 'root' as const };
}

function matchesFolder(course: Course, selectedNode: string) {
  const node = parseNode(selectedNode);
  const institution = getInstitution(course).trim().toLowerCase();

  if (node.type === 'root') {
    return true;
  }

  const nodeInstitution = node.institution.trim().toLowerCase();

  if (node.type === 'institution') {
    return institution === nodeInstitution;
  }

  const courseFaculty = course.faculty.trim().toLowerCase();
  const nodeFaculty = node.faculty.trim().toLowerCase();

  if (node.type === 'faculty') {
    return institution === nodeInstitution && courseFaculty === nodeFaculty;
  }

  const courseProgram = course.program.trim().toLowerCase();
  const nodeProgram = node.program.trim().toLowerCase();

  if (node.type === 'program') {
    return (
      institution === nodeInstitution &&
      courseFaculty === nodeFaculty &&
      courseProgram === nodeProgram
    );
  }

  const academicPeriod = getAcademicPeriod(course).trim().toLowerCase();
  const nodePeriod = node.academicPeriod.trim().toLowerCase();

  if (node.type === 'academicPeriod') {
    return (
      institution === nodeInstitution &&
      courseFaculty === nodeFaculty &&
      courseProgram === nodeProgram &&
      academicPeriod === nodePeriod
    );
  }

  const courseType = getCourseType(course).trim().toLowerCase();
  const nodeType = node.courseType.trim().toLowerCase();

  return (
    institution === nodeInstitution &&
    courseFaculty === nodeFaculty &&
    courseProgram === nodeProgram &&
    academicPeriod === nodePeriod &&
    courseType === nodeType
  );
}

function getParentNode(selectedNode: string) {
  const node = parseNode(selectedNode);

  if (node.type === 'root') {
    return null;
  }

  if (node.type === 'institution') {
    return 'root';
  }

  if (node.type === 'faculty') {
    return makeInstitutionKey(node.institution);
  }

  if (node.type === 'program') {
    return makeFacultyKey(node.institution, node.faculty);
  }

  if (node.type === 'academicPeriod') {
    return makeProgramKey(node.institution, node.faculty, node.program);
  }

  return makeAcademicPeriodKey(node.institution, node.faculty, node.program, node.academicPeriod);
}

function getNodeLabel(selectedNode: string) {
  const node = parseNode(selectedNode);

  if (node.type === 'root') {
    return courseRepositoryLabel;
  }

  if (node.type === 'institution') {
    return node.institution;
  }

  if (node.type === 'faculty') {
    return node.faculty;
  }

  if (node.type === 'program') {
    return node.program;
  }

  if (node.type === 'academicPeriod') {
    return node.academicPeriod;
  }

  return node.courseType;
}

function getNodePath(selectedNode: string) {
  const node = parseNode(selectedNode);

  if (node.type === 'root') {
    return [{ key: 'root', label: courseRepositoryLabel }];
  }

  if (node.type === 'institution') {
    return [
      { key: 'root', label: courseRepositoryLabel },
      { key: makeInstitutionKey(node.institution), label: node.institution },
    ];
  }

  if (node.type === 'faculty') {
    return [
      { key: 'root', label: courseRepositoryLabel },
      { key: makeInstitutionKey(node.institution), label: node.institution },
      { key: makeFacultyKey(node.institution, node.faculty), label: node.faculty },
    ];
  }

  if (node.type === 'program') {
    return [
      { key: 'root', label: courseRepositoryLabel },
      { key: makeInstitutionKey(node.institution), label: node.institution },
      { key: makeFacultyKey(node.institution, node.faculty), label: node.faculty },
      { key: makeProgramKey(node.institution, node.faculty, node.program), label: node.program },
    ];
  }

  if (node.type === 'academicPeriod') {
    return [
      { key: 'root', label: courseRepositoryLabel },
      { key: makeInstitutionKey(node.institution), label: node.institution },
      { key: makeFacultyKey(node.institution, node.faculty), label: node.faculty },
      { key: makeProgramKey(node.institution, node.faculty, node.program), label: node.program },
      {
        key: makeAcademicPeriodKey(node.institution, node.faculty, node.program, node.academicPeriod),
        label: node.academicPeriod,
      },
    ];
  }

  return [
    { key: 'root', label: courseRepositoryLabel },
    { key: makeInstitutionKey(node.institution), label: node.institution },
    { key: makeFacultyKey(node.institution, node.faculty), label: node.faculty },
    { key: makeProgramKey(node.institution, node.faculty, node.program), label: node.program },
    {
      key: makeAcademicPeriodKey(node.institution, node.faculty, node.program, node.academicPeriod),
      label: node.academicPeriod,
    },
  ];
}

function describeFolderCount(count: number, singularContext: string, pluralContext: string) {
  if (count === 0) {
    return `Sin cursos todavía en ${pluralContext}.`;
  }

  return `${count} curso${count === 1 ? '' : 's'} en ${count === 1 ? singularContext : pluralContext}.`;
}

function buildFolderEntries(appData: AppData, courses: Course[], selectedNode: string): FolderEntry[] {
  const node = parseNode(selectedNode);
  const structures = getInstitutionStructures(appData.institution);
  const institutionNames = uniqueOptions([
    ...structures.map((structure) => structure.institution),
    ...courses.map((course) => getInstitution(course)),
  ]);

  if (node.type === 'root') {
    return institutionNames
      .map((institution) => {
        const key = makeInstitutionKey(institution);
        const count = courses.filter((course) => matchesFolder(course, key)).length;

        return {
          key,
          label: institution,
          description: describeFolderCount(count, 'esta institución', 'estas instituciones'),
          count,
          type: 'institution' as const,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }

  if (node.type === 'institution') {
    const facultyOptions = uniqueOptions([
      ...getInstitutionFaculties(appData.institution, node.institution),
      ...courses
        .filter((course) => getInstitution(course) === node.institution)
        .map((course) => course.faculty),
    ]);

    return facultyOptions
      .map((faculty) => {
        const key = makeFacultyKey(node.institution, faculty);
        const count = courses.filter((course) => matchesFolder(course, key)).length;

        return {
          key,
          label: faculty,
          description: describeFolderCount(count, 'esta facultad', 'estas facultades'),
          count,
          type: 'faculty' as const,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }

  if (node.type === 'faculty') {
    const programOptions = uniqueOptions([
      ...getInstitutionPrograms(appData.institution, node.institution),
      ...courses
        .filter((course) => getInstitution(course) === node.institution && course.faculty === node.faculty)
        .map((course) => course.program),
    ]);

    return programOptions
      .map((program) => {
        const key = makeProgramKey(node.institution, node.faculty, program);
        const count = courses.filter((course) => matchesFolder(course, key)).length;

        return {
          key,
          label: program,
          description: describeFolderCount(count, 'este programa', 'estos programas'),
          count,
          type: 'program' as const,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }

  if (node.type === 'program') {
    const academicPeriodOptions = uniqueOptions([
      ...getInstitutionAcademicPeriods(appData.institution, node.institution),
      ...courses
        .filter(
          (course) =>
            getInstitution(course) === node.institution &&
            course.faculty === node.faculty &&
            course.program === node.program,
        )
        .map((course) => getAcademicPeriod(course)),
    ]);

    return academicPeriodOptions
      .map((academicPeriod) => {
        const key = makeAcademicPeriodKey(node.institution, node.faculty, node.program, academicPeriod);
        const count = courses.filter((course) => matchesFolder(course, key)).length;

        return {
          key,
          label: academicPeriod,
          description: describeFolderCount(count, 'este periodo', 'estos periodos'),
          count,
          type: 'academicPeriod' as const,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }

  return [];
}

function getFolderSectionCopy(selectedNode: string) {
  const node = parseNode(selectedNode);

  if (node.type === 'root') {
    return 'Explora las instituciones visibles y entra a sus subcarpetas académicas.';
  }

  if (node.type === 'institution') {
    return 'Esta carpeta reúne las facultades visibles dentro de la institución seleccionada.';
  }

  if (node.type === 'faculty') {
    return 'Aquí se organizan los programas académicos que pertenecen a esta facultad.';
  }

  if (node.type === 'program') {
    return 'Aquí se organizan los periodos académicos disponibles para el programa.';
  }

  return 'Selecciona un periodo para ver los cursos. Ya estás en el nivel operativo final.';
}


export function CoursesPage({
  role,
  appData,
  userRole,
  refreshAppData,
}: CoursesPageProps) {
  const { showAlert } = useSystemDialog();
  const [view, setView] = useState<ExplorerView>('cards');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState('root');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [projectFilter, setProjectFilter] = useState('Todos');
  const [institutionFilter, setInstitutionFilter] = useState('Todas');
  const [facultyFilter, setFacultyFilter] = useState('Todas');
  const [programFilter, setProgramFilter] = useState('Todos');
  const [periodFilter, setPeriodFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [stageFilter, setStageFilter] = useState('Todas');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    createInitialCourseForm(appData),
  );
  const [createdCourse, setCreatedCourse] = useState<Course | null>(null);

  const visibleCourses = getVisibleCourses(appData, userRole === 'Administrador' ? 'Administrador' : role);
  const canCreate = canManageCourses(userRole);

  const projectOptions = useMemo(
    () =>
      visibleCourses
        .map((course) => ({
          value: course.id,
          label: `${course.title} · ${course.code}`,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'es')),
    [visibleCourses],
  );

  const institutionOptions = useMemo(
    () =>
      Array.from(new Set(visibleCourses.map((course) => getInstitution(course)))).sort((left, right) =>
        left.localeCompare(right, 'es'),
      ),
    [visibleCourses],
  );

  const filteredForFacultyOptions = visibleCourses.filter((course) =>
    institutionFilter === 'Todas' ? true : getInstitution(course) === institutionFilter,
  );
  const facultyOptions = Array.from(
    new Set(filteredForFacultyOptions.map((course) => course.faculty)),
  ).sort((left, right) => left.localeCompare(right, 'es'));

  const filteredForProgramOptions = visibleCourses.filter((course) => {
    const matchesInstitution =
      institutionFilter === 'Todas' ? true : getInstitution(course) === institutionFilter;
    const matchesFaculty = facultyFilter === 'Todas' ? true : course.faculty === facultyFilter;

    return matchesInstitution && matchesFaculty;
  });
  const programOptions = Array.from(
    new Set(filteredForProgramOptions.map((course) => course.program)),
  ).sort((left, right) => left.localeCompare(right, 'es'));

  const periodOptions = Array.from(
    new Set(visibleCourses.map((course) => course.metadata.academicPeriod || 'Sin periodo')),
  ).sort((left, right) => left.localeCompare(right, 'es'));

  const typeOptions = Array.from(
    new Set(visibleCourses.map((course) => course.metadata.courseType || 'Curso')),
  ).sort((left, right) => left.localeCompare(right, 'es'));
  const composerInstitutionOptions = useMemo(
    () =>
      uniqueOptions(
        appData.institution.institutions.length > 0
          ? appData.institution.institutions
          : visibleCourses.map((course) => getInstitution(course)),
      ),
    [appData.institution, visibleCourses],
  );
  const composerFacultyOptions = useMemo(
    () => uniqueOptions(getInstitutionFaculties(appData.institution, courseForm.institution)),
    [appData.institution, courseForm.institution],
  );
  const composerProgramOptions = useMemo(
    () => uniqueOptions(getInstitutionPrograms(appData.institution, courseForm.institution)),
    [appData.institution, courseForm.institution],
  );
  const composerPeriodOptions = useMemo(
    () => uniqueOptions(getInstitutionAcademicPeriods(appData.institution, courseForm.institution)),
    [appData.institution, courseForm.institution],
  );
  const composerCourseTypeOptions = useMemo(
    () => uniqueOptions(getInstitutionCourseTypes(appData.institution, courseForm.institution)),
    [appData.institution, courseForm.institution],
  );


  useEffect(() => {
    setCourseForm((current) => syncCourseStructureFields(appData, current));
  }, [appData]);

  async function handleCreateCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(courseForm),
      });

      const payload = (await response.json()) as { course?: Course; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el curso.');
      }

      refreshAppData();
      setCourseForm(createInitialCourseForm(appData));
      setIsComposerOpen(false);
      
      if (payload.course) {
        setCreatedCourse(payload.course);
      }
    } catch (error) {
      await showAlert({
        title: 'No fue posible crear el curso',
        message: error instanceof Error ? error.message : 'No fue posible crear el curso.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function updateCourseField<Key extends keyof CourseMutationInput>(
    key: Key,
    value: CourseMutationInput[Key],
  ) {
    setCourseForm((current) => {
      if (key === 'institution') {
        return syncCourseStructureFields(appData, {
          ...current,
          institution: value as CourseMutationInput['institution'],
          faculty: '',
          program: '',
          academicPeriod: '',
          courseType: '',
        });
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  useEffect(() => {
    if (!isComposerOpen) return;

    const getSegment = (text: string) => {
      if (!text) return 'XXX';
      const words = text.trim().split(/\s+/).filter(w => w.length > 2);
      if (words.length >= 2) {
        return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
      }
      return text.trim().slice(0, 3).toUpperCase();
    };

    const inst = getSegment(courseForm.institution);
    const fac = getSegment(courseForm.faculty);
    const prog = getSegment(courseForm.program);
    const type = getSegment(courseForm.courseType);
    const year = new Date().getFullYear().toString().slice(-2);
    
    // Static suffix based on title length or similar to keep it stable during edits
    const suffix = courseForm.title 
      ? (courseForm.title.length % 100).toString().padStart(2, '0')
      : '00';
    
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const generatedCode = `CUR-${inst}-${fac}-${prog}-${type}-${year}${suffix}${random}`;

    setCourseForm((current) => {
      if (current.code === generatedCode) return current;
      return { ...current, code: generatedCode };
    });
  }, [
    isComposerOpen,
    courseForm.institution,
    courseForm.faculty,
    courseForm.program,
    courseForm.courseType,
    courseForm.title,
  ]);

  function clearFilters() {
    setProjectFilter('Todos');
    setInstitutionFilter('Todas');
    setFacultyFilter('Todas');
    setProgramFilter('Todos');
    setPeriodFilter('Todos');
    setTypeFilter('Todos');
    setStageFilter('Todas');
    setStatusFilter('Todos');
    setSearch('');
  }

  const query = search.trim().toLowerCase();
  const repositoryCourses = visibleCourses
    .filter((course) => (projectFilter === 'Todos' ? true : course.id === projectFilter))
    .filter((course) =>
      institutionFilter === 'Todas' ? true : getInstitution(course) === institutionFilter,
    )
    .filter((course) => (facultyFilter === 'Todas' ? true : course.faculty === facultyFilter))
    .filter((course) => (programFilter === 'Todos' ? true : course.program === programFilter))
    .filter((course) =>
      periodFilter === 'Todos' ? true : course.metadata.academicPeriod === periodFilter,
    )
    .filter((course) => (typeFilter === 'Todos' ? true : course.metadata.courseType === typeFilter))
    .filter((course) => (stageFilter === 'Todas' ? true : course.stageId === stageFilter))
    .filter((course) => (statusFilter === 'Todos' ? true : course.status === statusFilter))
    .filter((course) => {
      if (!query) {
        return true;
      }

      const stageName = getStageMeta(appData, course.stageId)?.name ?? course.stageId;
      const target = [
        course.title,
        course.code,
        course.faculty,
        course.program,
        course.summary,
        buildRouteLabel(course),
        course.metadata.shortName,
        course.metadata.academicPeriod,
        course.metadata.courseType,
        stageName,
      ]
        .join(' ')
        .toLowerCase();

      return target.includes(query);
    });

  const currentFolderCourses = repositoryCourses
    .filter((course) => matchesFolder(course, selectedNode))
    .sort((left, right) => {
      if (sortMode === 'progress') {
        return right.progress - left.progress;
      }

      if (sortMode === 'name') {
        return left.title.localeCompare(right.title, 'es');
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });

  const folderEntries = buildFolderEntries(appData, repositoryCourses, selectedNode);
  const folderPath = getNodePath(selectedNode);
  const parentNode = getParentNode(selectedNode);
  const currentNode = parseNode(selectedNode);
  const isRootEntry = selectedNode === 'root';
  const isProgramEntry = currentNode.type === 'academicPeriod';
  const activeFilterCount = [
    projectFilter !== 'Todos',
    institutionFilter !== 'Todas',
    facultyFilter !== 'Todas',
    programFilter !== 'Todos',
    periodFilter !== 'Todos',
    typeFilter !== 'Todos',
    stageFilter !== 'Todas',
    statusFilter !== 'Todos',
    search.trim().length > 0,
  ].filter(Boolean).length;
  const hasAdvancedFiltersActive =
    periodFilter !== 'Todos' ||
    typeFilter !== 'Todos' ||
    stageFilter !== 'Todas' ||
    statusFilter !== 'Todos';
  const shouldShowAdvancedFilters = showAdvancedFilters || hasAdvancedFiltersActive || !isRootEntry;

  return (
    <div className="page-stack courses-page courses-page--folders">
      <section className="surface section-card section-card--compact courses-entry-shell">
        <div className="toolbar toolbar--compact">
          <div className="courses-toolbar__intro">
            <span className="eyebrow">
              {isRootEntry ? 'Buscar y filtrar' : `Carpeta activa · ${getNodeLabel(selectedNode)}`}
            </span>
          </div>

          <div className="toolbar-header toolbar-header--compact">
            <label className="field field--search courses-toolbar__search">
              <span>Buscar curso</span>
              <div className="field__control">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar curso, código o carpeta"
                />
              </div>
            </label>

            {canCreate && !isProgramEntry ? (
              <button
                type="button"
                className={isComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsComposerOpen(true)}
              >
                <Plus size={16} />
                <span>Nuevo curso</span>
              </button>
            ) : null}
          </div>

          {!isProgramEntry && (
            <div className="courses-filter-grid courses-filter-grid--compact">
              <label className="field field--compact">
                <span>Institución</span>
                <div className="field__control">
                  <select
                    value={institutionFilter}
                    onChange={(event) => setInstitutionFilter(event.target.value)}
                  >
                    <option value="Todas">Todas</option>
                    {institutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--compact">
                <span>Facultad</span>
                <div className="field__control">
                  <select
                    value={facultyFilter}
                    onChange={(event) => setFacultyFilter(event.target.value)}
                  >
                    <option value="Todas">Todas</option>
                    {facultyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--compact">
                <span>Programa</span>
                <div className="field__control">
                  <select
                    value={programFilter}
                    onChange={(event) => setProgramFilter(event.target.value)}
                  >
                    <option value="Todos">Todos</option>
                    {programOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--compact">
                <span>Proyecto / curso</span>
                <div className="field__control">
                  <select
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                  >
                    <option value="Todos">Todos</option>
                    {projectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
          )}

          {shouldShowAdvancedFilters ? (
            <div className="courses-filter-grid courses-filter-grid--advanced">
              <label className="field field--compact">
                <span>Periodo</span>
                <div className="field__control">
                  <select
                    value={periodFilter}
                    onChange={(event) => setPeriodFilter(event.target.value)}
                  >
                    <option value="Todos">Todos</option>
                    {periodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--compact">
                <span>Tipo</span>
                <div className="field__control">
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="Todos">Todos</option>
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--compact">
                <span>Etapa</span>
                <div className="field__control">
                  <select
                    value={stageFilter}
                    onChange={(event) => setStageFilter(event.target.value)}
                  >
                    <option value="Todas">Todas</option>
                    {appData.stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--compact">
                <span>Estado</span>
                <div className="field__control">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  >
                    {statusFilters.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
          ) : null}

          <div className="courses-toolbar__meta courses-toolbar__meta--compact">
            {isProgramEntry ? (
              <>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={
                      view === 'cards'
                        ? 'segmented-control__button is-active'
                        : 'segmented-control__button'
                    }
                    onClick={() => setView('cards')}
                  >
                    <LayoutGrid size={16} />
                    <span>Tarjetas</span>
                  </button>
                  <button
                    type="button"
                    className={
                      view === 'list'
                        ? 'segmented-control__button is-active'
                        : 'segmented-control__button'
                    }
                    onClick={() => setView('list')}
                  >
                    <List size={16} />
                    <span>Listado</span>
                  </button>
                </div>

                <label className="field courses-toolbar__sort">
                  <span>Ordenar</span>
                  <div className="field__control">
                    <select
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as SortMode)}
                    >
                      <option value="recent">Actualizados</option>
                      <option value="progress">Avance</option>
                      <option value="name">Nombre</option>
                    </select>
                  </div>
                </label>
              </>
            ) : null}

            <button
              type="button"
              className={shouldShowAdvancedFilters ? 'filter-chip filter-chip--active' : 'filter-chip'}
              onClick={() => setShowAdvancedFilters((current) => !current)}
            >
              <span>{shouldShowAdvancedFilters ? 'Ocultar filtros avanzados' : 'Más filtros'}</span>
            </button>

            <button type="button" className="ghost-button" onClick={clearFilters}>
              <span>Limpiar filtros</span>
            </button>
          </div>

          {isComposerOpen ? (
            <ModalFrame
              eyebrow="Alta rápida"
              title="Crear curso"
              width="xl"
              onClose={() => setIsComposerOpen(false)}
            >
              <form onSubmit={handleCreateCourse}>
                <div className="form-grid">
                  <div className="form-section-header field--full">
                    <h5>Identidad del curso</h5>
                  </div>
                  <label className="field">
                    <span>Título</span>
                    <div className="field__control">
                      <input
                        value={courseForm.title}
                        onChange={(event) => updateCourseField('title', event.target.value)}
                        placeholder="Nombre del curso"
                        required
                      />
                    </div>
                  </label>

                  <label className="field field--readonly">
                    <span>ID / código (Automático)</span>
                    <div className="field__control">
                      <input
                        value={courseForm.code}
                        readOnly
                        placeholder="CUR-INST-FAC-PROG-..."
                        required
                      />
                    </div>
                  </label>

                  <div className="form-section-header field--full">
                    <h5>Estructura institucional y ubicación</h5>
                  </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="form-label">Institución</label>
                  <div className="modern-select-wrapper">
                    <select
                      className="modern-select"
                      value={courseForm.institution}
                      onChange={(event) => updateCourseField('institution', event.target.value)}
                      required
                    >
                      {composerInstitutionOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <ChevronDown className="modern-select-icon" size={18} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Facultad</label>
                  <div className="modern-select-wrapper">
                    <select
                      className="modern-select"
                      value={courseForm.faculty}
                      onChange={(event) => updateCourseField('faculty', event.target.value)}
                      required
                    >
                      {composerFacultyOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <ChevronDown className="modern-select-icon" size={18} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Programa</label>
                  <div className="modern-select-wrapper">
                    <select
                      className="modern-select"
                      value={courseForm.program}
                      onChange={(event) => updateCourseField('program', event.target.value)}
                      required
                    >
                      {composerProgramOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <ChevronDown className="modern-select-icon" size={18} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label flex items-center justify-between">
                    <span>Créditos</span>
                    <span className="text-[10px] font-bold text-ocean">ECTS / Institucional</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      className="modern-input"
                      value={courseForm.credits || ''}
                      onChange={(event) => updateCourseField('credits', Number(event.target.value))}
                      placeholder="Ej: 3"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted/30">pts</div>
                  </div>
                </div>
              </div>

                  <label className="field">
                    <span>Periodo académico</span>
                    <div className="field__control">
                      <select
                        value={courseForm.academicPeriod}
                        onChange={(event) => updateCourseField('academicPeriod', event.target.value)}
                      >
                        <option value="">Sin definir</option>
                        {composerPeriodOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="field">
                    <span>Tipología de curso</span>
                    <div className="field__control">
                      <select
                        value={courseForm.courseType}
                        onChange={(event) => updateCourseField('courseType', event.target.value)}
                        required
                      >
                        {composerCourseTypeOptions.map((option) => (
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
                      <select
                        value={courseForm.modality}
                        onChange={(event) => updateCourseField('modality', event.target.value)}
                        required
                      >
                        <option value="presencial">Presencial</option>
                        <option value="virtual">Virtual</option>
                        <option value="híbrido">Híbrido</option>
                        <option value="MOOC">MOOC</option>
                      </select>
                    </div>
                  </label>

                  <div className="form-section-header field--full">
                    <h5>Configuración operativa</h5>
                  </div>

                  <label className="field">
                    <span>Créditos</span>
                    <div className="field__control">
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={courseForm.credits}
                        onChange={(event) =>
                           updateCourseField('credits', Number.parseInt(event.target.value, 10) || 1)
                        }
                        required
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>Etapa inicial</span>
                    <div className="field__control">
                      <select
                        value={courseForm.stageId}
                        onChange={(event) => updateCourseField('stageId', event.target.value)}
                      >
                        {appData.stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
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
                          updateCourseField('status', event.target.value as CourseStatus)
                        }
                      >
                        {statusFilters
                          .filter((item) => item !== 'Todos')
                          .map((status) => (
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
                        onChange={(event) => updateCourseField('nextMilestone', event.target.value)}
                        placeholder="Aprobación de arquitectura · 12 abr 2026"
                      />
                    </div>
                  </label>

                  <label className="field field--full">
                    <span>Resumen</span>
                    <div className="field__control field__control--textarea">
                      <textarea
                        value={courseForm.summary}
                        onChange={(event) => updateCourseField('summary', event.target.value)}
                        placeholder="Describe el enfoque del curso y su intención formativa."
                        rows={4}
                      />
                    </div>
                  </label>
                </div>

                <div className="action-row">
                  <button type="submit" className="cta-button" disabled={isSaving}>
                    <span>{isSaving ? 'Creando…' : 'Crear curso'}</span>
                  </button>
                  <button type="button" className="filter-chip" onClick={() => setIsComposerOpen(false)}>
                    <span>Cancelar</span>
                  </button>
                </div>
              </form>
            </ModalFrame>

          ) : null}
        </div>
      </section>

      <section className="surface section-card section-card--compact folder-browser folder-browser--compact">
        {!isProgramEntry && (
          <div className="folder-browser__head">
            <div>
              <span className="eyebrow">{isRootEntry ? 'Nivel 1' : 'Subcarpetas'}</span>
              <h3>{isRootEntry ? 'Carpetas' : getNodeLabel(selectedNode)}</h3>
              {!isRootEntry ? <p className="courses-results__summary">{getFolderSectionCopy(selectedNode)}</p> : null}
            </div>

            <div className="folder-browser__actions">
              {parentNode ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setSelectedNode(parentNode)}
                >
                  <ArrowLeft size={16} />
                  <span>Subir un nivel</span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {!isRootEntry ? (
          <>
            <div className="breadcrumb-row folder-path">
              {folderPath.map((segment, index) => (
                <span key={segment.key} className="breadcrumb-row__item">
                  {index > 0 ? <ChevronRight size={14} /> : null}
                  <button
                    type="button"
                    className={
                      index === folderPath.length - 1
                        ? 'folder-breadcrumb folder-breadcrumb--current'
                        : 'folder-breadcrumb'
                    }
                    onClick={() => setSelectedNode(segment.key)}
                    disabled={index === folderPath.length - 1}
                  >
                    {segment.label}
                  </button>
                </span>
              ))}
            </div>

            <div className="courses-inline-meta">
              <span>{folderEntries.length} subcarpetas</span>
              <span>{activeFilterCount} filtros activos</span>
              {isProgramEntry ? <span>{currentFolderCourses.length} cursos visibles</span> : null}
            </div>
          </>
        ) : null}

        {folderEntries.length > 0 ? (
          <div className="folder-grid">
            {folderEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className="folder-card"
                onClick={() => setSelectedNode(entry.key)}
              >
                <div className="folder-card__icon">
                  {entry.type === 'program' ? <FolderOpen size={20} /> : <FolderClosed size={20} />}
                </div>
                <div className="folder-card__content">
                  <strong>{entry.label}</strong>
                  <p>{entry.description}</p>
                </div>
                <span className="folder-card__count">{entry.count}</span>
              </button>
            ))}
          </div>
        ) : !isProgramEntry ? (
          <div className="empty-state empty-state--embedded folder-browser__empty">
            <strong>
              {isProgramEntry
                ? 'Llegaste al último nivel de carpetas'
                : 'No hay más subcarpetas en esta ruta'}
            </strong>
            <p>
              {isProgramEntry
                ? 'Esta carpeta ya corresponde a un programa. Debajo verás únicamente los cursos disponibles.'
                : 'Ajusta los filtros o vuelve un nivel para encontrar más rutas académicas.'}
            </p>
          </div>
        ) : null}
      </section>

      {isProgramEntry ? (
        <section className="surface section-card explorer-content">
          {!isProgramEntry && (
            <div className="explorer-content__head">
              <div>
                <span className="eyebrow">Cursos</span>
                <h3>Cursos dentro de {getNodeLabel(selectedNode)}</h3>
                <p className="courses-results__summary">
                  {currentFolderCourses.length} visibles en esta carpeta.
                </p>
              </div>
            </div>
          )}

          {currentFolderCourses.length === 0 ? (
            <div className="empty-state">
              <strong>No encontramos cursos en esta vista</strong>
              <p>Ajusta la búsqueda, limpia filtros o navega a otra carpeta del repositorio.</p>
            </div>
          ) : view === 'cards' ? (
            <section className="courses-grid courses-grid--explorer">
              {currentFolderCourses.map((course) => {
                const stageMeta = getStageMeta(appData, course.stageId);
                const alertCount = appData.alerts.filter((alert) => alert.courseSlug === course.slug).length;
                const pendingObservations = course.observations.filter(
                  (observation) => observation.status !== 'Resuelta',
                ).length;

                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    stageName={stageMeta?.name ?? course.stageId}
                    routeLabel={buildRouteLabel(course)}
                    ownerLabel={stageMeta?.owner}
                    alertCount={alertCount}
                    pendingObservations={pendingObservations}
                    variant={isProgramEntry ? 'simple' : 'default'}
                  />
                );
              })}
            </section>
          ) : (
            <div className="list-stack">
              {currentFolderCourses.map((course) => {
                const stageMeta = getStageMeta(appData, course.stageId);
                const alertCount = appData.alerts.filter((alert) => alert.courseSlug === course.slug).length;
                const pendingObservations = course.observations.filter(
                  (observation) => observation.status !== 'Resuelta',
                ).length;

                return (
                  <Link key={course.id} to={`/courses/${course.slug}`} className="task-item explorer-result">
                    <div>
                      <span className="badge badge--outline">{course.code}</span>
                      <strong>{course.title}</strong>
                      <p>{buildRouteLabel(course)}</p>
                    </div>

                    <div className="task-item__meta">
                      <span>{course.metadata.courseType}</span>
                      <span>{course.metadata.academicPeriod}</span>
                      <span>{stageMeta?.name ?? course.stageId}</span>
                      <span>{course.progress}%</span>
                      <span>{alertCount} alertas</span>
                      <span>{pendingObservations} observaciones</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
      {createdCourse && (
        <ModalFrame
          eyebrow="Creación rápida"
          title="¡Curso creado con éxito!"
          width="sm"
          onClose={() => setCreatedCourse(null)}
        >
          <div className="success-state">
            <div className="success-state__icon">
              <CheckCircle size={48} color="var(--success-main)" />
            </div>
            <h4>{createdCourse.title}</h4>
            <p>
              El curso se ha registrado correctamente en el repositorio y la estructura de carpetas
              se ha actualizado.
            </p>
            <div className="success-state__actions">
              <Link
                to={`/courses/${createdCourse.slug}`}
                className="button button--primary button--full"
                onClick={() => setCreatedCourse(null)}
              >
                <span>Ver curso</span>
              </Link>
              <button
                type="button"
                className="ghost-button button--full"
                onClick={() => setCreatedCourse(null)}
              >
                <span>Cerrar</span>
              </button>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
