import { useEffect, useState } from 'react';
import { LibraryBig, NotebookTabs, PackageCheck, Plus, Save, Trash2 } from 'lucide-react';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type {
  AppData,
  LibraryResource,
  LibraryResourceMutationInput,
  Role,
} from '../types.js';
import { getVisibleCourses, getVisibleResources } from '../utils/domain.js';
import { buildCourseScopeLabel, countCoursesForStructure } from '../utils/institutions.js';
import {
  canCreateLibraryResources,
  canDeleteLibraryResources,
  canEditLibraryResource,
} from '../utils/permissions.js';

interface LibraryPageProps {
  role: Role;
  userRole: Role;
  appData: AppData;
  refreshAppData: () => void;
}

type ResourceFilter = 'Todos' | 'Curado' | 'Propio';

function buildResourceForm(courseSlug: string): LibraryResourceMutationInput {
  return {
    title: '',
    kind: 'Curado',
    courseSlug,
    unit: '',
    source: '',
    status: 'Pendiente',
    tags: [],
    summary: '',
  };
}

function makeResourceDrafts(resources: LibraryResource[]) {
  return Object.fromEntries(
    resources.map((resource) => [
      resource.id,
      {
        title: resource.title,
        kind: resource.kind,
        courseSlug: resource.courseSlug,
        unit: resource.unit,
        source: resource.source,
        status: resource.status,
        tags: resource.tags,
        summary: resource.summary,
      },
    ]),
  ) as Record<string, LibraryResourceMutationInput>;
}

function tagsToInput(tags: string[]) {
  return tags.join(', ');
}

function inputToTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function LibraryPage({ role, userRole, appData, refreshAppData }: LibraryPageProps) {
  const { showAlert, showConfirm } = useSystemDialog();
  const [filter, setFilter] = useState<ResourceFilter>('Todos');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const resources = getVisibleResources(appData, role);
  const visibleCourses = getVisibleCourses(appData, role);
  const defaultCourseSlug = visibleCourses[0]?.slug ?? appData.courses[0]?.slug ?? '';
  const courseBySlug = new Map(appData.courses.map((course) => [course.slug, course]));
  const courseOptions = visibleCourses.map((course) => ({
    value: course.slug,
    label: `${course.title} · ${buildCourseScopeLabel(course)}`,
  }));
  const structureSummaries = appData.institution.structures.map((structure) => {
    const linkedCourses = countCoursesForStructure(visibleCourses, structure);
    const linkedResources = resources.filter((resource) => {
      const institution = courseBySlug.get(resource.courseSlug)?.metadata.institution?.trim();
      return institution === structure.institution;
    }).length;

    return {
      structure,
      linkedCourses,
      linkedResources,
    };
  });
  const filteredResources =
    filter === 'Todos'
      ? resources
      : resources.filter((resource) => resource.kind === filter);
  const readyCount = resources.filter((resource) => resource.status === 'Listo').length;
  const canCreate = canCreateLibraryResources(userRole);
  const canEdit = canEditLibraryResource(userRole);
  const canDelete = canDeleteLibraryResources(userRole);
  const [resourceForm, setResourceForm] = useState<LibraryResourceMutationInput>(() =>
    buildResourceForm(defaultCourseSlug),
  );
  const [resourceDrafts, setResourceDrafts] = useState<Record<string, LibraryResourceMutationInput>>(
    () => makeResourceDrafts(resources),
  );
  const [tagInputs, setTagInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(resources.map((resource) => [resource.id, tagsToInput(resource.tags)])),
  );
  const [newTagInput, setNewTagInput] = useState(() => tagsToInput(resourceForm.tags));

  useEffect(() => {
    setResourceForm((current) => ({
      ...buildResourceForm(defaultCourseSlug),
      kind: current.kind,
      status: current.status,
    }));
    setNewTagInput('');
  }, [defaultCourseSlug]);

  useEffect(() => {
    setResourceDrafts(makeResourceDrafts(resources));
    setTagInputs(
      Object.fromEntries(resources.map((resource) => [resource.id, tagsToInput(resource.tags)])),
    );
  }, [appData, role]);

  async function handleCreateResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(resourceForm),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el recurso.');
      }

      refreshAppData();
      setResourceForm(buildResourceForm(defaultCourseSlug));
      setNewTagInput('');
      setIsComposerOpen(false);
    } catch (error) {
      await showAlert({
        title: 'No fue posible crear el recurso',
        message: error instanceof Error ? error.message : 'No fue posible crear el recurso.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveResource(resourceId: string) {
    const draft = resourceDrafts[resourceId];

    if (!draft) {
      return;
    }

    const response = await fetch('/api/resources', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: resourceId,
        ...draft,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      await showAlert({
        title: 'No fue posible guardar el recurso',
        message: payload.error ?? 'No fue posible guardar el recurso.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
      return;
    }

    refreshAppData();
  }

  async function handleDeleteResource(resourceId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar recurso',
      message:
        'El recurso será eliminado del repositorio operativo. Esta acción no se puede deshacer.',
      tone: 'warning',
      confirmLabel: 'Eliminar recurso',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/resources', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: resourceId,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      await showAlert({
        title: 'No fue posible eliminar el recurso',
        message: payload.error ?? 'No fue posible eliminar el recurso.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
      return;
    }

    refreshAppData();
  }

  function updateResourceField<Key extends keyof LibraryResourceMutationInput>(
    key: Key,
    value: LibraryResourceMutationInput[Key],
  ) {
    setResourceForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateResourceDraft<Key extends keyof LibraryResourceMutationInput>(
    resourceId: string,
    key: Key,
    value: LibraryResourceMutationInput[Key],
  ) {
    setResourceDrafts((current) => ({
      ...current,
      [resourceId]: {
        ...current[resourceId],
        [key]: value,
      },
    }));
  }

  return (
    <div className="page-stack library-page">
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Biblioteca</span>
            <h3>Recursos curados y propios</h3>
          </div>
          <LibraryBig size={18} />
        </div>

        <p className="section-lead">
          Esta base concentra piezas de producción interna, referencias académicas y evidencia lista para cada curso.
        </p>

        <div className="metrics-grid metrics-grid--three">
          <div className="mini-metric">
            <span>Recursos visibles</span>
            <strong>{resources.length}</strong>
          </div>
          <div className="mini-metric">
            <span>Listos para integrar</span>
            <strong>{readyCount}</strong>
          </div>
          <div className="mini-metric">
            <span>Tipo dominante</span>
            <strong>
              {resources.filter((resource) => resource.kind === 'Curado').length >=
              resources.filter((resource) => resource.kind === 'Propio').length
                ? 'Curado'
                : 'Propio'}
            </strong>
          </div>
        </div>

        <div className="toolbar">
          {canCreate ? (
            <div className="toolbar-header">
              <button
                type="button"
                className={isComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsComposerOpen((current) => !current)}
              >
                <Plus size={16} />
                <span>{isComposerOpen ? 'Cerrar formulario' : 'Nuevo recurso'}</span>
              </button>
            </div>
          ) : null}

          <div className="chip-row">
            {(['Todos', 'Curado', 'Propio'] as ResourceFilter[]).map((item) => (
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
          <form className="editor-card" onSubmit={handleCreateResource}>
            <div className="editor-card__header">
              <div>
                <span className="eyebrow">Alta rápida</span>
                <h3>Registrar recurso</h3>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Título</span>
                <div className="field__control">
                  <input
                    value={resourceForm.title}
                    onChange={(event) => updateResourceField('title', event.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Tipo</span>
                <div className="field__control">
                  <select
                    value={resourceForm.kind}
                    onChange={(event) =>
                      updateResourceField(
                        'kind',
                        event.target.value as LibraryResourceMutationInput['kind'],
                      )
                    }
                  >
                    {['Curado', 'Propio'].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Curso</span>
                <div className="field__control">
                  <select
                    value={resourceForm.courseSlug}
                    onChange={(event) => updateResourceField('courseSlug', event.target.value)}
                    required
                  >
                    {courseOptions.map((course) => (
                      <option key={course.value} value={course.value}>
                        {course.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Unidad</span>
                <div className="field__control">
                  <input
                    value={resourceForm.unit}
                    onChange={(event) => updateResourceField('unit', event.target.value)}
                    placeholder="Módulo, unidad o bloque"
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Fuente</span>
                <div className="field__control">
                  <input
                    value={resourceForm.source}
                    onChange={(event) => updateResourceField('source', event.target.value)}
                    placeholder="Origen o referencia"
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Estado</span>
                <div className="field__control">
                  <select
                    value={resourceForm.status}
                    onChange={(event) =>
                      updateResourceField(
                        'status',
                        event.target.value as LibraryResourceMutationInput['status'],
                      )
                    }
                  >
                    {['Pendiente', 'En revisión', 'Listo'].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field field--full">
                <span>Tags</span>
                <div className="field__control">
                  <input
                    value={newTagInput}
                    onChange={(event) => {
                      setNewTagInput(event.target.value);
                      updateResourceField('tags', inputToTags(event.target.value));
                    }}
                    placeholder="accesibilidad, video, evaluación"
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Resumen</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={3}
                    value={resourceForm.summary}
                    onChange={(event) => updateResourceField('summary', event.target.value)}
                    required
                  />
                </div>
              </label>
            </div>

            <div className="action-row">
              <button
                type="submit"
                className="cta-button"
                disabled={isSaving || visibleCourses.length === 0}
              >
                <span>{isSaving ? 'Creando…' : 'Guardar recurso'}</span>
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Directorio aplicado</span>
            <h3>Estructuras institucionales vinculadas</h3>
          </div>
          <NotebookTabs size={18} />
        </div>

        <p className="section-lead">
          Biblioteca toma la institución de cada curso para ordenar recursos dentro del directorio académico definido en Gobierno.
        </p>

        {structureSummaries.length === 0 ? (
          <div className="empty-state">
            <strong>No hay estructuras institucionales configuradas</strong>
            <p>Cuando el directorio institucional tenga estructuras, aparecerán aquí con su impacto en biblioteca.</p>
          </div>
        ) : (
          <div className="institution-structure-grid">
            {structureSummaries.map(({ structure, linkedCourses, linkedResources }) => (
              <article key={structure.id} className="surface section-card section-card--compact">
                <div className="institution-structure-card__header">
                  <div>
                    <span className="eyebrow">Institución</span>
                    <h3>{structure.institution}</h3>
                  </div>
                  <span className="badge badge--outline">
                    {structure.pedagogicalGuidelines.length} regla
                    {structure.pedagogicalGuidelines.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="metrics-grid metrics-grid--three">
                  <div className="mini-metric">
                    <span>Cursos visibles</span>
                    <strong>{linkedCourses}</strong>
                  </div>
                  <div className="mini-metric">
                    <span>Recursos visibles</span>
                    <strong>{linkedResources}</strong>
                  </div>
                  <div className="mini-metric">
                    <span>SSO automático</span>
                    <strong>{structure.allowAutoProvisioning ? 'Sí' : 'No'}</strong>
                  </div>
                </div>

                <p className="institution-structure-summary">
                  Tipologías: {structure.courseTypes.join(', ') || 'Sin tipologías'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="insight-grid">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Inventario</span>
              <h3>Repositorio operativo</h3>
            </div>
            <PackageCheck size={18} />
          </div>

          {filteredResources.length === 0 ? (
            <div className="empty-state">
              <strong>No hay recursos en esta vista</strong>
              <p>Cuando se registren piezas nuevas o cambies de filtro, aparecerán aquí.</p>
            </div>
          ) : canEdit ? (
            <div className="list-stack">
              {filteredResources.map((resource) => {
                const draft = resourceDrafts[resource.id];

                if (!draft) {
                  return null;
                }

                return (
                  <div key={resource.id} className="task-editor">
                    <div>
                      <div className="task-editor__header">
                        <span className={resource.kind === 'Curado' ? 'badge badge--ocean' : 'badge badge--sage'}>
                          {resource.kind}
                        </span>
                        <strong>{resource.title}</strong>
                      </div>

                      <div className="form-grid">
                        <label className="field">
                          <span>Título</span>
                          <div className="field__control">
                            <input
                              value={draft.title}
                              onChange={(event) =>
                                updateResourceDraft(resource.id, 'title', event.target.value)
                              }
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Tipo</span>
                          <div className="field__control">
                            <select
                              value={draft.kind}
                              onChange={(event) =>
                                updateResourceDraft(
                                  resource.id,
                                  'kind',
                                  event.target.value as LibraryResourceMutationInput['kind'],
                                )
                              }
                            >
                              {['Curado', 'Propio'].map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Curso</span>
                          <div className="field__control">
                            <select
                              value={draft.courseSlug}
                              onChange={(event) =>
                                updateResourceDraft(resource.id, 'courseSlug', event.target.value)
                              }
                            >
                              {courseOptions.map((course) => (
                                <option key={course.value} value={course.value}>
                                  {course.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Unidad</span>
                          <div className="field__control">
                            <input
                              value={draft.unit}
                              onChange={(event) =>
                                updateResourceDraft(resource.id, 'unit', event.target.value)
                              }
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Fuente</span>
                          <div className="field__control">
                            <input
                              value={draft.source}
                              onChange={(event) =>
                                updateResourceDraft(resource.id, 'source', event.target.value)
                              }
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Estado</span>
                          <div className="field__control">
                            <select
                              value={draft.status}
                              onChange={(event) =>
                                updateResourceDraft(
                                  resource.id,
                                  'status',
                                  event.target.value as LibraryResourceMutationInput['status'],
                                )
                              }
                            >
                              {['Pendiente', 'En revisión', 'Listo'].map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field field--full">
                          <span>Tags</span>
                          <div className="field__control">
                            <input
                              value={tagInputs[resource.id] ?? tagsToInput(draft.tags)}
                              onChange={(event) => {
                                setTagInputs((current) => ({
                                  ...current,
                                  [resource.id]: event.target.value,
                                }));
                                updateResourceDraft(
                                  resource.id,
                                  'tags',
                                  inputToTags(event.target.value),
                                );
                              }}
                            />
                          </div>
                        </label>

                        <label className="field field--full">
                          <span>Resumen</span>
                          <div className="field__control field__control--textarea">
                            <textarea
                              rows={3}
                              value={draft.summary}
                              onChange={(event) =>
                                updateResourceDraft(resource.id, 'summary', event.target.value)
                              }
                            />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="task-editor__sidebar">
                      <div className="task-item__meta">
                        <span>{draft.source}</span>
                        <span>{draft.unit}</span>
                      </div>

                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleSaveResource(resource.id)}
                      >
                        <Save size={16} />
                        <span>Guardar</span>
                      </button>

                      {canDelete ? (
                        <button
                          type="button"
                          className="danger-button danger-button--ghost"
                          onClick={() => void handleDeleteResource(resource.id)}
                        >
                          <Trash2 size={16} />
                          <span>Eliminar</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="resource-grid">
              {filteredResources.map((resource) => (
                <div key={resource.id} className="resource-card">
                  <div className="resource-card__top">
                    <span className={resource.kind === 'Curado' ? 'badge badge--ocean' : 'badge badge--sage'}>
                      {resource.kind}
                    </span>
                    <span className="badge badge--outline">{resource.status}</span>
                  </div>
                  <strong>{resource.title}</strong>
                  <p>{resource.summary}</p>
                  <div className="resource-card__meta">
                    <span>{resource.source}</span>
                    <span>{resource.unit}</span>
                  </div>
                  <div className="tag-row">
                    {resource.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Curaduría</span>
              <h3>Criterios de calidad</h3>
            </div>
            <NotebookTabs size={18} />
          </div>

          <div className="checklist">
            <div className="checklist__item">
              <strong>Pertinencia por unidad</strong>
              <p>Todo recurso debe indicar en qué módulo entra, qué resuelve y qué aprendizaje apoya.</p>
            </div>
            <div className="checklist__item">
              <strong>Trazabilidad visible</strong>
              <p>La fuente, justificación y estado del recurso acompañan el ciclo completo del curso.</p>
            </div>
            <div className="checklist__item">
              <strong>Proyección móvil</strong>
              <p>Las piezas nuevas se evalúan pensando en legibilidad, peso liviano y alternativa accesible.</p>
            </div>
            <div className="checklist__item">
              <strong>Control de versiones</strong>
              <p>Los recursos propios quedan listos para revisión, devolución o reemplazo sin perder historial.</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
