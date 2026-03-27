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
  isLoading?: boolean;
}

const roleMessage: Record<Role, string> = {
  Administrador: 'Vista global para gobernar indicadores, permisos y throughput completo de la operación.',
  Coordinador: 'Control del ritmo operativo, capacidad de equipos y bloqueos que afectan la entrega.',
  Experto: 'Espacio enfocado en autoría, criterio disciplinar y piezas que todavía requieren validación.',
  'Diseñador instruccional':
    'Lectura técnica de arquitectura, observaciones y decisiones pedagógicas que destraban el flujo.',
  'Diseñador multimedia':
    'Seguimiento de recursos, entregas visuales y puntos de accesibilidad listos para producción.',
  'Gestor LMS': 'Radar técnico sobre cursos listos para montaje y elementos que afectan la experiencia final.',
  'Analista QA': 'Panel de revisión con hallazgos, aprobaciones y riesgos que no deberían escapar.',
  Auditor: 'Trazabilidad de punta a punta para validar consistencia operativa y cierres del flujo.',
};

function DashboardSkeleton() {
  return (
    <div className="page-stack page-stack--loading">
      <section className="hero-card hero-card--editorial surface hero-card--loading">
        <div className="hero-card__copy">
          <span className="hero-badge">Sincronizando</span>
          <div className="skeleton-line skeleton-line--eyebrow" />
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--wide" />
          <div className="hero-points">
            <div className="skeleton-stat" />
            <div className="skeleton-stat" />
            <div className="skeleton-stat" />
          </div>
        </div>

        <div className="hero-card__stats">
          <div className="hero-orbit surface-muted skeleton-panel" />
          <div className="hero-mini surface-muted skeleton-panel" />
        </div>
      </section>

      <section className="metrics-grid metrics-grid--staggered">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="metric-card metric-card--ink skeleton-panel" />
        ))}
      </section>

      <section className="insight-grid insight-grid--offset">
        <article className="surface section-card skeleton-panel skeleton-panel--tall" />
        <article className="surface section-card skeleton-panel skeleton-panel--medium" />
      </section>
    </div>
  );
}

export function DashboardPage({ role, appData, isLoading = false }: DashboardPageProps) {
  if (isLoading) {
    return <DashboardSkeleton />;
  }

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
  const busiestStage = stageCounts.slice().sort((left, right) => right.count - left.count)[0];

  return (
    <div className="page-stack dashboard-page">
      <section className="hero-card hero-card--editorial surface">
        <div className="hero-card__copy">
          <span className="hero-badge">{role}</span>
          <span className="hero-kicker hero-kicker--warm">Command View</span>
          <h3>Observa el portafolio como sistema: throughput, riesgos y calidad en una sola lectura.</h3>
          <p className="hero-lead">{roleMessage[role]}</p>

          <div className="hero-points">
            <div>
              <strong>{visibleCourses.length}</strong>
              <span>cursos monitorizados</span>
            </div>
            <div>
              <strong>{visibleTasks.length}</strong>
              <span>work items activos</span>
            </div>
            <div>
              <strong>{visibleAlerts.length}</strong>
              <span>señales críticas</span>
            </div>
          </div>
        </div>

        <div className="hero-card__stats">
          <div className="hero-orbit surface-muted">
            <span className="eyebrow">Hot Zone</span>
            <strong>{busiestStage?.name ?? 'No dominant stage'}</strong>
            <p>
              {busiestStage?.count
                ? `${busiestStage.count} cursos se concentran aquí y están marcando la carga operativa actual.`
                : 'Todavía no hay concentración suficiente para destacar una etapa dominante.'}
            </p>
          </div>

          <div className="hero-raft">
            <div className="hero-progress-card surface-muted">
              <ProgressRing
                value={averageProgress(visibleCourses)}
                label="Visible throughput"
                detail="Promedio de avance de los cursos que hoy están dentro de tu campo de acción."
              />
            </div>

            <div className="hero-mini surface-muted">
              <span className="eyebrow">Next action</span>
              <strong>{visibleTasks[0]?.title ?? 'Sin tareas inmediatas'}</strong>
              <p>{visibleTasks[0]?.summary ?? 'La plataforma no registra pendientes urgentes para este rol.'}</p>
              {visibleTasks[0] ? <span>Vence {formatDate(visibleTasks[0].dueDate)}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="metrics-grid metrics-grid--staggered">
        <MetricCard
          label="Cursos activos"
          value={String(visibleCourses.length)}
          detail="Portafolio que hoy requiere seguimiento real, no solo visibilidad."
          icon={BriefcaseBusiness}
          tone="coral"
        />
        <MetricCard
          label="Queue inmediata"
          value={String(visibleTasks.filter((task) => task.status !== 'Lista').length)}
          detail="Tareas próximas con responsable claro y fecha comprometida."
          icon={FolderClock}
          tone="gold"
        />
        <MetricCard
          label="Bloqueos"
          value={String(visibleCourses.filter((course) => course.status === 'Bloqueado').length)}
          detail="Cursos detenidos que frenan el paso natural hacia la siguiente etapa."
          icon={AlertTriangle}
          tone="ocean"
        />
        <MetricCard
          label="Calidad media"
          value={`${averageQuality}%`}
          detail="Lectura rápida del estándar actual sobre el portafolio visible."
          icon={CheckCheck}
          tone="sage"
        />
      </section>

      <section className="insight-grid insight-grid--offset">
        <article className="surface section-card section-card--raised">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Distribution</span>
              <h3>Etapas donde hoy se concentra la operación</h3>
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

        <article className="surface section-card section-card--trail">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Signals</span>
              <h3>Eventos que piden intervención</h3>
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

      <section className="insight-grid insight-grid--offset insight-grid--reverse">
        <article className="surface section-card section-card--raised">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Queue</span>
              <h3>Lo siguiente en la cola priorizada</h3>
            </div>
            <FolderClock size={18} />
          </div>

          <div className="list-stack">
            {visibleTasks.length === 0 ? (
              <div className="empty-state">
                <strong>La mesa está despejada</strong>
                <p>No aparecen tareas urgentes para este rol en el corte actual.</p>
              </div>
            ) : (
              visibleTasks.slice(0, 4).map((task) => {
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
              })
            )}
          </div>
        </article>

        <article className="surface section-card section-card--trail">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Portfolio</span>
              <h3>Cursos con mayor avance visible</h3>
            </div>
            <BriefcaseBusiness size={18} />
          </div>

          <div className="mini-course-grid">
            {spotlightCourses.length === 0 ? (
              <div className="empty-state">
                <strong>Aún no hay cursos destacados</strong>
                <p>Cuando el rol tenga visibilidad sobre el portafolio, esta sección mostrará sus piezas más avanzadas.</p>
              </div>
            ) : (
              spotlightCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  stageName={getStageMeta(appData, course.stageId)?.name ?? course.stageId}
                />
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
