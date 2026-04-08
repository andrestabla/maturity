import {
  AlertCircle,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Headset,
  LifeBuoy,
  LockKeyhole,
  Route,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type {
  AppData,
  AuthUser,
  HelpDeskTicket,
  HelpDeskTicketCategory,
  HelpDeskTicketStatus,
  HelpDeskTicketUpdateInput,
  Role,
} from '../types.js';
import { getVisibleCourses, getVisibleHelpDeskTickets } from '../utils/domain.js';

interface HelpDeskPageProps {
  role: Role;
  viewer: AuthUser;
  appData: AppData;
  isLoading?: boolean;
  refreshAppData: () => void;
}

const ticketStatuses: HelpDeskTicketStatus[] = [
  'Abierto',
  'En análisis',
  'En progreso',
  'Resuelto',
  'Cerrado',
];

const ticketCategories: HelpDeskTicketCategory[] = [
  'Soporte técnico',
  'Funcionalidad del sistema',
  'Flujo de trabajo',
  'Acceso y permisos',
  'Metodología y entregables',
];

const categoryIcons: Record<HelpDeskTicketCategory, typeof Headset> = {
  'Soporte técnico': Wrench,
  'Funcionalidad del sistema': Sparkles,
  'Flujo de trabajo': Route,
  'Acceso y permisos': LockKeyhole,
  'Metodología y entregables': BookOpenCheck,
};

const statusToneClass: Record<HelpDeskTicketStatus, string> = {
  Abierto: 'is-open',
  'En análisis': 'is-triage',
  'En progreso': 'is-progress',
  Resuelto: 'is-resolved',
  Cerrado: 'is-closed',
};

function toHours(start: string, end: string) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }
  return Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
}

function formatDateTime(raw: string) {
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return raw;
  }

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed));
}

function createInitialForm() {
  return {
    title: '',
    description: '',
    category: 'Soporte técnico' as HelpDeskTicketCategory,
    priority: 'Media' as HelpDeskTicket['priority'],
    courseSlug: '',
    stageId: '',
  };
}

function HelpDeskSkeleton() {
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

interface KnowledgeCard {
  id: string;
  title: string;
  category: HelpDeskTicketCategory;
  summary: string;
  promptSeed: string;
}

const enterpriseKnowledgeCards: KnowledgeCard[] = [
  {
    id: 'kb-access',
    title: 'Ruta de acceso y permisos por rol',
    category: 'Acceso y permisos',
    summary:
      'Checklist de desbloqueo: validación de rol activo, membresía institucional y permiso por módulo.',
    promptSeed:
      'Incidencia de acceso. Contexto: usuario sin visualización del módulo o con permisos incompletos. Ya se revisó rol, estado de cuenta y afiliación institucional.',
  },
  {
    id: 'kb-workflow',
    title: 'Flujo operativo por etapas',
    category: 'Flujo de trabajo',
    summary:
      'Mapa de handoffs entre microcurrículo, arquitectura, planeación, escritura, validación y QA.',
    promptSeed:
      'Duda de flujo de trabajo. Contexto: el equipo necesita confirmar dependencias, handoff y criterio de cierre entre etapas.',
  },
  {
    id: 'kb-writing',
    title: 'Buenas prácticas de escritura por entregable',
    category: 'Metodología y entregables',
    summary:
      'Guía institucional para estructurar productos, evitar retrabajo y asegurar trazabilidad de cambios.',
    promptSeed:
      'Consulta metodológica sobre entregables. Contexto: se requiere claridad para estructurar producto, criterios de calidad y evidencia mínima.',
  },
  {
    id: 'kb-tech',
    title: 'Diagnóstico técnico inicial',
    category: 'Soporte técnico',
    summary:
      'Secuencia recomendada para errores de carga, procesamiento y guardado sin detener operación.',
    promptSeed:
      'Solicitud de soporte técnico. Contexto: comportamiento inestable de la plataforma durante operación del curso.',
  },
];

export function HelpDeskPage({
  role,
  viewer,
  appData,
  isLoading = false,
  refreshAppData,
}: HelpDeskPageProps) {
  const { showAlert } = useSystemDialog();
  const [form, setForm] = useState(createInitialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [ticketDrafts, setTicketDrafts] = useState<Record<string, Partial<HelpDeskTicketUpdateInput>>>({});
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  if (isLoading) {
    return <HelpDeskSkeleton />;
  }

  const canManageAll = role === 'Administrador' || role === 'Coordinador';
  const visibleTickets = getVisibleHelpDeskTickets(appData, role, viewer);
  const visibleCourses = getVisibleCourses(appData, role, viewer);
  const assignableUsers = appData.users.filter((user) => user.status !== 'Inactivo');

  const openTickets = visibleTickets.filter((ticket) =>
    ['Abierto', 'En análisis', 'En progreso'].includes(ticket.status),
  );
  const resolvedTickets = visibleTickets.filter((ticket) =>
    ['Resuelto', 'Cerrado'].includes(ticket.status),
  );
  const avgResolutionHours = (() => {
    const samples = resolvedTickets
      .map((ticket) => toHours(ticket.createdAt, ticket.updatedAt))
      .filter((hours): hours is number => typeof hours === 'number');
    if (samples.length === 0) {
      return 0;
    }
    return Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
  })();
  const slaHits = resolvedTickets.filter((ticket) => {
    const hours = toHours(ticket.createdAt, ticket.updatedAt);
    return typeof hours === 'number' && hours <= 48;
  }).length;
  const slaRate = resolvedTickets.length > 0 ? Math.round((slaHits / resolvedTickets.length) * 100) : 0;
  const unresolvedAccessIssues = openTickets.filter(
    (ticket) => ticket.category === 'Acceso y permisos',
  ).length;

  const ticketsByStatus = ticketStatuses.map((status) => ({
    status,
    tickets: visibleTickets.filter((ticket) => ticket.status === status),
  }));

  function getTicketDraft(ticket: HelpDeskTicket) {
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      courseSlug: ticket.courseSlug ?? '',
      stageId: ticket.stageId ?? '',
      assigneeId: ticket.assigneeId ?? '',
      assigneeName: ticket.assigneeName ?? '',
      resolutionSummary: ticket.resolutionSummary ?? '',
      ...(ticketDrafts[ticket.id] ?? {}),
    };
  }

  function updateTicketDraft(
    ticketId: string,
    updater: (current: Partial<HelpDeskTicketUpdateInput>) => Partial<HelpDeskTicketUpdateInput>,
  ) {
    setTicketDrafts((current) => ({
      ...current,
      [ticketId]: updater(current[ticketId] ?? {}),
    }));
  }

  function applyKnowledgeTemplate(card: KnowledgeCard) {
    setForm((current) => ({
      ...current,
      category: card.category,
      title: card.title,
      description: card.promptSeed,
    }));
  }

  async function handleCreateTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setTicketError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/helpdesk', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          courseSlug: form.courseSlug || undefined,
          stageId: form.stageId || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'No fue posible crear la solicitud en la mesa de ayuda.');
      }

      setForm(createInitialForm());
      refreshAppData();
      void showAlert({
        title: 'Solicitud registrada',
        message: 'Tu ticket quedó en la mesa de ayuda y ya está disponible para seguimiento.',
        tone: 'success',
      });
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'No fue posible crear la solicitud.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveTicket(ticket: HelpDeskTicket) {
    const draft = getTicketDraft(ticket);
    const isRequester = viewer.id === ticket.requesterId;
    const isAssignee = viewer.id === ticket.assigneeId;
    const canManageWorkflow = canManageAll || isAssignee;

    const payload: Partial<HelpDeskTicketUpdateInput> = canManageWorkflow
      ? {
          id: ticket.id,
          title: draft.title,
          description: draft.description,
          category: draft.category,
          status: draft.status,
          priority: draft.priority,
          courseSlug: draft.courseSlug || undefined,
          stageId: draft.stageId
            ? (draft.stageId as HelpDeskTicket['stageId'])
            : undefined,
          assigneeId: draft.assigneeId || '',
          assigneeName: draft.assigneeName || '',
          resolutionSummary: draft.resolutionSummary || '',
        }
      : {
          id: ticket.id,
          title: draft.title,
          description: draft.description,
          category: draft.category,
          priority: draft.priority,
          courseSlug: draft.courseSlug || undefined,
          stageId: draft.stageId
            ? (draft.stageId as HelpDeskTicket['stageId'])
            : undefined,
          status: isRequester && draft.status === 'Cerrado' ? 'Cerrado' : undefined,
        };

    setTicketError(null);
    setSavingTicketId(ticket.id);

    try {
      const response = await fetch('/api/helpdesk', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? 'No fue posible actualizar el ticket.');
      }

      setTicketDrafts((current) => {
        const next = { ...current };
        delete next[ticket.id];
        return next;
      });
      refreshAppData();
      void showAlert({
        title: 'Ticket actualizado',
        message: `Se actualizó el caso "${ticket.title}".`,
        tone: 'success',
      });
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : 'No fue posible actualizar el ticket.');
    } finally {
      setSavingTicketId(null);
    }
  }

  return (
    <div className="page-stack helpdesk-page">
      <section className="surface helpdesk-hero">
        <div className="section-heading section-heading--control">
          <div>
            <span className="eyebrow">MESA DE AYUDA</span>
            <h3>Soporte funcional, técnico y metodológico</h3>
          </div>
          <span className="badge badge--outline">{role}</span>
        </div>
        <p className="section-lead">
          Centraliza incidentes, dudas y requerimientos para asegurar continuidad operativa.
          Canaliza atención con trazabilidad de estado, responsable y resolución.
        </p>
        <div className="helpdesk-kpi-grid">
          <article className="helpdesk-kpi helpdesk-kpi--ocean">
            <Headset size={16} />
            <span>Casos activos</span>
            <strong>{openTickets.length}</strong>
            <small>{visibleTickets.length} totales</small>
          </article>
          <article className="helpdesk-kpi helpdesk-kpi--sage">
            <Clock3 size={16} />
            <span>Tiempo medio de resolución</span>
            <strong>{avgResolutionHours}h</strong>
            <small>{resolvedTickets.length} casos cerrados</small>
          </article>
          <article className="helpdesk-kpi helpdesk-kpi--gold">
            <BadgeCheck size={16} />
            <span>Cumplimiento SLA 48h</span>
            <strong>{slaRate}%</strong>
            <small>{slaHits} dentro de ventana</small>
          </article>
          <article className="helpdesk-kpi helpdesk-kpi--coral">
            <AlertCircle size={16} />
            <span>Riesgo de fricción</span>
            <strong>{unresolvedAccessIssues}</strong>
            <small>acceso/permisos abiertos</small>
          </article>
        </div>
      </section>

      <section className="helpdesk-layout">
        <article className="surface section-card helpdesk-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">NUEVA SOLICITUD</span>
              <h3>Abrir caso en mesa de ayuda</h3>
            </div>
            <LifeBuoy size={16} />
          </div>
          <form className="helpdesk-form" onSubmit={handleCreateTicket}>
            <label className="field">
              <span>Título del caso</span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Ej: Error al guardar en escritura"
                required
              />
            </label>
            <label className="field">
              <span>Descripción</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={5}
                placeholder="Describe qué ocurre, cuándo ocurre y el impacto operativo."
                required
              />
            </label>
            <div className="helpdesk-form__grid">
              <label className="field">
                <span>Categoría</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as HelpDeskTicketCategory,
                    }))
                  }
                >
                  {ticketCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Prioridad</span>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as HelpDeskTicket['priority'],
                    }))
                  }
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </label>
              <label className="field">
                <span>Curso (opcional)</span>
                <select
                  value={form.courseSlug}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, courseSlug: event.target.value }))
                  }
                >
                  <option value="">General / Plataforma</option>
                  {visibleCourses.map((course) => (
                    <option key={course.id} value={course.slug}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Etapa (opcional)</span>
                <select
                  value={form.stageId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, stageId: event.target.value }))
                  }
                >
                  <option value="">Sin etapa específica</option>
                  {appData.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {createError ? <p className="field-help field-help--error">{createError}</p> : null}
            <button type="submit" className="cta-button" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando…' : 'Registrar solicitud'}
            </button>
          </form>
        </article>

        <article className="surface section-card helpdesk-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">CONOCIMIENTOS DE LA EMPRESA</span>
              <h3>Playbooks para reducir fricción</h3>
            </div>
            <BookOpenCheck size={16} />
          </div>
          <div className="helpdesk-knowledge-list">
            {enterpriseKnowledgeCards.map((card) => {
              const Icon = categoryIcons[card.category];
              return (
                <article key={card.id} className="helpdesk-knowledge-card">
                  <div className="helpdesk-knowledge-card__head">
                    <Icon size={15} />
                    <span>{card.category}</span>
                  </div>
                  <strong>{card.title}</strong>
                  <p>{card.summary}</p>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => applyKnowledgeTemplate(card)}
                  >
                    Usar como plantilla
                  </button>
                </article>
              );
            })}
          </div>
        </article>
      </section>

      {ticketError ? (
        <section className="surface section-card">
          <p className="field-help field-help--error">{ticketError}</p>
        </section>
      ) : null}

      <section className="helpdesk-board">
        {ticketsByStatus.map((column) => (
          <article key={column.status} className="surface section-card helpdesk-column">
            <div className="helpdesk-column__head">
              <h4>{column.status}</h4>
              <span className={`badge badge--outline ${statusToneClass[column.status]}`}>
                {column.tickets.length}
              </span>
            </div>
            {column.tickets.length === 0 ? (
              <div className="empty-state">
                <strong>Sin casos</strong>
                <p>No hay tickets en este estado.</p>
              </div>
            ) : (
              <div className="helpdesk-ticket-list">
                {column.tickets.map((ticket) => {
                  const draft = getTicketDraft(ticket);
                  const isRequester = viewer.id === ticket.requesterId;
                  const isAssignee = viewer.id === ticket.assigneeId;
                  const canOperate = canManageAll || isRequester || isAssignee;
                  const canManageWorkflow = canManageAll || isAssignee;
                  const statusOptions = canManageWorkflow
                    ? ticketStatuses
                    : isRequester
                      ? ['Abierto', 'Cerrado']
                      : [ticket.status];
                  const CategoryIcon = categoryIcons[ticket.category];

                  return (
                    <article key={ticket.id} className="helpdesk-ticket-card">
                      <div className="helpdesk-ticket-card__head">
                        <div>
                          <span className="eyebrow">#{ticket.id.slice(0, 8)}</span>
                          <h5>{ticket.title}</h5>
                        </div>
                        <span className={`badge badge--outline ${statusToneClass[ticket.status]}`}>
                          {ticket.priority}
                        </span>
                      </div>

                      <div className="helpdesk-ticket-card__meta">
                        <span>
                          <CategoryIcon size={14} />
                          {ticket.category}
                        </span>
                        <span>
                          <Clock3 size={14} />
                          {formatDateTime(ticket.updatedAt)}
                        </span>
                        <span>
                          <CheckCircle2 size={14} />
                          {ticket.requesterName}
                        </span>
                      </div>

                      <label className="field">
                        <span>Descripción</span>
                        <textarea
                          value={draft.description ?? ''}
                          disabled={!canOperate}
                          rows={4}
                          onChange={(event) =>
                            updateTicketDraft(ticket.id, (current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <div className="helpdesk-ticket-card__grid">
                        <label className="field">
                          <span>Estado</span>
                          <select
                            value={draft.status ?? ticket.status}
                            disabled={!canOperate}
                            onChange={(event) =>
                              updateTicketDraft(ticket.id, (current) => ({
                                ...current,
                                status: event.target.value as HelpDeskTicketStatus,
                              }))
                            }
                          >
                            {statusOptions.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {statusOption}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span>Responsable</span>
                          <select
                            value={draft.assigneeId ?? ''}
                            disabled={!canManageAll}
                            onChange={(event) => {
                              const assignee = assignableUsers.find(
                                (user) => user.id === event.target.value,
                              );
                              updateTicketDraft(ticket.id, (current) => ({
                                ...current,
                                assigneeId: event.target.value,
                                assigneeName: assignee?.name ?? '',
                              }));
                            }}
                          >
                            <option value="">Sin asignar</option>
                            {assignableUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="field">
                        <span>Resolución / nota de cierre</span>
                        <textarea
                          value={draft.resolutionSummary ?? ''}
                          disabled={!canManageWorkflow}
                          rows={3}
                          onChange={(event) =>
                            updateTicketDraft(ticket.id, (current) => ({
                              ...current,
                              resolutionSummary: event.target.value,
                            }))
                          }
                          placeholder="Describe acción tomada, causa raíz y siguiente paso."
                        />
                      </label>

                      {canOperate ? (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={savingTicketId === ticket.id}
                          onClick={() => void handleSaveTicket(ticket)}
                        >
                          {savingTicketId === ticket.id ? 'Guardando…' : 'Guardar ticket'}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
