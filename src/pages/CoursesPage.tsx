import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FolderClosed,
  FolderKanban,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { CourseCard } from '../components/CourseCard.js';
import type { AppData, Course, CourseMutationInput, CourseStatus, Role } from '../types.js';
import { getStageMeta, getVisibleCourses } from '../utils/domain.js';
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
type FolderNodeType = 'root' | 'institution' | 'faculty' | 'program';

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
const repositoryLabel = 'Repositorio institucional';

function createInitialCourseForm(appData: AppData): CourseMutationInput {
  return {
    title: '',
    code: '',
    faculty: '',
    program: '',
    modality: 'Virtual guiado',
    credits: 3,
    stageId: appData.stages[0]?.id ?? 'configuracion',
    status: 'En revisión',
    summary: '',
    nextMilestone: '',
  };
}

function getInstitution(course: Course) {
  return course.metadata.institution || 'Institución sin definir';
}

function buildRouteLabel(course: Course) {
  return `${getInstitution(course)} / ${course.faculty} / ${course.program}`;
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

function parseNode(selectedNode: string) {
  if (selectedNode === 'root') {
    return { type: 'root' as const };
  }

  const [type, institution, faculty, program] = selectedNode.split('::');

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

  return (
    institution === node.institution &&
    course.faculty === node.faculty &&
    course.program === node.program
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

  return makeFacultyKey(node.institution, node.faculty);
}

function getNodeLabel(selectedNode: string) {
  const node = parseNode(selectedNode);

  if (node.type === 'root') {
    return repositoryLabel;
  }

  if (node.type === 'institution') {
    return node.institution;
  }

  if (node.type === 'faculty') {
    return node.faculty;
  }

  return node.program;
}

function getNodePath(selectedNode: string) {
  const node = parseNode(selectedNode);

  if (node.type === 'root') {
    return [{ key: 'root', label: repositoryLabel }];
  }

  if (node.type === 'institution') {
    return [
      { key: 'root', label: repositoryLabel },
      { key: makeInstitutionKey(node.institution), label: node.institution },
    ];
  }

  if (node.type === 'faculty') {
    return [
      { key: 'root', label: repositoryLabel },
      { key: makeInstitutionKey(node.institution), label: node.institution },
      { key: makeFacultyKey(node.institution, node.faculty), label: node.faculty },
    ];
  }

  return [
    { key: 'root', label: repositoryLabel },
    { key: makeInstitutionKey(node.institution), label: node.institution },
    { key: makeFacultyKey(node.institution, node.faculty), label: node.faculty },
    { key: makeProgramKey(node.institution, node.faculty, node.program), label: node.program },
  ];
}

function buildFolderEntries(courses: Course[], selectedNode: string): FolderEntry[] {
  const node = parseNode(selectedNode);

  if (node.type === 'root') {
    const institutionMap = courses.reduce<Record<string, number>>((accumulator, course) => {
      const institution = getInstitution(course);
      accumulator[institution] = (accumulator[institution] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(institutionMap)
      .map(([institution, count]) => ({
        key: makeInstitutionKey(institution),
        label: institution,
        description: `${count} curso${count === 1 ? '' : 's'} en esta institución`,
        count,
        type: 'institution' as const,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }

  if (node.type === 'institution') {
    const facultyMap = courses.reduce<Record<string, number>>((accumulator, course) => {
      if (getInstitution(course) !== node.institution) {
        return accumulator;
      }

      accumulator[course.faculty] = (accumulator[course.faculty] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(facultyMap)
      .map(([faculty, count]) => ({
        key: makeFacultyKey(node.institution, faculty),
        label: faculty,
        description: `${count} curso${count === 1 ? '' : 's'} dentro de la facultad`,
        count,
        type: 'faculty' as const,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }

  if (node.type === 'faculty') {
    const programMap = courses.reduce<Record<string, number>>((accumulator, course) => {
      if (getInstitution(course) !== node.institution || course.faculty !== node.faculty) {
        return accumulator;
      }

      accumulator[course.program] = (accumulator[course.program] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(programMap)
      .map(([program, count]) => ({
        key: makeProgramKey(node.institution, node.faculty, program),
        label: program,
        description: `${count} curso${count === 1 ? '' : 's'} en este programa`,
        count,
        type: 'program' as const,
      }))
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

  return 'Ya estás en el nivel de programa. Debajo verás los cursos disponibles en esta carpeta.';
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

  useEffect(() => {
    if (
      selectedNode !== 'root' &&
      !visibleCourses.some((course) => matchesFolder(course, selectedNode))
    ) {
      setSelectedNode('root');
    }
  }, [selectedNode, visibleCourses]);

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
    setCourseForm((current) => ({
      ...current,
      [key]: value,
    }));
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

  const folderEntries = buildFolderEntries(repositoryCourses, selectedNode);
  const folderPath = getNodePath(selectedNode);
  const parentNode = getParentNode(selectedNode);
  const isRootEntry = selectedNode === 'root';
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

  return (
    <div className="page-stack courses-page courses-page--folders">
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Mis cursos</span>
            <h3>Repositorio central de cursos</h3>
          </div>
          <FolderKanban size={18} />
        </div>

        <p className="section-lead">
          Entra al repositorio institucional, navega por carpetas y subcarpetas académicas, y llega
          al curso correcto sin pasar por un árbol lateral.
        </p>

        <div className="toolbar">
          <div className="toolbar-header">
            <label className="field field--search courses-toolbar__search">
              <span>Buscar curso</span>
              <div className="field__control">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, código, facultad, programa o metadato"
                />
              </div>
            </label>

            {canCreate ? (
              <button
                type="button"
                className={isComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsComposerOpen((current) => !current)}
              >
                <Plus size={16} />
                <span>{isComposerOpen ? 'Cerrar formulario' : 'Nuevo curso'}</span>
              </button>
            ) : null}
          </div>

          <div className="courses-filter-grid">
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

          <div className="courses-toolbar__meta">
            {!isRootEntry ? (
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

            <button type="button" className="ghost-button" onClick={clearFilters}>
              <span>Limpiar filtros</span>
            </button>
          </div>

          {isComposerOpen ? (
            <form className="editor-card" onSubmit={handleCreateCourse}>
              <div className="editor-card__header">
                <div>
                  <span className="eyebrow">Alta rápida</span>
                  <h3>Crear curso</h3>
                </div>
              </div>

              <div className="form-grid">
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

                <label className="field">
                  <span>Facultad</span>
                  <div className="field__control">
                    <input
                      value={courseForm.faculty}
                      onChange={(event) => updateCourseField('faculty', event.target.value)}
                      placeholder="Facultad"
                      required
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Programa</span>
                  <div className="field__control">
                    <input
                      value={courseForm.program}
                      onChange={(event) => updateCourseField('program', event.target.value)}
                      placeholder="Programa académico"
                      required
                    />
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
              </div>
            </form>
          ) : null}
        </div>
      </section>

      <section className="surface section-card folder-browser">
        <div className="folder-browser__head">
          <div>
            <span className="eyebrow">Carpetas y subcarpetas</span>
            <h3>{isRootEntry ? 'Carpetas de nivel 1' : getNodeLabel(selectedNode)}</h3>
            <p className="section-lead">
              {isRootEntry
                ? 'Selecciona una institución para entrar a sus subcarpetas académicas.'
                : getFolderSectionCopy(selectedNode)}
            </p>
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

            <div className="metrics-grid metrics-grid--three">
              <div className="mini-metric">
                <span>Subcarpetas</span>
                <strong>{folderEntries.length}</strong>
              </div>
              <div className="mini-metric">
                <span>Cursos visibles</span>
                <strong>{currentFolderCourses.length}</strong>
              </div>
              <div className="mini-metric">
                <span>Filtros activos</span>
                <strong>{activeFilterCount}</strong>
              </div>
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
            <strong>No hay más subcarpetas en esta ruta</strong>
            <p>Ya estás en el nivel más específico de navegación. Debajo verás los cursos disponibles.</p>
          </div>
        )}
      </section>

      {!isRootEntry ? (
        <section className="surface section-card explorer-content">
          <div className="explorer-content__head">
            <div>
              <span className="eyebrow">Cursos</span>
              <h3>Cursos dentro de {getNodeLabel(selectedNode)}</h3>
              <p className="courses-results__summary">
                Busca, filtra y ordena los cursos visibles de esta carpeta sin perder la ruta
                institucional.
              </p>
            </div>
          </div>

          <div className="flow-glance flow-glance--compact">
            <div className="flow-glance__item">
              <strong>{openCount}</strong>
              <span>cursos abiertos</span>
              <p>Incluye todos los expedientes que aún están en operación o revisión.</p>
            </div>
            <div className="flow-glance__item">
              <strong>{blockedCount === 0 ? 'Sin bloqueos' : blockedCount}</strong>
              <span>estado crítico</span>
              <p>
                {blockedCount === 0
                  ? 'No hay bloqueos visibles en esta carpeta.'
                  : 'Conviene intervenir estos cursos primero para recuperar ritmo.'}
              </p>
            </div>
            <div className="flow-glance__item">
              <strong>{stageCount}</strong>
              <span>etapas activas</span>
              <p>Te muestra cuánta dispersión operativa hay en la carpeta seleccionada.</p>
            </div>
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
