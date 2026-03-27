import { useState } from 'react';
import { LibraryBig, NotebookTabs, PackageCheck } from 'lucide-react';
import type { AppData, Role } from '../types.js';
import { getVisibleResources } from '../utils/domain.js';

interface LibraryPageProps {
  role: Role;
  appData: AppData;
}

type ResourceFilter = 'Todos' | 'Curado' | 'Propio';

export function LibraryPage({ role, appData }: LibraryPageProps) {
  const [filter, setFilter] = useState<ResourceFilter>('Todos');
  const resources = getVisibleResources(appData, role);
  const filteredResources =
    filter === 'Todos'
      ? resources
      : resources.filter((resource) => resource.kind === filter);

  const readyCount = resources.filter((resource) => resource.status === 'Listo').length;

  return (
    <div className="page-stack">
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
            <strong>{resources.filter((resource) => resource.kind === 'Curado').length >= resources.filter((resource) => resource.kind === 'Propio').length ? 'Curado' : 'Propio'}</strong>
          </div>
        </div>

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
