import {
  Bot,
  CircleAlert,
  Compass,
  PencilLine,
  Flag,
  Layers3,
  MoveRight,
  Plus,
  Save,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProgressRing } from '../components/ProgressRing.js';
import { StageRail } from '../components/StageRail.js';
import type { AppData, CourseMutationInput, Role, TaskMutationInput } from '../types.js';
import { formatDate, formatLongDate } from '../utils/format.js';
import { getCourseBySlug, getStageMeta } from '../utils/domain.js';
import {
  canCreateTasks,
  canDeleteTasks,
  canEditTask,
  canManageCourses,
} from '../utils/permissions.js';

interface CourseWorkspacePageProps {
  role: Role;
  userRole: Role;
  appData: AppData;
  refreshAppData: () => void;
}

function badgeClass(status: string) {
  switch (status) {
    case 'Listo':
    case 'En ritmo':
      return 'badge badge--sage';
    case 'En revisión':
      return 'badge badge--gold';
    case 'Pendiente':
    case 'Riesgo':
      return 'badge badge--ocean';
    case 'Bloqueado':
      return 'badge badge--coral';
    default:
      return 'badge badge--outline';
  }
}

function makeCourseForm(course: NonNullable<ReturnType<typeof getCourseBySlug>>): CourseMutationInput {
  return {
    title: course.title,
    code: course.code,
    faculty: course.faculty,
    program: course.program,
    modality: course.modality,
    credits: course.credits,
    stageId: course.stageId,
    status: course.status,
    summary: course.summary,
    nextMilestone: course.nextMilestone,
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

export function CourseWorkspacePage({
  role,
  userRole,
  appData,
  refreshAppData,
}: CourseWorkspacePageProps) {
  const { slug = '' } = useParams();
  const course = getCourseBySlug(appData, slug);
  const [isCourseEditorOpen, setIsCourseEditorOpen] = useState(false);
  const [isTaskComposerOpen, setIsTaskComposerOpen] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isCourseSaving, setIsCourseSaving] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);

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
  const stage = getStageMeta(appData, course.stageId);
  const relatedTasks = appData.tasks.filter((task) => task.courseSlug === currentCourse.slug);
  const myTasks =
    role === 'Administrador' || role === 'Auditor'
      ? relatedTasks
      : relatedTasks.filter((task) => task.role === role);
  const visibleTasks = canCreateTasks(userRole) ? relatedTasks : myTasks;
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    makeCourseForm(currentCourse),
  );
  const [newTaskForm, setNewTaskForm] = useState<TaskMutationInput>(() =>
    makeTaskForm(currentCourse.slug, currentCourse.stageId),
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskMutationInput>>(() =>
    Object.fromEntries(
      relatedTasks.map((task) => [
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
    ),
  );

  useEffect(() => {
    setCourseForm(makeCourseForm(currentCourse));
    setNewTaskForm(makeTaskForm(currentCourse.slug, currentCourse.stageId));
    setTaskDrafts(
      Object.fromEntries(
        relatedTasks.map((task) => [
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
      ),
    );
  }, [currentCourse, currentCourse.slug, currentCourse.stageId, relatedTasks]);

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

  async function handleCourseDelete() {
    const confirmed = window.confirm(
      `Vas a eliminar el curso "${currentCourse.title}" y sus tareas asociadas. Esta acción no se puede deshacer.`,
    );

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
    setTaskError(null);

    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: taskId,
        ...taskDrafts[taskId],
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
    const confirmed = window.confirm('La tarea será eliminada permanentemente. ¿Quieres continuar?');

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

  function updateTaskDraft(taskId: string, key: keyof TaskMutationInput, value: string) {
    setTaskDrafts((current) => ({
      ...current,
      [taskId]: {
        ...current[taskId],
        [key]: value as TaskMutationInput[typeof key],
      },
    }));
  }

  return (
    <div className="page-stack">
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
                onClick={() => setIsCourseEditorOpen((current) => !current)}
              >
                <PencilLine size={16} />
                <span>{isCourseEditorOpen ? 'Cerrar edición' : 'Editar curso'}</span>
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

      {isCourseEditorOpen ? (
        <section className="surface section-card">
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
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, title: event.target.value }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Código</span>
                <div className="field__control">
                  <input
                    value={courseForm.code}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, code: event.target.value }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Facultad</span>
                <div className="field__control">
                  <input
                    value={courseForm.faculty}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, faculty: event.target.value }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Programa</span>
                <div className="field__control">
                  <input
                    value={courseForm.program}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, program: event.target.value }))
                    }
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Modalidad</span>
                <div className="field__control">
                  <input
                    value={courseForm.modality}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, modality: event.target.value }))
                    }
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
                      setCourseForm((current) => ({
                        ...current,
                        credits: Number.parseInt(event.target.value, 10) || 1,
                      }))
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
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, stageId: event.target.value }))
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
                <span>Estado</span>
                <div className="field__control">
                  <select
                    value={courseForm.status}
                    onChange={(event) =>
                      setCourseForm((current) => ({
                        ...current,
                        status: event.target.value as CourseMutationInput['status'],
                      }))
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
                    onChange={(event) =>
                      setCourseForm((current) => ({
                        ...current,
                        nextMilestone: event.target.value,
                      }))
                    }
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
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, summary: event.target.value }))
                    }
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

              <button type="button" className="danger-button" onClick={() => void handleCourseDelete()}>
                <Trash2 size={16} />
                <span>Eliminar curso</span>
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Flujo</span>
            <h3>Ruta completa del curso</h3>
          </div>
          <Compass size={18} />
        </div>
        <StageRail items={course.stageChecklist} />
      </section>

      <section className="workspace-grid">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Entrega</span>
              <h3>Entregables activos</h3>
            </div>
            <Flag size={18} />
          </div>

          <div className="list-stack">
            {course.deliverables.map((deliverable) => (
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
            ))}
          </div>
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Agenda</span>
              <h3>Próximos hitos</h3>
            </div>
            <Compass size={18} />
          </div>

          <div className="timeline-stack">
            {course.schedule.map((item) => (
              <div key={item.id} className={`timeline-item timeline-item--${item.status}`}>
                <span className="timeline-item__dot" />
                <div>
                  <strong>{item.label}</strong>
                  <p>{formatLongDate(item.dueDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Módulos</span>
              <h3>Mapa de experiencia</h3>
            </div>
            <Layers3 size={18} />
          </div>

          <div className="module-grid">
            {course.modules.map((module) => (
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
            ))}
          </div>
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Observaciones</span>
              <h3>Puntos abiertos</h3>
            </div>
            <CircleAlert size={18} />
          </div>

          <div className="list-stack">
            {course.observations.map((observation) => (
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
            ))}
          </div>
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Equipo</span>
              <h3>Núcleo del proyecto</h3>
            </div>
            <UsersRound size={18} />
          </div>

          <div className="team-list">
            {course.team.map((member) => (
              <div key={member.id} className="team-list__item">
                <span className="avatar-pill">{member.initials}</span>
                <div>
                  <strong>{member.name}</strong>
                  <p>{member.role}</p>
                </div>
                <span>{member.focus}</span>
              </div>
            ))}
          </div>
        </article>

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
      </section>

      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Tareas</span>
            <h3>Tablero operativo del curso</h3>
          </div>
        </div>

        {canCreateTasks(userRole) ? (
          <div className="toolbar-header">
            <button
              type="button"
              className={isTaskComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
              onClick={() => setIsTaskComposerOpen((current) => !current)}
            >
              <Plus size={16} />
              <span>{isTaskComposerOpen ? 'Cerrar formulario' : 'Nueva tarea'}</span>
            </button>
          </div>
        ) : null}

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
          {visibleTasks.length === 0 ? (
            <div className="empty-state">
              <strong>Sin tareas visibles en este curso</strong>
              <p>Cuando el flujo avance o se registren nuevas asignaciones aparecerán aquí.</p>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <div key={task.id} className="task-editor">
                <div>
                  <div className="task-editor__header">
                    <span className={badgeClass(task.status)}>{task.status}</span>
                    <strong>{task.title}</strong>
                  </div>

                  {canCreateTasks(userRole) ? (
                    <div className="form-grid">
                      <label className="field">
                        <span>Título</span>
                        <div className="field__control">
                          <input
                            value={taskDrafts[task.id]?.title ?? task.title}
                            onChange={(event) => updateTaskDraft(task.id, 'title', event.target.value)}
                          />
                        </div>
                      </label>

                      <label className="field">
                        <span>Rol</span>
                        <div className="field__control">
                          <select
                            value={taskDrafts[task.id]?.role ?? task.role}
                            onChange={(event) => updateTaskDraft(task.id, 'role', event.target.value)}
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
                            value={taskDrafts[task.id]?.stageId ?? task.stageId}
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
                            value={taskDrafts[task.id]?.dueDate ?? task.dueDate}
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
                            value={taskDrafts[task.id]?.priority ?? task.priority}
                            onChange={(event) =>
                              updateTaskDraft(task.id, 'priority', event.target.value)
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
                            value={taskDrafts[task.id]?.status ?? task.status}
                            onChange={(event) =>
                              updateTaskDraft(task.id, 'status', event.target.value)
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
                            value={taskDrafts[task.id]?.summary ?? task.summary}
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
                            value={taskDrafts[task.id]?.status ?? task.status}
                            onChange={(event) =>
                              updateTaskDraft(task.id, 'status', event.target.value)
                            }
                            disabled={!canEditTask(userRole, task.role)}
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
                            value={taskDrafts[task.id]?.summary ?? task.summary}
                            onChange={(event) =>
                              updateTaskDraft(task.id, 'summary', event.target.value)
                            }
                            disabled={!canEditTask(userRole, task.role)}
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

                  {canEditTask(userRole, task.role) ? (
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
            ))
          )}
        </div>
      </section>
    </div>
  );
}
