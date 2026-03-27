import { useState } from 'react';
import { FolderKanban, LayoutGrid, Plus, Rows3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CourseCard } from '../components/CourseCard.js';
import type { AppData, CourseMutationInput, CourseStatus, Role } from '../types.js';
import { getStageName, getVisibleCourses } from '../utils/domain.js';
import { canManageCourses } from '../utils/permissions.js';

interface CoursesPageProps {
  role: Role;
  appData: AppData;
  userRole: Role;
  refreshAppData: () => void;
}

type ViewMode = 'portfolio' | 'pipeline';
type FilterMode = 'Todos' | CourseStatus;

const filters: FilterMode[] = ['Todos', 'En ritmo', 'En revisión', 'Riesgo', 'Bloqueado', 'Listo'];

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

export function CoursesPage({
  role,
  appData,
  userRole,
  refreshAppData,
}: CoursesPageProps) {
  const [view, setView] = useState<ViewMode>('portfolio');
  const [filter, setFilter] = useState<FilterMode>('Todos');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    createInitialCourseForm(appData),
  );

  const visibleCourses = getVisibleCourses(appData, role);
  const filteredCourses =
    filter === 'Todos'
      ? visibleCourses
      : visibleCourses.filter((course) => course.status === filter);
  const canCreate = canManageCourses(userRole);

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

  return (
    <div className="page-stack courses-page">
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Portafolio</span>
            <h3>Cursos y proyectos activos</h3>
          </div>
          <FolderKanban size={18} />
        </div>

        <p className="section-lead">
          Vista pensada para operar el flujo de producción completo con filtros rápidos por estado y lectura por etapa.
        </p>

        <div className="toolbar">
          {canCreate ? (
            <div className="toolbar-header">
              <button
                type="button"
                className={isComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsComposerOpen((current) => !current)}
              >
                <Plus size={16} />
                <span>{isComposerOpen ? 'Cerrar formulario' : 'Nuevo curso'}</span>
              </button>
            </div>
          ) : null}

          <div className="segmented-control">
            <button
              type="button"
              className={view === 'portfolio' ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => setView('portfolio')}
            >
              <LayoutGrid size={16} />
              <span>Portfolio</span>
            </button>
            <button
              type="button"
              className={view === 'pipeline' ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => setView('pipeline')}
            >
              <Rows3 size={16} />
              <span>Pipeline</span>
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
                <span>Código</span>
                <div className="field__control">
                  <input
                    value={courseForm.code}
                    onChange={(event) => updateCourseField('code', event.target.value)}
                    placeholder="MAT-420"
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

      {view === 'portfolio' ? (
        <section className="courses-grid">
          {filteredCourses.length === 0 ? (
            <div className="surface empty-state">
              <strong>Sin cursos para este filtro</strong>
              <p>Prueba otro estado o crea el primer curso desde esta vista.</p>
            </div>
          ) : (
            filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                stageName={getStageName(appData, course.stageId)}
              />
            ))
          )}
        </section>
      ) : (
        <section className="pipeline-grid">
          {appData.stages.map((stage) => {
            const items = filteredCourses.filter((course) => course.stageId === stage.id);

            return (
              <article key={stage.id} className="pipeline-column surface">
                <div className="pipeline-column__header">
                  <div>
                    <span className="eyebrow">{stage.owner}</span>
                    <h3>{stage.name}</h3>
                  </div>
                  <span className={`badge badge--${stage.tone}`}>{items.length}</span>
                </div>

                <p className="pipeline-column__copy">{stage.description}</p>

                <div className="pipeline-column__list">
                  {items.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin cursos en esta etapa</strong>
                      <p>Cuando el flujo alcance este punto aparecerá aquí.</p>
                    </div>
                  ) : (
                    items.map((course) => (
                      <Link key={course.id} to={`/courses/${course.slug}`} className="pipeline-item">
                        <div>
                          <strong>{course.title}</strong>
                          <p>{course.status}</p>
                        </div>
                        <span>{course.progress}%</span>
                      </Link>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Lectura rápida</span>
            <h3>Cómo se ve hoy el flujo</h3>
          </div>
        </div>

        <div className="flow-glance">
          {filteredCourses.map((course) => (
            <div key={course.id} className="flow-glance__item">
              <strong>{course.title}</strong>
              <span>{getStageName(appData, course.stageId)}</span>
              <p>{course.nextMilestone}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
