import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCheck,
  FolderClock,
  Sparkles,
} from 'lucide-react';
import { CourseCard } from '../components/CourseCard.js';
import { MetricCard } from '../components/MetricCard.js';
import { ProgressRing } from '../components/ProgressRing.js';
import type { AppData, Role } from '../types.js';
import { formatDate } from '../utils/format.js';
import {
  averageProgress,
  getStageMeta,
  getVisibleAlerts,
  getVisibleCourses,
  getVisibleTasks,
} from '../utils/domain.js';

interface DashboardPageProps {
  role: Role;
  appData: AppData;
}

const roleMessage: Record<Role, string> = {
  Administrador: 'Vista global para gobernar indicadores, reglas y el pulso completo de la operación.',
  Coordinador: 'Control del ritmo operativo, bloqueos y capacidad de los equipos por curso.',
  Experto: 'Espacio centrado en autoría, curaduría y piezas que todavía exigen criterio disciplinar.',
  'Diseñador instruccional':
    'Lectura clara de arquitectura, observaciones y decisiones pedagógicas que destraban el flujo.',
  'Diseñador multimedia':
    'Seguimiento de recursos propios, entregas visuales y puntos de accesibilidad listos para producción.',
  'Gestor LMS': 'Radar técnico sobre cursos listos para montaje y elementos que afectan la experiencia final.',
  'Analista QA': 'Panel de revisión final con hallazgos, aprobaciones y riesgos que no deberían escapar.',
  Auditor: 'Trazabilidad de punta a punta para validar la consistencia del proceso y sus cierres.',
};

export function DashboardPage({ role, appData }: DashboardPageProps) {
  const visibleCourses = getVisibleCourses(appData, role);
  const visibleTasks = getVisibleTasks(appData, role).sort((left, right) =>
    left.dueDate.localeCompare(right.dueDate),
  );
  const visibleAlerts = getVisibleAlerts(appData, role);
  const averageQuality =
    visibleCourses.length === 0
      ? 0
      : Math.round(
          visibleCourses.reduce((sum, course) => sum + course.pulse.quality, 0) /
            visibleCourses.length,
        );

  const stageCounts = appData.stages.map((stage) => ({
    ...stage,
    count: visibleCourses.filter((course) => course.stageId === stage.id).length,
  }));

  const spotlightCourses = visibleCourses.slice().sort((left, right) => right.progress - left.progress).slice(0, 2);

  return (
    <div className="page-stack">
      <section className="hero-card surface">
        <div className="hero-card__copy">
          <span className="hero-badge">{role}</span>
          <h3>Producción académica con ritmo, claridad y una lectura viva del proyecto.</h3>
          <p>{roleMessage[role]}</p>

          <div className="hero-points">
            <div>
              <strong>{visibleCourses.length}</strong>
              <span>cursos visibles para este rol</span>
            </div>
            <div>
              <strong>{visibleTasks.length}</strong>
              <span>tareas abiertas con trazabilidad</span>
            </div>
            <div>
              <strong>{visibleAlerts.length}</strong>
              <span>alertas activas que piden intervención</span>
            </div>
          </div>
        </div>

        <div className="hero-card__stats">
          <ProgressRing
            value={averageProgress(visibleCourses)}
            label="Portafolio visible"
            detail="Promedio de avance de los cursos a tu cargo."
          />

          <div className="hero-mini surface-muted">
            <span className="eyebrow">Próximo movimiento</span>
            <strong>
              {visibleTasks[0]?.title ?? 'Sin tareas inmediatas'}
            </strong>
            <p>{visibleTasks[0]?.summary ?? 'El sistema no registra pendientes para este rol.'}</p>
            {visibleTasks[0] ? <span>Vence {formatDate(visibleTasks[0].dueDate)}</span> : null}
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          label="Cursos activos"
          value={String(visibleCourses.length)}
          detail="Portafolio que hoy requiere seguimiento operativo."
          icon={BriefcaseBusiness}
          tone="coral"
        />
        <MetricCard
          label="Pendientes próximos"
          value={String(visibleTasks.filter((task) => task.status !== 'Lista').length)}
          detail="Tareas visibles con vencimiento y responsable claro."
          icon={FolderClock}
          tone="gold"
        />
        <MetricCard
          label="Bloqueos"
          value={String(visibleCourses.filter((course) => course.status === 'Bloqueado').length)}
          detail="Cursos detenidos que impiden el siguiente cambio de etapa."
          icon={AlertTriangle}
          tone="ocean"
        />
        <MetricCard
          label="Calidad promedio"
          value={`${averageQuality}%`}
          detail="Lectura rápida del estándar actual del portafolio."
          icon={CheckCheck}
          tone="sage"
        />
      </section>

      <section className="insight-grid">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Panorama</span>
              <h3>Estado por etapas</h3>
            </div>
            <Sparkles size={18} />
          </div>

          <div className="stage-grid">
            {stageCounts.map((stage) => (
              <div key={stage.id} className={`stage-summary stage-summary--${stage.tone}`}>
                <span>{stage.name}</span>
                <strong>{stage.count}</strong>
                <p>{stage.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Radar</span>
              <h3>Lo que pide atención</h3>
            </div>
            <AlertTriangle size={18} />
          </div>

          <div className="list-stack">
            {visibleAlerts.length === 0 ? (
              <div className="empty-state">
                <strong>Sin alertas críticas</strong>
                <p>La cartera visible para este rol no tiene bloqueos prioritarios en este momento.</p>
              </div>
            ) : (
              visibleAlerts.map((alert) => {
                const course = visibleCourses.find((item) => item.slug === alert.courseSlug);
                const stage = course ? getStageMeta(appData, course.stageId) : undefined;

                return (
                  <div key={alert.id} className="list-item">
                    <div className={`status-dot status-dot--${alert.tone}`} />
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.detail}</p>
                    </div>
                    <div className="list-item__meta">
                      <span>{course?.title}</span>
                      <span>{stage?.name ?? 'Curso'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <section className="insight-grid">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Worklist</span>
              <h3>Tareas del día</h3>
            </div>
            <FolderClock size={18} />
          </div>

          <div className="list-stack">
            {visibleTasks.slice(0, 4).map((task) => {
              const course = visibleCourses.find((item) => item.slug === task.courseSlug);
              return (
                <div key={task.id} className="task-item">
                  <div>
                    <span className="badge badge--outline">{task.priority}</span>
                    <strong>{task.title}</strong>
                    <p>{task.summary}</p>
                  </div>
                  <div className="task-item__meta">
                    <span>{course?.title ?? 'Curso'}</span>
                    <span>Vence {formatDate(task.dueDate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Cursos</span>
              <h3>Radar del portafolio</h3>
            </div>
            <BriefcaseBusiness size={18} />
          </div>

          <div className="mini-course-grid">
            {spotlightCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                stageName={getStageMeta(appData, course.stageId)?.name ?? course.stageId}
              />
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
