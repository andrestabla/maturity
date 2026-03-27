import { useEffect, useState } from 'react';
import {
  ChevronRight,
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
type FilterMode = 'Todos' | CourseStatus;
type SortMode = 'recent' | 'progress' | 'name';

const filters: FilterMode[] = ['Todos', 'En ritmo', 'En revisión', 'Riesgo', 'Bloqueado', 'Listo'];
const rootLabel = 'Repositorio institucional';

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

function buildRouteLabel(course: Course) {
  return `${rootLabel} / ${course.faculty} / ${course.program}`;
}

function matchesNode(course: Course, selectedNode: string) {
  if (selectedNode === 'institution') {
    return true;
  }

  if (selectedNode.startsWith('faculty:')) {
    return course.faculty === selectedNode.replace('faculty:', '');
  }

  if (selectedNode.startsWith('program::')) {
    const [, faculty, program] = selectedNode.split('::');
    return course.faculty === faculty && course.program === program;
  }

  return true;
}

function getNodeLabel(selectedNode: string) {
  if (selectedNode === 'institution') {
    return rootLabel;
  }

  if (selectedNode.startsWith('faculty:')) {
    return selectedNode.replace('faculty:', '');
  }

  if (selectedNode.startsWith('program::')) {
    return selectedNode.split('::')[2] ?? rootLabel;
  }

  return rootLabel;
}

function getNodePath(selectedNode: string) {
  if (selectedNode === 'institution') {
    return [rootLabel];
  }

  if (selectedNode.startsWith('faculty:')) {
    return [rootLabel, selectedNode.replace('faculty:', '')];
  }

  if (selectedNode.startsWith('program::')) {
    const [, faculty, program] = selectedNode.split('::');
    return [rootLabel, faculty, program];
  }

  return [rootLabel];
}

export function CoursesPage({
  role,
  appData,
  userRole,
  refreshAppData,
}: CoursesPageProps) {
  const [view, setView] = useState<ExplorerView>('cards');
  const [filter, setFilter] = useState<FilterMode>('Todos');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState('institution');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    createInitialCourseForm(appData),
  );

  const visibleCourses = getVisibleCourses(appData, role);
  const canCreate = canManageCourses(userRole);

  const facultyMap = visibleCourses.reduce<Record<string, Set<string>>>((accumulator, course) => {
    if (!accumulator[course.faculty]) {
      accumulator[course.faculty] = new Set<string>();
    }

    accumulator[course.faculty].add(course.program);
    return accumulator;
  }, {});

  const facultyEntries = Object.entries(facultyMap)
    .map(([faculty, programs]) => ({
      faculty,
      programs: Array.from(programs).sort((left, right) => left.localeCompare(right, 'es')),
    }))
    .sort((left, right) => left.faculty.localeCompare(right.faculty, 'es'));

  useEffect(() => {
    if (
      selectedNode !== 'institution' &&
      !visibleCourses.some((course) => matchesNode(course, selectedNode))
    ) {
      setSelectedNode('institution');
    }
  }, [selectedNode, visibleCourses]);

  async function handleCreateCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

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
      setFormError(error instanceof Error ? error.message : 'No fue posible crear el curso.');
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

  const nodeCourses = visibleCourses.filter((course) => matchesNode(course, selectedNode));
  const query = search.trim().toLowerCase();
  const filteredCourses = nodeCourses
    .filter((course) => (filter === 'Todos' ? true : course.status === filter))
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
        stageName,
      ]
        .join(' ')
        .toLowerCase();

      return target.includes(query);
    })
    .sort((left, right) => {
      if (sortMode === 'progress') {
        return right.progress - left.progress;
      }

      if (sortMode === 'name') {
        return left.title.localeCompare(right.title, 'es');
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });

  const openCount = filteredCourses.filter((course) => course.status !== 'Listo').length;
  const blockedCount = filteredCourses.filter((course) => course.status === 'Bloqueado').length;
  const programCount = new Set(
    nodeCourses.map((course) => `${course.faculty}::${course.program}`),
  ).size;
  const nodePath = getNodePath(selectedNode);

  return (
    <div className="page-stack courses-page courses-page--explorer">
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Mis cursos</span>
            <h3>Explorador central de producción</h3>
          </div>
          <FolderKanban size={18} />
        </div>

        <p className="section-lead">
          Este módulo organiza la operación por ruta institucional y convierte cada curso en su expediente central de trabajo.
        </p>

        <div className="toolbar">
          <div className="toolbar-header">
            <label className="field field--search">
              <span>Buscar</span>
              <div className="field__control">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, ID, etapa o ruta"
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

          <div className="segmented-control">
            <button
              type="button"
              className={view === 'cards' ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => setView('cards')}
            >
              <LayoutGrid size={16} />
              <span>Tarjetas</span>
            </button>
            <button
              type="button"
              className={view === 'list' ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => setView('list')}
            >
              <List size={16} />
              <span>Listado</span>
            </button>
          </div>

          <div className="chip-row">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
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
                    {filters.filter((item) => item !== 'Todos').map((status) => (
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

            {formError ? <p className="form-error">{formError}</p> : null}

            <div className="action-row">
              <button type="submit" className="cta-button" disabled={isSaving}>
                <span>{isSaving ? 'Creando…' : 'Crear curso'}</span>
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="courses-explorer">
        <aside className="surface section-card explorer-tree">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Árbol</span>
              <h3>Navegación jerárquica</h3>
            </div>
          </div>

          <div className="explorer-tree__list">
            <button
              type="button"
              className={selectedNode === 'institution' ? 'explorer-node explorer-node--active' : 'explorer-node'}
              onClick={() => setSelectedNode('institution')}
            >
              <span>{rootLabel}</span>
              <strong>{visibleCourses.length}</strong>
            </button>

            {facultyEntries.map((entry) => (
              <div key={entry.faculty} className="explorer-branch">
                <button
                  type="button"
                  className={
                    selectedNode === `faculty:${entry.faculty}`
                      ? 'explorer-node explorer-node--child explorer-node--active'
                      : 'explorer-node explorer-node--child'
                  }
                  onClick={() => setSelectedNode(`faculty:${entry.faculty}`)}
                >
                  <span>{entry.faculty}</span>
                  <strong>
                    {visibleCourses.filter((course) => course.faculty === entry.faculty).length}
                  </strong>
                </button>

                <div className="explorer-branch__children">
                  {entry.programs.map((program) => {
                    const key = `program::${entry.faculty}::${program}`;

                    return (
                      <button
                        key={key}
                        type="button"
                        className={
                          selectedNode === key
                            ? 'explorer-node explorer-node--leaf explorer-node--active'
                            : 'explorer-node explorer-node--leaf'
                        }
                        onClick={() => setSelectedNode(key)}
                      >
                        <span>{program}</span>
                        <strong>
                          {
                            visibleCourses.filter(
                              (course) =>
                                course.faculty === entry.faculty && course.program === program,
                            ).length
                          }
                        </strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="surface section-card explorer-content">
          <div className="explorer-content__head">
            <div>
              <span className="eyebrow">Ruta activa</span>
              <h3>{getNodeLabel(selectedNode)}</h3>
            </div>

            <div className="breadcrumb-row">
              {nodePath.map((segment, index) => (
                <span key={`${segment}-${index}`} className="breadcrumb-row__item">
                  {index > 0 ? <ChevronRight size={14} /> : null}
                  <span>{segment}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="metrics-grid metrics-grid--three">
            <div className="mini-metric">
              <span>Cursos visibles</span>
              <strong>{filteredCourses.length}</strong>
            </div>
            <div className="mini-metric">
              <span>Programas</span>
              <strong>{programCount}</strong>
            </div>
            <div className="mini-metric">
              <span>Cursos abiertos</span>
              <strong>{openCount}</strong>
            </div>
          </div>

          <div className="flow-glance flow-glance--compact">
            <div className="flow-glance__item">
              <strong>{blockedCount === 0 ? 'Sin bloqueos' : blockedCount}</strong>
              <span>estado crítico de la vista</span>
              <p>
                {blockedCount === 0
                  ? 'Esta ruta no presenta cursos bloqueados en este corte.'
                  : 'Útil para priorizar intervención operativa y desbloqueo de handoffs.'}
              </p>
            </div>
            <div className="flow-glance__item">
              <strong>{filter === 'Todos' ? 'Todos los estados' : filter}</strong>
              <span>filtro activo</span>
              <p>La búsqueda y el árbol trabajan juntos para reducir ruido y abrir el curso correcto más rápido.</p>
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="empty-state">
              <strong>No hay cursos para esta ruta</strong>
              <p>Prueba con otro nodo, otro estado o una búsqueda más amplia.</p>
            </div>
          ) : view === 'cards' ? (
            <section className="courses-grid courses-grid--explorer">
              {filteredCourses.map((course) => {
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
              {filteredCourses.map((course) => {
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
                      <span>{stageMeta?.name ?? course.stageId}</span>
                      <span>{stageMeta?.owner ?? 'Sin responsable'}</span>
                      <span>{course.progress}%</span>
                      <span>{alertCount} alertas</span>
                      <span>{pendingObservations} observaciones</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
