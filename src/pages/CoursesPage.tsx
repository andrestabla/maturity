import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  Search,
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
  'En ritmo',
  'En revisión',
  'Riesgo',
  'Bloqueado',
  'Listo',
];

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

function createInitialCourseForm(appData: AppData): CourseMutationInput {
  return syncCourseStructureFields(appData, {
    title: '',
    code: '',
    institution: '',
    faculty: '',
    program: '',
    academicPeriod: '',
    courseType: '',
    modality: 'Virtual guiado',
    credits: 3,
    stageId: appData.stages[0]?.id ?? 'configuracion',
    status: 'En revisión',
    summary: '',
    nextMilestone: '',
  });
}

function getInstitution(course: Course) {
  return course.metadata.institution || 'Institución sin definir';
}

function getAcademicPeriod(course: Course) {
  return course.metadata.academicPeriod || 'Periodo sin definir';
}

function getCourseType(course: Course) {
  return course.metadata.courseType || 'Tipología sin definir';
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

function makeCourseTypeKey(
  institution: string,
  faculty: string,
  program: string,
  academicPeriod: string,
  courseType: string,
) {
  return `courseType::${institution}::${faculty}::${program}::${academicPeriod}::${courseType}`;
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
  const institution = getInstitution(course);

  if (node.type === 'root') {
    return true;
  }

  if (node.type === 'institution') {
    return institution === node.institution;
  }

  if (node.type === 'faculty') {
    return institution === node.institution && course.faculty === node.faculty;
  }

  if (node.type === 'program') {
    return (
      institution === node.institution &&
      course.faculty === node.faculty &&
      course.program === node.program
    );
  }

  if (node.type === 'academicPeriod') {
    return (
      institution === node.institution &&
      course.faculty === node.faculty &&
      course.program === node.program &&
      getAcademicPeriod(course) === node.academicPeriod
    );
  }

  return (
    institution === node.institution &&
    course.faculty === node.faculty &&
    course.program === node.program &&
    getAcademicPeriod(course) === node.academicPeriod &&
    getCourseType(course) === node.courseType
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
    {
      key: makeCourseTypeKey(
        node.institution,
        node.faculty,
        node.program,
        node.academicPeriod,
        node.courseType,
      ),
      label: node.courseType,
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

  if (node.type === 'academicPeriod') {
    const courseTypeOptions = uniqueOptions([
      ...getInstitutionCourseTypes(appData.institution, node.institution),
      ...courses
        .filter(
          (course) =>
            getInstitution(course) === node.institution &&
            course.faculty === node.faculty &&
            course.program === node.program &&
            getAcademicPeriod(course) === node.academicPeriod,
        )
        .map((course) => getCourseType(course)),
    ]);

    return courseTypeOptions
      .map((courseType) => {
        const key = makeCourseTypeKey(
          node.institution,
          node.faculty,
          node.program,
          node.academicPeriod,
          courseType,
        );
        const count = courses.filter((course) => matchesFolder(course, key)).length;

        return {
          key,
          label: courseType,
          description: describeFolderCount(count, 'esta tipología', 'estas tipologías'),
          count,
          type: 'courseType' as const,
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

  if (node.type === 'academicPeriod') {
    return 'Selecciona la tipología del curso para entrar a la carpeta operativa final.';
  }

  return 'Ya estás en la carpeta final del directorio. Debajo verás los cursos disponibles en esta ruta.';
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

  const visibleCourses = getVisibleCourses(appData, role);
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
    if (
      selectedNode !== 'root' &&
      !visibleCourses.some((course) => matchesFolder(course, selectedNode))
    ) {
      setSelectedNode('root');
    }
  }, [selectedNode, visibleCourses]);

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

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el curso.');
      }

      refreshAppData();
      setCourseForm(createInitialCourseForm(appData));
      setIsComposerOpen(false);
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
  const isProgramEntry = currentNode.type === 'program';
  const openCount = currentFolderCourses.filter((course) => course.status !== 'Listo').length;
  const blockedCount = currentFolderCourses.filter((course) => course.status === 'Bloqueado').length;
  const stageCount = new Set(currentFolderCourses.map((course) => course.stageId)).size;
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

            {canCreate ? (
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
              eyebrow="Cursos"
              title="Crear curso"
              description="El alta se abre en modal para mantener el directorio y los filtros siempre despejados."
              width="xl"
              onClose={() => setIsComposerOpen(false)}
            >
              <form className="editor-card" onSubmit={handleCreateCourse}>
                <div className="editor-card__header">
                  <div>
                    <span className="eyebrow">Alta rápida</span>
                    <h3>Crear curso</h3>
                  </div>
                </div>

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

                  <label className="field">
                    <span>ID / código</span>
                    <div className="field__control">
                      <input
                        value={courseForm.code}
                        onChange={(event) => updateCourseField('code', event.target.value)}
                        placeholder="CUR-UNIX-EDU-PSI-0001"
                        required
                      />
                    </div>
                  </label>

                  <div className="form-section-header field--full">
                    <h5>Estructura institucional y ubicación</h5>
                    <p>Define dónde se ubicará el curso dentro del repositorio jerárquico.</p>
                  </div>

                  <label className="field">
                    <span>Institución</span>
                    <div className="field__control">
                      <select
                        value={courseForm.institution}
                        onChange={(event) => updateCourseField('institution', event.target.value)}
                        required
                      >
                        {composerInstitutionOptions.map((option) => (
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
                        onChange={(event) => updateCourseField('faculty', event.target.value)}
                        required
                      >
                        {composerFacultyOptions.map((option) => (
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
                        onChange={(event) => updateCourseField('program', event.target.value)}
                        required
                      >
                        {composerProgramOptions.map((option) => (
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
                        onChange={(event) => updateCourseField('academicPeriod', event.target.value)}
                        required
                      >
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
                      <input
                        value={courseForm.modality}
                        onChange={(event) => updateCourseField('modality', event.target.value)}
                        placeholder="Virtual guiado"
                        required
                      />
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
                        required
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
                        required
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
        ) : (
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
        )}
      </section>

      {isProgramEntry ? (
        <section className="surface section-card explorer-content">
          <div className="explorer-content__head">
            <div>
              <span className="eyebrow">Cursos</span>
              <h3>Cursos dentro de {getNodeLabel(selectedNode)}</h3>
              <p className="courses-results__summary">
                {currentFolderCourses.length} visibles en esta carpeta.
              </p>
            </div>
          </div>

          <div className="courses-inline-meta">
            <span>{openCount} abiertos</span>
            <span>{blockedCount === 0 ? 'Sin bloqueos' : `${blockedCount} bloqueados`}</span>
            <span>{stageCount} etapas activas</span>
          </div>

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
    </div>
  );
}
