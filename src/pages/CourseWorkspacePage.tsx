import {
  Bot,
  CircleAlert,
  Compass,
  Flag,
  Layers3,
  MoveRight,
  UsersRound,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ProgressRing } from '../components/ProgressRing';
import { StageRail } from '../components/StageRail';
import { tasks } from '../data/mockData';
import type { Role } from '../types';
import { formatDate, formatLongDate } from '../utils/format';
import { getCourseBySlug, getStageMeta } from '../utils/domain';

interface CourseWorkspacePageProps {
  role: Role;
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

export function CourseWorkspacePage({ role }: CourseWorkspacePageProps) {
  const { slug = '' } = useParams();
  const course = getCourseBySlug(slug);

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

  const stage = getStageMeta(course.stageId);
  const relatedTasks = tasks.filter((task) => task.courseSlug === course.slug);
  const myTasks =
    role === 'Administrador' || role === 'Auditor'
      ? relatedTasks
      : relatedTasks.filter((task) => task.role === role);

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
            <span className="eyebrow">Mi cola</span>
            <h3>Trabajo visible para {role}</h3>
          </div>
        </div>

        <div className="list-stack">
          {myTasks.length === 0 ? (
            <div className="empty-state">
              <strong>Sin tareas asignadas en este curso</strong>
              <p>Desde esta vista se pueden seguir igualmente las observaciones y entregables del equipo.</p>
            </div>
          ) : (
            myTasks.map((task) => (
              <div key={task.id} className="task-item">
                <div>
                  <span className={badgeClass(task.status)}>{task.status}</span>
                  <strong>{task.title}</strong>
                  <p>{task.summary}</p>
                </div>
                <div className="task-item__meta">
                  <span>{task.role}</span>
                  <span>Vence {formatDate(task.dueDate)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
