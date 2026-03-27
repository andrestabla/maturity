import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleAlert,
  FolderClock,
  RadioTower,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { CourseCard } from '../components/CourseCard.js';
import { ProgressRing } from '../components/ProgressRing.js';
import { Link } from 'react-router-dom';
import type { AppData, Role } from '../types.js';
import { formatDate } from '../utils/format.js';
import {
  averageProgress,
  getStageMeta,
  getVisibleAlerts,
  getVisibleCourses,
  getVisibleTasks,
} from '../utils/domain.js';
import { canManageAlerts } from '../utils/permissions.js';

interface DashboardPageProps {
  role: Role;
  userRole: Role;
  appData: AppData;
  isLoading?: boolean;
  refreshAppData: () => void;
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
      <section className="control-hero surface">
        <div className="control-hero__main">
          <div className="skeleton-line skeleton-line--eyebrow" />
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--wide" />
          <div className="workflow-legend">
            <div className="skeleton-stat" />
            <div className="skeleton-stat" />
            <div className="skeleton-stat" />
            <div className="skeleton-stat" />
          </div>
        </div>
        <div className="control-hero__side skeleton-panel skeleton-panel--medium" />
      </section>

      <section className="dashboard-workspace">
        <div className="dashboard-workspace__grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <article key={index} className="course-card surface skeleton-panel" />
          ))}
        </div>
        <div className="dashboard-workspace__side">
          <article className="surface section-card skeleton-panel skeleton-panel--medium" />
          <article className="surface section-card skeleton-panel skeleton-panel--medium" />
        </div>
      </section>

      <section className="dashboard-bottom">
        {Array.from({ length: 2 }).map((_, index) => (
          <article key={index} className="surface section-card skeleton-panel skeleton-panel--medium" />
        ))}
      </section>
    </div>
  );
}

export function DashboardPage({
  role,
  userRole,
  appData,
  isLoading = false,
  refreshAppData,
}: DashboardPageProps) {
  const { showAlert } = useSystemDialog();
  const [dismissingAlertId, setDismissingAlertId] = useState<string | null>(null);

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

  const spotlightCourses = visibleCourses.slice().sort((left, right) => right.progress - left.progress).slice(0, 5);
  const busiestStage = stageCounts.slice().sort((left, right) => right.count - left.count)[0];
  const syncFeed = [
    ...visibleTasks.slice(0, 2).map((task) => {
      const course = visibleCourses.find((item) => item.slug === task.courseSlug);
      return {
        id: task.id,
        title: `Neon -> ${course?.title ?? 'Curso'}`,
        detail: `${task.title} · ${task.summary}`,
      };
    }),
    ...visibleAlerts.slice(0, 2).map((alert) => {
      const course = visibleCourses.find((item) => item.slug === alert.courseSlug);
      return {
        id: alert.id,
        title: `Neon -> ${course?.title ?? 'Curso'}`,
        detail: alert.title,
      };
    }),
  ].slice(0, 4);

  const workflowSignals = [
    { label: 'Mi portafolio', tone: 'ocean', value: visibleCourses.length },
    { label: 'Tareas', tone: 'sage', value: visibleTasks.length },
    { label: 'Biblioteca', tone: 'gold', value: appData.libraryResources.length },
    { label: 'Alertas', tone: 'coral', value: visibleAlerts.length },
  ];

  async function handleDismissAlert(alertId: string) {
    setDismissingAlertId(alertId);

    try {
      const response = await fetch('/api/alerts', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id: alertId,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible resolver la alerta.');
      }

      refreshAppData();
    } catch (error) {
      await showAlert({
        title: 'No fue posible resolver la alerta',
        message: error instanceof Error ? error.message : 'No fue posible resolver la alerta.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
    } finally {
      setDismissingAlertId(null);
    }
  }

  return (
    <div className="page-stack dashboard-page dashboard-page--reference">
      <section className="control-hero surface">
        <div className="control-hero__main">
          <div className="section-heading section-heading--control">
            <div>
              <span className="eyebrow">UNIFIED WORKFLOW</span>
              <h3>Unified workflow</h3>
            </div>
            <Link to="/courses" className="control-link">
              <span>Abrir portafolio</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <p className="section-lead">
            Live data feed para seguir portafolio, entregables, tareas y señales de riesgo desde una sola lectura operativa. {roleMessage[role]}
          </p>

          <div className="workflow-legend">
            {workflowSignals.map((signal) => (
              <div key={signal.label} className="workflow-legend__item">
                <span className={`status-dot status-dot--${signal.tone}`} />
                <div>
                  <strong>{signal.label}</strong>
                  <span>{signal.value} activos</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="control-hero__side surface-muted">
          <div className="sync-panel">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">LIVE SYNC</span>
                <h3>Live sync</h3>
              </div>
              <RadioTower size={16} />
            </div>

            <div className="sync-feed">
              {syncFeed.length === 0 ? (
                <div className="empty-state empty-state--positive">
                  <strong>Sin eventos recientes</strong>
                  <p>No hay nuevos movimientos para este rol en este corte.</p>
                </div>
              ) : (
                syncFeed.map((item) => (
                  <div key={item.id} className="sync-feed__item">
                    <span className="status-dot status-dot--ocean" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Link to="/courses" className="control-button">
              Sincronizar
            </Link>
          </div>
        </aside>
      </section>

      <section className="dashboard-workspace">
        <div className="dashboard-workspace__grid">
          {spotlightCourses.length === 0 ? (
            <div className="empty-state">
              <strong>Aún no hay cursos visibles</strong>
              <p>Cuando haya cursos asignados a este rol, aparecerán aquí con su avance y próxima entrega.</p>
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

        <aside className="dashboard-workspace__side">
          <article className="surface section-card dashboard-sidecard">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">ROLE CONTROL</span>
                <h3>Role control</h3>
              </div>
              <ShieldCheck size={16} />
            </div>

            <div className="role-control-list">
              <div className="role-control-list__item">
                <span>Acceso</span>
                <strong>{role}</strong>
              </div>
              <div className="role-control-list__item">
                <span>Hot zone</span>
                <strong>{busiestStage?.name ?? 'Sin etapa dominante'}</strong>
              </div>
              <div className="role-control-list__item">
                <span>Quality</span>
                <strong>{averageQuality}%</strong>
              </div>
            </div>
          </article>

          <article className="surface section-card dashboard-sidecard dashboard-sidecard--progress">
            <ProgressRing
              value={averageProgress(visibleCourses)}
              label="Visible throughput"
              detail="Promedio de avance del portafolio visible para este rol."
            />
          </article>

          <article className="surface section-card dashboard-sidecard">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">ALERTAS</span>
                <h3>Alertas activas</h3>
              </div>
              <CircleAlert size={16} />
            </div>

            <div className="sync-feed">
              {visibleAlerts.length === 0 ? (
                <div className="empty-state empty-state--positive">
                  <strong>Sin alertas abiertas</strong>
                  <p>La operación visible para este rol no tiene bloqueos ni llamados pendientes.</p>
                </div>
              ) : (
                visibleAlerts.slice(0, 4).map((alert) => {
                  const course = visibleCourses.find((item) => item.slug === alert.courseSlug);
                  const canDismiss = canManageAlerts(userRole, alert.owner);

                  return (
                    <div key={alert.id} className="sync-feed__item sync-feed__item--alert">
                      <span className={`status-dot status-dot--${alert.tone}`} />
                      <div>
                        <strong>{alert.title}</strong>
                        <p>{alert.detail}</p>
                        <div className="task-item__meta">
                          <span>{course?.title ?? 'Curso'}</span>
                          <span>{alert.owner}</span>
                        </div>
                      </div>

                      {canDismiss ? (
                        <button
                          type="button"
                          className="ghost-button ghost-button--icon"
                          disabled={dismissingAlertId === alert.id}
                          onClick={() => void handleDismissAlert(alert.id)}
                          aria-label="Resolver alerta"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </aside>
      </section>

      <section className="dashboard-bottom">
        <article className="surface section-card">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">DISTRIBUTION</span>
              <h3>Distribución por etapas</h3>
            </div>
            <BriefcaseBusiness size={16} />
          </div>

          <div className="stage-grid stage-grid--compact">
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
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">QUEUE</span>
              <h3>Lo siguiente en cola</h3>
            </div>
            <FolderClock size={16} />
          </div>

          <div className="list-stack">
            {visibleTasks.length === 0 ? (
              <div className="empty-state empty-state--positive">
                <strong>La cola está despejada</strong>
                <p>No aparecen tareas urgentes para este rol en este momento.</p>
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
      </section>
    </div>
  );
}
