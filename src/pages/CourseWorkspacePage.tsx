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
import { Link, useParams } from 'react-router-dom';
import { ProgressRing } from '../components/ProgressRing.js';
import { StageRail } from '../components/StageRail.js';
import type {
  AppData,
  Course,
  CourseMutationInput,
  Deliverable,
  DeliverableMutationInput,
  Observation,
  ObservationMutationInput,
  Role,
  StageCheckpointStatus,
  Task,
  TaskMutationInput,
} from '../types.js';
import { formatDate, formatLongDate } from '../utils/format.js';
import { getCourseBySlug, getStageMeta } from '../utils/domain.js';
import {
  canCreateDeliverables,
  canCreateObservations,
  canCreateTasks,
  canDeleteDeliverables,
  canDeleteObservations,
  canDeleteTasks,
  canEditDeliverable,
  canEditObservation,
  canEditTask,
  canManageHandoffs,
  canManageCourses,
  canOperateStageCheckpoint,
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

function makeCourseForm(course: Course): CourseMutationInput {
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

function buildEmptyCourseForm(stageId: string): CourseMutationInput {
  return {
    title: '',
    code: '',
    faculty: '',
    program: '',
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

export function CourseWorkspacePage({
  role,
  userRole,
  appData,
  refreshAppData,
}: CourseWorkspacePageProps) {
  const { slug = '' } = useParams();
  const course = getCourseBySlug(appData, slug);
  const fallbackStageId = appData.stages[0]?.id ?? 'configuracion';
  const currentStageId = course?.stageId ?? fallbackStageId;
  const currentCourseSlug = course?.slug ?? slug;
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
  const [isDeliverableComposerOpen, setIsDeliverableComposerOpen] = useState(false);
  const [isObservationComposerOpen, setIsObservationComposerOpen] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [deliverableError, setDeliverableError] = useState<string | null>(null);
  const [observationError, setObservationError] = useState<string | null>(null);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [isCourseSaving, setIsCourseSaving] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [isDeliverableSaving, setIsDeliverableSaving] = useState(false);
  const [isObservationSaving, setIsObservationSaving] = useState(false);
  const [isCheckpointSaving, setIsCheckpointSaving] = useState<number | null>(null);
  const [isHandoffSaving, setIsHandoffSaving] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    course ? makeCourseForm(course) : buildEmptyCourseForm(currentStageId),
  );
  const [newTaskForm, setNewTaskForm] = useState<TaskMutationInput>(() =>
    makeTaskForm(currentCourseSlug, currentStageId),
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

  useEffect(() => {
    if (!course) {
      setCourseForm(buildEmptyCourseForm(currentStageId));
      setNewTaskForm(makeTaskForm(currentCourseSlug, currentStageId));
      setNewDeliverableForm(makeDeliverableForm(defaultDeliverableOwner));
      setNewObservationForm(makeObservationForm(defaultObservationRole));
      setTaskDrafts({});
      setDeliverableDrafts({});
      setObservationDrafts({});
      setCheckpointDrafts({});
      return;
    }

    setCourseForm(makeCourseForm(course));
    setNewTaskForm(makeTaskForm(course.slug, course.stageId));
    setNewDeliverableForm(makeDeliverableForm(defaultDeliverableOwner));
    setNewObservationForm(makeObservationForm(defaultObservationRole));
    setTaskDrafts(makeTaskDrafts(relatedTasks));
    setDeliverableDrafts(makeDeliverableDrafts(course.deliverables));
    setObservationDrafts(makeObservationDrafts(course.observations));
    setCheckpointDrafts(
      Object.fromEntries(
        course.stageChecklist.map((checkpoint, index) => [index, checkpoint.status]),
      ) as Record<number, StageCheckpointStatus>,
    );
  }, [
    appData.tasks,
    course,
    currentCourseSlug,
    currentStageId,
    defaultDeliverableOwner,
    defaultObservationRole,
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
  const currentStageIndex = appData.stages.findIndex((item) => item.id === currentCourse.stageId);
  const currentCheckpoint = currentCourse.stageChecklist[currentStageIndex];
  const nextStage = currentStageIndex >= 0 ? appData.stages[currentStageIndex + 1] : undefined;
  const blockingCheckpoints = currentCourse.stageChecklist.filter(
    (checkpoint, index) => index <= currentStageIndex && checkpoint.status === 'blocked',
  );
  const criticalObservations = currentCourse.observations.filter(
    (observation) => observation.status !== 'Resuelta' && observation.severity === 'Alta',
  );
  const isHandoffReady =
    Boolean(currentCheckpoint && currentCheckpoint.status === 'done') &&
    blockingCheckpoints.length === 0 &&
    criticalObservations.length === 0;

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
    const confirmed = window.confirm(
      'El entregable será eliminado del curso. Esta acción no se puede deshacer.',
    );

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
    const confirmed = window.confirm(
      'La observación será eliminada del seguimiento del curso. ¿Quieres continuar?',
    );

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

  return (
    <div className="page-stack workspace-page">
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

        <StageRail items={currentCourse.stageChecklist} />

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
                <strong>{blockingCheckpoints.length + criticalObservations.length}</strong>
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

            {blockingCheckpoints.length > 0 || criticalObservations.length > 0 ? (
              <div className="empty-state handoff-state">
                <strong>El handoff todavía no está listo</strong>
                <p>
                  {blockingCheckpoints.length > 0
                    ? `Hay ${blockingCheckpoints.length} checkpoint(s) bloqueado(s) antes de avanzar.`
                    : `Hay ${criticalObservations.length} observación(es) crítica(s) pendiente(s) por resolver.`}
                </p>
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
        </div>

        {checkpointError ? <p className="form-error">{checkpointError}</p> : null}
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

          {canCreateDeliverables(userRole) ? (
            <div className="toolbar-header">
              <button
                type="button"
                className={
                  isDeliverableComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'
                }
                onClick={() => setIsDeliverableComposerOpen((current) => !current)}
              >
                <Plus size={16} />
                <span>{isDeliverableComposerOpen ? 'Cerrar formulario' : 'Nuevo entregable'}</span>
              </button>
            </div>
          ) : null}

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
            {course.deliverables.length === 0 ? (
              <div className="empty-state">
                <strong>Sin entregables registrados</strong>
                <p>Cuando el curso tenga piezas activas, aparecerán aquí con responsable y fecha.</p>
              </div>
            ) : (
              course.deliverables.map((deliverable) => {
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
              })
            )}
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
            visibleTasks.map((task) => {
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
            })
          )}
        </div>
      </section>
    </div>
  );
}
