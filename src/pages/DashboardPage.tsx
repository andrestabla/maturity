import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleAlert,
  FolderClock,
  Gauge,
  ListTodo,
  RadioTower,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProgressRing } from '../components/ProgressRing.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type { AppData, AuthUser, Role } from '../types.js';
import { getStageMeta, getVisibleAlerts, getVisibleCourses, getVisibleTasks, averageProgress } from '../utils/domain.js';
import { formatDate } from '../utils/format.js';
import { canManageAlerts } from '../utils/permissions.js';

interface DashboardPageProps {
  role: Role;
  userRole: Role;
  viewer: AuthUser;
  appData: AppData;
  isLoading?: boolean;
  refreshAppData: () => void;
}

interface WorkflowSignal {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: 'ocean' | 'sage' | 'gold' | 'coral';
  to: string;
  icon: LucideIcon;
}

const roleMessage: Record<Role, string> = {
  Administrador: 'Vista global para gobernar indicadores, permisos y throughput completo de la operación.',
  Coordinador: 'Control del ritmo operativo, capacidad de equipos y bloqueos que afectan la entrega.',
  Experto: 'Espacio enfocado en autoría, criterio disciplinar y piezas que todavía requieren validación.',
  'Diseñador instruccional': 'Lectura técnica de arquitectura, observaciones y decisiones pedagógicas que destraban el flujo.',
  'Diseñador multimedia': 'Seguimiento de recursos, entregas visuales y puntos de accesibilidad listos para producción.',
  'Gestor LMS': 'Radar técnico sobre cursos listos para montaje y elementos que afectan la experiencia final.',
  'Analista QA': 'Panel de revisión con hallazgos, aprobaciones y riesgos que no deberían escapar.',
  Auditor: 'Trazabilidad de punta a punta para validar consistencia operativa y cierres del flujo.',
};

function DashboardSkeleton() {
  return (
    <div className="page-stack page-stack--loading">
      <section className="surface section-card">
        <div className="skeleton-line skeleton-line--eyebrow" />
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--wide" />
      </section>

      <section className="metrics-grid metrics-grid--three">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="surface section-card skeleton-panel skeleton-panel--medium" />
        ))}
      </section>
    </div>
  );
}

export function DashboardPage({
  role,
  userRole,
  viewer,
  appData,
  isLoading = false,
  refreshAppData,
}: DashboardPageProps) {
  const { showAlert } = useSystemDialog();
  const [dismissingAlertId, setDismissingAlertId] = useState<string | null>(null);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const visibleCourses = getVisibleCourses(appData, role, viewer);
  const visibleAlerts = getVisibleAlerts(appData, role, viewer);
  const visibleTasks = getVisibleTasks(appData, role, viewer).sort((left, right) =>
    left.dueDate.localeCompare(right.dueDate),
  );
  const pendingTasks = visibleTasks.filter((task) => task.status !== 'Lista');
  const overdueTasks = pendingTasks.filter((task) => Date.parse(task.dueDate) < Date.now()).length;
  const averageCourseProgress = averageProgress(visibleCourses);

  const stageCounts = appData.stages.map((stage) => ({
    ...stage,
    count: visibleCourses.filter((course) => course.stageId === stage.id).length,
  }));
  const busiestStage = stageCounts.slice().sort((left, right) => right.count - left.count)[0];

  const courseSignals = visibleCourses
    .map((course) => {
      const taskCount = pendingTasks.filter((task) => task.courseSlug === course.slug).length;
      const alertCount = visibleAlerts.filter((alert) => alert.courseSlug === course.slug).length;

      return {
        course,
        stageName: getStageMeta(appData, course.stageId)?.name ?? course.stageId,
        taskCount,
        alertCount,
      };
    })
    .sort((left, right) => {
      const leftSignal = left.taskCount + left.alertCount * 2;
      const rightSignal = right.taskCount + right.alertCount * 2;
      if (leftSignal !== rightSignal) return rightSignal - leftSignal;
      return right.course.progress - left.course.progress;
    })
    .slice(0, 8);

  const workflowSignals: WorkflowSignal[] = [
    {
      key: 'portfolio',
      label: 'Cursos activos',
      value: String(visibleCourses.length),
      detail: 'en tu portafolio actual',
      tone: 'ocean',
      to: '/courses',
      icon: BriefcaseBusiness,
    },
    {
      key: 'progress',
      label: 'Avance promedio',
      value: `${averageCourseProgress}%`,
      detail: 'progreso del portafolio',
      tone: 'sage',
      to: '/courses',
      icon: Gauge,
    },
    {
      key: 'tasks',
      label: 'Tareas pendientes',
      value: String(pendingTasks.length),
      detail: `${overdueTasks} vencidas`,
      tone: 'gold',
      to: '/courses',
      icon: ListTodo,
    },
    {
      key: 'alerts',
      label: 'Alertas activas',
      value: String(visibleAlerts.length),
      detail: 'bloqueos y riesgos abiertos',
      tone: 'coral',
      to: '/dashboard#alertas',
      icon: CircleAlert,
    },
  ];

  const liveSync = [
    ...pendingTasks.slice(0, 3).map((task) => {
      const course = visibleCourses.find((item) => item.slug === task.courseSlug);
      return {
        id: task.id,
        title: task.title,
        detail: `${course?.title ?? 'Curso'} · vence ${formatDate(task.dueDate)}`,
      };
    }),
    ...visibleAlerts.slice(0, 3).map((alert) => {
      const course = visibleCourses.find((item) => item.slug === alert.courseSlug);
      return {
        id: alert.id,
        title: alert.title,
        detail: `${course?.title ?? 'Curso'} · ${alert.owner}`,
      };
    }),
  ].slice(0, 6);

  async function handleDismissAlert(alertId: string) {
    setDismissingAlertId(alertId);

    try {
      const response = await fetch('/api/alerts', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ id: alertId }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible resolver la alerta.');
      }

      refreshAppData();
    } catch (error) {
      void showAlert({
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
    <div className="page-stack dashboard-page dashboard-page--unified">
      <section className="surface dashboard-unified-hero">
        <div className="section-heading section-heading--control">
          <div>
            <span className="eyebrow">UNIFIED WORKFLOW</span>
            <h3>Dashboard operativo</h3>
          </div>
          <Link to="/courses" className="control-link">
            <span>Abrir portafolio</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <p className="section-lead">
          Visualiza cursos activos, progreso, tareas por vencer y alertas en una sola lectura para actuar rápido. {roleMessage[role]}
        </p>

        <div className="dashboard-workflow-cards">
          {workflowSignals.map((signal) => {
            const Icon = signal.icon;

            return (
              <Link
                key={signal.key}
                to={signal.to}
                className={`dashboard-workflow-card dashboard-workflow-card--${signal.tone}`}
              >
                <div className="dashboard-workflow-card__icon">
                  <Icon size={18} />
                </div>
                <strong>{signal.label}</strong>
                <span className="dashboard-workflow-card__value">{signal.value}</span>
                <small>{signal.detail}</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="dashboard-unified-layout">
        <div className="dashboard-unified-main">
          <article className="surface section-card dashboard-panel">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">CURSOS ACTIVOS</span>
                <h3>Cursos en los que estás trabajando</h3>
              </div>
              <span className="badge badge--outline">{visibleCourses.length}</span>
            </div>

            {courseSignals.length === 0 ? (
              <div className="empty-state">
                <strong>Aún no hay cursos visibles</strong>
                <p>Cuando tengas cursos asignados, aquí verás su avance y señales de atención.</p>
              </div>
            ) : (
              <div className="dashboard-course-grid">
                {courseSignals.map((item) => (
                  <Link key={item.course.id} to={`/courses/${item.course.slug}`} className="dashboard-course-tile">
                    <div className="dashboard-course-tile__head">
                      <span className="eyebrow">{item.course.code}</span>
                      <ArrowUpRight size={16} />
                    </div>
                    <h4>{item.course.title}</h4>
                    <p>{item.course.summary}</p>

                    <div className="dashboard-course-tile__signals">
                      <span>{item.stageName}</span>
                      <span>{item.taskCount} tareas</span>
                      <span>{item.alertCount} alertas</span>
                    </div>

                    <div className="dashboard-course-tile__progress">
                      <strong>{item.course.progress}%</strong>
                      <div className="progress-bar">
                        <span style={{ width: `${item.course.progress}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article className="surface section-card dashboard-panel">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">TAREAS</span>
                <h3>Pendientes priorizados</h3>
              </div>
              <FolderClock size={16} />
            </div>

            <div className="dashboard-task-list">
              {pendingTasks.length === 0 ? (
                <div className="empty-state empty-state--positive">
                  <strong>Sin tareas pendientes</strong>
                  <p>Tu cola está al día. No hay actividades abiertas para este rol.</p>
                </div>
              ) : (
                pendingTasks.slice(0, 6).map((task) => {
                  const course = visibleCourses.find((item) => item.slug === task.courseSlug);
                  const isOverdue = Date.parse(task.dueDate) < Date.now();

                  return (
                    <div key={task.id} className={`dashboard-task-row ${isOverdue ? 'is-overdue' : ''}`}>
                      <div className="dashboard-task-row__head">
                        <span className="badge badge--outline">{task.priority}</span>
                        <strong>{task.title}</strong>
                      </div>
                      <p>{task.summary}</p>
                      <div className="dashboard-task-row__meta">
                        <span>{course?.title ?? 'Curso'}</span>
                        <span>Vence {formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </div>

        <aside className="dashboard-unified-side">
          <article className="surface section-card dashboard-panel dashboard-panel--alerts" id="alertas">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">LIVE SYNC</span>
                <h3>Alertas y actividad</h3>
              </div>
              <RadioTower size={16} />
            </div>

            <div className="dashboard-live-feed">
              {liveSync.length === 0 ? (
                <div className="empty-state empty-state--positive">
                  <strong>Sin eventos recientes</strong>
                  <p>No hay nuevos movimientos para este rol.</p>
                </div>
              ) : (
                liveSync.map((item) => (
                  <div key={item.id} className="dashboard-live-feed__item">
                    <span className="status-dot status-dot--ocean" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="dashboard-alert-list">
              {visibleAlerts.slice(0, 5).map((alert) => {
                const course = visibleCourses.find((item) => item.slug === alert.courseSlug);
                const canDismiss = canManageAlerts(userRole, alert.owner);

                return (
                  <div key={alert.id} className="dashboard-alert-row">
                    <span className={`status-dot status-dot--${alert.tone}`} />
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.detail}</p>
                      <small>{course?.title ?? 'Curso'} · {alert.owner}</small>
                    </div>
                    {canDismiss ? (
                      <button
                        type="button"
                        className="ghost-button ghost-button--icon"
                        aria-label="Resolver alerta"
                        disabled={dismissingAlertId === alert.id}
                        onClick={() => void handleDismissAlert(alert.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="surface section-card dashboard-panel dashboard-panel--role">
            <div className="section-heading section-heading--compact">
              <div>
                <span className="eyebrow">ROLE SNAPSHOT</span>
                <h3>Control de rol</h3>
              </div>
              <ShieldCheck size={16} />
            </div>

            <div className="role-control-list">
              <div className="role-control-list__item">
                <span>Acceso</span>
                <strong>{role}</strong>
              </div>
              <div className="role-control-list__item">
                <span>Etapa con mayor carga</span>
                <strong>{busiestStage?.name ?? 'Sin etapa dominante'}</strong>
              </div>
              <div className="role-control-list__item">
                <span>Tareas vencidas</span>
                <strong>{overdueTasks}</strong>
              </div>
              <div className="role-control-list__item">
                <span>Tareas completadas</span>
                <strong>{visibleTasks.length - pendingTasks.length}</strong>
              </div>
            </div>

            <div className="dashboard-role-progress">
              <ProgressRing
                value={averageCourseProgress}
                label="Avance del portafolio"
                detail="Porcentaje promedio de progreso de cursos visibles."
              />
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
