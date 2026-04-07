import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CheckCheck,
  Clock3,
  FileCheck2,
  Gauge,
  Layers3,
  RefreshCcw,
  RotateCcw,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { AppData, AuthUser, CourseStatus, Role } from '../types.js';
import { getVisibleAlerts, getVisibleCourses, getVisibleTasks } from '../utils/domain.js';

interface AnalyticsPageProps {
  role: Role;
  viewer: AuthUser;
  appData: AppData;
  isLoading?: boolean;
}

interface KpiCard {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: 'ocean' | 'sage' | 'gold' | 'coral';
  icon: LucideIcon;
}

type StageTimeRow = {
  stageId: string;
  stageName: string;
  averageDays: number;
  samples: number;
};

const statusOrder: CourseStatus[] = [
  'Sin iniciar',
  'En curso',
  'En QA',
  'Entregado',
  'Bloqueado',
  'En riesgo',
];

const stageByPlanningPhase: Record<string, string> = {
  escritura: 'escritura',
  validacion: 'validacion',
  multimedia: 'multimedia',
  lms: 'lms',
  qa: 'qa',
};

function parseDateSafe(raw: string | undefined) {
  if (!raw) {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function diffDays(startDate: Date, endDate: Date) {
  const deltaMs = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(deltaMs / (1000 * 60 * 60 * 24)));
}

function percentage(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return Math.round(values.reduce((acc, current) => acc + current, 0) / values.length);
}

function buildMonthWindow(size = 6) {
  const months: Array<{ key: string; label: string }> = [];
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es', { month: 'short' });

  for (let cursor = size - 1; cursor >= 0; cursor -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - cursor, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = formatter.format(date).replace('.', '');
    months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  return months;
}

function AnalyticsSkeleton() {
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

export function AnalyticsPage({
  role,
  viewer,
  appData,
  isLoading = false,
}: AnalyticsPageProps) {
  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  const visibleCourses = getVisibleCourses(appData, role, viewer);
  const visibleTasks = getVisibleTasks(appData, role, viewer);
  const visibleAlerts = getVisibleAlerts(appData, role, viewer);
  const today = new Date();

  const coursesByStatus = statusOrder.map((status) => ({
    status,
    count: visibleCourses.filter((course) => course.status === status).length,
  }));
  const maxStatusCount = Math.max(...coursesByStatus.map((item) => item.count), 1);

  const stageDurations = new Map<string, { totalDays: number; samples: number }>();
  visibleCourses.forEach((course) => {
    course.products.forEach((product) => {
      product.phasePlan.forEach((phase) => {
        const stageId = stageByPlanningPhase[phase.phase];
        if (!stageId) {
          return;
        }
        const startDate = parseDateSafe(phase.startDate);
        const endDate = parseDateSafe(phase.endDate);
        if (!startDate || !endDate) {
          return;
        }
        const duration = diffDays(startDate, endDate);
        const current = stageDurations.get(stageId) ?? { totalDays: 0, samples: 0 };
        current.totalDays += duration;
        current.samples += 1;
        stageDurations.set(stageId, current);
      });
    });
  });

  const stageTimeRows: StageTimeRow[] = appData.stages.map((stage) => {
    const stats = stageDurations.get(stage.id);
    return {
      stageId: stage.id,
      stageName: stage.name,
      averageDays: stats && stats.samples > 0 ? Math.round(stats.totalDays / stats.samples) : 0,
      samples: stats?.samples ?? 0,
    };
  });
  const maxAverageStageDays = Math.max(...stageTimeRows.map((row) => row.averageDays), 1);

  const milestones = visibleCourses.flatMap((course) =>
    course.schedule.map((item) => ({
      ...item,
      courseTitle: course.title,
    })),
  );
  const completedMilestones = milestones.filter((item) => item.status === 'done').length;
  const overdueMilestones = milestones.filter((item) => {
    const dueDate = parseDateSafe(item.dueDate);
    if (!dueDate) {
      return false;
    }
    return item.status !== 'done' && dueDate.getTime() < today.getTime();
  }).length;
  const scheduleCompliance = percentage(completedMilestones, milestones.length);
  const scheduleHealth = percentage(
    Math.max(0, milestones.length - overdueMilestones),
    milestones.length,
  );

  const deliverables = visibleCourses.flatMap((course) => course.deliverables);
  const deliverablesDone = deliverables.filter((item) => item.status === 'Listo').length;
  const deliverablesBlocked = deliverables.filter((item) => item.status === 'Bloqueado').length;
  const deliverableCompliance = percentage(deliverablesDone, deliverables.length);

  const openTasks = visibleTasks.filter((task) => task.status !== 'Lista');
  const blockedTasks = visibleTasks.filter((task) => task.status === 'Bloqueada');
  const overdueTasks = openTasks.filter((task) => {
    const dueDate = parseDateSafe(task.dueDate);
    return Boolean(dueDate && dueDate.getTime() < today.getTime());
  }).length;
  const taskResolutionRate = percentage(
    visibleTasks.filter((task) => task.status === 'Lista').length,
    visibleTasks.length,
  );

  const workloadByRole = appData.roles
    .map((currentRole) => {
      const roleTasks = openTasks.filter((task) => task.role === currentRole);
      return {
        role: currentRole,
        open: roleTasks.length,
        blocked: roleTasks.filter((task) => task.status === 'Bloqueada').length,
        inReview: roleTasks.filter((task) => task.status === 'En revisión').length,
      };
    })
    .filter((item) => item.open > 0)
    .sort((left, right) => right.open - left.open);
  const maxRoleLoad = Math.max(...workloadByRole.map((item) => item.open), 1);

  const products = visibleCourses.flatMap((course) => course.products);
  const approvedProducts = products.filter((product) => product.status === 'Aprobado').length;
  const productsInReview = products.filter((product) => product.status === 'En revisión').length;
  const observations = visibleCourses.flatMap((course) => course.observations);
  const observationsInAdjustment = observations.filter(
    (observation) => observation.status === 'En ajuste',
  ).length;
  const observationsPending = observations.filter(
    (observation) => observation.status === 'Pendiente',
  ).length;

  const approvalRate = percentage(approvedProducts, products.length);
  const returnRate = percentage(productsInReview, products.length);
  const reworkRate = observations.length > 0
    ? percentage(observationsInAdjustment, observations.length)
    : percentage(blockedTasks.length, openTasks.length || 1);

  const averageQuality = average(visibleCourses.map((course) => course.pulse.quality));
  const averageVelocity = average(visibleCourses.map((course) => course.pulse.velocity));
  const averageAlignment = average(visibleCourses.map((course) => course.pulse.alignment));
  const riskCourses = visibleCourses.filter(
    (course) => course.status === 'En riesgo' || course.status === 'Bloqueado',
  ).length;
  const efficiencyIndex = average([
    taskResolutionRate,
    deliverableCompliance,
    100 - percentage(overdueTasks, openTasks.length || 1),
  ]);

  const monthWindow = buildMonthWindow(6);
  const productApprovalsByMonth = new Map<string, number>();
  products.forEach((product) => {
    if (product.status !== 'Aprobado') {
      return;
    }
    const date = parseDateSafe(product.updatedAt);
    if (!date) {
      return;
    }
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    productApprovalsByMonth.set(key, (productApprovalsByMonth.get(key) ?? 0) + 1);
  });
  const portfolioFlow = monthWindow.map((month) => ({
    ...month,
    approvals: productApprovalsByMonth.get(month.key) ?? 0,
  }));
  const maxApprovalsInWindow = Math.max(...portfolioFlow.map((item) => item.approvals), 1);

  const criticalCourses = visibleCourses
    .map((course) => {
      const courseOverdueTasks = openTasks.filter((task) => {
        if (task.courseSlug !== course.slug) {
          return false;
        }
        const dueDate = parseDateSafe(task.dueDate);
        return Boolean(dueDate && dueDate.getTime() < today.getTime());
      }).length;
      const courseAlerts = visibleAlerts.filter((alert) => alert.courseSlug === course.slug).length;
      const riskScore =
        (course.status === 'En riesgo' ? 3 : 0) +
        (course.status === 'Bloqueado' ? 4 : 0) +
        courseOverdueTasks * 2 +
        courseAlerts;

      return {
        course,
        courseOverdueTasks,
        courseAlerts,
        riskScore,
      };
    })
    .filter((item) => item.riskScore > 0)
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 7);

  const kpis: KpiCard[] = [
    {
      key: 'portfolio',
      label: 'Cursos visibles',
      value: String(visibleCourses.length),
      detail: `${riskCourses} en riesgo o bloqueados`,
      tone: 'ocean',
      icon: Layers3,
    },
    {
      key: 'throughput',
      label: 'Cumplimiento cronograma',
      value: `${scheduleCompliance}%`,
      detail: `${completedMilestones}/${milestones.length || 0} hitos cerrados`,
      tone: 'sage',
      icon: CalendarClock,
    },
    {
      key: 'workload',
      label: 'Carga activa',
      value: String(openTasks.length),
      detail: `${overdueTasks} tareas vencidas`,
      tone: 'gold',
      icon: Activity,
    },
    {
      key: 'approval',
      label: 'Tasa aprobación',
      value: `${approvalRate}%`,
      detail: `${approvedProducts}/${products.length || 0} productos`,
      tone: 'sage',
      icon: BadgeCheck,
    },
    {
      key: 'rework',
      label: 'Retrabajo',
      value: `${reworkRate}%`,
      detail: `${observationsInAdjustment} observaciones en ajuste`,
      tone: 'coral',
      icon: RotateCcw,
    },
    {
      key: 'quality',
      label: 'Índice de eficiencia',
      value: `${efficiencyIndex}%`,
      detail: `${taskResolutionRate}% tareas resueltas`,
      tone: 'ocean',
      icon: Gauge,
    },
  ];

  return (
    <div className="page-stack analytics-page">
      <section className="surface analytics-hero">
        <div className="section-heading section-heading--control">
          <div>
            <span className="eyebrow">ANALÍTICA OPERATIVA</span>
            <h3>Rendimiento, calidad y flujo de producción</h3>
          </div>
          <span className="badge badge--outline">{role}</span>
        </div>
        <p className="section-lead">
          Este tablero consolida desempeño de cursos, tiempos por etapa, cumplimiento de cronogramas,
          carga por rol, devoluciones, retrabajo y señales de eficiencia del portafolio.
        </p>
        <div className="analytics-kpi-grid">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <article key={kpi.key} className={`analytics-kpi-card analytics-kpi-card--${kpi.tone}`}>
                <div className="analytics-kpi-card__icon">
                  <Icon size={17} />
                </div>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.detail}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="analytics-grid">
        <article className="surface section-card analytics-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">CURSOS POR ESTADO</span>
              <h3>Distribución del portafolio</h3>
            </div>
            <BarChart3 size={16} />
          </div>
          <div className="analytics-list">
            {coursesByStatus.map((item) => (
              <div key={item.status} className="analytics-list__row">
                <div className="analytics-list__head">
                  <strong>{item.status}</strong>
                  <span>{item.count}</span>
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${percentage(item.count, maxStatusCount)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface section-card analytics-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">TIEMPOS POR ETAPA</span>
              <h3>Promedio planificado por fase</h3>
            </div>
            <Timer size={16} />
          </div>
          <div className="analytics-list">
            {stageTimeRows.map((row) => (
              <div key={row.stageId} className="analytics-list__row">
                <div className="analytics-list__head">
                  <strong>{row.stageName}</strong>
                  <span>
                    {row.averageDays} días {row.samples > 0 ? `· ${row.samples} muestras` : ''}
                  </span>
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${percentage(row.averageDays, maxAverageStageDays)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="surface section-card analytics-panel analytics-panel--schedule">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">CRONOGRAMA</span>
              <h3>Cumplimiento y salud temporal</h3>
            </div>
            <Clock3 size={16} />
          </div>
          <div className="analytics-schedule-grid">
            <div className="analytics-gauge">
              <span>Cumplimiento</span>
              <strong>{scheduleCompliance}%</strong>
              <small>{completedMilestones}/{milestones.length || 0} hitos cerrados</small>
            </div>
            <div className="analytics-gauge">
              <span>Salud del plan</span>
              <strong>{scheduleHealth}%</strong>
              <small>{overdueMilestones} hitos vencidos abiertos</small>
            </div>
            <div className="analytics-gauge">
              <span>Entregables listos</span>
              <strong>{deliverableCompliance}%</strong>
              <small>{deliverablesBlocked} bloqueados</small>
            </div>
          </div>
        </article>

        <article className="surface section-card analytics-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">CARGA POR ROL</span>
              <h3>Trabajo operativo activo</h3>
            </div>
            <Activity size={16} />
          </div>
          {workloadByRole.length === 0 ? (
            <div className="empty-state empty-state--positive">
              <strong>Sin carga abierta por rol</strong>
              <p>No hay tareas pendientes en tu alcance actual.</p>
            </div>
          ) : (
            <div className="analytics-list">
              {workloadByRole.map((item) => (
                <div key={item.role} className="analytics-list__row">
                  <div className="analytics-list__head">
                    <strong>{item.role}</strong>
                    <span>
                      {item.open} activas · {item.blocked} bloqueadas · {item.inReview} en revisión
                    </span>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: `${percentage(item.open, maxRoleLoad)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="analytics-grid">
        <article className="surface section-card analytics-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">TASAS DE PROCESO</span>
              <h3>Devolución, aprobación y retrabajo</h3>
            </div>
            <RefreshCcw size={16} />
          </div>
          <div className="analytics-rate-grid">
            <div className="analytics-rate analytics-rate--sage">
              <span>Aprobación</span>
              <strong>{approvalRate}%</strong>
              <small>{approvedProducts}/{products.length || 0} productos aprobados</small>
            </div>
            <div className="analytics-rate analytics-rate--gold">
              <span>Devolución</span>
              <strong>{returnRate}%</strong>
              <small>{productsInReview} productos en revisión</small>
            </div>
            <div className="analytics-rate analytics-rate--coral">
              <span>Retrabajo</span>
              <strong>{reworkRate}%</strong>
              <small>{observationsPending} pendientes · {observationsInAdjustment} en ajuste</small>
            </div>
          </div>
        </article>

        <article className="surface section-card analytics-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">CALIDAD Y EFICIENCIA</span>
              <h3>Indicadores compuestos</h3>
            </div>
            <FileCheck2 size={16} />
          </div>
          <div className="analytics-quality-grid">
            <div className="analytics-quality-item">
              <span>Pulse calidad</span>
              <strong>{averageQuality}%</strong>
            </div>
            <div className="analytics-quality-item">
              <span>Pulse velocidad</span>
              <strong>{averageVelocity}%</strong>
            </div>
            <div className="analytics-quality-item">
              <span>Pulse alineación</span>
              <strong>{averageAlignment}%</strong>
            </div>
            <div className="analytics-quality-item">
              <span>Resolución de tareas</span>
              <strong>{taskResolutionRate}%</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="analytics-grid analytics-grid--wide">
        <article className="surface section-card analytics-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">PORTAFOLIO</span>
              <h3>Comportamiento general de producción</h3>
            </div>
            <Gauge size={16} />
          </div>
          <div className="analytics-flow-bars">
            {portfolioFlow.map((item) => (
              <div key={item.key} className="analytics-flow-bars__item">
                <div
                  className="analytics-flow-bars__bar"
                  style={{ height: `${percentage(item.approvals, maxApprovalsInWindow)}%` }}
                />
                <strong>{item.approvals}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <p className="field-help">
            Aprobaciones de producto por mes en la ventana reciente.
          </p>
        </article>

        <article className="surface section-card analytics-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">RIESGO OPERATIVO</span>
              <h3>Cursos que requieren atención inmediata</h3>
            </div>
            <AlertTriangle size={16} />
          </div>
          {criticalCourses.length === 0 ? (
            <div className="empty-state empty-state--positive">
              <strong>Sin cursos críticos en este corte</strong>
              <p>No se detectaron señales severas de riesgo en tu cartera visible.</p>
            </div>
          ) : (
            <div className="analytics-risk-list">
              {criticalCourses.map((item) => (
                <div key={item.course.id} className="analytics-risk-row">
                  <div>
                    <strong>{item.course.title}</strong>
                    <p>{item.course.program}</p>
                  </div>
                  <div className="analytics-risk-row__signals">
                    <span>{item.course.status}</span>
                    <span>{item.courseOverdueTasks} vencidas</span>
                    <span>{item.courseAlerts} alertas</span>
                    <span className="is-score">Score {item.riskScore}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="surface analytics-footer-strip">
        <div>
          <CheckCheck size={16} />
          <span>{deliverablesDone} entregables listos</span>
        </div>
        <div>
          <CalendarClock size={16} />
          <span>{milestones.length - completedMilestones} hitos abiertos</span>
        </div>
        <div>
          <AlertTriangle size={16} />
          <span>{visibleAlerts.length} alertas activas</span>
        </div>
        <div>
          <Gauge size={16} />
          <span>Índice eficiencia {efficiencyIndex}%</span>
        </div>
      </section>
    </div>
  );
}
